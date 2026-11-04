import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import ipaddr from "ipaddr.js";

export function publicAddress(address) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === "ipv6" && ip.isIPv4MappedAddress())
      ip = ip.toIPv4Address();
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}

export function validateUrl(value) {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  ) {
    throw new Error(
      "Destino bloqueado: use HTTP/HTTPS, porta padrão e endereço sem credenciais.",
    );
  }
  url.hash = "";
  return url;
}

// Resolve uma vez, verifica TODOS os endereços e fixa o IP usado pelo socket.
// O hostname original continua sendo usado para Host, SNI e validação do certificado.
export async function resolvePublic(url, resolver = lookup) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = ipaddr.isValid(hostname)
    ? [
        {
          address: hostname,
          family: ipaddr.parse(hostname).kind() === "ipv4" ? 4 : 6,
        },
      ]
    : await resolver(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some((item) => !publicAddress(item.address))
  )
    throw new Error("Destino bloqueado: endereço local, privado ou reservado.");
  return addresses[0];
}

export async function safeFetch(
  value,
  {
    maxBytes = 2_000_000,
    timeoutMs = 15_000,
    maxRedirects = 4,
    signal,
    resolver = lookup,
    transport,
  } = {},
) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let url = validateUrl(value);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    combinedSignal.throwIfAborted();
    // DNS não aceita AbortSignal; a corrida limita a espera mesmo se o resolver travar.
    const address = await Promise.race([
      resolvePublic(url, resolver),
      new Promise((_, reject) => {
        if (combinedSignal.aborted) reject(combinedSignal.reason);
        else
          combinedSignal.addEventListener(
            "abort",
            () => reject(combinedSignal.reason),
            { once: true },
          );
      }),
    ]);
    const result = await (transport || readResponse)(url, address, {
      maxBytes,
      signal: combinedSignal,
    });
    if ([301, 302, 303, 307, 308].includes(result.status)) {
      if (!result.headers.location || hop === maxRedirects)
        throw new Error("Redirecionamento inválido ou excessivo.");
      const next = validateUrl(new URL(result.headers.location, url).href);
      if (url.protocol === "https:" && next.protocol !== "https:")
        throw new Error("Redirecionamento para conexão sem TLS bloqueado.");
      url = next;
      continue;
    }
    if (result.status < 200 || result.status >= 300)
      throw new Error(`Fonte retornou HTTP ${result.status}.`);
    return { ...result, url: url.href };
  }
}

function readResponse(url, address, { maxBytes, signal }) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        signal,
        agent: false,
        headers: {
          "User-Agent": "NotifyMonitor/0.2",
          Accept: "text/html,application/pdf,text/plain",
          "Accept-Encoding": "identity",
        },
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [address]);
          else callback(null, address.address, address.family);
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300) {
          response.destroy();
          resolve({
            status,
            headers: response.headers,
            bytes: Buffer.alloc(0),
          });
          return;
        }
        if (
          Number(response.headers["content-length"]) > maxBytes ||
          (response.headers["content-encoding"] &&
            response.headers["content-encoding"] !== "identity")
        ) {
          response.destroy(
            new Error(
              "Resposta excede o limite ou usa compressão não suportada.",
            ),
          );
        }
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes)
            response.destroy(new Error("Fonte excede o limite de bytes."));
          else chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status,
            headers: response.headers,
            bytes: Buffer.concat(chunks),
          }),
        );
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    request.end();
  });
}
