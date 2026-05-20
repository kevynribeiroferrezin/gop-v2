-- Execute este script no SQL Editor do Supabase usando um usuario owner.
-- Ele padroniza data Brasil, cria auditoria e habilita RLS nas tabelas usadas pelo app.

create schema if not exists gop_v2;

alter role authenticated set timezone = 'America/Sao_Paulo';
alter role anon set timezone = 'America/Sao_Paulo';
alter role service_role set timezone = 'America/Sao_Paulo';

create or replace function gop_v2.hoje_brasil()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

grant execute on function gop_v2.hoje_brasil() to anon, authenticated, service_role;

create or replace function gop_v2.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = gop_v2, public
as $$
  select id from gop_v2.profiles where user_id = auth.uid() and ativo = true limit 1;
$$;

grant execute on function gop_v2.current_profile_id() to authenticated, service_role;

create or replace function gop_v2.current_role()
returns text
language sql
stable
security definer
set search_path = gop_v2, public
as $$
  select role from gop_v2.profiles where user_id = auth.uid() and ativo = true limit 1;
$$;

grant execute on function gop_v2.current_role() to authenticated, service_role;

create or replace function gop_v2.is_admin()
returns boolean
language sql
stable
security definer
set search_path = gop_v2, public
as $$
  select coalesce(gop_v2.current_role() = 'admin', false);
$$;

grant execute on function gop_v2.is_admin() to authenticated, service_role;

create or replace function gop_v2.is_rh_or_admin()
returns boolean
language sql
stable
security definer
set search_path = gop_v2, public
as $$
  select coalesce(gop_v2.current_role() in ('admin', 'rh'), false);
$$;

grant execute on function gop_v2.is_rh_or_admin() to authenticated, service_role;

create or replace function gop_v2.current_supervisor_id()
returns uuid
language sql
stable
security definer
set search_path = gop_v2, public
as $$
  select s.id
  from gop_v2.supervisores s
  join gop_v2.profiles p on p.id = s.profile_id
  where p.user_id = auth.uid()
    and p.ativo = true
    and p.role = 'supervisor'
    and s.ativo = true
  limit 1;
$$;

grant execute on function gop_v2.current_supervisor_id() to authenticated, service_role;

create table if not exists gop_v2.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_profile_id uuid,
  actor_role text,
  entidade text not null,
  entidade_id text,
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table gop_v2.audit_logs
  add column if not exists actor_user_id uuid,
  add column if not exists actor_profile_id uuid,
  add column if not exists actor_role text,
  add column if not exists entidade text,
  add column if not exists entidade_id text,
  add column if not exists acao text,
  add column if not exists detalhes jsonb not null default '{}'::jsonb,
  add column if not exists ip inet,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists audit_logs_created_at_idx
  on gop_v2.audit_logs (created_at desc);

create index if not exists audit_logs_entidade_idx
  on gop_v2.audit_logs (entidade, entidade_id);

alter table gop_v2.audit_logs enable row level security;
alter table gop_v2.profiles enable row level security;
alter table gop_v2.supervisores enable row level security;
alter table gop_v2.funcionarios enable row level security;
alter table gop_v2.presencas enable row level security;
alter table gop_v2.fechamentos_chamada enable row level security;
alter table gop_v2.cargos enable row level security;
alter table gop_v2.regionais enable row level security;

drop policy if exists "audit_admin_select" on gop_v2.audit_logs;
create policy "audit_admin_select"
on gop_v2.audit_logs
for select
to authenticated
using (gop_v2.is_admin());

drop policy if exists "profiles_select_self_or_admin" on gop_v2.profiles;
create policy "profiles_select_self_or_admin"
on gop_v2.profiles
for select
to authenticated
using (user_id = auth.uid() or gop_v2.is_admin());

drop policy if exists "profiles_admin_write" on gop_v2.profiles;
create policy "profiles_admin_write"
on gop_v2.profiles
for all
to authenticated
using (gop_v2.is_admin())
with check (gop_v2.is_admin());

drop policy if exists "supervisores_select_auth" on gop_v2.supervisores;
drop policy if exists "supervisores_select_by_role" on gop_v2.supervisores;
create policy "supervisores_select_by_role"
on gop_v2.supervisores
for select
to authenticated
using (
  gop_v2.is_rh_or_admin()
  or profile_id = gop_v2.current_profile_id()
);

