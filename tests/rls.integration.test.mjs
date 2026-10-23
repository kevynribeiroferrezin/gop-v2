import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// PostgreSQL real em WASM, somente fixtures locais. Nenhum acesso ao Supabase.
test("RLS: ataques entre supervisores, elevacao, RPC, views e auditoria", async (t) => {
  const db = new PGlite();
  const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to public;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create schema gop_v2;
      create table gop_v2.profiles (id uuid primary key, user_id uuid unique, role text, ativo boolean);
      create table gop_v2.supervisores (id uuid primary key, profile_id uuid, ativo boolean);
      create table gop_v2.funcionarios (id uuid primary key, supervisor_id uuid, nome text);
      create table gop_v2.presencas (id uuid primary key default gen_random_uuid(), funcionario_id uuid, supervisor_id uuid, status text);
      create table gop_v2.fechamentos_chamada (id uuid primary key default gen_random_uuid(), supervisor_id uuid, fechado_por uuid);
      create table gop_v2.cargos (id int primary key, nome text);
      create table gop_v2.regionais (id int primary key, nome text);
      create view gop_v2.vw_funcionarios_completo as select * from gop_v2.funcionarios;
      create function gop_v2.get_chamada_por_data(date) returns setof gop_v2.funcionarios
        language sql security definer as $$ select * from gop_v2.funcionarios $$;
      create function gop_v2.legacy_leak() returns setof gop_v2.funcionarios
        language sql security definer as $$ select * from gop_v2.funcionarios $$;
      insert into gop_v2.profiles values
        ('${id(1)}','${id(101)}','admin',true),
        ('${id(2)}','${id(102)}','supervisor',true),
        ('${id(3)}','${id(103)}','supervisor',true),
        ('${id(4)}','${id(104)}','rh',true),
        ('${id(5)}','${id(105)}','supervisor',false);
      insert into gop_v2.supervisores values
        ('${id(12)}','${id(2)}',true), ('${id(13)}','${id(3)}',true), ('${id(15)}','${id(5)}',true);
      insert into gop_v2.funcionarios values
        ('${id(22)}','${id(12)}','Equipe A'), ('${id(23)}','${id(13)}','Equipe B');
      insert into gop_v2.cargos values (1,'Cargo');
      grant all on all tables in schema gop_v2 to anon, authenticated, service_role;
      grant usage on schema gop_v2 to anon, authenticated, service_role;
    `);
    await db.exec(readFileSync("supabase/sql/001_security_audit_rls.sql", "utf8"));
    await db.exec("create policy legacy_open on gop_v2.funcionarios for all to authenticated using (true) with check (true)");
    await db.exec(readFileSync("supabase/sql/003_security_hardening.sql", "utf8"));
    async function asUser(n, sql) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [n ? id(n) : ""]);
      await db.exec(`set role ${n ? "authenticated" : "anon"}`);
      return db.query(sql);
    }
    await t.test("anon nao le tabelas, views nem executa RPC", async () => {
      for (const sql of ["select * from gop_v2.profiles", "select * from gop_v2.vw_funcionarios_completo",
        "select * from gop_v2.get_chamada_por_data(current_date)"]) {
        await assert.rejects(asUser(null, sql), /permission denied/);
      }
    });
    await t.test("supervisor so ve sua equipe em tabela, view e RPC", async () => {
      for (const source of ["gop_v2.funcionarios", "gop_v2.vw_funcionarios_completo", "gop_v2.get_chamada_por_data(current_date)"]) {
        const { rows } = await asUser(102, `select * from ${source}`);
        assert.deepEqual(rows.map((row) => row.id), [id(22)]);
      }
      await assert.rejects(asUser(102, "select * from gop_v2.legacy_leak()"), /permission denied/);
    });
    await t.test("trocar funcionario_id mantendo supervisor proprio e bloqueado", async () => {
      await assert.rejects(asUser(102, `insert into gop_v2.presencas (funcionario_id,supervisor_id,status)
        values ('${id(23)}','${id(12)}','falta')`), /row-level security/);
      await assert.rejects(asUser(102, `insert into gop_v2.presencas (funcionario_id,supervisor_id,status)
        values ('${id(23)}','${id(13)}','falta')`), /row-level security/);
      await asUser(102, `insert into gop_v2.presencas (funcionario_id,supervisor_id,status)
        values ('${id(22)}','${id(12)}','presente')`);
      const changed = await asUser(103, "update gop_v2.presencas set status='falta' returning id");
      assert.equal(changed.rows.length, 0);
    });
    await t.test("supervisor nao promove seu proprio perfil nem forja autor de fechamento", async () => {
      assert.equal((await asUser(102, "update gop_v2.profiles set role='admin' returning id")).rows.length, 0);
      await assert.rejects(asUser(102, `insert into gop_v2.fechamentos_chamada (supervisor_id,fechado_por)
        values ('${id(12)}','${id(1)}')`), /row-level security/);
      await asUser(102, `insert into gop_v2.fechamentos_chamada (supervisor_id,fechado_por)
        values ('${id(12)}','${id(2)}')`);
    });
    await t.test("conta inativa nao ve equipe, catalogos nem seu perfil", async () => {
      for (const table of ["profiles", "funcionarios", "cargos"]) {
        assert.equal((await asUser(105, `select * from gop_v2.${table}`)).rows.length, 0);
      }
    });
    await t.test("RH le equipes e cadastra colaborador, mas nao grava presenca", async () => {
      assert.equal((await asUser(104, "select * from gop_v2.funcionarios")).rows.length, 2);
      await asUser(104, `insert into gop_v2.funcionarios values ('${id(24)}','${id(12)}','Novo')`);
      await assert.rejects(asUser(104, `insert into gop_v2.presencas (funcionario_id,supervisor_id,status)
        values ('${id(22)}','${id(12)}','falta')`), /row-level security/);
    });
    await t.test("logs sao automaticos, restritos ao admin e imutaveis ao navegador", async () => {
      assert.equal((await asUser(102, "select * from gop_v2.audit_logs")).rows.length, 0);
      await assert.rejects(asUser(102, "insert into gop_v2.audit_logs (entidade,acao) values ('profiles','criar')"), /permission denied/);
      await assert.rejects(asUser(101, "delete from gop_v2.audit_logs"), /permission denied/);
      const { rows } = await asUser(101, "select * from gop_v2.audit_logs order by created_at");
      assert.equal(rows.length, 3);
      assert.deepEqual(rows[0].detalhes, { origem: "database_trigger" });
      assert.equal(rows[0].actor_user_id, id(102));
    });
  } finally {
    await db.close();
  }
});
