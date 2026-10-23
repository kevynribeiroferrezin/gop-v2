-- Somente leitura de metadados. Nao acessa registros pessoais nem altera tabelas.
begin read only;
select table_name, column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'gop_v2'
order by table_name, ordinal_position;

select tablename, rowsecurity from pg_tables
where schemaname = 'gop_v2' order by tablename;

select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'gop_v2'
order by tablename, policyname;

select p.oid::regprocedure as function_signature, p.prosecdef as security_definer,
  p.proconfig as configuration,
  has_function_privilege('anon', p.oid, 'execute') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'gop_v2' order by 1;

select c.relname, c.relkind, c.reloptions
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'gop_v2' and c.relkind in ('v', 'm') order by c.relname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'gop_v2' and grantee in ('anon','authenticated','PUBLIC')
order by table_name, grantee, privilege_type;
rollback;
