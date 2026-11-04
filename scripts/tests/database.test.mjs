import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const teamA = "11111111-1111-4111-8111-111111111111",
  teamB = "22222222-2222-4222-8222-222222222222";
const editor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  reader = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  outsider = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const eventId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const payload = {
  id: eventId,
  name: "Fixture de teste",
  url: "https://official.example/",
  organization: "Teste",
  edition: "2027",
  owner: "",
  participation: "Interessados",
  favorite: false,
  stages: [],
  history: [],
  created_at: "2026-11-04T12:00:00Z",
};
test("migrações, permissões e retomada transacional", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,service_role;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated; grant select on storage.objects to authenticated;
      alter default privileges in schema public grant select on tables to authenticated;`);
    for (const file of ["202611040001_base.sql", "202611040002_collection.sql"])
      await db.exec(
        await readFile(
          new URL(`../../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.query("insert into auth.users values ($1),($2),($3)", [
      editor,
      reader,
      outsider,
    ]);
    await db.query("insert into workspaces(id,name) values ($1,'A'),($2,'B')", [
      teamA,
      teamB,
    ]);
    await db.query(
      "insert into memberships values ($1,$2,'editor'),($1,$3,'reader'),($4,$5,'editor')",
      [teamA, editor, reader, teamB, outsider],
    );
    const login = async (id) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    const save = (revision, data = payload, team = teamA) =>
      db.query("select save_event($1,$2::jsonb,$3) as revision", [
        team,
        JSON.stringify(data),
        revision,
      ]);
    let source, lease, snapshot;
    await t.test(
      "editor grava, conflito não sobrescreve e auditoria é imutável",
      async () => {
        await login(editor);
        assert.equal((await save(0)).rows[0].revision, 1);
        await assert.rejects(save(0), /alterada por outra pessoa/);
        await assert.rejects(save(null), /alterada por outra pessoa/);
        assert.equal(
          (await db.query("select count(*)::int as n from event_audit")).rows[0]
            .n,
          1,
        );
        await assert.rejects(db.query("update events set payload = '{}'"));
        await assert.rejects(db.exec("delete from event_audit"));
      },
    );
    await t.test(
      "leitor consulta mas não grava; outra equipe não lê nem altera",
      async () => {
        await login(reader);
        assert.equal((await db.query("select * from events")).rows.length, 1);
        await assert.rejects(save(1), /não autorizado/);
        await login(outsider);
        assert.equal((await db.query("select * from events")).rows.length, 0);
        await assert.rejects(save(1, payload, teamB), /não pertence/);
        await assert.rejects(
          db.exec("select claim_source()"),
          /permission denied/,
        );
      },
    );
    await t.test("fonte registrada pertence à equipe do evento", async () => {
      await login(editor);
      await db.query("select manage_source($1,$2,'register')", [
        eventId,
        payload.url,
      ]);
      source = (await db.query("select * from sources")).rows[0];
      await login(outsider);
      assert.equal((await db.query("select * from sources")).rows.length, 0);
    });
    const claim = async () => {
      await db.exec("reset role");
      await db.exec(
        "update sources set next_check_at = now() - interval '1 second'",
      );
      return (await db.query("select claim_source() as source")).rows[0].source;
    };
    const complete = (token, version = snapshot, error = null) =>
      db.query(
        "select complete_source_check($1,$2,$3::jsonb,$4,10) as outcome",
        [source.id, token, version && JSON.stringify(version), error],
      );
    await t.test(
      "primeira coleta salva evidência e não altera etapa",
      async () => {
        lease = (await claim()).lease_token;
        snapshot = {
          content_hash: "a".repeat(64),
          raw_hash: "b".repeat(64),
          text: "Prazo previsto para hoje",
          documents: [],
          pages: null,
          needs_review: false,
          storage_path: `${teamA}/${source.id}/${"b".repeat(64)}`,
          effective_url: payload.url,
          content_type: "text/html",
          byte_length: 100,
        };
        assert.equal((await complete(lease)).rows[0].outcome, "baseline");
        assert.equal(
          (await db.query("select payload from events")).rows[0].payload.stages
            .length,
          0,
        );
        assert.equal(
          (await db.query("select review_pending from sources")).rows[0]
            .review_pending,
          true,
        );
      },
    );
    await t.test(
      "repetir conclusão não duplica execução nem versão",
      async () => {
        assert.equal((await complete(lease)).rows[0].outcome, "discarded");
        lease = (await claim()).lease_token;
        assert.equal((await complete(lease)).rows[0].outcome, "unchanged");
        assert.equal(
          (await db.query("select count(*)::int as n from source_versions"))
            .rows[0].n,
          1,
        );
        assert.equal(
          (await db.query("select count(*)::int as n from check_runs")).rows[0]
            .n,
          2,
        );
      },
    );
    await t.test(
      "confirmação exige versão atual e registra autoria",
      async () => {
        await login(editor);
        await assert.rejects(
          db.query("select acknowledge_source($1,$2,$3)", [
            source.id,
            "x".repeat(64),
            "Conferido manualmente",
          ]),
          /fonte mudou/,
        );
        await db.query("select acknowledge_source($1,$2,$3)", [
          source.id,
          snapshot.content_hash,
          "Conferido manualmente; etapas permanecem inalteradas",
        ]);
        assert.equal(
          (await db.query("select review_pending from sources")).rows[0]
            .review_pending,
          false,
        );
        assert.equal(
          (await db.query("select actor from source_reviews")).rows[0].actor,
          editor,
        );
      },
    );
    await t.test(
      "conteúdo alterado preserva versão anterior e reabre revisão",
      async () => {
        lease = (await claim()).lease_token;
        snapshot = {
          ...snapshot,
          content_hash: "c".repeat(64),
          text: "Prazo prorrogado; conferir publicação",
        };
        assert.equal((await complete(lease)).rows[0].outcome, "changed");
        assert.equal(
          (await db.query("select count(*)::int as n from source_versions"))
            .rows[0].n,
          2,
        );
        assert.equal(
          (await db.query("select review_pending from sources")).rows[0]
            .review_pending,
          true,
        );
      },
    );
    await t.test("erro mantém versão conhecida e último sucesso", async () => {
      const before = (
        await db.query("select last_success_at,last_content_hash from sources")
      ).rows[0];
      lease = (await claim()).lease_token;
      await complete(lease, null, "Fonte retornou HTTP 429.");
      const after = (await db.query("select * from sources")).rows[0];
      assert.equal(after.health, "error");
      assert.equal(after.last_content_hash, before.last_content_hash);
      assert.equal(
        String(after.last_success_at),
        String(before.last_success_at),
      );
      assert.equal(after.failure_count, 1);
    });
    await t.test("pausa invalida um coletor em andamento", async () => {
      lease = (await claim()).lease_token;
      await login(editor);
      await db.query("select manage_source($1,$2,'pause')", [
        eventId,
        payload.url,
      ]);
      await db.exec("reset role");
      assert.equal((await complete(lease)).rows[0].outcome, "discarded");
      assert.equal(
        (await db.query("select claim_source() as item")).rows[0].item,
        null,
      );
    });
    await t.test("Storage privado respeita associação à equipe", async () => {
      await db.query(
        "insert into storage.objects(bucket_id,name) values ('source-evidence',$1)",
        [snapshot.storage_path],
      );
      await login(editor);
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        1,
      );
      await login(outsider);
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
    });
  } finally {
    await db.close();
  }
});
