import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("data operacional usa America/Sao_Paulo", () => {
  const date = new Date("2026-05-01T02:30:00.000Z");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type) => parts.find((part) => part.type === type)?.value;

  assert.equal(`${value("year")}-${value("month")}-${value("day")}`, "2026-04-30");
});

test("politica de senha exige comprimento e complexidade", () => {
  const source = readFileSync("src/lib/password.ts", "utf8");

  assert.match(source, /MIN_PASSWORD_LENGTH = 10/);
  assert.match(source, /\[a-z\]/);
  assert.match(source, /\[A-Z\]/);
  assert.match(source, /\[0-9\]/);
  assert.match(source, /\[\^A-Za-z0-9\]/);
});

test("sql versionado habilita RLS e auditoria", () => {
  const sql = readFileSync("supabase/sql/001_security_audit_rls.sql", "utf8");

  assert.match(sql, /create table if not exists gop_v2\.audit_logs/i);
  assert.match(sql, /create or replace function gop_v2\.current_supervisor_id\(\)/i);
  assert.match(sql, /alter table gop_v2\.profiles enable row level security/i);
  assert.match(sql, /alter table gop_v2\.funcionarios enable row level security/i);
  assert.match(sql, /alter table gop_v2\.presencas enable row level security/i);
  assert.match(sql, /create or replace function gop_v2\.hoje_brasil\(\)/i);
  assert.match(sql, /grant execute on function gop_v2\.hoje_brasil\(\)/i);
  assert.match(sql, /America\/Sao_Paulo/);
});

test("policies impedem supervisor de escrever registros de outro supervisor", () => {
  const sql = readFileSync("supabase/sql/001_security_audit_rls.sql", "utf8");

  assert.doesNotMatch(sql, /create policy "presencas_select_auth"[\s\S]*?using \(true\)/i);
  assert.doesNotMatch(sql, /create policy "funcionarios_select_auth"[\s\S]*?using \(true\)/i);
  assert.match(
    sql,
    /presencas_admin_supervisor_write[\s\S]*supervisor_id = gop_v2\.current_supervisor_id\(\)/i
  );
  assert.match(
    sql,
    /fechamentos_admin_supervisor_write[\s\S]*supervisor_id = gop_v2\.current_supervisor_id\(\)/i
  );
});

test("configuracao de producao inclui Vercel e headers defensivos", () => {
  const vercel = readFileSync("vercel.json", "utf8");
  const nextConfig = readFileSync("next.config.ts", "utf8");

  assert.match(vercel, /"framework": "nextjs"/);
  assert.match(vercel, /"buildCommand": "npm run build"/);
  assert.match(nextConfig, /Content-Security-Policy/);
  assert.match(nextConfig, /Strict-Transport-Security/);
  assert.match(nextConfig, /Cache-Control/);
});

test("app mantem auditoria interna sem aba visual", () => {
  const sidebar = readFileSync("src/components/Sidebar.tsx", "utf8");
  const api = readFileSync("app/api/auditoria/route.ts", "utf8");

  assert.doesNotMatch(sidebar, /\/auditoria/);
  assert.doesNotMatch(sidebar, /Auditoria/);
  assert.match(api, /audit_logs/);
});
