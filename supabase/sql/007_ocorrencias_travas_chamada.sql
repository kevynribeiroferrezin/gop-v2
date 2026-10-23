-- Apply after 001 and 005 (006 may also be applied). No historical details are invented.
begin;
alter table gop_v2.presencas
  add column if not exists observacao text,
  add column if not exists falta_justificada boolean,
  add column if not exists falta_motivo text,
  add column if not exists atraso_motivo text,
  add column if not exists atraso_detalhe text,
  add column if not exists atraso_tem_atestado boolean,
  add column if not exists atestado_cid text,
  add column if not exists folga_tipo text,
  add column if not exists afastamento_motivo text;
alter table gop_v2.fechamentos_chamada
  add column if not exists total_funcionarios integer,
  add column if not exists total_excecoes integer,
  add column if not exists observacao text;

-- Shared transaction lock serializes presence writes and closure of the same team/day.
create or replace function gop_v2.lock_chamada(p_supervisor uuid,p_data date)
returns void language sql volatile set search_path='' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_supervisor::text || ':' || p_data::text,0));
$$;

create or replace function gop_v2.guard_presenca()
returns trigger language plpgsql security definer set search_path='' as $$
declare k record; changed boolean;
begin
  -- Deterministic ordering also protects attempts to move a row to another date/team.
  for k in select distinct s,d from (
    select case when TG_OP <> 'INSERT' then OLD.supervisor_id end s, case when TG_OP <> 'INSERT' then OLD.data_presenca end d
    union all select case when TG_OP <> 'DELETE' then NEW.supervisor_id end,case when TG_OP <> 'DELETE' then NEW.data_presenca end
  ) x where s is not null and d is not null order by s,d loop
    perform gop_v2.lock_chamada(k.s,k.d);
    if exists(select 1 from gop_v2.fechamentos_chamada where supervisor_id=k.s and data_chamada=k.d) then
      raise exception 'Chamada finalizada: nenhuma alteracao e permitida' using errcode='55000';
    end if;
  end loop;
  if TG_OP <> 'INSERT' and OLD.status='ferias' and not coalesce(gop_v2.is_admin(),false) then
    raise exception 'Somente admin pode alterar ou excluir ferias ja registradas' using errcode='55000';
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  if NEW.supervisor_id is null or NEW.data_presenca is null or NEW.funcionario_id is null then
    raise exception 'Identificacao da presenca obrigatoria' using errcode='22023';
  end if;
  changed := TG_OP='INSERT';
  if TG_OP='UPDATE' then
    changed := (to_jsonb(NEW) - 'id') is distinct from (to_jsonb(OLD) - 'id');
  end if;
  if not changed then return NEW; end if;
  if NEW.status is null or NEW.status not in ('presente','falta','atraso','atestado','folga','ferias','afastado') then
    raise exception 'Status invalido' using errcode='22023';
  end if;
  if NEW.status <> 'falta' then NEW.falta_justificada:=null; NEW.falta_motivo:=null;
  elsif NEW.falta_justificada is null then raise exception 'Informe se a falta e justificada' using errcode='22023';
  elsif NEW.falta_justificada and nullif(btrim(NEW.falta_motivo),'') is null then raise exception 'Informe o motivo da falta justificada' using errcode='22023';
  elsif not NEW.falta_justificada then NEW.falta_motivo:=null; end if;
  if NEW.status <> 'atraso' then NEW.atraso_motivo:=null; NEW.atraso_detalhe:=null; NEW.atraso_tem_atestado:=null;
  else
    if NEW.atraso_motivo is null or NEW.atraso_motivo not in ('transporte','compromisso','medico','outro') then raise exception 'Informe o motivo do atraso' using errcode='22023'; end if;
    if NEW.atraso_motivo='outro' and nullif(btrim(NEW.atraso_detalhe),'') is null then raise exception 'Descreva o atraso' using errcode='22023'; end if;
    if NEW.atraso_motivo='medico' and NEW.atraso_tem_atestado is null then raise exception 'Informe se possui atestado' using errcode='22023'; end if;
    if NEW.atraso_motivo <> 'medico' then NEW.atraso_tem_atestado:=null; end if;
  end if;
  if not (NEW.status='atestado' or (NEW.status='atraso' and NEW.atraso_motivo='medico' and coalesce(NEW.atraso_tem_atestado,false))) then NEW.atestado_cid:=null; end if;
  if NEW.status <> 'folga' then NEW.folga_tipo:=null;
  elsif NEW.folga_tipo is null or NEW.folga_tipo not in ('escala','banco_horas','feriado') then raise exception 'Selecione o tipo de folga' using errcode='22023'; end if;
  if NEW.status <> 'afastado' then NEW.afastamento_motivo:=null;
  elsif nullif(btrim(NEW.afastamento_motivo),'') is null then raise exception 'Informe o motivo do afastamento' using errcode='22023'; end if;
  if length(coalesce(NEW.falta_motivo,''))>2000 or length(coalesce(NEW.atraso_detalhe,''))>2000
    or length(coalesce(NEW.afastamento_motivo,''))>2000 or length(coalesce(NEW.observacao,''))>2000
    or length(coalesce(NEW.atestado_cid,''))>20 then raise exception 'Detalhes excedem o tamanho permitido' using errcode='22023'; end if;
  return NEW;
