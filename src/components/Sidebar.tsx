"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, ClipboardCheck, CalendarDays, Users, UserCog, ArrowUpRight, FileChartColumn, Network, Menu, X } from "lucide-react";
import { supabase } from "../lib/supabase/client";
import Brand from "./Brand";
import type { Role } from "../lib/workspace-types";

export type Section = "dashboard" | "chamada" | "colaboradores" | "usuarios" | "relatorios" | "coordenacao" | "calendario";
const overflowSections = ["usuarios", "coordenacao", "calendario"];
const items = [
  { label: "Visão geral", path: "/", key: "dashboard", icon: LayoutDashboard, roles: ["admin", "coordenador", "supervisor", "rh"] },
  { label: "Chamada", path: "/chamada", key: "chamada", icon: ClipboardCheck, roles: ["admin", "supervisor"] },
  { label: "Calendário", path: "/calendario", key: "calendario", icon: CalendarDays, roles: ["admin", "coordenador", "supervisor", "rh"] },
  { label: "Colaboradores", path: "/colaboradores", key: "colaboradores", icon: Users, roles: ["admin", "coordenador", "supervisor", "rh"] },
  { label: "Relatórios", path: "/relatorios", key: "relatorios", icon: FileChartColumn, roles: ["admin", "coordenador", "supervisor", "rh"] },
  { label: "Coordenação", path: "/coordenacao", key: "coordenacao", icon: Network, roles: ["admin", "coordenador"] },
  { label: "Usuários", path: "/usuarios", key: "usuarios", icon: UserCog, roles: ["admin"] },
];
const roleNames = { admin: "Administrador", coordenador: "Coordenador", rh: "Recursos humanos", supervisor: "Supervisor" };

export default function Sidebar({ active }: { active: Section }) {
  const router = useRouter();
  const [profile, setProfile] = useState<{ nome: string; role: Role } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const moreDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let live = true;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data } = await supabase.from("profiles").select("nome, role, ativo")
        .eq("user_id", session.user.id).single();
      if (live && data?.ativo && ["admin", "coordenador", "rh", "supervisor"].includes(data.role)) {
        setProfile({ nome: data.nome, role: data.role as Role });
      }
    }
    void load();
    return () => { live = false; };
  }, [router]);
  async function sair() {
    setLeaving(true);
    const { error } = await supabase.auth.signOut();
    if (error) { setLeaving(false); return; }
    router.replace("/login");
  }
  const allowed = profile ? items.filter((item) => item.roles.includes(profile.role)) : [];
  function links(mobile = false, overflow = false) {
    const list = allowed.filter((item) => overflow ? overflowSections.includes(item.key) : !mobile || !overflowSections.includes(item.key));
    return list.map(({ label, path, key, icon: Icon }) => (
      <Link key={key} href={path} className={`nav-item ${active === key ? "is-active" : ""}`}
        onClick={() => moreDialog.current?.close()}
        aria-current={active === key ? "page" : undefined}>
        <Icon size={mobile ? 20 : 18} strokeWidth={1.8} /><span>{label}</span>
        {!mobile && active === key && <span className="nav-dot" />}
      </Link>
    ));
  }
  return <>
    <aside className="sidebar">
      <Link href="/" className="brand-link" aria-label="GOP, início"><Brand /></Link>
      <div className="workspace-label"><span className="workspace-dot" /> Espaço de trabalho <span>V2</span></div>
      <p className="nav-caption">PRINCIPAL</p>
      <nav aria-label="Navegação principal" className="sidebar-nav">{links()}</nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><ClipboardCheck size={20} /><p>O dia começa<br /><strong>com a sua equipe.</strong></p><ArrowUpRight size={16} /></div>
        <div className="profile-block">
          <span className="avatar">{profile?.nome?.trim().charAt(0).toUpperCase() || "G"}</span>
          <span className="profile-copy"><strong>{profile?.nome ?? "Carregando…"}</strong><small>{profile ? roleNames[profile.role] : "Seu espaço de trabalho"}</small></span>
          <button type="button" onClick={sair} disabled={leaving} className="icon-button" aria-label="Sair da conta" title="Sair da conta"><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
    <nav className="mobile-nav" aria-label="Navegação no celular">{links(true)}
      <button type="button" onClick={() => moreDialog.current?.showModal()} className={`nav-item ${overflowSections.includes(active) ? "is-active" : ""}`} aria-label="Mais opções" aria-haspopup="dialog"><Menu size={19} /><span>Mais</span></button>
    </nav>
    <dialog ref={moreDialog} className="mobile-more-dialog" aria-label="Mais opções de navegação">
      <div className="more-heading"><strong>{profile?.nome ?? "Minha conta"}</strong><button type="button" className="icon-button" onClick={() => moreDialog.current?.close()} aria-label="Fechar opções"><X size={20} /></button></div>
      <nav aria-label="Outras páginas e conta">{links(false, true)}<button type="button" onClick={sair} disabled={leaving} className="nav-item"><LogOut size={18} />Sair da conta</button></nav>
    </dialog>
  </>;
}
