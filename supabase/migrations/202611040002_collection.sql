-- Base de coleta. Nunca deriva resultado oficial de calendário ou de mudança textual.
alter table public.events add column revision integer not null default 1;
grant select on public.workspaces, public.memberships, public.events, public.event_audit to authenticated;

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  workspace_id uuid not null references public.workspaces,
  url text not null check(url ~ '^https?://'),
  paused boolean not null default false,
  health text not null default 'pending' check(health in ('pending','healthy','review','error')),
  last_success_at timestamptz,
  last_checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  last_content_hash text,
  last_error text,
  failure_count integer not null default 0,
  review_pending boolean not null default false,
  requested_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  unique(event_id,url)
);
create index source_due on public.sources(next_check_at) where not paused;
create index source_event on public.sources(event_id);
create table public.source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources on delete cascade,
  workspace_id uuid not null references public.workspaces,
  content_hash text not null,
  raw_hash text not null,
  text_content text not null,
  documents jsonb not null default '[]',
  pages jsonb,
  needs_review boolean not null default false,
  storage_path text not null,
  effective_url text not null,
  content_type text not null,
  byte_length integer not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(source_id,content_hash)
);
create table public.check_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources on delete cascade,
  workspace_id uuid not null references public.workspaces,
  lease_token uuid not null unique,
  outcome text not null check(outcome in ('baseline','changed','unchanged','error')),
  version_id uuid references public.source_versions,
  error_message text,
  elapsed_ms integer not null,
  created_at timestamptz not null default now()
);
create table public.source_reviews (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources,
  version_id uuid not null references public.source_versions,
  workspace_id uuid not null references public.workspaces,
  actor uuid not null references auth.users,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.sources enable row level security;
alter table public.source_versions enable row level security;
alter table public.check_runs enable row level security;
alter table public.source_reviews enable row level security;
create policy member_sources on public.sources for select to authenticated using(exists(select 1 from public.memberships m where m.workspace_id = sources.workspace_id and m.user_id = auth.uid()));
create policy member_versions on public.source_versions for select to authenticated using(exists(select 1 from public.memberships m where m.workspace_id = source_versions.workspace_id and m.user_id = auth.uid()));
create policy member_runs on public.check_runs for select to authenticated using(exists(select 1 from public.memberships m where m.workspace_id = check_runs.workspace_id and m.user_id = auth.uid()));
create policy member_source_reviews on public.source_reviews for select to authenticated using(exists(select 1 from public.memberships m where m.workspace_id = source_reviews.workspace_id and m.user_id = auth.uid()));
revoke all on public.source_reviews from anon,authenticated;
grant select on public.source_reviews to authenticated;
revoke all on public.sources, public.source_versions, public.check_runs from anon, authenticated;
grant select on public.sources, public.source_versions, public.check_runs to authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values('source-evidence','source-evidence',false,2000000);
create policy member_evidence on storage.objects for select to authenticated using(
  bucket_id = 'source-evidence' and exists(select 1 from public.memberships m where m.workspace_id::text = split_part(name,'/',1) and m.user_id = auth.uid())
);

-- Substitui a escrita inicial por compare-and-swap, evitando perda silenciosa de edições.
drop function public.save_event(uuid,jsonb);
create function public.save_event(target_workspace uuid, event_payload jsonb, expected_revision integer default 0) returns integer
language plpgsql security definer set search_path = '' as $$
declare existing public.events; event_id uuid; next_revision integer;
begin
  if not exists(select 1 from public.memberships where workspace_id = target_workspace and user_id = auth.uid() and role in ('admin','editor')) then raise exception 'Acesso de edição não autorizado'; end if;
  if coalesce(length(trim(event_payload->>'name')),0) = 0 or length(event_payload->>'name') > 200 then raise exception 'Nome inválido'; end if;
  if not coalesce((event_payload->>'url') ~ '^https?://[^\s/@]+', false) then raise exception 'URL inválida'; end if;
  if jsonb_typeof(event_payload->'stages') is distinct from 'array' or jsonb_typeof(event_payload->'history') is distinct from 'array' then raise exception 'Etapas e histórico inválidos'; end if;
  if octet_length(event_payload::text) > 500000 then raise exception 'Cadastro excede limite'; end if;
  event_id := (event_payload->>'id')::uuid;
  perform pg_advisory_xact_lock(hashtext(event_id::text));
  select * into existing from public.events where id = event_id for update;
  if found then
    if existing.workspace_id <> target_workspace then raise exception 'Evento não pertence à equipe'; end if;
    if existing.revision is distinct from expected_revision then raise exception 'Esta oportunidade foi alterada por outra pessoa. Recarregue os dados antes de salvar.'; end if;
    if exists(select 1 from public.sources where sources.event_id = existing.id and sources.url = existing.payload->>'url') and existing.payload->>'url' <> event_payload->>'url' then raise exception 'Atualize a fonte monitorada separadamente'; end if;
  elsif expected_revision is distinct from 0 then raise exception 'Oportunidade não encontrada';
  end if;
  next_revision := coalesce(existing.revision,0) + 1;
  insert into public.events(id,workspace_id,payload,revision) values(event_id,target_workspace,event_payload - 'revision',next_revision)
    on conflict(id) do update set payload = excluded.payload, revision = excluded.revision, updated_at = now();
  insert into public.event_audit(event_id,workspace_id,actor,previous_payload,next_payload) values(event_id,target_workspace,auth.uid(),existing.payload,event_payload - 'revision');
  return next_revision;
end;
$$;
revoke all on function public.save_event(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.save_event(uuid,jsonb,integer) to authenticated;

create function public.manage_source(target_event uuid, source_url text, action text) returns void
language plpgsql security definer set search_path = '' as $$
declare item public.events;
begin
  select * into item from public.events where id = target_event;
  if not exists(select 1 from public.memberships where workspace_id = item.workspace_id and user_id = auth.uid() and role in ('admin','editor')) then raise exception 'Acesso de edição não autorizado'; end if;
  if action = 'register' then
    if not coalesce(source_url ~ '^https?://[^\s/@]+', false) or length(source_url) > 2048 then raise exception 'URL inválida'; end if;
    perform pg_advisory_xact_lock(hashtext(target_event::text));
    if (select count(*) from public.sources where event_id = target_event) >= 3 then raise exception 'Limite do piloto: três fontes por oportunidade'; end if;
    insert into public.sources(event_id,workspace_id,url) values(target_event,item.workspace_id,source_url) on conflict(event_id,url) do nothing;
  elsif action = 'request' then
    update public.sources set requested_at = now(), next_check_at = least(next_check_at,now()) where event_id = target_event and url = source_url and not paused and (requested_at is null or requested_at < now() - interval '1 hour') and (last_checked_at is null or last_checked_at < now() - interval '1 hour');
  elsif action in ('pause','resume') then
    update public.sources set paused = (action = 'pause'), lease_token = null, lease_until = null, next_check_at = now() where event_id = target_event and url = source_url;
  else raise exception 'Ação inválida'; end if;
end;
$$;
revoke all on function public.manage_source(uuid,text,text) from public,anon,authenticated;
grant execute on function public.manage_source(uuid,text,text) to authenticated;

create function public.acknowledge_source(source_uuid uuid, reviewed_hash text, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare item public.sources; version_uuid uuid;
begin
  select * into item from public.sources where id = source_uuid for update;
  if not exists(select 1 from public.memberships where workspace_id = item.workspace_id and user_id = auth.uid() and role in ('admin','editor')) then raise exception 'Acesso de edição não autorizado'; end if;
  if item.last_content_hash is distinct from reviewed_hash or reviewed_hash is null then raise exception 'A fonte mudou. Recarregue as evidências antes de confirmar.'; end if;
  if coalesce(length(trim(reason)),0) < 5 or length(reason) > 1000 then raise exception 'Descreva a conferência em 5 a 1000 caracteres'; end if;
  select id into version_uuid from public.source_versions where source_id = source_uuid and content_hash = reviewed_hash;
  if not found then raise exception 'Versão não encontrada'; end if;
  insert into public.source_reviews(source_id,version_id,workspace_id,actor,reason) values(source_uuid,version_uuid,item.workspace_id,auth.uid(),trim(reason));
  update public.sources set review_pending = false, health = case when health = 'error' then 'error' else 'healthy' end where id = source_uuid;
end;
$$;
revoke all on function public.acknowledge_source(uuid,text,text) from public,anon,authenticated;
grant execute on function public.acknowledge_source(uuid,text,text) to authenticated;

create function public.claim_source() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item public.sources; token uuid;
begin
  -- Logs operacionais expiram; versões que sustentam evidências são preservadas.
  delete from public.check_runs where created_at < now() - interval '30 days';
  -- Teto conservador do piloto. Atingir o limite deixa fontes pendentes, sem upgrade.
  if (select coalesce(sum(byte_length),0) from public.source_versions) >= 100000000 then return null; end if;
  select * into item from public.sources where not paused and next_check_at <= now() and (lease_until is null or lease_until < now())
    and (select count(*) from public.source_versions v where v.source_id = sources.id) < 50
    order by requested_at nulls last, next_check_at for update skip locked limit 1;
  if not found then return null; end if;
  token := gen_random_uuid();
  update public.sources set lease_token = token, lease_until = now() + interval '5 minutes' where id = item.id;
  return jsonb_build_object('id',item.id,'workspace_id',item.workspace_id,'url',item.url,'lease_token',token,'last_content_hash',item.last_content_hash);
end;
$$;
revoke all on function public.claim_source() from public,anon,authenticated;
grant execute on function public.claim_source() to service_role;

create function public.complete_source_check(source_id uuid, lease uuid, snapshot jsonb, error_message text, elapsed_ms integer) returns text
language plpgsql security definer set search_path = '' as $$
declare item public.sources; version_uuid uuid; outcome text; count_fail integer;
begin
  select * into item from public.sources where id = source_id for update;
  if not found or item.lease_token is distinct from lease or item.paused then return 'discarded'; end if;
  if error_message is not null then
    count_fail := least(item.failure_count + 1,8);
    update public.sources set health = 'error', last_error = left(error_message,500), failure_count = count_fail, last_checked_at = now(),
      next_check_at = now() + make_interval(hours => least(6 * power(2,count_fail - 1)::integer,48)), requested_at = null, lease_token = null, lease_until = null where id = source_id;
    outcome := 'error';
  else
    if snapshot is null or coalesce(length(snapshot->>'content_hash'),0) <> 64 or length(snapshot->>'text') > 200000 then raise exception 'Snapshot inválido'; end if;
    if snapshot->>'storage_path' not like item.workspace_id::text || '/' || item.id::text || '/%' then raise exception 'Evidência fora do escopo'; end if;
    outcome := case when item.last_content_hash is null then 'baseline' when item.last_content_hash = snapshot->>'content_hash' then 'unchanged' else 'changed' end;
    insert into public.source_versions(source_id,workspace_id,content_hash,raw_hash,text_content,documents,pages,needs_review,storage_path,effective_url,content_type,byte_length)
      values(item.id,item.workspace_id,snapshot->>'content_hash',snapshot->>'raw_hash',snapshot->>'text',snapshot->'documents',snapshot->'pages',(snapshot->>'needs_review')::boolean,snapshot->>'storage_path',snapshot->>'effective_url',snapshot->>'content_type',(snapshot->>'byte_length')::integer)
      on conflict on constraint source_versions_source_id_content_hash_key do update set last_seen_at = now()
      returning id into version_uuid;
    update public.sources set last_content_hash = snapshot->>'content_hash', last_success_at = now(), last_checked_at = now(), last_error = null, failure_count = 0,
      review_pending = review_pending or outcome <> 'unchanged', health = case when review_pending or outcome <> 'unchanged' then 'review' else 'healthy' end,
      next_check_at = now() + interval '6 hours', requested_at = null, lease_token = null, lease_until = null where id = item.id;
  end if;
  insert into public.check_runs(source_id,workspace_id,lease_token,outcome,version_id,error_message,elapsed_ms)
    values(item.id,item.workspace_id,lease,outcome,version_uuid,left(error_message,500),greatest(0,elapsed_ms));
  return outcome;
end;
$$;
revoke all on function public.complete_source_check(uuid,uuid,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.complete_source_check(uuid,uuid,jsonb,text,integer) to service_role;
