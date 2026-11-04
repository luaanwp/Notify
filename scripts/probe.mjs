// Diagnóstico sem credenciais: consulta só as URLs explicitamente passadas.
// Guarda evidências localmente, sem cadastrar oportunidades nem ativar monitoramento.
import { mkdir, writeFile } from "node:fs/promises";
import { safeFetch } from "./collector/network.mjs";
import { extract } from "./collector/extract.mjs";
import { hash } from "./collector/extract.mjs";

await mkdir(".local/probes", { recursive: true });
let failures = 0;
for (const url of process.argv.slice(2, 12)) {
  const started = Date.now();
  const result = { requestedUrl: url, checkedAt: new Date().toISOString() };
  const id = hash(url).slice(0, 16);
  try {
    const response = await safeFetch(url);
    const content = await extract(response);
    Object.assign(result, {
      effectiveUrl: response.url,
      byteLength: response.bytes.length,
      contentHash: content.contentHash,
      rawHash: content.rawHash,
      textLength: content.text.length,
      needsReview: content.needsReview,
      documents: content.documents,
      elapsedMs: Date.now() - started,
    });
    await writeFile(`.local/probes/${id}.bin`, response.bytes);
    await writeFile(`.local/probes/${id}.txt`, content.text);
  } catch (error) {
    Object.assign(result, {
      error: error.message,
      elapsedMs: Date.now() - started,
    });
    failures++;
  }
  await writeFile(`.local/probes/${id}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
if (failures) process.exitCode = 1;
