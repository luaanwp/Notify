import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicAddress,
  resolvePublic,
  safeFetch,
  validateUrl,
} from "../collector/network.mjs";

test("bloqueia loopback, redes internas, metadados e IPv4 mapeado em IPv6", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.2",
    "169.254.169.254",
    "0.0.0.0",
    "100.100.100.200",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("93.184.216.34"), true);
  for (const url of [
    "file:///etc/passwd",
    "http://name:password@example.com",
    "http://example.com:8080",
  ])
    assert.throws(() => validateUrl(url));
});
test("rejeita DNS misto e não resolve novamente ao fazer a requisição", async () => {
  await assert.rejects(
    resolvePublic(new URL("https://example.com"), async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]),
  );
  let resolutions = 0;
  const result = await safeFetch("https://example.com", {
    resolver: async () => {
      resolutions++;
      return [{ address: "93.184.216.34", family: 4 }];
    },
    transport: async (_url, address) => {
      assert.equal(address.address, "93.184.216.34");
      return { status: 200, headers: {}, bytes: Buffer.from("ok") };
    },
  });
  assert.equal(resolutions, 1);
  assert.equal(result.bytes.toString(), "ok");
});
test("revalida destinos de redirect antes de abrir a conexão", async () => {
  let requests = 0;
  await assert.rejects(
    safeFetch("https://example.com", {
      resolver: async () => [{ address: "93.184.216.34", family: 4 }],
      transport: async () => {
        requests++;
        return {
          status: 302,
          headers: { location: "http://169.254.169.254/" },
          bytes: Buffer.alloc(0),
        };
      },
    }),
  );
  assert.equal(requests, 1);
});
test("não aceita sucesso para 403 ou 429", async () => {
  for (const status of [403, 429])
    await assert.rejects(
      safeFetch("https://example.com", {
        resolver: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async () => ({
          status,
          headers: {},
          bytes: Buffer.alloc(0),
        }),
      }),
      new RegExp(`HTTP ${status}`),
    );
});