drop policy if exists "supervisores_admin_write" on gop_v2.supervisores;
create policy "supervisores_admin_write"
on gop_v2.supervisores
for all
to authenticated
using (gop_v2.is_admin())
with check (gop_v2.is_admin());

drop policy if exists "funcionarios_select_auth" on gop_v2.funcionarios;
drop policy if exists "funcionarios_select_by_role" on gop_v2.funcionarios;
create policy "funcionarios_select_by_role"
on gop_v2.funcionarios
for select
to authenticated
using (
  gop_v2.is_rh_or_admin()
  or supervisor_id = gop_v2.current_supervisor_id()
);

drop policy if exists "funcionarios_rh_admin_write" on gop_v2.funcionarios;
create policy "funcionarios_rh_admin_write"
on gop_v2.funcionarios
for all
to authenticated
using (gop_v2.is_rh_or_admin())
with check (gop_v2.is_rh_or_admin());

drop policy if exists "presencas_select_auth" on gop_v2.presencas;
drop policy if exists "presencas_select_by_role" on gop_v2.presencas;
create policy "presencas_select_by_role"
on gop_v2.presencas
for select
to authenticated
using (
  gop_v2.is_rh_or_admin()
  or supervisor_id = gop_v2.current_supervisor_id()
);

drop policy if exists "presencas_admin_supervisor_write" on gop_v2.presencas;
create policy "presencas_admin_supervisor_write"
on gop_v2.presencas
for all
to authenticated
using (
  gop_v2.is_admin()
  or (
    gop_v2.current_role() = 'supervisor'
    and supervisor_id = gop_v2.current_supervisor_id()
  )
)
with check (
  gop_v2.is_admin()
  or (
    gop_v2.current_role() = 'supervisor'
    and supervisor_id = gop_v2.current_supervisor_id()
  )
);

drop policy if exists "fechamentos_select_auth" on gop_v2.fechamentos_chamada;
drop policy if exists "fechamentos_select_by_role" on gop_v2.fechamentos_chamada;
create policy "fechamentos_select_by_role"
on gop_v2.fechamentos_chamada
for select
to authenticated
using (
  gop_v2.is_rh_or_admin()
  or supervisor_id = gop_v2.current_supervisor_id()
);

drop policy if exists "fechamentos_admin_supervisor_write" on gop_v2.fechamentos_chamada;
create policy "fechamentos_admin_supervisor_write"
on gop_v2.fechamentos_chamada
for all
to authenticated
using (
  gop_v2.is_admin()
  or (
    gop_v2.current_role() = 'supervisor'
    and supervisor_id = gop_v2.current_supervisor_id()
  )
)
with check (
  gop_v2.is_admin()
  or (
    gop_v2.current_role() = 'supervisor'
    and supervisor_id = gop_v2.current_supervisor_id()
  )
);

drop policy if exists "cargos_select_auth" on gop_v2.cargos;
create policy "cargos_select_auth"
on gop_v2.cargos
for select
to authenticated
using (true);

drop policy if exists "cargos_rh_admin_write" on gop_v2.cargos;
create policy "cargos_rh_admin_write"
on gop_v2.cargos
for all
to authenticated
using (gop_v2.is_rh_or_admin())
with check (gop_v2.is_rh_or_admin());

drop policy if exists "regionais_select_auth" on gop_v2.regionais;
create policy "regionais_select_auth"
on gop_v2.regionais
for select
to authenticated
using (true);

drop policy if exists "regionais_rh_admin_write" on gop_v2.regionais;
create policy "regionais_rh_admin_write"
on gop_v2.regionais
for all
to authenticated
using (gop_v2.is_rh_or_admin())
with check (gop_v2.is_rh_or_admin());

-- Opcional, se seu Postgres/Supabase permitir security_invoker em views.
alter view if exists gop_v2.vw_funcionarios_completo set (security_invoker = true);
alter view if exists gop_v2.vw_dashboard_presencas_hoje set (security_invoker = true);
alter view if exists gop_v2.vw_chamadas_pendentes_hoje set (security_invoker = true);
