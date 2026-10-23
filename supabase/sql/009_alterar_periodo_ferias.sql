-- Apply after 007 and 008. Admin-only, atomic replacement of a continuous vacation.
begin;
create or replace function gop_v2.consultar_periodo_ferias(p_funcionario_id uuid,p_referencia date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare inicio date; fim date; token text; bloqueados integer;
begin
  if not coalesce(gop_v2.is_admin(),false) then raise exception 'Somente admin pode consultar o ajuste de ferias' using errcode='42501'; end if;
  with dias as (
    select p.data_presenca,p.data_presenca-(row_number() over(order by p.data_presenca))::integer as grupo
    from gop_v2.presencas p where p.funcionario_id=p_funcionario_id and p.status='ferias'
  ) select min(data_presenca),max(data_presenca) into inicio,fim from dias
    where grupo=(select grupo from dias where data_presenca=p_referencia);
  if inicio is null then return null; end if;
  select md5(jsonb_agg(to_jsonb(p) order by p.data_presenca)::text) into token
    from gop_v2.presencas p where p.funcionario_id=p_funcionario_id and p.status='ferias' and p.data_presenca between inicio and fim;
  select count(*) into bloqueados from gop_v2.presencas p join gop_v2.fechamentos_chamada f
    on f.supervisor_id=p.supervisor_id and f.data_chamada=p.data_presenca
    where p.funcionario_id=p_funcionario_id and p.status='ferias' and p.data_presenca between inicio and fim;
  return jsonb_build_object('versao',1,'inicio',inicio,'fim',fim,'token',token,'dias_bloqueados',bloqueados);
end $$;

create or replace function gop_v2.alterar_periodo_ferias(
  p_funcionario_id uuid,p_referencia date,p_token text,p_inicio date,p_fim date
) returns void language plpgsql security invoker set search_path='' as $$
declare periodo jsonb; atual jsonb; inicio date; fim date; supervisor uuid; k record;
begin
  if not coalesce(gop_v2.is_admin(),false) then raise exception 'Somente admin pode alterar periodo de ferias' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim-p_inicio>365 then raise exception 'Periodo invalido (maximo 366 dias)' using errcode='22023'; end if;
  if p_token is null or length(p_token)<>32 then raise exception 'Recarregue o periodo de ferias' using errcode='40001'; end if;
  select f.supervisor_id into supervisor from gop_v2.funcionarios f join gop_v2.supervisores s on s.id=f.supervisor_id
    where f.id=p_funcionario_id and f.ativo=true and s.ativo=true;
  if supervisor is null then raise exception 'Colaborador ou equipe indisponivel' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ferias:'||p_funcionario_id::text,0));
  periodo:=gop_v2.consultar_periodo_ferias(p_funcionario_id,p_referencia);
  if periodo is null or periodo->>'token' is distinct from p_token then raise exception 'Periodo alterado por outra sessao; recarregue antes de salvar' using errcode='40001'; end if;
  inicio:=(periodo->>'inicio')::date; fim:=(periodo->>'fim')::date;
  for k in select distinct s,d from (
    select p.supervisor_id s,p.data_presenca d from gop_v2.presencas p
      where p.funcionario_id=p_funcionario_id and p.status='ferias' and p.data_presenca between inicio and fim
    union all select supervisor,p_inicio+n from generate_series(0,p_fim-p_inicio) n
  ) x order by s,d loop perform gop_v2.lock_chamada(k.s,k.d); end loop;
  -- Recheck after waiting for other writers/closures. Never trust stale dates from the UI.
  atual:=gop_v2.consultar_periodo_ferias(p_funcionario_id,p_referencia);
  if atual is null or atual->>'token' is distinct from p_token then raise exception 'Periodo alterado por outra sessao; recarregue antes de salvar' using errcode='40001'; end if;
  if exists(select 1 from gop_v2.presencas p join gop_v2.fechamentos_chamada f
    on f.supervisor_id=p.supervisor_id and f.data_chamada=p.data_presenca
    where p.funcionario_id=p_funcionario_id and p.status='ferias' and p.data_presenca between inicio and fim
      and p.data_presenca not between p_inicio and p_fim) then
    raise exception 'O ajuste removeria ferias de chamada finalizada' using errcode='55000';
  end if;
  if exists(select 1 from generate_series(0,p_fim-p_inicio) n join gop_v2.fechamentos_chamada f
    on f.supervisor_id=supervisor and f.data_chamada=p_inicio+n
    where p_inicio+n not between inicio and fim) then
    raise exception 'O novo periodo inclui chamada finalizada' using errcode='55000';
  end if;
  if exists(select 1 from gop_v2.presencas p where p.funcionario_id=p_funcionario_id and p.data_presenca between p_inicio and p_fim
    and p.data_presenca not between inicio and fim) then
    raise exception 'O novo periodo conflita com registros existentes; revise essas datas' using errcode='23505';
  end if;
  -- Keep intersection rows unchanged, including their IDs, notes and finalized days.
  delete from gop_v2.presencas p where p.funcionario_id=p_funcionario_id and p.status='ferias'
    and p.data_presenca between inicio and fim and p.data_presenca not between p_inicio and p_fim;
  insert into gop_v2.presencas(funcionario_id,supervisor_id,data_presenca,status,observacao)
    select p_funcionario_id,supervisor,p_inicio+n,'ferias','Ferias registradas por ajuste administrativo.'
    from generate_series(0,p_fim-p_inicio) n where p_inicio+n not between inicio and fim;
end $$;
revoke all on function gop_v2.consultar_periodo_ferias(uuid,date),gop_v2.alterar_periodo_ferias(uuid,date,text,date,date) from public,anon,authenticated;
grant execute on function gop_v2.consultar_periodo_ferias(uuid,date),gop_v2.alterar_periodo_ferias(uuid,date,text,date,date) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
