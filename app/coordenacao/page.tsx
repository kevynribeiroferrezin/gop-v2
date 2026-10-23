"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Search } from "lucide-react";
import AppShell, { PageLoading } from "../../src/components/AppShell";
import { activeProfile, coordinatorList, supervisorList } from "../../src/lib/workspace-data";
import type { Coordinator, Supervisor } from "../../src/lib/workspace-types";
import { supabase } from "../../src/lib/supabase/client";
import SupervisorDetailsEditor from "../../src/components/SupervisorDetailsEditor";

export default function CoordinationPage() {
  const router = useRouter();
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const load = useCallback(async () => {
    try {
      const profile = await activeProfile();
      if (!profile) { router.replace("/login"); return; }
      if (!["admin", "coordenador"].includes(profile.role)) { router.replace("/acesso-negado"); return; }
      setIsAdmin(profile.role === "admin");
      const [people, coords] = await Promise.all([supervisorList(), profile.role === "admin" ? coordinatorList() : Promise.resolve([])]);
      setSupervisors(people); setCoordinators(coords);
      setDrafts(Object.fromEntries(people.map((item) => [item.id, item.coordenador_profile_id ?? ""])));
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível carregar os vínculos."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => {
    let live = true;
    queueMicrotask(() => { if (live) void load(); });
    return () => { live = false; };
  }, [load]);
  const visible = useMemo(() => supervisors.filter((item) => `${item.nome} ${item.codigo}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))), [supervisors, search]);
  async function save(id: string) {
    if (!isAdmin) return;
    setSaving(id); setError(""); setSuccess("");
    const next = drafts[id] || null;
    const { error } = await supabase.from("supervisores").update({ coordenador_profile_id: next }).eq("id", id).select("id").single();
    if (error) setError("Não foi possível salvar. Selecione um coordenador ativo e confirme seu acesso de admin.");
    else { setSupervisors((items) => items.map((item) => item.id === id ? { ...item, coordenador_profile_id: next } : item)); setSuccess("Responsabilidade atualizada. O acesso do coordenador passa a seguir este vínculo."); }
    setSaving("");
  }
  if (loading) return <PageLoading active="coordenacao" message="Carregando a coordenação…" />;
  return <AppShell active="coordenacao"><header className="page-heading"><div><p className="eyebrow">Gestão da hierarquia</p><h1>{isAdmin ? "Coordenação e equipes" : "Supervisores da coordenação"}</h1><p className="page-description">{isAdmin ? "Edite os supervisores e defina a coordenação responsável por cada equipe." : "Edite os dados dos supervisores vinculados à sua coordenação."}</p></div></header>
    {error && <p role="alert" className="auth-message error">{error}</p>}{success && <p role="status" className="auth-message success">{success}</p>}
    <section className="surface"><div className="panel-heading"><div><h2>{isAdmin ? "Responsáveis pelos supervisores" : "Minha hierarquia"}</h2><p>{isAdmin ? "Os vínculos de coordenação são administrados exclusivamente pelo admin." : "A alteração de vínculos e permissões fica com a administração."}</p></div><div className="attendance-search"><Search size={16} /><input aria-label="Buscar supervisor para vincular" placeholder="Nome ou código…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      <div className="coordination-list">{visible.map((item) => <SupervisorDetailsEditor key={item.id} supervisor={item} onSaved={load} />)}</div>
      {isAdmin && <>
      <div className="coordination-list">{visible.map((item) => <div className="coordination-row" key={item.id}><div><strong>{item.nome}</strong><p>{item.codigo} · {item.ativo ? "Ativo" : "Inativo"}</p></div><label htmlFor={`coordinator-${item.id}`} className="sr-only">Coordenador de {item.nome}</label><select id={`coordinator-${item.id}`} value={drafts[item.id] ?? ""} disabled={Boolean(saving)} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}><option value="">Sem coordenador</option>{coordinators.map((person) => <option key={person.id} value={person.id} disabled={!person.ativo}>{person.nome}{!person.ativo ? " (inativo)" : ""}</option>)}</select><button type="button" className="button-secondary" disabled={Boolean(saving) || (drafts[item.id] || null) === item.coordenador_profile_id} onClick={() => save(item.id)}><Save size={15} />{saving === item.id ? "Salvando…" : "Salvar vínculo"}</button></div>)}</div>
      </>}
      {visible.length === 0 && <div className="empty-state">Nenhum supervisor encontrado.</div>}
    </section>
  </AppShell>;
}
