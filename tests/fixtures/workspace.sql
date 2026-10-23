-- Estrutura local para exercitar as migracoes, sem conexao com o banco real.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
grant usage on schema auth to public;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema gop_v2;
create table gop_v2.profiles (
  id uuid primary key, user_id uuid unique, nome text, email text,
  role text check (role in ('admin','supervisor','rh')), ativo boolean
);
create table gop_v2.supervisores (id uuid primary key, profile_id uuid, codigo text, nome text, email text, ativo boolean);
create table gop_v2.cargos (id int primary key, codigo text, nome text);
create table gop_v2.regionais (id int primary key, codigo text, nome text);
create table gop_v2.funcionarios (
  id uuid primary key, matricula text, nome text, cargo_id int, supervisor_id uuid,
  data_admissao date, status text, ativo boolean, observacao text, regional_id int
);
create table gop_v2.presencas (
  id uuid primary key default gen_random_uuid(), funcionario_id uuid, supervisor_id uuid,
  data_presenca date, status text, unique(funcionario_id,data_presenca)
);
create table gop_v2.fechamentos_chamada (
  id uuid primary key default gen_random_uuid(), supervisor_id uuid, fechado_por uuid,
  data_chamada date, unique(supervisor_id,data_chamada)
);
create view gop_v2.vw_funcionarios_completo as select * from gop_v2.funcionarios;
create function gop_v2.get_chamada_por_data(p_data date)
returns table(funcionario_id uuid,supervisor_id uuid,cargo_nome text,status_presenca text,possui_registro_manual boolean)
language sql stable security definer as $$
  select f.id,f.supervisor_id,c.nome,coalesce(p.status,'presente'),p.id is not null
  from gop_v2.funcionarios f
  join gop_v2.supervisores s on s.id=f.supervisor_id
  left join gop_v2.cargos c on c.id=f.cargo_id
  left join gop_v2.presencas p on p.funcionario_id=f.id and p.data_presenca=p_data and p.supervisor_id=f.supervisor_id
  where f.ativo=true and s.ativo=true;
$$;
grant all on all tables in schema gop_v2 to anon,authenticated,service_role;
grant usage on schema gop_v2 to anon,authenticated,service_role;
