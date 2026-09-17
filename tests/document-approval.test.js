import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { applicationApi } from "../server/api.js";
import onboarding from "../content/app-content/onboarding.json" with { type: "json" };

test("only exact references in active non-demo topics authorize downloads, with no stale grants", async () => {
  const data = structuredClone(onboarding);
  data.topics[0].isDemo = false;
  data.topics[0].documents = [
    { label: "Form", path: "documents/enrollment/form.pdf" },
  ];
  let failContent = false;
  let documentReads = 0;
  const upstream = async (url) => {
    if (url.endsWith("/app-content/onboarding.json"))
      return new Response(failContent ? "{invalid" : JSON.stringify(data));
    if (url.endsWith("/app-content/after-arrival.json"))
      return new Response(JSON.stringify({ version: 1, topics: [] }));
    documentReads++;
    return new Response("approved file bytes");
  };
  const api = applicationApi(
    { NEXTCLOUD_USERNAME: "test", NEXTCLOUD_APP_PASSWORD: "fake" },
    upstream,
  );
  const server = createServer((req, res) =>
    api(req, res, () => res.writeHead(404).end()),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/nextcloud/download?path=`;
    const read = async (path) => {
      const r = await fetch(base + encodeURIComponent(path));
      await r.text();
      return r.status;
    };
    assert.equal(await read("documents/unrelated.pdf"), 404);
    assert.equal(documentReads, 0);
    assert.equal(await read("documents/enrollment/form.pdf"), 200);
    data.topics[0].isActive = false;
    assert.equal(await read("documents/enrollment/form.pdf"), 404);
    data.topics[0].isActive = true;
    data.topics[0].isDemo = true;
    assert.equal(await read("documents/enrollment/form.pdf"), 404);
    data.topics[0].isDemo = false;
    data.topics[0].documents = [];
    assert.equal(await read("documents/enrollment/form.pdf"), 404);
    failContent = true;
    assert.equal(await read("documents/enrollment/form.pdf"), 404);
    assert.equal(documentReads, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
