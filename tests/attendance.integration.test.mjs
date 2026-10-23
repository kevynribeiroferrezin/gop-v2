import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("ocorrências estruturadas, férias restritas ao admin e fechamento definitivo no PostgreSQL", async (t) => {
  const db = new PGlite();
  const id = n => `40000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
  try {
    for (const file of ["tests/fixtures/workspace.sql", "supabase/sql/001_security_audit_rls.sql", "supabase/sql/005_coordenacao_relatorios.sql"]) await db.exec(readFileSync(file,"utf8"));
    await db.exec(`insert into gop_v2.profiles values
      ('${id(1)}','${id(101)}','Admin','a@example.test','admin',true),
      ('${id(2)}','${id(102)}','Supervisor A','s@example.test','supervisor',true),
      ('${id(3)}','${id(103)}','Supervisor B','b@example.test','supervisor',true),
      ('${id(4)}','${id(104)}','Coord','c@example.test','coordenador',true),
      ('${id(5)}','${id(105)}','RH','r@example.test','rh',true),
      ('${id(6)}','${id(106)}','Inativo','i@example.test','supervisor',false);
      insert into gop_v2.supervisores values
      ('${id(12)}','${id(2)}','A','Supervisor A','s@example.test',true,'${id(4)}'),
      ('${id(13)}','${id(3)}','B','Supervisor B','b@example.test',true,null);
      insert into gop_v2.funcionarios(id,matricula,nome,supervisor_id,ativo) values
      ('${id(201)}','201','Pessoa A','${id(12)}',true),('${id(202)}','202','Pessoa B','${id(12)}',true),
      ('${id(203)}','203','Pessoa C','${id(13)}',true);`);
    await db.exec(`insert into gop_v2.presencas(funcionario_id,supervisor_id,data_presenca,status) values ('${id(201)}','${id(12)}',gop_v2.hoje_brasil()-2,'falta')`);
    const migration = readFileSync("supabase/sql/007_ocorrencias_travas_chamada.sql","utf8");
    await db.exec(migration); await db.exec(migration);
    const adminVacationMigration = readFileSync("supabase/sql/008_ferias_edicao_admin.sql","utf8");
    await db.exec(adminVacationMigration); await db.exec(adminVacationMigration);
    const periodMigration = readFileSync("supabase/sql/009_alterar_periodo_ferias.sql","utf8");
    await db.exec(periodMigration); await db.exec(periodMigration);
    async function asUser(n,sql,params=[]) {
      await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):""]);
      await db.exec(`set role ${n?"authenticated":"anon"}`); return db.query(sql,params);
    }
    const save = (actor, records, finish=false, offset=0, supervisor=12) => asUser(actor,
      "select gop_v2.salvar_chamada($1,gop_v2.hoje_brasil()+$2::integer,$3::jsonb,$4)", [id(supervisor),offset,JSON.stringify(records),finish]);
    const record = extra => ({funcionario_id:id(201),status:"presente",...extra});
    await t.test("campos obrigatórios rejeitados; respostas completas persistem e estado respeita hierarquia", async () => {
      for (const data of [{status:"falta"},{status:"falta",falta_justificada:true},{status:"atraso"},{status:"atraso",atraso_motivo:"medico"},{status:"atraso",atraso_motivo:"outro"},{status:"folga"},{status:"afastado"}]) await assert.rejects(save(102,[record(data)]));
      for (const data of [
        {status:"falta",falta_justificada:false}, {status:"falta",falta_justificada:true,falta_motivo:"Compromisso informado"},
        {status:"atraso",atraso_motivo:"transporte"}, {status:"atraso",atraso_motivo:"compromisso"},
        {status:"atraso",atraso_motivo:"medico",atraso_tem_atestado:false},
        {status:"atraso",atraso_motivo:"medico",atraso_tem_atestado:true,atestado_cid:"Z00.0"},
        {status:"atraso",atraso_motivo:"outro",atraso_detalhe:"Motivo informado"},
        {status:"atestado",atestado_cid:"Z00.0"}, {status:"atestado",atestado_cid:null},
        ...["escala","banco_horas","feriado"].map(folga_tipo=>({status:"folga",folga_tipo})),
        {status:"afastado",afastamento_motivo:"Motivo informado"},
      ]) {
        await save(102,[record(data)]);
        const state=(await asUser(102,"select gop_v2.estado_chamada(gop_v2.hoje_brasil()) as state")).rows[0].state;
        for (const [key,value] of Object.entries(data)) assert.equal(state.registros[0][key],value);
        assert.equal(state.registros.length,1);
      }
      await save(102,[record({status:"presente",atestado_cid:"nao deve ficar",afastamento_motivo:"remover"})]);
      const row=(await asUser(102,"select * from gop_v2.presencas")).rows[0]; assert.equal(row.atestado_cid,null);assert.equal(row.afastamento_motivo,null);
      assert.equal((await asUser(103,"select gop_v2.estado_chamada(gop_v2.hoje_brasil()) as state")).rows[0].state.registros.length,0);
      for(const actor of [103,104,105,106,null]) await assert.rejects(save(actor,[record({status:"presente"})]));
      await assert.rejects(save(102,[record({funcionario_id:id(203)})]),/fora da equipe/);
      await assert.rejects(save(102,[record({status:"falta",falta_justificada:"sim"})]),/Resposta invalida/);
    });
    await t.test("ocorrências legadas não recebem motivos inventados e exigem complemento antes de fechar", async () => {
      const state=(await asUser(102,"select gop_v2.estado_chamada(gop_v2.hoje_brasil()-2) as state")).rows[0].state;
      assert.equal(state.registros[0].falta_justificada,null);
      await assert.rejects(save(102,[],true,-2),/Complete os detalhes/);
      assert.equal((await asUser(102,"select * from gop_v2.fechamentos_chamada where data_chamada=gop_v2.hoje_brasil()-2")).rows.length,0);
      await save(102,[record({status:"falta",falta_justificada:false})],true,-2);
    });
    await t.test("férias gravadas são bloqueadas para supervisor e editáveis apenas por admin antes do fechamento", async () => {
      await asUser(102,"select gop_v2.registrar_ferias($1,gop_v2.hoje_brasil()+1,gop_v2.hoje_brasil()+3)",[id(201)]);
      assert.equal((await asUser(102,"select * from gop_v2.presencas where status='ferias'")).rows.length,3);
      await asUser(102,"select gop_v2.registrar_ferias($1,gop_v2.hoje_brasil()+2,gop_v2.hoje_brasil()+4)",[id(201)]);
      assert.equal((await asUser(102,"select * from gop_v2.presencas where status='ferias'")).rows.length,4);
      for(const actor of [102]) {
        await assert.rejects(save(actor,[record({status:"presente"})],false,1),/Somente admin/);
        await assert.rejects(asUser(actor,"delete from gop_v2.presencas where status='ferias'"),/Somente admin/);
        await assert.rejects(asUser(actor,"update gop_v2.presencas set data_presenca=gop_v2.hoje_brasil()+5 where status='ferias'"),/Somente admin/);
      }
      await save(101,[record({status:"presente"})],false,1);
      assert.equal((await asUser(101,"select status from gop_v2.presencas where data_presenca=gop_v2.hoje_brasil()+1")).rows[0].status,"presente");
      assert.equal((await asUser(101,"update gop_v2.presencas set observacao='Ajuste admin' where data_presenca=gop_v2.hoje_brasil()+2 returning id")).rows.length,1);
      for(const actor of [103,104,105,106]) assert.equal((await asUser(actor,"update gop_v2.presencas set observacao='Sem permissao' where status='ferias' returning id")).rows.length,0);
      assert.equal((await asUser(101,"delete from gop_v2.presencas where data_presenca=gop_v2.hoje_brasil()+2 returning id")).rows.length,1);
      await assert.rejects(save(102,[],true,1),/Chamada invalida/);
    });
    await t.test("admin substitui um período inteiro, remove dias antigos e preserva a interseção", async () => {
      await asUser(102,"select gop_v2.registrar_ferias($1,gop_v2.hoje_brasil()+10,gop_v2.hoje_brasil()+12)",[id(202)]);
      const read = () => asUser(101,"select gop_v2.consultar_periodo_ferias($1,gop_v2.hoje_brasil()+11) as periodo",[id(202)]);
      const original=(await read()).rows[0].periodo;
      const retained=(await asUser(101,"select id,observacao from gop_v2.presencas where funcionario_id=$1 and data_presenca=gop_v2.hoje_brasil()+11",[id(202)])).rows[0];
      const change = (actor,token,end=13) => asUser(actor,"select gop_v2.alterar_periodo_ferias($1,gop_v2.hoje_brasil()+11,$2,gop_v2.hoje_brasil()+11,gop_v2.hoje_brasil()+$3::integer)",[id(202),token,end]);
      for(const actor of [102,103,104,105,106,null]) await assert.rejects(change(actor,original.token),/Somente admin|permission denied/);
      await change(101,original.token);
      assert.equal((await asUser(101,"select * from gop_v2.presencas where funcionario_id=$1 and data_presenca=gop_v2.hoje_brasil()+10",[id(202)])).rows.length,0);
      assert.equal((await asUser(101,"select * from gop_v2.presencas where funcionario_id=$1 and data_presenca=gop_v2.hoje_brasil()+13",[id(202)])).rows[0].status,"ferias");
      assert.deepEqual((await asUser(101,"select id,observacao from gop_v2.presencas where funcionario_id=$1 and data_presenca=gop_v2.hoje_brasil()+11",[id(202)])).rows[0],retained);
      await assert.rejects(change(101,original.token,14),/outra sessao/);
      const updated=(await read()).rows[0].periodo;
      await save(102,[record({funcionario_id:id(202),status:"folga",folga_tipo:"escala"})],false,15);
      await assert.rejects(change(101,updated.token,15),/conflita/);
      assert.equal((await asUser(101,"select * from gop_v2.presencas where funcionario_id=$1 and data_presenca=gop_v2.hoje_brasil()+14",[id(202)])).rows.length,0);
      assert.equal((await asUser(101,"select status from gop_v2.presencas where funcionario_id=$1 and data_presenca=gop_v2.hoje_brasil()+15",[id(202)])).rows[0].status,"folga");
    });
    await t.test("ajustar dias abertos preserva chamadas finalizadas e rejeita remoção de dia finalizado", async () => {
      await asUser(102,"select gop_v2.registrar_ferias($1,gop_v2.hoje_brasil()-12,gop_v2.hoje_brasil()-10)",[id(202)]);
      await save(102,[],true,-11);
      const read = () => asUser(101,"select gop_v2.consultar_periodo_ferias($1,gop_v2.hoje_brasil()-11) as periodo",[id(202)]);
      const period=(await read()).rows[0].periodo;assert.equal(period.dias_bloqueados,1);
      const closedRow=(await asUser(101,"select * from gop_v2.presencas where funcionario_id=$1 and data_presenca=gop_v2.hoje_brasil()-11",[id(202)])).rows[0];
      await asUser(101,"select gop_v2.alterar_periodo_ferias($1,gop_v2.hoje_brasil()-11,$2,gop_v2.hoje_brasil()-13,gop_v2.hoje_brasil()-10)",[id(202),period.token]);
      assert.deepEqual((await asUser(101,"select * from gop_v2.presencas where funcionario_id=$1 and data_presenca=gop_v2.hoje_brasil()-11",[id(202)])).rows[0],closedRow);
      const updated=(await read()).rows[0].periodo;
      await assert.rejects(asUser(101,"select gop_v2.alterar_periodo_ferias($1,gop_v2.hoje_brasil()-11,$2,gop_v2.hoje_brasil()-10,gop_v2.hoje_brasil()-9)",[id(202),updated.token]),/chamada finalizada/);
      assert.equal((await read()).rows[0].periodo.token,updated.token);
    });
    await t.test("finalizar salva rascunhos atomicamente, congela presentes padrão e impede qualquer reabertura", async () => {
      await asUser(102,"select gop_v2.registrar_ferias($1,gop_v2.hoje_brasil(),gop_v2.hoje_brasil())",[id(202)]);
      await save(102,[record({status:"falta",falta_justificada:true,falta_motivo:"Justificativa"})],true);
      const rows=(await asUser(102,"select * from gop_v2.presencas where data_presenca=gop_v2.hoje_brasil() order by funcionario_id")).rows;
      assert.equal(rows.length,2);assert.equal(rows[0].status,"falta");assert.equal(rows[1].status,"ferias");
      const closure=(await asUser(102,"select * from gop_v2.fechamentos_chamada where data_chamada=gop_v2.hoje_brasil()")).rows[0];assert.equal(closure.total_funcionarios,2);assert.equal(closure.total_excecoes,2);
      for(const actor of [101,102]) {
        await assert.rejects(save(actor,[record({status:"presente"})]),/ja finalizada/);
        await assert.rejects(asUser(actor,"update gop_v2.presencas set observacao='x' where data_presenca=gop_v2.hoje_brasil()"),/Chamada finalizada/);
        await assert.rejects(asUser(actor,"delete from gop_v2.presencas where data_presenca=gop_v2.hoje_brasil()"),/Chamada finalizada/);
        await assert.rejects(asUser(actor,"update gop_v2.presencas set data_presenca=gop_v2.hoje_brasil()+7 where data_presenca=gop_v2.hoje_brasil()"),/Chamada finalizada/);
        await assert.rejects(asUser(actor,"insert into gop_v2.presencas(funcionario_id,supervisor_id,data_presenca,status) values ($1,$2,gop_v2.hoje_brasil(),'presente')",[id(201),id(12)]),/Chamada finalizada/);
        await assert.rejects(asUser(actor,"delete from gop_v2.fechamentos_chamada"),/nao pode ser alterada ou reaberta/);
        await assert.rejects(asUser(actor,"update gop_v2.fechamentos_chamada set observacao='x'"),/nao pode ser alterada ou reaberta/);
      }
      await assert.rejects(asUser(102,"select gop_v2.registrar_ferias($1,gop_v2.hoje_brasil()-1,gop_v2.hoje_brasil()+1)",[id(202)]),/finalizada/);
      assert.equal((await asUser(102,"select * from gop_v2.presencas where data_presenca=gop_v2.hoje_brasil()-1")).rows.length,0);
    });
    await t.test("falha na última ocorrência reverte o lote e não finaliza a chamada", async () => {
      await assert.rejects(save(102,[record({status:"atestado",atestado_cid:"Z00.0"}),record({funcionario_id:id(202),status:"afastado"})],true,-1));
      assert.equal((await asUser(102,"select * from gop_v2.presencas where data_presenca=gop_v2.hoje_brasil()-1")).rows.length,0);
      assert.equal((await asUser(102,"select * from gop_v2.fechamentos_chamada where data_chamada=gop_v2.hoje_brasil()-1")).rows.length,0);
      const logs=(await asUser(101,"select detalhes::text from gop_v2.audit_logs")).rows;
      assert.ok(logs.every(row=>!row.detalhes.includes("Z00.0")&&!row.detalhes.includes("Justificativa")));
    });
  } finally {await db.close();}
});