end $$;
drop trigger if exists guard_presenca on gop_v2.presencas;
create trigger guard_presenca before insert or update or delete on gop_v2.presencas for each row execute function gop_v2.guard_presenca();

create or replace function gop_v2.guard_fechamento()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP <> 'INSERT' then raise exception 'Chamada finalizada nao pode ser alterada ou reaberta' using errcode='55000'; end if;
  if NEW.supervisor_id is null or NEW.data_chamada is null or NEW.data_chamada > gop_v2.hoje_brasil() then raise exception 'Data de fechamento invalida' using errcode='22023'; end if;
  perform gop_v2.lock_chamada(NEW.supervisor_id,NEW.data_chamada);
  if exists(select 1 from gop_v2.fechamentos_chamada where supervisor_id=NEW.supervisor_id and data_chamada=NEW.data_chamada) then
    raise exception 'Chamada ja finalizada' using errcode='55000';
  end if;
  if exists(select 1 from gop_v2.presencas p join gop_v2.funcionarios f on f.id=p.funcionario_id
    where p.supervisor_id=NEW.supervisor_id and p.data_presenca=NEW.data_chamada and f.supervisor_id=NEW.supervisor_id and f.ativo=true and (
      p.status is null or p.status not in ('presente','falta','atraso','atestado','folga','ferias','afastado')
      or (p.status='falta' and (p.falta_justificada is null or (p.falta_justificada and nullif(btrim(p.falta_motivo),'') is null)))
      or (p.status='atraso' and (p.atraso_motivo is null or (p.atraso_motivo='medico' and p.atraso_tem_atestado is null) or (p.atraso_motivo='outro' and nullif(btrim(p.atraso_detalhe),'') is null)))
      or (p.status='folga' and p.folga_tipo is null) or (p.status='afastado' and nullif(btrim(p.afastamento_motivo),'') is null)
    )) then raise exception 'Complete os detalhes das ocorrencias antes de finalizar' using errcode='22023'; end if;
  return NEW;
end $$;
drop trigger if exists guard_fechamento on gop_v2.fechamentos_chamada;
create trigger guard_fechamento before insert or update or delete on gop_v2.fechamentos_chamada for each row execute function gop_v2.guard_fechamento();

