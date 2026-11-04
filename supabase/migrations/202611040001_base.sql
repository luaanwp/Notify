-- Primeira entrega manual. O payload será normalizado ao implementar o coletor.
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create table public.memberships (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('admin','editor','reader')),
  primary key (workspace_id,user_id)
);
create table public.events (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.event_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events,
  workspace_id uuid not null references public.workspaces,
  actor uuid not null references auth.users,
  previous_payload jsonb,
  next_payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.events enable row level security;
alter table public.event_audit enable row level security;
create policy own_membership on public.memberships for select to authenticated using(user_id = auth.uid());
create policy member_workspace on public.workspaces for select to authenticated using(exists(select 1 from public.memberships m where m.workspace_id = id and m.user_id = auth.uid()));
create policy member_events on public.events for select to authenticated using(exists(select 1 from public.memberships m where m.workspace_id = events.workspace_id and m.user_id = auth.uid()));
create policy member_audit on public.event_audit for select to authenticated using(exists(select 1 from public.memberships m where m.workspace_id = event_audit.workspace_id and m.user_id = auth.uid()));
-- Escrita somente pela função, que registra auditoria imutável na mesma transação.
create function public.save_event(target_workspace uuid, event_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare existing public.events; event_id uuid;
begin
  if not exists(select 1 from public.memberships where workspace_id = target_workspace and user_id = auth.uid() and role in ('admin','editor')) then
    raise exception 'Acesso de edição não autorizado';
  end if;
  if length(trim(event_payload->>'name')) is null or length(trim(event_payload->>'name')) = 0 then raise exception 'Nome obrigatório'; end if;
  if not coalesce((event_payload->>'url') ~ '^https?://', false) then raise exception 'URL inválida'; end if;
  event_id := (event_payload->>'id')::uuid;
  perform pg_advisory_xact_lock(hashtext(event_id::text));
  select * into existing from public.events where id = event_id for update;
  if found and existing.workspace_id <> target_workspace then raise exception 'Evento não pertence à equipe'; end if;
  insert into public.events(id,workspace_id,payload) values(event_id,target_workspace,event_payload)
    on conflict(id) do update set payload = excluded.payload, updated_at = now();
  insert into public.event_audit(event_id,workspace_id,actor,previous_payload,next_payload)
    values(event_id,target_workspace,auth.uid(),existing.payload,event_payload);
end;
$$;
revoke all on function public.save_event(uuid,jsonb) from public;
grant execute on function public.save_event(uuid,jsonb) to authenticated;
