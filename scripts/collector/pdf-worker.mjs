import { parentPort, workerData } from "node:worker_threads";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
try {
  const task = getDocument({
    data: workerData,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > 40)
      throw new Error("PDF excede o limite de 40 páginas.");
    const pages = [];
    let length = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
        )
        .join("")
        .trim();
      length += text.length;
      if (length > 200_000) throw new Error("PDF excede o limite de texto.");
      pages.push({ page: i, text });
      page.cleanup();
    }
    parentPort.postMessage({
      text: pages.map((p) => `[Página ${p.page}]\n${p.text}`).join("\n"),
      pages,
      documents: [],
      needsReview: pages.some((p) => p.text.length < 20),
    });
  } finally {
    await task.destroy();
  }
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
