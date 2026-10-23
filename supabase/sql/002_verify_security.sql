-- Somente leitura. Confira RLS/policies apos as migracoes aplicadas.
-- Executar como owner nao comprova isolamento: validar tambem com JWTs de cada perfil.

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
    'regionais',
    'cobrancas_chamada'
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
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'gop_v2'
      and p.proname = 'current_supervisor_id'
  ) as current_supervisor_id_existe;

select
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'gop_v2'
      and table_name = 'audit_logs'
  ) as audit_logs_existe;

-- Campos e RPCs da coordenacao/relatorios (se o 005 ja foi aplicado).
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='gop_v2' and (
  (table_name='funcionarios' and column_name in ('nome_smart','modalidade_trabalho'))
  or (table_name='supervisores' and column_name='coordenador_profile_id')
)
order by table_name,column_name;

select p.oid::regprocedure as funcao, p.prosecdef as security_definer, p.proconfig,
  has_function_privilege('anon',p.oid,'execute') as anon_pode_executar,
  has_function_privilege('authenticated',p.oid,'execute') as autenticado_pode_executar
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='gop_v2' and p.proname in ('get_chamada_por_data','relatorio_presencas','cobrar_chamada','can_view_supervisor','editar_colaborador','editar_supervisor','estado_chamada','salvar_chamada','registrar_ferias','consultar_periodo_ferias','alterar_periodo_ferias')
order by p.proname;

-- Ocorrencias estruturadas e travas definitivas (007).
select column_name,data_type from information_schema.columns
where table_schema='gop_v2' and table_name='presencas' and column_name in
  ('falta_justificada','falta_motivo','atraso_motivo','atraso_detalhe','atraso_tem_atestado','atestado_cid','folga_tipo','afastamento_motivo')
order by column_name;
select event_object_table,trigger_name,event_manipulation,action_timing
from information_schema.triggers where trigger_schema='gop_v2'
  and trigger_name in ('guard_presenca','guard_fechamento') order by event_object_table,event_manipulation;
