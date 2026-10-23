"use client";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import Sidebar, { type Section } from "./Sidebar";
import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";

const labels = { dashboard: "Visão geral", chamada: "Chamada diária", colaboradores: "Colaboradores", usuarios: "Usuários", relatorios: "Relatórios", coordenacao: "Coordenação", calendario: "Calendário" };
export default function AppShell({ active, children }: { active: Section; children: React.ReactNode }) {
  return <div className="app-shell">
    <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
    <Sidebar active={active} />
    <div className="workspace">
      <div className="workspace-bar">
        <div className="desktop-breadcrumb"><span>Gestão de presenças</span><ChevronRight size={14} /><strong>{labels[active]}</strong></div>
        <Link className="mobile-brand" href="/" aria-label="GOP, início"><Brand /></Link>
        <div className="workspace-tools"><span className="workspace-context"><span /> Operação diária</span><ThemeToggle /></div>
      </div>
      <main id="conteudo" className="workspace-content">{children}</main>
      <footer className="workspace-footer"><span>GOP · Gestão de presenças</span><span>Feito para o ritmo da sua equipe.</span></footer>
    </div>
  </div>;
}
export function PageLoading({ active, message }: { active: Section; message: string }) {
  return <AppShell active={active}><div className="page-loading" role="status"><Loader2 size={24} className="animate-spin" /><p>{message}</p><span>Aguarde enquanto organizamos os dados.</span></div></AppShell>;
}
