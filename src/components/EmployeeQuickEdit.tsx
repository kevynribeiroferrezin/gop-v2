"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import EmployeeWorkFields from "./EmployeeWorkFields";
import type { WorkMode } from "../lib/workspace-types";
import { supabase } from "../lib/supabase/client";
import { missingSchema } from "../lib/schema-errors";

export default function EmployeeQuickEdit({ employee, available, onClose, onSaved }: {
  employee: { id: string; nome: string; nome_smart: string | null; modalidade_trabalho: WorkMode };
  available: boolean; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(employee.nome);
  const [work, setWork] = useState({ nome_smart: employee.nome_smart ?? "", modalidade_trabalho: employee.modalidade_trabalho });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !available || work.modalidade_trabalho === "nao_informado") return;
    setSaving(true); setError("");
    try {
      const { error } = await supabase.rpc("editar_colaborador", { p_funcionario_id: employee.id, p_nome: name.trim(), p_nome_smart: work.nome_smart.trim() || null, p_modalidade_trabalho: work.modalidade_trabalho });
      if (error) {
        setError(missingSchema(error) ? "A edição depende da atualização de permissões no banco. Solicite a aplicação da migração 006 à administração." : "Não foi possível salvar. Confirme se o colaborador continua vinculado à sua equipe.");
        return;
      }
      await onSaved(); onClose();
    } catch { setError("Não foi possível salvar. Tente novamente."); }
    finally { setSaving(false); }
  }
  return <dialog className="edit-dialog" ref={dialog} aria-labelledby="employee-edit-title" onCancel={(event) => { if (saving) event.preventDefault(); else onClose(); }}>
    <header><div><h2 id="employee-edit-title">Editar colaborador</h2><p>Atualize os dados do colaborador da sua equipe.</p></div><button type="button" className="icon-button" aria-label="Fechar edição" disabled={saving} onClick={onClose}><X size={20} /></button></header>
    <form onSubmit={save}><label className="flex flex-col gap-2 text-sm font-semibold">Nome do colaborador<input className="h-11 rounded-xl border border-slate-200 px-4 font-normal dark:border-slate-800" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <EmployeeWorkFields nomeSmart={work.nome_smart} mode={work.modalidade_trabalho} onChange={setWork} />
      {!available && <p role="status">Os campos Smart e modalidade ainda precisam ser habilitados no banco pela administração. A consulta dos colaboradores continua disponível.</p>}
      {error && <p role="alert" className="auth-message error">{error}</p>}
      <footer><button className="button-secondary" type="button" disabled={saving} onClick={onClose}>Cancelar</button><button className="button-primary" disabled={saving || !available || !name.trim() || work.modalidade_trabalho === "nao_informado"}>{saving ? "Salvando…" : "Salvar dados"}</button></footer>
    </form>
  </dialog>;
}
