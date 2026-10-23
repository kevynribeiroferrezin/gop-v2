-- Apply after 001 and 005. Narrow writes; do not grant supervisors broad UPDATE.
begin;

create or replace function gop_v2.editar_colaborador(
  p_funcionario_id uuid, p_nome text, p_nome_smart text, p_modalidade_trabalho text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := gop_v2.current_profile_id(); result uuid;
begin
  if actor is null or not coalesce(gop_v2.current_role() in ('admin','supervisor'),false) then
    raise exception 'Sem permissao para editar este colaborador' using errcode='42501';
  end if;
  if p_nome is null or length(btrim(p_nome)) not between 1 and 200
    or length(coalesce(p_nome_smart,'')) > 200
    or p_modalidade_trabalho is null or p_modalidade_trabalho not in ('hibrido','presencial','home_office') then
    raise exception 'Nome ou modalidade invalida' using errcode='22023';
  end if;
  update gop_v2.funcionarios f set nome=btrim(p_nome),
    nome_smart=nullif(btrim(p_nome_smart),''), modalidade_trabalho=p_modalidade_trabalho
  where f.id=p_funcionario_id and (gop_v2.is_admin() or exists (
    select 1 from gop_v2.supervisores s
    where s.id=f.supervisor_id and s.profile_id=actor and s.ativo=true
  )) returning f.id into result;
  if not found then
    raise exception 'Sem permissao para editar este colaborador' using errcode='42501';
  end if;
  return result;
end $$;

create or replace function gop_v2.editar_supervisor(
  p_supervisor_id uuid, p_nome text, p_codigo text, p_email text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := gop_v2.current_profile_id(); result uuid;
begin
  if actor is null or not coalesce(gop_v2.current_role() in ('admin','coordenador'),false) then
    raise exception 'Sem permissao para editar este supervisor' using errcode='42501';
  end if;
  if p_nome is null or length(btrim(p_nome)) not between 1 and 200
    or p_codigo is null or length(btrim(p_codigo)) not between 1 and 100
    or length(coalesce(p_email,'')) > 254
    or (nullif(btrim(p_email),'') is not null and btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Dados do supervisor invalidos' using errcode='22023';
  end if;
  -- Link, account/profile, and role cannot be changed through this function.
  update gop_v2.supervisores s set nome=btrim(p_nome), codigo=btrim(p_codigo), email=nullif(btrim(p_email),'')
  where s.id=p_supervisor_id and (gop_v2.is_admin() or s.coordenador_profile_id=actor)
  returning s.id into result;
  if not found then
    raise exception 'Sem permissao para editar este supervisor' using errcode='42501';
  end if;
  return result;
end $$;

revoke all on function gop_v2.editar_colaborador(uuid,text,text,text),
  gop_v2.editar_supervisor(uuid,text,text,text) from public,anon,authenticated;
grant execute on function gop_v2.editar_colaborador(uuid,text,text,text),
  gop_v2.editar_supervisor(uuid,text,text,text) to authenticated,service_role;
notify pgrst, 'reload schema';
commit;
