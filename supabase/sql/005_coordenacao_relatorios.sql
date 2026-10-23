-- Autorizado pelo usuario em 22/10/2026. Revisar o schema real antes de aplicar.
-- Requer as tabelas do sistema e helpers/audit_logs do 001. Nao apaga registros.
-- Preserva a implementacao existente de get_chamada_por_data(date).
begin;

-- Nao converter enums ou remover checks compostos sem examinar o banco real.
do $$
declare a record; c record;
begin
  select attnum, atttypid into a from pg_attribute
    where attrelid = 'gop_v2.profiles'::regclass and attname = 'role';
  if a.atttypid not in ('text'::regtype, 'varchar'::regtype) then
    raise exception 'profiles.role nao e text/varchar; revisar o tipo antes da migracao';
  end if;
  if exists (select 1 from gop_v2.profiles where role not in ('admin','rh','supervisor','coordenador')) then
    raise exception 'Existem papeis desconhecidos; revisar antes da migracao';
  end if;
  for c in select conname, conkey from pg_constraint
    where conrelid = 'gop_v2.profiles'::regclass and contype = 'c' and a.attnum = any(conkey)
  loop
    if cardinality(c.conkey) <> 1 then raise exception 'Check de role composto: %', c.conname; end if;
    execute format('alter table gop_v2.profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table gop_v2.profiles add constraint profiles_role_check
  check (role in ('admin','rh','supervisor','coordenador'));

alter table gop_v2.funcionarios add column if not exists nome_smart text;
alter table gop_v2.funcionarios add column if not exists modalidade_trabalho text not null default 'nao_informado';
alter table gop_v2.funcionarios drop constraint if exists funcionarios_modalidade_trabalho_check;
alter table gop_v2.funcionarios add constraint funcionarios_modalidade_trabalho_check
  check (modalidade_trabalho in ('nao_informado','home_office','presencial','hibrido'));
alter table gop_v2.funcionarios drop constraint if exists funcionarios_nome_smart_check;
alter table gop_v2.funcionarios add constraint funcionarios_nome_smart_check
  check (nome_smart is null or char_length(nome_smart) <= 200);

alter table gop_v2.supervisores add column if not exists coordenador_profile_id uuid
  references gop_v2.profiles(id);
create index if not exists supervisores_coordenador_profile_idx on gop_v2.supervisores(coordenador_profile_id);

create or replace function gop_v2.validate_coordinator_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if NEW.coordenador_profile_id is not null and not exists (
    select 1 from gop_v2.profiles p where p.id = NEW.coordenador_profile_id
      and p.role = 'coordenador' and p.ativo = true
  ) then raise exception 'Selecione um coordenador ativo'; end if;
  return NEW;
end $$;
drop trigger if exists validate_coordinator_link on gop_v2.supervisores;
create trigger validate_coordinator_link before insert or update of coordenador_profile_id
  on gop_v2.supervisores for each row execute function gop_v2.validate_coordinator_link();

create or replace function gop_v2.can_view_supervisor(p_supervisor_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(gop_v2.current_role() in ('admin','rh'), false) or exists (
    select 1 from gop_v2.supervisores s where s.id = p_supervisor_id and (
      (gop_v2.current_role() = 'coordenador' and s.coordenador_profile_id = gop_v2.current_profile_id())
      or (gop_v2.current_role() = 'supervisor' and s.id = gop_v2.current_supervisor_id())
    )
  );
$$;

create table if not exists gop_v2.cobrancas_chamada (
  id uuid primary key default gen_random_uuid(),
  remetente_profile_id uuid not null references gop_v2.profiles(id),
  supervisor_id uuid not null references gop_v2.supervisores(id),
  data_chamada date not null,
  mensagem text not null,
  created_at timestamptz not null default now(),
  lida_em timestamptz,
  unique (remetente_profile_id, supervisor_id, data_chamada)
);
create index if not exists cobrancas_supervisor_data_idx on gop_v2.cobrancas_chamada(supervisor_id, data_chamada);

-- Auditoria atomica, inclusive de vinculos e cobrancas, sem copiar PII.
create or replace function gop_v2.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb;
begin
  row_data := case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  insert into gop_v2.audit_logs
    (actor_user_id,actor_profile_id,actor_role,entidade,entidade_id,acao,detalhes)
  values (auth.uid(),gop_v2.current_profile_id(),gop_v2.current_role(),TG_TABLE_NAME,row_data->>'id',
    case TG_OP when 'INSERT' then 'criar' when 'UPDATE' then 'atualizar' else 'excluir' end,
    jsonb_build_object('origem','database_trigger'));
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','supervisores','funcionarios','presencas','fechamentos_chamada','cargos','regionais','cobrancas_chamada'] loop
    execute format('drop trigger if exists security_audit_change on gop_v2.%I',t);
    execute format('create trigger security_audit_change after insert or update or delete on gop_v2.%I for each row execute function gop_v2.audit_row_change()',t);
  end loop;
end $$;

-- Remover policies legadas permissivas: uma policy aberta anularia o isolamento.
do $$
declare p record; t text;
begin
  for p in select tablename, policyname from pg_policies where schemaname='gop_v2'
    and tablename in ('profiles','supervisores','funcionarios','presencas','fechamentos_chamada','cargos','regionais','audit_logs','cobrancas_chamada')
  loop execute format('drop policy %I on gop_v2.%I', p.policyname,p.tablename); end loop;
  foreach t in array array['profiles','supervisores','funcionarios','presencas','fechamentos_chamada','cargos','regionais','audit_logs','cobrancas_chamada']
  loop execute format('alter table gop_v2.%I enable row level security', t); end loop;
end $$;

create policy profiles_read on gop_v2.profiles for select to authenticated
  using ((user_id = auth.uid() and ativo = true) or gop_v2.is_admin());
create policy profiles_write on gop_v2.profiles for all to authenticated
  using (gop_v2.is_admin()) with check (gop_v2.is_admin());
create policy supervisors_read on gop_v2.supervisores for select to authenticated
  using (gop_v2.can_view_supervisor(id));
create policy supervisors_write on gop_v2.supervisores for all to authenticated
  using (gop_v2.is_admin()) with check (gop_v2.is_admin());
create policy employees_read on gop_v2.funcionarios for select to authenticated
  using (gop_v2.can_view_supervisor(supervisor_id));
create policy employees_write on gop_v2.funcionarios for all to authenticated
  using (gop_v2.is_rh_or_admin()) with check (gop_v2.is_rh_or_admin());
create policy attendance_read on gop_v2.presencas for select to authenticated
  using (gop_v2.is_rh_or_admin() or (gop_v2.can_view_supervisor(supervisor_id) and exists (
    select 1 from gop_v2.funcionarios f where f.id = funcionario_id and f.supervisor_id = presencas.supervisor_id
  )));
create policy attendance_write on gop_v2.presencas for all to authenticated
  using (gop_v2.is_admin() or (supervisor_id = gop_v2.current_supervisor_id() and exists (
    select 1 from gop_v2.funcionarios f where f.id = funcionario_id and f.supervisor_id = gop_v2.current_supervisor_id()
  )))
  with check (gop_v2.is_admin() or (supervisor_id = gop_v2.current_supervisor_id() and exists (
    select 1 from gop_v2.funcionarios f where f.id = funcionario_id and f.supervisor_id = gop_v2.current_supervisor_id()
  )));
create policy closures_read on gop_v2.fechamentos_chamada for select to authenticated
  using (gop_v2.can_view_supervisor(supervisor_id));
create policy closures_write on gop_v2.fechamentos_chamada for all to authenticated
  using (gop_v2.is_admin() or supervisor_id = gop_v2.current_supervisor_id())
  with check (gop_v2.is_admin() or (supervisor_id = gop_v2.current_supervisor_id() and fechado_por = gop_v2.current_profile_id()));
create policy cargos_read on gop_v2.cargos for select to authenticated using (gop_v2.current_profile_id() is not null);
create policy cargos_write on gop_v2.cargos for all to authenticated using (gop_v2.is_rh_or_admin()) with check (gop_v2.is_rh_or_admin());
create policy regionais_read on gop_v2.regionais for select to authenticated using (gop_v2.current_profile_id() is not null);
create policy regionais_write on gop_v2.regionais for all to authenticated using (gop_v2.is_rh_or_admin()) with check (gop_v2.is_rh_or_admin());
create policy audit_read on gop_v2.audit_logs for select to authenticated using (gop_v2.is_admin());
create policy reminders_read on gop_v2.cobrancas_chamada for select to authenticated using (
  gop_v2.is_admin() or supervisor_id = gop_v2.current_supervisor_id()
  or (remetente_profile_id = gop_v2.current_profile_id() and gop_v2.can_view_supervisor(supervisor_id))
);
create policy reminders_ack on gop_v2.cobrancas_chamada for update to authenticated
  using (supervisor_id = gop_v2.current_supervisor_id())
  with check (supervisor_id = gop_v2.current_supervisor_id());

-- Nova view evita destruir dependencias da view antiga.
create or replace view gop_v2.vw_colaboradores_acesso with (security_invoker=true) as
  select f.id, f.matricula, f.nome, f.cargo_id, c.codigo as cargo_codigo, c.nome as cargo_nome,
    f.supervisor_id, s.codigo as supervisor_codigo, s.nome as supervisor_nome,
    f.data_admissao, f.status, f.ativo, f.observacao, f.regional_id,
    r.codigo as regional_codigo, r.nome as regional_nome, f.nome_smart, f.modalidade_trabalho,
    s.coordenador_profile_id
  from gop_v2.funcionarios f left join gop_v2.cargos c on c.id=f.cargo_id
    left join gop_v2.supervisores s on s.id=f.supervisor_id
    left join gop_v2.regionais r on r.id=f.regional_id;

alter function gop_v2.get_chamada_por_data(date) security invoker;
create or replace function gop_v2.relatorio_presencas(p_inicio date, p_fim date)
returns table (
  data_referencia date, funcionario_id uuid, matricula text, funcionario_nome text,
  nome_smart text, modalidade_trabalho text, cargo_nome text, supervisor_id uuid,
  supervisor_nome text, coordenador_profile_id uuid, status_presenca text,
  possui_registro_manual boolean, chamada_pendente boolean
) language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 30 then
    raise exception 'Selecione um periodo valido de ate 31 dias';
  end if;
  return query
    select (p_inicio + days.n)::date, f.id, f.matricula::text, f.nome::text,
      f.nome_smart, f.modalidade_trabalho, ch.cargo_nome::text, s.id, s.nome::text,
      s.coordenador_profile_id, coalesce(ch.status_presenca::text,'presente'),
      coalesce(ch.possui_registro_manual,false),
      (fc.supervisor_id is null and p_inicio + days.n <= gop_v2.hoje_brasil())
    from pg_catalog.generate_series(0, p_fim-p_inicio) days(n)
    cross join lateral gop_v2.get_chamada_por_data(p_inicio + days.n) ch
    join gop_v2.funcionarios f on f.id=ch.funcionario_id and f.supervisor_id=ch.supervisor_id
    join gop_v2.supervisores s on s.id=f.supervisor_id
    left join gop_v2.fechamentos_chamada fc on fc.supervisor_id=s.id and fc.data_chamada=p_inicio + days.n
    where gop_v2.can_view_supervisor(s.id);
end $$;

create or replace function gop_v2.cobrar_chamada(p_supervisor_id uuid, p_data date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; actor uuid := gop_v2.current_profile_id(); actor_name text;
begin
  if actor is null or not coalesce(gop_v2.current_role() in ('admin','coordenador'),false)
    or not gop_v2.can_view_supervisor(p_supervisor_id) then
    raise exception 'Sem permissao para cobrar este supervisor' using errcode='42501';
  end if;
  if p_data is null or p_data > gop_v2.hoje_brasil() or p_data < gop_v2.hoje_brasil()-93 then
    raise exception 'Data de cobranca invalida';
  end if;
  if not exists (select 1 from gop_v2.supervisores where id=p_supervisor_id and ativo=true) then
    raise exception 'Supervisor indisponivel';
  end if;
  if exists (select 1 from gop_v2.fechamentos_chamada where supervisor_id=p_supervisor_id and data_chamada=p_data) then
    raise exception 'Esta chamada ja foi finalizada';
  end if;
  select nome into actor_name from gop_v2.profiles where id=actor;
  insert into gop_v2.cobrancas_chamada (remetente_profile_id,supervisor_id,data_chamada,mensagem)
    values (actor,p_supervisor_id,p_data,left(coalesce(actor_name,'A gestao'),200)||' solicitou a finalizacao desta chamada.')
    on conflict (remetente_profile_id,supervisor_id,data_chamada) do nothing returning id into result;
  if result is null then select id into result from gop_v2.cobrancas_chamada
    where remetente_profile_id=actor and supervisor_id=p_supervisor_id and data_chamada=p_data; end if;
  return result;
end $$;

-- Esquema fechado para anon; apenas RPCs conhecidas ficam disponiveis.
revoke all on schema gop_v2 from public, anon;
grant usage on schema gop_v2 to authenticated, service_role;
revoke all on all tables in schema gop_v2 from public, anon, authenticated;
revoke execute on all functions in schema gop_v2 from public, anon, authenticated;
grant select,insert,update,delete on gop_v2.profiles,gop_v2.supervisores,gop_v2.funcionarios,
  gop_v2.presencas,gop_v2.fechamentos_chamada,gop_v2.cargos,gop_v2.regionais to authenticated;
grant select on gop_v2.vw_colaboradores_acesso,gop_v2.vw_funcionarios_completo,
  gop_v2.audit_logs,gop_v2.cobrancas_chamada to authenticated;
grant update(lida_em) on gop_v2.cobrancas_chamada to authenticated;
grant all on gop_v2.cobrancas_chamada to service_role;
grant usage on all sequences in schema gop_v2 to authenticated;
grant execute on function gop_v2.current_profile_id(),gop_v2.current_role(),gop_v2.is_admin(),
  gop_v2.is_rh_or_admin(),gop_v2.current_supervisor_id(),gop_v2.hoje_brasil(),
  gop_v2.can_view_supervisor(uuid),gop_v2.get_chamada_por_data(date),
  gop_v2.relatorio_presencas(date,date),gop_v2.cobrar_chamada(uuid,date) to authenticated,service_role;
alter function gop_v2.current_profile_id() set search_path='';
alter function gop_v2.current_role() set search_path='';
alter function gop_v2.is_admin() set search_path='';
alter function gop_v2.is_rh_or_admin() set search_path='';
alter function gop_v2.current_supervisor_id() set search_path='';
do $$ declare v record; begin
  for v in select viewname from pg_views where schemaname='gop_v2' loop
    execute format('alter view gop_v2.%I set (security_invoker=true)',v.viewname);
  end loop;
end $$;
alter default privileges in schema gop_v2 revoke execute on functions from public;
notify pgrst, 'reload schema';
commit;
