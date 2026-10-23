// Somente leitura de recursos publicos e rejeicao de tokens invalidos.
// Nunca imprime chaves, tokens ou dados recebidos do banco.
const origin = new URL(process.argv[2] ?? "http://localhost:3000").origin;
const results = [];
async function get(path, init) {
  return fetch(new URL(path, origin), { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
}
const page = await get("/login");
const html = await page.text();
for (const header of ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy"]) {
  results.push({ check: `header ${header}`, ok: page.headers.has(header) });
}
let pageSources = html;
for (const path of ["/", "/chamada", "/colaboradores", "/usuarios", "/resetar-senha", "/acesso-negado"]) {
  const response = await get(path);
  if (!response.ok) throw new Error(`Pagina inacessivel: ${path} (${response.status})`);
  pageSources += await response.text();
}
const paths = [...new Set([...pageSources.matchAll(/(?:src|href)="([^"<>]+\.js(?:\?[^"<>]*)?)"/g)]
  .map((match) => match[1]))].filter((path) => new URL(path, origin).origin === origin);
let source = pageSources;
for (const path of paths) {
  const response = await get(path);
  if (!response.ok) throw new Error(`Bundle inacessivel: ${response.status}`);
  const js = await response.text();
  source += js;
  const map = await get(`${path.split("?")[0]}.map`);
  results.push({ check: "source map privado", ok: [403, 404].includes(map.status), status: map.status });
}
const tokens = [...new Set(source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? [])];
let anonKey;
for (const token of tokens) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    results.push({ check: "JWT publicado tem apenas papel anon", ok: payload.role === "anon" });
    if (payload.role === "anon") anonKey = token;
  } catch { results.push({ check: "JWT publicado valido", ok: false }); }
}
results.push({ check: "nenhuma chave secreta Supabase publicada", ok: !/sb_secret_[A-Za-z0-9_-]+/.test(source) });
for (const [path, method] of [["/api/usuarios", "POST"], ["/api/usuarios/senha", "PATCH"], ["/api/auditoria", "GET"]]) {
  for (const invalidToken of [false, true]) {
    const response = await get(path, { method, headers: {
      ...(invalidToken ? { Authorization: "Bearer security-audit-invalid-token" } : {}),
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    }, ...(method !== "GET" ? { body: "{}" } : {}) });
    results.push({ check: `${method} ${path} ${invalidToken ? "token invalido" : "sem token"}`, ok: response.status === 401, status: response.status });
  }
}
const supabaseUrl = source.match(/https:\/\/[a-z0-9-]+\.supabase\.co/)?.[0];
if (supabaseUrl && anonKey) {
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Accept-Profile": "gop_v2" };
  for (const table of ["profiles", "supervisores", "funcionarios", "presencas", "fechamentos_chamada", "audit_logs", "cargos", "regionais", "vw_funcionarios_completo"]) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, { headers, signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    const invalidKey = /invalid.*(?:api.?key|jwt)|expired/i.test(String(body.message ?? body.msg ?? ""));
    results.push({ check: `anon nao le ${table}`,
      ok: !invalidKey && (body.code === "42501" || (response.ok && Array.isArray(body) && body.length === 0)),
      status: response.status, code: body.code ?? null,
      ...(invalidKey ? { inconclusivo: "Provedor rejeitou a credencial publica; RLS nao comprovada." } : {}),
    });
  }
  // OpenAPI informa formato, sem consultar registros pessoais.
  const schema = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { ...headers, Accept: "application/openapi+json" }, signal: AbortSignal.timeout(15000) });
  console.log(`OpenAPI anon: HTTP ${schema.status} (sem dados pessoais)`);
  if (schema.ok) {
    const spec = await schema.json();
    for (const [name, definition] of Object.entries(spec.definitions ?? {})) {
      console.log(`Formato publico ${name}: ${Object.keys(definition.properties ?? {}).join(", ")}`);
    }
  }
} else {
  console.log("Configuracao Supabase nao encontrada nos bundles iniciais; verificacao anon pendente.");
}
console.log(JSON.stringify({ origin, pages: 7, bundles: paths.length, results }, null, 2));
if (results.some((result) => !result.ok)) process.exitCode = 1;
