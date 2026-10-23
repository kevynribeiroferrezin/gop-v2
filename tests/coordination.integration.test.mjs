import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("coordenacao: isolamento real no PostgreSQL, relatorios e cobrancas", async (t) => {
  const db = new PGlite();
  const id = (n) => `20000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  try {
    await db.exec(readFileSync("tests/fixtures/workspace.sql", "utf8"));
    await db.exec(readFileSync("supabase/sql/001_security_audit_rls.sql", "utf8"));
    await db.exec("create policy legacy_open on gop_v2.funcionarios for all to authenticated using (true) with check (true)");
    await db.exec(readFileSync("supabase/sql/005_coordenacao_relatorios.sql", "utf8"));
    // Reaplicacao valida os IF NOT EXISTS sem duplicar as policies.
    await db.exec(readFileSync("supabase/sql/005_coordenacao_relatorios.sql", "utf8"));
    await db.exec(readFileSync("supabase/sql/006_edicao_hierarquia.sql", "utf8"));
    await db.exec(readFileSync("supabase/sql/006_edicao_hierarquia.sql", "utf8"));
    await db.exec(`
      insert into gop_v2.profiles values
        ('${id(1)}','${id(101)}','Admin','a@example.test','admin',true),
        ('${id(2)}','${id(102)}','Coord A','ca@example.test','coordenador',true),
        ('${id(3)}','${id(103)}','Coord B','cb@example.test','coordenador',true),
        ('${id(4)}','${id(104)}','Sup A','sa@example.test','supervisor',true),
        ('${id(5)}','${id(105)}','Sup B','sb@example.test','supervisor',true),
        ('${id(6)}','${id(106)}','Sup C','sc@example.test','supervisor',true),
        ('${id(7)}','${id(107)}','RH','rh@example.test','rh',true),
        ('${id(8)}','${id(108)}','Inativo','off@example.test','coordenador',false),
        ('${id(9)}','${id(109)}','Sem vinculo','sv@example.test','supervisor',true);
      insert into gop_v2.supervisores (id,profile_id,codigo,nome,email,ativo,coordenador_profile_id) values
        ('${id(14)}','${id(4)}','A','Sup A','sa@example.test',true,'${id(2)}'),
        ('${id(15)}','${id(5)}','B','Sup B','sb@example.test',true,'${id(2)}'),
        ('${id(16)}','${id(6)}','C','Sup C','sc@example.test',true,'${id(3)}'),
        ('${id(19)}','${id(9)}','D','Sem vinculo','sv@example.test',true,null);
      insert into gop_v2.cargos values (1,'ADM','Assistente');
      insert into gop_v2.regionais values (1,'SP','Sao Paulo');
    `);
    for (let n = 0; n < 8; n++) {
      const supervisor = [14, 15, 16, 19][Math.floor(n / 2)];
      await db.query(`insert into gop_v2.funcionarios
        (id,matricula,nome,cargo_id,supervisor_id,ativo,status,regional_id)
        values ($1,$2,$3,1,$4,true,'ativo',1)`, [id(200 + n), String(1000 + n), `Pessoa ${n}`, id(supervisor)]);
    }
    await db.exec(`
      update gop_v2.funcionarios set nome_smart='smart.pessoa',modalidade_trabalho='home_office' where id='${id(200)}';
      insert into gop_v2.presencas (funcionario_id,supervisor_id,data_presenca,status) values
        ('${id(200)}','${id(14)}',gop_v2.hoje_brasil(),'ferias'),
        ('${id(201)}','${id(14)}',gop_v2.hoje_brasil(),'atestado');
      insert into gop_v2.fechamentos_chamada (supervisor_id,fechado_por,data_chamada)
        values ('${id(15)}','${id(5)}',gop_v2.hoje_brasil());
    `);
    async function asUser(n, sql, params = []) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : ""]);
      await db.exec(`set role ${n ? "authenticated" : "anon"}`);
      return db.query(sql, params);
    }
    const report = "select * from gop_v2.relatorio_presencas(gop_v2.hoje_brasil(),gop_v2.hoje_brasil())";
    await t.test("admin e RH veem tudo; coordenadores somente supervisores vinculados", async () => {
      for (const [user, expected] of [[101, 8], [107, 8], [102, 4], [103, 2], [104, 2], [109, 2], [108, 0]]) {
        for (const query of ["select * from gop_v2.funcionarios", "select * from gop_v2.vw_colaboradores_acesso", report]) {
          assert.equal((await asUser(user, query)).rows.length, expected, `usuario ${user}: ${query}`);
        }
      }
      assert.deepEqual((await asUser(102, "select id from gop_v2.supervisores order by id")).rows.map((row) => row.id), [id(14), id(15)]);
      assert.equal((await asUser(103, "select * from gop_v2.supervisores where id=$1", [id(14)])).rows.length, 0);
      assert.equal((await asUser(104, `${report} where supervisor_id=$1`, [id(16)])).rows.length, 0);
      assert.equal((await asUser(102, `${report} where coordenador_profile_id=$1`, [id(3)])).rows.length, 0);
    });
    await t.test("status de ferias/atestado, Smart e modalidade chegam ao relatorio", async () => {
      const { rows } = await asUser(104, `${report} order by funcionario_id`);
      assert.equal(rows[0].status_presenca, "ferias");
      assert.equal(rows[1].status_presenca, "atestado");
      assert.equal(rows[0].nome_smart, "smart.pessoa");
      assert.equal(rows[0].modalidade_trabalho, "home_office");
      assert.equal(rows[1].modalidade_trabalho, "nao_informado");
      assert.ok(rows.every((row) => row.chamada_pendente));
      assert.ok((await asUser(105, report)).rows.every((row) => !row.chamada_pendente));
    });
    await t.test("troca de IDs, elevacao de papel e alteracao de vinculo sao bloqueadas", async () => {
      assert.equal((await asUser(102, "update gop_v2.supervisores set coordenador_profile_id=$1 where id=$2 returning id", [id(2), id(16)])).rows.length, 0);
      assert.equal((await asUser(104, "update gop_v2.profiles set role='admin' returning id")).rows.length, 0);
      assert.equal((await asUser(102, "update gop_v2.funcionarios set nome_smart='hack' returning id")).rows.length, 0);
      await assert.rejects(asUser(104, `insert into gop_v2.presencas (funcionario_id,supervisor_id,data_presenca,status)
        values ($1,$2,gop_v2.hoje_brasil(),'falta')`, [id(204), id(14)]), /row-level security/);
      await assert.rejects(asUser(102, `insert into gop_v2.presencas (funcionario_id,supervisor_id,data_presenca,status)
        values ($1,$2,gop_v2.hoje_brasil()+1,'falta')`, [id(200), id(14)]), /row-level security/);
      await assert.rejects(asUser(101, "update gop_v2.supervisores set coordenador_profile_id=$1 where id=$2", [id(4), id(14)]), /coordenador ativo/);
      await assert.rejects(asUser(101, "update gop_v2.supervisores set coordenador_profile_id=$1 where id=$2", [id(8), id(14)]), /coordenador ativo/);
    });
    await t.test("supervisor edita nome, Smart e modalidade somente dos próprios colaboradores", async () => {
      const sql = "select gop_v2.editar_colaborador($1,$2,$3,$4) as id";
      for (const mode of ["hibrido", "presencial", "home_office"]) {
        assert.equal((await asUser(104, sql, [id(200), "Pessoa editada", "smart.atualizado", mode])).rows[0].id, id(200));
        const row = (await asUser(104, "select nome,nome_smart,modalidade_trabalho from gop_v2.funcionarios where id=$1", [id(200)])).rows[0];
        assert.equal(row.nome_smart, "smart.atualizado"); assert.equal(row.modalidade_trabalho, mode);
      }
      for (const actor of [105, 102, 107, 108]) await assert.rejects(asUser(actor, sql, [id(200), "IDOR", "hack", "presencial"]), /Sem permissao/);
      await assert.rejects(asUser(104, sql, [id(204), "IDOR", "hack", "presencial"]), /Sem permissao/);
      for (const mode of [null, "nao_informado", "inventado"]) await assert.rejects(asUser(104, sql, [id(200), "Pessoa", null, mode]), /invalida/);
      assert.equal((await asUser(104, "update gop_v2.funcionarios set supervisor_id=$1 where id=$2 returning id", [id(16), id(200)])).rows.length, 0);
      assert.equal((await asUser(101, sql, [id(204), "Editado pelo admin", null, "hibrido"])).rows[0].id, id(204));
      await asUser(101, "update gop_v2.funcionarios set supervisor_id=$1 where id=$2", [id(15), id(201)]);
      await assert.rejects(asUser(104, sql, [id(201), "Transferido", null, "hibrido"]), /Sem permissao/);
      assert.equal((await asUser(105, sql, [id(201), "Transferido", null, "presencial"])).rows[0].id, id(201));
      await asUser(101, "update gop_v2.funcionarios set supervisor_id=$1 where id=$2", [id(14), id(201)]);
      await assert.rejects(asUser(null, sql, [id(200), "Anon", null, "presencial"]), /permission denied/);
    });
    await t.test("coordenador edita somente seus supervisores sem transferir vínculo ou conta", async () => {
      const sql = "select gop_v2.editar_supervisor($1,$2,$3,$4) as id";
      assert.equal((await asUser(102, sql, [id(14), "Supervisor atualizado", "A-1", "novo@example.test"])).rows[0].id, id(14));
      const row = (await asUser(102, "select * from gop_v2.supervisores where id=$1", [id(14)])).rows[0];
      assert.equal(row.nome, "Supervisor atualizado"); assert.equal(row.email, "novo@example.test");
      assert.equal(row.coordenador_profile_id, id(2)); assert.equal(row.profile_id, id(4));
      for (const actor of [103, 104, 107, 108]) await assert.rejects(asUser(actor, sql, [id(14), "IDOR", "A", null]), /Sem permissao/);
      await assert.rejects(asUser(102, sql, [id(16), "Outra equipe", "C", null]), /Sem permissao/);
      await assert.rejects(asUser(102, sql, [id(14), "Supervisor", "A", "email-invalido"]), /invalidos/);
      assert.equal((await asUser(102, "update gop_v2.supervisores set profile_id=$1 where id=$2 returning id", [id(2), id(14)])).rows.length, 0);
      assert.equal((await asUser(101, sql, [id(16), "Admin edita todos", "C", null])).rows[0].id, id(16));
      await assert.rejects(asUser(null, sql, [id(14), "Anon", "A", null]), /permission denied/);
    });
    await t.test("somente responsavel/admin cobra; envio repetido e idempotente", async () => {
      const sql = "select gop_v2.cobrar_chamada($1,gop_v2.hoje_brasil()) as id";
      const first = (await asUser(102, sql, [id(14)])).rows[0].id;
      assert.equal((await asUser(102, sql, [id(14)])).rows[0].id, first);
      assert.equal((await asUser(104, "select * from gop_v2.cobrancas_chamada")).rows.length, 1);
      assert.equal((await asUser(106, "select * from gop_v2.cobrancas_chamada")).rows.length, 0);
      for (const actor of [103, 104, 107, 108]) await assert.rejects(asUser(actor, sql, [id(14)]), /Sem permissao/);
      await assert.rejects(asUser(102, sql, [id(15)]), /ja foi finalizada/);
      await assert.rejects(asUser(102, "select gop_v2.cobrar_chamada($1,gop_v2.hoje_brasil()+1)", [id(14)]), /Data de cobranca invalida/);
      await assert.rejects(asUser(104, "insert into gop_v2.cobrancas_chamada (remetente_profile_id,supervisor_id,data_chamada,mensagem) values ($1,$2,current_date,'forjado')", [id(1), id(14)]), /permission denied/);
      await assert.rejects(asUser(104, "update gop_v2.cobrancas_chamada set mensagem='forjado'"), /permission denied/);
      assert.equal((await asUser(106, "update gop_v2.cobrancas_chamada set lida_em=now() returning id")).rows.length, 0);
      assert.equal((await asUser(104, "update gop_v2.cobrancas_chamada set lida_em=now() returning id")).rows.length, 1);
    });
    await t.test("desvincular supervisor remove acesso do coordenador imediatamente", async () => {
      await asUser(101, "update gop_v2.supervisores set coordenador_profile_id=$1 where id=$2", [id(3), id(14)]);
      assert.equal((await asUser(102, report)).rows.length, 2);
      assert.equal((await asUser(103, report)).rows.length, 4);
      assert.equal((await asUser(102, "select * from gop_v2.cobrancas_chamada")).rows.length, 0);
      assert.equal((await asUser(104, report)).rows.length, 2);
      await assert.rejects(asUser(102, "select gop_v2.editar_supervisor($1,$2,$3,$4)", [id(14), "Vinculo antigo", "A", null]), /Sem permissao/);
      assert.equal((await asUser(103, "select gop_v2.editar_supervisor($1,$2,$3,$4) as id", [id(14), "Nova coordenacao", "A", null])).rows[0].id, id(14));
    });
    await t.test("anon nao exporta nem cobra; periodos excessivos sao rejeitados", async () => {
      await assert.rejects(asUser(null, report), /permission denied/);
      await assert.rejects(asUser(null, "select gop_v2.cobrar_chamada($1,current_date)", [id(14)]), /permission denied/);
      await assert.rejects(asUser(101, "select * from gop_v2.relatorio_presencas(current_date-31,current_date)"), /31 dias/);
      await assert.rejects(asUser(101, "update gop_v2.funcionarios set modalidade_trabalho='qualquer'"), /check constraint/);
    });
  } finally { await db.close(); }
});
