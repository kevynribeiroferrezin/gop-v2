"use client";
import type { Profile, Supervisor, Coordinator, ViewScope } from "../lib/workspace-types";

export default function ScopeControls({ profile, supervisors, coordinators, scope, onChange }: {
  profile: Profile; supervisors: Supervisor[]; coordinators: Coordinator[];
  scope: ViewScope; onChange: (next: ViewScope) => void;
}) {
  if (!profile.ativo || profile.role !== "admin") return null;
  return <div className="scope-controls surface">
    <>
      <label>Visualização<select aria-label="Tipo de visualização" value={scope.mode} onChange={(event) => onChange({ mode: event.target.value as ViewScope["mode"], id: "" })}>
        <option value="geral">Admin · visão completa</option><option value="coordenador">Visão de coordenador</option><option value="supervisor">Visão de supervisor</option>
      </select></label>
      {scope.mode === "coordenador" && <label>Coordenador<select aria-label="Coordenador da visualização" value={scope.id} onChange={(event) => onChange({ ...scope, id: event.target.value })}><option value="">Selecione um coordenador</option>{coordinators.map((item) => <option key={item.id} value={item.id}>{item.nome}{!item.ativo ? " (inativo)" : ""}</option>)}</select></label>}
      {scope.mode === "supervisor" && <label>Supervisor<select aria-label="Supervisor da visualização" value={scope.id} onChange={(event) => onChange({ ...scope, id: event.target.value })}><option value="">Selecione um supervisor</option>{supervisors.map((item) => <option key={item.id} value={item.id}>{item.nome}{!item.ativo ? " (inativo)" : ""}</option>)}</select></label>}
      <p>A visualização filtra os dados. Seu acesso continua sendo de admin.</p>
    </>
  </div>;
}
