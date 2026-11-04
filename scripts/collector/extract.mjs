import { load } from "cheerio";
import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";

export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const normalize = (text) =>
  text.normalize("NFKC").replace(/\s+/g, " ").trim();

export function extractHtml(bytes, url) {
  const $ = load(bytes);
  $("header")
    .filter(
      (_, element) =>
        $(element).find('nav,[role="navigation"]').length > 0 &&
        $(element).find("h1").length === 0,
    )
    .remove();
  $(
    'script,style,noscript,nav,footer,aside,[role="navigation"],.cookie-banner,#cookie-banner,#skenav,#menu-main-menu',
  ).remove();
  let root = $("main").first().length
    ? $("main").first()
    : $("article").first().length
      ? $("article").first()
      : $('[role="main"],#main-content,#main,#content,.site-content').first()
            .length
        ? $('[role="main"],#main-content,#main,#content,.site-content').first()
        : $("body");
  // Algumas páginas oficiais posicionam a abertura do evento antes de <main>.
  const heading = $("h1").first();
  if (heading.length && !root.find("h1").length) {
    const opening = heading.closest('header,section,[class*="hero"]');
    root = opening.length ? root.add(opening) : root.add(heading);
  }
  const links = [];
  root.find("a[href]").each((_, element) => {
    try {
      const target = new URL($(element).attr("href"), url);
      target.hash = "";
      if (
        target.origin === new URL(url).origin &&
        /\.pdf(?:\?|$)/i.test(target.href)
      )
        links.push({
          url: target.href,
          label: normalize($(element).text()).slice(0, 300),
        });
    } catch {
      /* Link inválido não é evidência. */
    }
  });
  root.find("br").replaceWith("\n");
  root.find("p,div,li,tr,h1,h2,h3,h4,section").append("\n");
  const text = root
    .text()
    .split("\n")
    .map(normalize)
    .filter(Boolean)
    .join("\n");
  const documents = [
    ...new Map(links.map((link) => [link.url, link])).values(),
  ].sort((a, b) => a.url.localeCompare(b.url));
  if (!text.trim() && !documents.length)
    throw new Error(
      "Página sem conteúdo legível; pode exigir navegador ou acesso manual.",
    );
  if (text.length > 200_000 || documents.length > 100)
    throw new Error("Conteúdo excede o limite de extração.");
  return { text, documents, pages: null, needsReview: false };
}

export function extractPdf(bytes, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pdf-worker.mjs", import.meta.url), {
      workerData: new Uint8Array(bytes),
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("PDF excedeu o tempo de extração."));
    }, timeoutMs);
    worker.once("message", (result) => {
      clearTimeout(timer);
      void worker.terminate();
      if (result.error) reject(new Error(result.error));
      else resolve(result);
    });
    worker.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    worker.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error("Extração de PDF interrompida."));
    });
  });
}

export async function extract(response) {
  const type = String(response.headers["content-type"] || "")
    .split(";")[0]
    .toLowerCase();
  let result;
  if (response.bytes.subarray(0, 5).toString() === "%PDF-")
    result = await extractPdf(response.bytes);
  else if (["text/html", "application/xhtml+xml"].includes(type))
    result = extractHtml(response.bytes, response.url);
  else if (type === "text/plain") {
    const text = normalize(response.bytes.toString("utf8"));
    if (!text || text.length > 200_000)
      throw new Error("Texto vazio ou acima do limite.");
    result = { text, documents: [], pages: null, needsReview: false };
  } else throw new Error("Formato não suportado. Use HTML, texto ou PDF.");
  return {
    ...result,
    contentHash: hash(
      JSON.stringify({
        text: normalize(result.text),
        documents: result.documents.map((link) => link.url),
      }),
    ),
    rawHash: hash(response.bytes),
  };
}
