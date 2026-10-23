-- Apply after 007 when that migration is already installed.
-- Only admin may correct saved vacation; closed calls stay immutable.
begin;
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

notify pgrst,'reload schema';
commit;

