import { test } from "node:test";
import assert from "node:assert/strict";
import { extract } from "../collector/extract.mjs";

const html = (content) => ({
  url: "https://official.example/2027/",
  headers: { "content-type": "text/html" },
  bytes: Buffer.from(content),
});
test('preserva abertura do evento fora de main e ignora menu legado',async () => {
  const result = await extract(html('<div id="skenav">Menu antigo</div><section class="hero"><h1>Evento 2027</h1><p>1 a 4 de março de 2027</p></section><main><p>Conteúdo oficial</p></main>'));
  assert.match(result.text,/1 a 4 de março/); assert.doesNotMatch(result.text,/Menu antigo/);
});
test("mudança de menu e banner não vira mudança relevante", async () => {
  const a = await extract(
    html(
      "<nav>Menu A</nav><main><h1>Edital 2027</h1><p>Inscrições até 6 de dezembro</p></main>",
    ),
  );
  const b = await extract(
    html(
      "<nav>Menu B</nav><main><h1>Edital 2027</h1><p>Inscrições até 6 de dezembro</p></main><footer>Relógio 10:03</footer>",
    ),
  );
  assert.equal(a.contentHash, b.contentHash);
  assert.notEqual(a.rawHash, b.rawHash);
});
test("novo PDF na listagem muda hash; links externos não entram no escopo", async () => {
  const a = await extract(html("<main>Edital 2027</main>"));
  const b = await extract(
    html(
      '<main>Edital 2027<a href="retificacao.pdf">Retificação</a><a href="https://other.example/a.pdf">Outro domínio</a></main>',
    ),
  );
  assert.notEqual(a.contentHash, b.contentHash);
  assert.equal(b.documents.length, 1);
  assert.equal(
    b.documents[0].url,
    "https://official.example/2027/retificacao.pdf",
  );
});
test("página vazia não é apresentada como consulta sem novidades", async () => {
  await assert.rejects(
    extract(html("<body><script>render()</script></body>")),
    /sem conteúdo/,
  );
});

export function pdfFixture(text = "") {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let value = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(value));
    value += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(value);
  value += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(value);
}
test("lê texto do PDF e ignora alteração somente em metadados", async () => {
  const bytes = pdfFixture("Official deadline extended to 19 November 2027");
  const a = await extract({
    url: "https://official.example/file.pdf",
    headers: { "content-type": "application/pdf" },
    bytes,
  });
  const b = await extract({
    url: "https://official.example/file.pdf",
    headers: { "content-type": "application/pdf" },
    bytes: Buffer.concat([bytes, Buffer.from("\n% Metadata changed")]),
  });
  assert.match(a.text, /19 November/);
  assert.equal(a.contentHash, b.contentHash);
  assert.notEqual(a.rawHash, b.rawHash);
  assert.equal(a.needsReview, false);
});
test("PDF sem texto entra em revisão", async () => {
  const result = await extract({
    url: "https://official.example/file.pdf",
    headers: { "content-type": "application/pdf" },
    bytes: pdfFixture(),
  });
  assert.equal(result.needsReview, true);
});
