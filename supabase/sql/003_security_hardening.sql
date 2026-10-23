-- PROPOSTA AINDA NAO APLICADA. Depende de conexao e revisao do schema real.
-- Requer revisar o formato real (004) e testar em homologacao antes de aplicar.
-- Aplicar depois de 001. Transacional: qualquer erro desfaz toda a migracao.
begin;

-- Politicas permissivas se somam com OR. Remover inclusive nomes legados.
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'gop_v2' and tablename in
      ('profiles','supervisores','funcionarios','presencas',
       'fechamentos_chamada','cargos','regionais','audit_logs')
  loop
    execute format('drop policy %I on gop_v2.%I', p.policyname, p.tablename);
  end loop;
end $$;

revoke all on schema gop_v2 from public, anon;
grant usage on schema gop_v2 to authenticated, service_role;
revoke all on all tables in schema gop_v2 from public, anon, authenticated;
revoke all on all sequences in schema gop_v2 from public, anon, authenticated;
revoke execute on all functions in schema gop_v2 from public, anon, authenticated;
alter default privileges in schema gop_v2 revoke execute on functions from public;
alter default privileges in schema gop_v2 revoke all on tables from anon, authenticated;
alter default privileges in schema gop_v2 revoke all on sequences from anon, authenticated;

-- Helpers sao SECURITY DEFINER por necessidade de evitar recursao de RLS.
-- Nenhum objeto de schemas gravaveis deve resolver por search_path.
alter function gop_v2.current_profile_id() set search_path = '';
alter function gop_v2.current_role() set search_path = '';
alter function gop_v2.is_admin() set search_path = '';
alter function gop_v2.is_rh_or_admin() set search_path = '';
alter function gop_v2.current_supervisor_id() set search_path = '';
grant execute on function gop_v2.current_profile_id(), gop_v2.current_role(),
  gop_v2.is_admin(), gop_v2.is_rh_or_admin(), gop_v2.current_supervisor_id(),
  gop_v2.hoje_brasil() to authenticated, service_role;

-- RPC principal: executa como o solicitante, respeitando RLS.
-- A definicao original nao esta no repositorio; falhar se ela nao existir.
alter function gop_v2.get_chamada_por_data(date) security invoker;
grant execute on function gop_v2.get_chamada_por_data(date) to authenticated, service_role;

-- Views nao podem herdar o bypass de RLS do owner.
do $$
declare v record;
begin
  for v in select viewname from pg_views where schemaname = 'gop_v2'
  loop
    execute format('alter view gop_v2.%I set (security_invoker = true)', v.viewname);
  end loop;
end $$;
grant select on gop_v2.vw_funcionarios_completo to authenticated;

grant select, insert, update, delete on gop_v2.profiles, gop_v2.supervisores,
  gop_v2.funcionarios, gop_v2.presencas, gop_v2.fechamentos_chamada,
  gop_v2.cargos, gop_v2.regionais to authenticated;
grant select on gop_v2.audit_logs to authenticated;
-- Cadastros numericos existentes usam sequences; RLS ainda controla INSERT.
grant usage on all sequences in schema gop_v2 to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles','supervisores','funcionarios','presencas',
    'fechamentos_chamada','cargos','regionais','audit_logs']
  loop
    execute format('alter table gop_v2.%I enable row level security', t);
  end loop;
end $$;

create policy profiles_read on gop_v2.profiles for select to authenticated
  using ((user_id = auth.uid() and ativo = true) or gop_v2.is_admin());
create policy profiles_write on gop_v2.profiles for all to authenticated
  using (gop_v2.is_admin()) with check (gop_v2.is_admin());
create policy supervisores_read on gop_v2.supervisores for select to authenticated
  using (gop_v2.is_rh_or_admin() or profile_id = gop_v2.current_profile_id());
create policy supervisores_write on gop_v2.supervisores for all to authenticated
  using (gop_v2.is_admin()) with check (gop_v2.is_admin());
create policy funcionarios_read on gop_v2.funcionarios for select to authenticated
  using (gop_v2.is_rh_or_admin() or supervisor_id = gop_v2.current_supervisor_id());
create policy funcionarios_write on gop_v2.funcionarios for all to authenticated
  using (gop_v2.is_rh_or_admin()) with check (gop_v2.is_rh_or_admin());
create policy presencas_read on gop_v2.presencas for select to authenticated
  using (gop_v2.is_rh_or_admin() or (
    supervisor_id = gop_v2.current_supervisor_id() and exists (
      select 1 from gop_v2.funcionarios f where f.id = funcionario_id
        and f.supervisor_id = gop_v2.current_supervisor_id()
    )
  ));
create policy presencas_write on gop_v2.presencas for all to authenticated
  using (gop_v2.is_admin() or (
    supervisor_id = gop_v2.current_supervisor_id() and exists (
      select 1 from gop_v2.funcionarios f where f.id = funcionario_id
        and f.supervisor_id = gop_v2.current_supervisor_id()
    )
  ))
  with check (gop_v2.is_admin() or (
    supervisor_id = gop_v2.current_supervisor_id() and exists (
      select 1 from gop_v2.funcionarios f where f.id = funcionario_id
        and f.supervisor_id = gop_v2.current_supervisor_id()
    )
  ));
create policy fechamentos_read on gop_v2.fechamentos_chamada for select to authenticated
  using (gop_v2.is_rh_or_admin() or supervisor_id = gop_v2.current_supervisor_id());
create policy fechamentos_write on gop_v2.fechamentos_chamada for all to authenticated
  using (gop_v2.is_admin() or supervisor_id = gop_v2.current_supervisor_id())
  with check (gop_v2.is_admin() or (
    supervisor_id = gop_v2.current_supervisor_id()
    and fechado_por = gop_v2.current_profile_id()
  ));
create policy cargos_read on gop_v2.cargos for select to authenticated
  using (gop_v2.current_profile_id() is not null);
create policy cargos_write on gop_v2.cargos for all to authenticated
  using (gop_v2.is_rh_or_admin()) with check (gop_v2.is_rh_or_admin());
create policy regionais_read on gop_v2.regionais for select to authenticated
  using (gop_v2.current_profile_id() is not null);
create policy regionais_write on gop_v2.regionais for all to authenticated
  using (gop_v2.is_rh_or_admin()) with check (gop_v2.is_rh_or_admin());
create policy audit_read on gop_v2.audit_logs for select to authenticated
  using (gop_v2.is_admin());

-- Log atomico com a mutacao: nao aceita evento montado pelo navegador.
-- Nao copia PII, observacoes ou senhas para detalhes.
create or replace function gop_v2.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb;
begin
  row_data := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  insert into gop_v2.audit_logs
    (actor_user_id, actor_profile_id, actor_role, entidade, entidade_id, acao, detalhes)
  values (auth.uid(), gop_v2.current_profile_id(), gop_v2.current_role(),
    TG_TABLE_NAME, row_data->>'id',
    case TG_OP when 'INSERT' then 'criar' when 'UPDATE' then 'atualizar' else 'excluir' end,
    jsonb_build_object('origem', 'database_trigger'));
  return null;
end $$;
revoke all on function gop_v2.audit_row_change() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['profiles','supervisores','funcionarios','presencas',
    'fechamentos_chamada','cargos','regionais']
  loop
    execute format('drop trigger if exists security_audit_change on gop_v2.%I', t);
    execute format('create trigger security_audit_change after insert or update or delete on gop_v2.%I for each row execute function gop_v2.audit_row_change()', t);
  end loop;
end $$;
commit;