create or replace function gop_v2.estado_chamada(p_data date)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if not coalesce(gop_v2.current_role() in ('admin','supervisor'),false) then raise exception 'Sem permissao' using errcode='42501'; end if;
  return jsonb_build_object('versao',1,
    'registros',coalesce((select jsonb_agg(jsonb_build_object('funcionario_id',p.funcionario_id,'supervisor_id',p.supervisor_id,'status',p.status,'observacao',p.observacao,
      'falta_justificada',p.falta_justificada,'falta_motivo',p.falta_motivo,'atraso_motivo',p.atraso_motivo,'atraso_detalhe',p.atraso_detalhe,
      'atraso_tem_atestado',p.atraso_tem_atestado,'atestado_cid',p.atestado_cid,'folga_tipo',p.folga_tipo,'afastamento_motivo',p.afastamento_motivo))
      from gop_v2.presencas p where p.data_presenca=p_data),'[]'::jsonb),
    'fechamentos',coalesce((select jsonb_agg(f.supervisor_id) from gop_v2.fechamentos_chamada f where f.data_chamada=p_data),'[]'::jsonb));
end $$;

create or replace function gop_v2.salvar_chamada(p_supervisor_id uuid,p_data date,p_registros jsonb,p_finalizar boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb; p gop_v2.presencas%rowtype; total integer; excecoes integer;
begin
  if not coalesce(gop_v2.current_role() in ('admin','supervisor'),false)
    or not (gop_v2.is_admin() or p_supervisor_id=gop_v2.current_supervisor_id()) then raise exception 'Sem permissao' using errcode='42501'; end if;
  if p_data is null or p_supervisor_id is null or not exists(select 1 from gop_v2.supervisores where id=p_supervisor_id and ativo=true)
    or jsonb_typeof(p_registros) is distinct from 'array' or jsonb_array_length(p_registros)>5000
    or p_finalizar is null or (p_finalizar and p_data>gop_v2.hoje_brasil()) then raise exception 'Chamada invalida' using errcode='22023'; end if;
  perform gop_v2.lock_chamada(p_supervisor_id,p_data);
  if exists(select 1 from gop_v2.fechamentos_chamada where supervisor_id=p_supervisor_id and data_chamada=p_data) then raise exception 'Chamada ja finalizada' using errcode='55000'; end if;
  for item in select value from jsonb_array_elements(p_registros) loop
    if jsonb_typeof(item) is distinct from 'object' or exists(select 1 from jsonb_object_keys(item) k where k not in
      ('funcionario_id','status','observacao','falta_justificada','falta_motivo','atraso_motivo','atraso_detalhe','atraso_tem_atestado','atestado_cid','folga_tipo','afastamento_motivo')) then raise exception 'Registro invalido' using errcode='22023'; end if;
    if (item->'falta_justificada' is not null and jsonb_typeof(item->'falta_justificada') not in ('boolean','null'))
      or (item->'atraso_tem_atestado' is not null and jsonb_typeof(item->'atraso_tem_atestado') not in ('boolean','null')) then raise exception 'Resposta invalida' using errcode='22023'; end if;
    p := jsonb_populate_record(null::gop_v2.presencas,item);
    if not exists(select 1 from gop_v2.funcionarios where id=p.funcionario_id and supervisor_id=p_supervisor_id and ativo=true) then raise exception 'Colaborador fora da equipe' using errcode='42501'; end if;
    insert into gop_v2.presencas(funcionario_id,supervisor_id,data_presenca,status,observacao,falta_justificada,falta_motivo,atraso_motivo,atraso_detalhe,atraso_tem_atestado,atestado_cid,folga_tipo,afastamento_motivo)
      values(p.funcionario_id,p_supervisor_id,p_data,p.status,p.observacao,p.falta_justificada,p.falta_motivo,p.atraso_motivo,p.atraso_detalhe,p.atraso_tem_atestado,p.atestado_cid,p.folga_tipo,p.afastamento_motivo)
    on conflict(funcionario_id,data_presenca) do update set status=excluded.status,observacao=excluded.observacao,
      falta_justificada=excluded.falta_justificada,falta_motivo=excluded.falta_motivo,atraso_motivo=excluded.atraso_motivo,atraso_detalhe=excluded.atraso_detalhe,
      atraso_tem_atestado=excluded.atraso_tem_atestado,atestado_cid=excluded.atestado_cid,folga_tipo=excluded.folga_tipo,afastamento_motivo=excluded.afastamento_motivo;
  end loop;
  if p_finalizar then
    -- Freeze default presence as real rows, preserving every existing exception/vacation.
    insert into gop_v2.presencas(funcionario_id,supervisor_id,data_presenca,status)
      select f.id,p_supervisor_id,p_data,'presente' from gop_v2.funcionarios f where f.supervisor_id=p_supervisor_id and f.ativo=true
      on conflict(funcionario_id,data_presenca) do nothing;
    select count(*),count(*) filter(where pr.status<>'presente') into total,excecoes from gop_v2.funcionarios f
      join gop_v2.presencas pr on pr.funcionario_id=f.id and pr.supervisor_id=p_supervisor_id and pr.data_presenca=p_data
      where f.supervisor_id=p_supervisor_id and f.ativo=true;
    if total=0 then raise exception 'Equipe sem colaboradores' using errcode='22023'; end if;
    if total <> (select count(*) from gop_v2.funcionarios where supervisor_id=p_supervisor_id and ativo=true) then
      raise exception 'Existem registros de outra equipe nesta data; revise os vinculos antes de finalizar' using errcode='22023';
    end if;
    insert into gop_v2.fechamentos_chamada(supervisor_id,data_chamada,fechado_por,total_funcionarios,total_excecoes,observacao)
      values(p_supervisor_id,p_data,gop_v2.current_profile_id(),total,excecoes,'Chamada finalizada pelo sistema.');
  end if;
end $$;

create or replace function gop_v2.registrar_ferias(p_funcionario_id uuid,p_inicio date,p_fim date)
returns void language plpgsql security invoker set search_path='' as $$
declare supervisor uuid; d date;
begin
  select supervisor_id into supervisor from gop_v2.funcionarios where id=p_funcionario_id and ativo=true;
  if not coalesce(gop_v2.current_role() in ('admin','supervisor'),false) or supervisor is null
    or not (gop_v2.is_admin() or supervisor=gop_v2.current_supervisor_id()) then raise exception 'Sem permissao' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim-p_inicio>365 then raise exception 'Periodo de ferias invalido (maximo 366 dias)' using errcode='22023'; end if;
  for d in select p_inicio+n from generate_series(0,p_fim-p_inicio) n loop
    perform gop_v2.lock_chamada(supervisor,d);
    if exists(select 1 from gop_v2.fechamentos_chamada where supervisor_id=supervisor and data_chamada=d) then raise exception 'Periodo inclui chamada finalizada' using errcode='55000'; end if;
    insert into gop_v2.presencas(funcionario_id,supervisor_id,data_presenca,status,observacao)
      values(p_funcionario_id,supervisor,d,'ferias','Ferias de '||p_inicio::text||' ate '||p_fim::text)
      on conflict(funcionario_id,data_presenca) do update set status='ferias',observacao=excluded.observacao
      where presencas.status is distinct from 'ferias';
  end loop;
end $$;

revoke all on function gop_v2.guard_presenca(),gop_v2.guard_fechamento(),gop_v2.lock_chamada(uuid,date) from public,anon,authenticated;
grant execute on function gop_v2.lock_chamada(uuid,date) to authenticated,service_role;
revoke all on function gop_v2.estado_chamada(date),gop_v2.salvar_chamada(uuid,date,jsonb,boolean),gop_v2.registrar_ferias(uuid,date,date) from public,anon,authenticated;
grant execute on function gop_v2.estado_chamada(date),gop_v2.salvar_chamada(uuid,date,jsonb,boolean),gop_v2.registrar_ferias(uuid,date,date) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
