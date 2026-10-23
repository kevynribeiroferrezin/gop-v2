import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const origin = "http://localhost:3100";
let previousNonce;
for (const path of ["/login", "/login", "/", "/chamada", "/colaboradores", "/usuarios", "/resetar-senha", "/coordenacao", "/relatorios"]) {
  const response = await fetch(`${origin}${path}`, { headers: {
    "x-nonce": "attacker-chosen", "Content-Security-Policy": "script-src * 'unsafe-inline'",
  } });
  assert.equal(response.status, 200, path);
  const policy = response.headers.get("content-security-policy");
  const nonce = policy?.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce);
  assert.notEqual(nonce, previousNonce);
  assert.notEqual(nonce, "attacker-chosen");
  previousNonce = nonce;
  assert.doesNotMatch(policy.split(";").find((rule) => rule.includes("script-src")), /unsafe-inline|unsafe-eval/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const html = await response.text();
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)];
  assert.ok(scripts.length > 0);
  for (const script of scripts) assert.ok(script[1].includes(`nonce="${nonce}"`), `Script sem nonce em ${path}`);
}
for (const [path, method] of [["/api/usuarios", "POST"], ["/api/usuarios/senha", "PATCH"], ["/api/auditoria", "GET"], ["/api/auditoria", "POST"]]) {
  const response = await fetch(`${origin}${path}`, { method });
  assert.equal(response.status, 401);
  assert.match(response.headers.get("cache-control"), /no-store/);
}
for (const path of ["/.env", "/.env.local", "/.git/config", "/package.json"]) {
  assert.equal((await fetch(`${origin}${path}`)).status, 404);
}
let files = 0;
function inspect(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) inspect(file);
    else {
      files++;
      assert.equal(entry.name.endsWith(".map"), false, "Source map publicado");
      if (entry.name.endsWith(".js")) {
        assert.equal(readFileSync(file, "utf8").includes("security-test-server-only-canary"), false, "Chave servidor no bundle");
      }
    }
  }
}
inspect(".next/static");
console.log(`OK: 9 respostas HTML com nonce, 4 APIs sem token, 4 caminhos privados e ${files} assets verificados.`);
