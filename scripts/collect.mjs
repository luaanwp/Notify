import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { safeFetch } from "./collector/network.mjs";
import { extract } from "./collector/extract.mjs";

export async function collectSource(
  source,
  { client, fetcher = safeFetch, extractor = extract, signal },
) {
  const started = Date.now();
  try {
    const response = await fetcher(source.url, { signal });
    const content = await extractor(response);
    const path = `${source.workspace_id}/${source.id}/${content.rawHash}`;
    const uploaded =
      content.contentHash === source.last_content_hash
        ? { error: null }
        : await client.storage
            .from("source-evidence")
            .upload(path, response.bytes, {
              contentType:
                response.headers["content-type"] || "application/octet-stream",
              upsert: false,
            });
    if (uploaded.error && String(uploaded.error.statusCode) !== "409")
      throw uploaded.error;
    const result = await client.rpc("complete_source_check", {
      source_id: source.id,
      lease: source.lease_token,
      snapshot: {
        content_hash: content.contentHash,
        raw_hash: content.rawHash,
        text: content.text,
        documents: content.documents,
        pages: content.pages,
        needs_review: content.needsReview,
        storage_path: path,
        effective_url: response.url,
        content_type: response.headers["content-type"] || "",
        byte_length: response.bytes.length,
      },
      error_message: null,
      elapsed_ms: Date.now() - started,
    });
    if (result.error) throw result.error;
    return { source: source.id, outcome: result.data };
  } catch (error) {
    // Nada altera etapas ou participação. Falhas preservam versão e último sucesso.
    const result = await client.rpc("complete_source_check", {
      source_id: source.id,
      lease: source.lease_token,
      snapshot: null,
      error_message: String(error.message || error).slice(0, 500),
      elapsed_ms: Date.now() - started,
    });
    if (result.error) throw result.error;
    return { source: source.id, outcome: "error" };
  }
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    throw new Error(
      "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY somente no ambiente do coletor.",
    );
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signal = AbortSignal.timeout(180_000);
  // Uma fonte por vez. Busca incremental evita reservar fontes que não cabem no lote.
  let processed = 0;
  const domains = new Map();
  for (; processed < 20 && !signal.aborted; processed++) {
    const claimed = await client.rpc("claim_source");
    if (claimed.error) throw claimed.error;
    if (!claimed.data) break;
    const domain = new URL(claimed.data.url).hostname;
    const remaining = (domains.get(domain) || 0) + 1000 - Date.now();
    if (remaining > 0)
      await new Promise((resolve) => setTimeout(resolve, remaining));
    const result = await collectSource(claimed.data, { client, signal });
    domains.set(domain, Date.now());
    console.log(JSON.stringify(result)); // Não registrar texto, URLs privadas ou credenciais.
  }
  console.log(
    `Lote encerrado: ${processed} fonte(s). Pendências permanecem no banco.`,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
