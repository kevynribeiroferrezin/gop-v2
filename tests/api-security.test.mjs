import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./ts-loader.mjs";

const security = loadTs("src/lib/api-security.ts");
const request = (body, token = "Bearer test.token", contentType = "application/json") =>
  new Request("https://example.test/api", { method: "POST", headers: {
    ...(token ? { Authorization: token } : {}), "Content-Type": contentType,
  }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("JSON invalido, escalar, array e corpo grande sao rejeitados", async () => {
  for (const body of ["{", "null", "[]", "123", '"texto"']) {
    await assert.rejects(security.readJsonObject(request(body)), { status: 400 });
  }
  await assert.rejects(security.readJsonObject(request("{}", undefined, "text/plain")), { status: 415 });
  await assert.rejects(security.readJsonObject(request(JSON.stringify({ nome: "a".repeat(17000) }))), { status: 413 });
  assert.deepEqual(await security.readJsonObject(request({ nome: "ok" })), { nome: "ok" });
});

test("valida tipos, tamanhos, UUID, regional e papel sem coercoes", () => {
  const valid = { nome: " Maria ", email: "MARIA@example.test", senha: "Forte!12345", role: "rh" };
  assert.equal(security.newUserInput(valid).email, "maria@example.test");
  for (const change of [{ nome: [] }, { email: "invalid" }, { senha: 123 }, { role: "owner" },
    { regionalId: "1" }, { regionalId: -1 }, { regionalId: 1.2 }, { role: "supervisor" }, { senha: "A".repeat(129) }]) {
    assert.throws(() => security.newUserInput({ ...valid, ...change }), { status: 400 });
  }
  assert.throws(() => security.passwordInput({ userId: "' OR 1=1", novaSenha: "Forte!12345" }), { status: 400 });
});

const routes = [
  ["app/api/usuarios/route.ts", "POST"],
  ["app/api/usuarios/senha/route.ts", "PATCH"],
  ["app/api/auditoria/route.ts", "GET"],
];
function route(file, { role = "admin", ativo = true, target = true, invalidUser = false } = {}) {
  let calls = 0;
  let authCalls = 0;
  const inserted = [];
  const fake = {
    auth: {
      getUser: async () => { authCalls++; return { data: { user: invalidUser ? null : { id: "actor" } }, error: null }; },
      admin: { updateUserById: async () => { calls++; return { error: null }; },
        createUser: async () => { calls++; return { error: new Error("stop") }; } },
    },
    from: (table) => ({
      select() { return this; },
      eq(_column, value) { this.target = value !== "actor"; return this; },
      async single() { return { data: this.target ? (target ? { id: "target" } : null) : { id: "profile", role, ativo }, error: null }; },
      async insert(value) { inserted.push({ table, value }); return { error: null }; },
    }),
  };
  const exports = loadTs(file, { "server-only": {},
    "next/server": { NextResponse: { json: Response.json.bind(Response) } },
    "@supabase/supabase-js": { createClient: () => fake },
  });
  return { exports, calls: () => calls, authCalls: () => authCalls, inserted };
}

test("todas as APIs administrativas rejeitam ausencia, esquema e token invalidos", async () => {
  for (const [file, method] of routes) {
    for (const token of [null, "Basic abc", "Bearer abc extra", "Bearer"]) {
      const api = route(file);
      assert.equal((await api.exports[method](request({}, token))).status, 401);
      assert.equal(api.authCalls(), 0);
      assert.equal(api.calls(), 0);
    }
    const api = route(file, { invalidUser: true });
    assert.equal((await api.exports[method](request({}))).status, 401);
  }
});

test("RH, supervisor e admin inativo nao acessam APIs administrativas", async () => {
  for (const [file, method] of routes) {
    for (const profile of [{ role: "rh" }, { role: "coordenador" }, { role: "supervisor" }, { ativo: false }, { role: "owner" }]) {
      const api = route(file, profile);
      assert.equal((await api.exports[method](request({}))).status, 403);
      assert.equal(api.calls(), 0);
    }
  }
});

test("admin nao redefine senha de conta fora do GOP", async () => {
  const api = route("app/api/usuarios/senha/route.ts", { target: false });
  const response = await api.exports.PATCH(request({ userId: "10000000-0000-0000-0000-000000000001", novaSenha: "Forte!12345" }));
  assert.equal(response.status, 404);
  assert.equal(api.calls(), 0);
});

test("admin autorizado redefine senha e registra evento sem senha", async () => {
  const api = route("app/api/usuarios/senha/route.ts");
  assert.equal((await api.exports.PATCH(request({ userId: "10000000-0000-0000-0000-000000000001", novaSenha: "Forte!12345" }))).status, 200);
  assert.equal(api.calls(), 1);
  assert.equal(api.inserted[0].value.acao, "redefinir_senha");
  assert.doesNotMatch(JSON.stringify(api.inserted), /Forte!/);
});

test("auditoria do cliente nao inventa evento administrativo nem armazena detalhes livres", async () => {
  const api = route("app/api/auditoria/route.ts", { role: "supervisor" });
  assert.equal((await api.exports.POST(request({ entidade: "auth.users", acao: "redefinir_senha" }))).status, 400);
  assert.equal(api.inserted.length, 0);
  assert.equal((await api.exports.POST(request({ entidade: "presencas", acao: "salvar_chamada", detalhes: { senha: "segredo" } }))).status, 200);
  assert.equal(api.inserted[0].value.acao, "relato_cliente");
  assert.equal(api.inserted[0].value.detalhes.verificado, false);
  assert.doesNotMatch(JSON.stringify(api.inserted), /segredo/);
});

test("CSP de producao exige nonce e bloqueia scripts inline arbitrarios", () => {
  const { contentSecurityPolicy } = loadTs("src/lib/content-security-policy.ts");
  const csp = contentSecurityPolicy("random-nonce", false, "https://example.supabase.co/path");
  const script = csp.split(";").find((item) => item.trim().startsWith("script-src"));
  assert.match(script, /nonce-random-nonce/);
  assert.doesNotMatch(script, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /wss:\/\/example.supabase.co/);
  assert.match(csp, /frame-ancestors 'none'/);
});
