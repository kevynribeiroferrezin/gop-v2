-- Execute depois do 001_security_audit_rls.sql para conferir RLS/policies.

select
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'gop_v2'
  and tablename in (
    'audit_logs',
    'profiles',
    'supervisores',
    'funcionarios',
    'presencas',
    'fechamentos_chamada',
    'cargos',
    'regionais'
  )
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'gop_v2'
order by tablename, policyname;

select gop_v2.hoje_brasil() as data_brasil;

select
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'gop_v2'
      and table_name = 'audit_logs'
  ) as audit_logs_existe;

