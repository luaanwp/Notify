import { test } from "node:test";
import assert from "node:assert/strict";
import { collectSource } from "../collect.mjs";

const source = {
  id: "source",
  workspace_id: "workspace",
  url: "https://official.example",
  lease_token: "lease",
  last_content_hash: "same",
};
const snapshot = {
  contentHash: "same",
  rawHash: "raw",
  text: "same",
  documents: [],
  pages: null,
  needsReview: false,
};
function fixture(uploadError = null) {
  const calls = [];
  let uploads = 0;
  return {
    calls,
    get uploads() {
      return uploads;
    },
    client: {
      storage: {
        from: () => ({
          upload: async () => {
            uploads++;
            return { error: uploadError };
          },
        }),
      },
      rpc: async (name, args) => {
        calls.push({ name, args });
        return {
          data: args.error_message ? "error" : "unchanged",
          error: null,
        };
      },
    },
  };
}
test("conteúdo inalterado não armazena menu ou metadados novos", async () => {
  const f = fixture();
  await collectSource(source, {
    client: f.client,
    fetcher: async () => ({
      bytes: Buffer.from("raw"),
      headers: {},
      url: source.url,
    }),
    extractor: async () => snapshot,
  });
  assert.equal(f.uploads, 0);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].args.snapshot.content_hash, "same");
});
test("falha de upload registra falha, sem aceitar versão incompleta", async () => {
  const f = fixture(new Error("Storage indisponível"));
  await collectSource(source, {
    client: f.client,
    fetcher: async () => ({
      bytes: Buffer.from("raw"),
      headers: {},
      url: source.url,
    }),
    extractor: async () => ({ ...snapshot, contentHash: "new" }),
  });
  assert.equal(f.calls[0].args.snapshot, null);
  assert.match(f.calls[0].args.error_message, /Storage/);
});
test("erro de rede registra falha e não acessa Storage", async () => {
  const f = fixture();
  await collectSource(source, {
    client: f.client,
    fetcher: async () => {
      throw new Error("Fonte retornou HTTP 403.");
    },
  });
  assert.equal(f.uploads, 0);
  assert.match(f.calls[0].args.error_message, /403/);
});
