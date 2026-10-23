"use client";
import AppShell, { PageLoading } from "../../src/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
} from "lucide-react";
import { supabase } from "../../src/lib/supabase/client";
import { GENERIC_DATA_ERROR, GENERIC_SAVE_ERROR } from "../../src/lib/errors";
import { registrarAuditoria } from "../../src/lib/audit";
import EmployeeWorkFields from "../../src/components/EmployeeWorkFields";
import { WORK_MODES, type WorkMode } from "../../src/lib/workspace-types";
import { employeeList } from "../../src/lib/workspace-data";
import EmployeeQuickEdit from "../../src/components/EmployeeQuickEdit";

type Colaborador = {
  id: string;
  matricula: string;
  nome: string;
  nome_smart: string | null;
  modalidade_trabalho: WorkMode;
  cargo_id: number;
  cargo_codigo: string;
  cargo_nome: string;
  supervisor_id: string | null;
  supervisor_codigo: string | null;
  supervisor_nome: string | null;
  data_admissao: string | null;
  status: string;
  ativo: boolean;
  observacao: string | null;
  regional_id: number | null;
  regional_codigo: string | null;
  regional_nome: string | null;
};

type Cargo = {
  id: number;
  codigo: string;
  nome: string;
};

type Supervisor = {
  id: string;
  codigo: string | null;
  nome: string;
};

type Regional = {
  id: number;
  codigo: string;
  nome: string;
};

export default function ColaboradoresPage() {
  const router = useRouter();

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [busca, setBusca] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [quickEditing, setQuickEditing] = useState<Colaborador | null>(null);
  const [workFields, setWorkFields] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [regionais, setRegionais] = useState<Regional[]>([]);
  const [modoCadastro, setModoCadastro] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [colaboradorEditando, setColaboradorEditando] =
    useState<Colaborador | null>(null);

  const [formEdicao, setFormEdicao] = useState({
    matricula: "",
    nome: "",
    nome_smart: "",
    modalidade_trabalho: "nao_informado" as WorkMode,
    cargo_id: "",
    supervisor_id: "",
    data_admissao: "",
    status: "ativo",
    observacao: "",
    ativo: true,
    regional_id: "",
  });
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);

  const [form, setForm] = useState({
    matricula: "",
    nome: "",
    nome_smart: "",
    modalidade_trabalho: "nao_informado" as WorkMode,
    cargo_id: "",
    supervisor_id: "",
    data_admissao: "",
    regional_id: "",
    status: "ativo",
    observacao: "",
  });

  useEffect(() => {
  async function iniciar() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, ativo")
      .eq("user_id", session.user.id)
      .single();

    if (profileError || !profile) {
      router.push("/login");
      return;
    }

    if (!profile.ativo || !["admin", "coordenador", "supervisor", "rh"].includes(profile.role)) {
      router.push("/acesso-negado");
      return;
    }

    setCanEdit(profile.role === "admin" || profile.role === "rh");
    setIsSupervisor(profile.role === "supervisor");
    await carregarColaboradores();
    if (profile.role === "admin" || profile.role === "rh") await Promise.all([
      carregarCargos(),
      carregarSupervisores(),
      carregarRegionais(),
    ]);
  }

  iniciar();
}, [router]);

  async function carregarColaboradores() {
    setCarregando(true);
    setErro(null);

    try {
      const result = await employeeList();
      setColaboradores(result.rows as Colaborador[]);
      setWorkFields(result.workFields);
    } catch (error) {
      setErro(error instanceof Error ? error.message : GENERIC_DATA_ERROR);
    } finally { setCarregando(false); }
  }
  
  
  async function carregarCargos() {
    const { data, error } = await supabase
      .from("cargos")
      .select("id, codigo, nome")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) {
      setErro(GENERIC_DATA_ERROR);
      return;
    }

    setCargos((data ?? []) as Cargo[]);
  }

  async function carregarRegionais() {
  const { data, error } = await supabase
    .from("regionais")
    .select("id, codigo, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    setErro(GENERIC_DATA_ERROR);
    return;
  }

  setRegionais((data ?? []) as Regional[]);
}
  async function carregarSupervisores() {
    const { data, error } = await supabase
      .from("supervisores")
      .select("id, codigo, nome")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) {
      setErro(GENERIC_DATA_ERROR);
      return;
    }

    setSupervisores((data ?? []) as Supervisor[]);
  }

function abrirEdicaoColaborador(colaborador: Colaborador) {
  if (!canEdit) return;
  setErro(null);
  setColaboradorEditando(colaborador);

  setFormEdicao({
    matricula: colaborador.matricula,
    nome: colaborador.nome,
    nome_smart: colaborador.nome_smart ?? "",
    modalidade_trabalho: colaborador.modalidade_trabalho ?? "nao_informado",
    cargo_id: String(colaborador.cargo_id),
    supervisor_id: colaborador.supervisor_id ?? "",
    data_admissao: colaborador.data_admissao ?? "",
    status: colaborador.status,
    observacao: colaborador.observacao ?? "",
    ativo: colaborador.ativo,
    regional_id: colaborador.regional_id ? String(colaborador.regional_id) : "",
  });

  setModoCadastro(false);
  setModoEdicao(true);
}

async function salvarEdicaoColaborador(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  if (!canEdit) return;

  if (!colaboradorEditando) {
    return;
  }

  setSalvando(true);
  setErro(null);

  if (!formEdicao.matricula.trim()) {
    setErro("Informe a matrícula do colaborador.");
    setSalvando(false);
    return;
  }

  if (!formEdicao.nome.trim()) {
    setErro("Informe o nome do colaborador.");
    setSalvando(false);
    return;
  }

  if (!formEdicao.cargo_id) {
    setErro("Selecione um cargo.");
    setSalvando(false);
    return;
  }

  // Mantém a edição no mesmo registro base usado pelas views do dashboard.
  const { error } = await supabase
    .from("funcionarios")
    .update({
      matricula: formEdicao.matricula.trim(),
      nome: formEdicao.nome.trim(),
      ...(workFields ? { nome_smart: formEdicao.nome_smart.trim() || null,
      modalidade_trabalho: formEdicao.modalidade_trabalho } : {}),
      cargo_id: Number(formEdicao.cargo_id),
      supervisor_id: formEdicao.supervisor_id || null,
      data_admissao: formEdicao.data_admissao || null,
      status: formEdicao.status,
      observacao: formEdicao.observacao.trim() || null,
      regional_id: formEdicao.regional_id ? Number(formEdicao.regional_id) : null,
      ativo: formEdicao.ativo,
    })
    .eq("id", colaboradorEditando.id);

  if (error) {
    setErro(GENERIC_SAVE_ERROR);
    setSalvando(false);
    return;
  }

  await registrarAuditoria({
    entidade: "funcionarios",
    entidadeId: colaboradorEditando.id,
    acao: "atualizar",
    detalhes: {
      matricula: formEdicao.matricula.trim(),
      status_anterior: colaboradorEditando.status,
      status_novo: formEdicao.status,
      ativo_anterior: colaboradorEditando.ativo,
      ativo_novo: formEdicao.ativo,
    },
  });

  setModoEdicao(false);
  setColaboradorEditando(null);
  setSalvando(false);

  await carregarColaboradores();
}

async function alternarStatusColaborador(colaborador: Colaborador) {
  if (!canEdit) return;
  const confirmar = window.confirm(
    colaborador.ativo
      ? `Deseja inativar o colaborador ${colaborador.nome}?`
      : `Deseja ativar o colaborador ${colaborador.nome}?`
  );

  if (!confirmar) {
    return;
  }

  setErro(null);

  const { error } = await supabase
    .from("funcionarios")
    .update({
      ativo: !colaborador.ativo,
      status: colaborador.ativo ? "inativo" : "ativo",
    })
    .eq("id", colaborador.id);

  if (error) {
    setErro(GENERIC_SAVE_ERROR);
    return;
  }

  await registrarAuditoria({
    entidade: "funcionarios",
    entidadeId: colaborador.id,
    acao: colaborador.ativo ? "inativar" : "ativar",
    detalhes: {
      matricula: colaborador.matricula,
      status_anterior: colaborador.status,
      status_novo: colaborador.ativo ? "inativo" : "ativo",
    },
  });

  await carregarColaboradores();
}

  async function cadastrarColaborador(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    setSalvando(true);
    setErro(null);

    if (!form.matricula.trim()) {
      setErro("Informe a matrícula do colaborador.");
      setSalvando(false);
      return;
    }

    if (!form.nome.trim()) {
      setErro("Informe o nome do colaborador.");
      setSalvando(false);
      return;
    }

    if (!form.cargo_id) {
      setErro("Selecione um cargo.");
      setSalvando(false);
      return;
    }

    const { error } = await supabase.from("funcionarios").insert({
      matricula: form.matricula.trim(),
      nome: form.nome.trim(),
      ...(workFields ? { nome_smart: form.nome_smart.trim() || null,
      modalidade_trabalho: form.modalidade_trabalho } : {}),
      cargo_id: Number(form.cargo_id),
      supervisor_id: form.supervisor_id || null,
      data_admissao: form.data_admissao || null,
      status: form.status,
      observacao: form.observacao.trim() || null,
      regional_id: form.regional_id ? Number(form.regional_id) : null,
      ativo: true,
    });

    if (error) {
      setErro(GENERIC_SAVE_ERROR);
      setSalvando(false);
      return;
    }

    await registrarAuditoria({
      entidade: "funcionarios",
      acao: "criar",
      detalhes: {
        matricula: form.matricula.trim(),
        cargo_id: Number(form.cargo_id),
        supervisor_id: form.supervisor_id || null,
        regional_id: form.regional_id ? Number(form.regional_id) : null,
      },
    });

    setForm({
      matricula: "",
      nome: "",
      nome_smart: "",
      modalidade_trabalho: "nao_informado" as WorkMode,
      cargo_id: "",
      supervisor_id: "",
      data_admissao: "",
      status: "ativo",
      observacao: "",
      regional_id: "",
    });

    setModoCadastro(false);
    setSalvando(false);

    await carregarColaboradores();
  }

  const colaboradoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return colaboradores;
    }

    return colaboradores.filter((item) => {
      return (
        item.nome.toLowerCase().includes(termo) ||
        item.nome_smart?.toLowerCase().includes(termo) ||
        item.matricula.toLowerCase().includes(termo) ||
        item.cargo_nome.toLowerCase().includes(termo) ||
        item.supervisor_nome?.toLowerCase().includes(termo)
      );
    });
  }, [busca, colaboradores]);

  if (carregando) return <PageLoading active="colaboradores" message="Carregando colaboradores…" />;

  return (
    <AppShell active="colaboradores">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>

              <p className="text-sm font-semibold text-yellow-600">
                Cadastro base
              </p>

              <h1 className="mt-1 text-3xl font-semibold text-slate-900 dark:text-slate-100">
                Colaboradores
              </h1>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Consulte os funcionários, cargos e supervisores responsáveis.
              </p>
            </div>

            {canEdit && !modoCadastro && !modoEdicao && (
              <button
                onClick={() => {
                  setErro(null);
                  setModoEdicao(false);
                  setColaboradorEditando(null);
                  setModoCadastro(true);
                }}
                className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-yellow-400"
              >
                Novo colaborador
              </button>
            )}
          </header>

          {erro && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {erro}
              {!modoCadastro && !modoEdicao && <button type="button" className="button-secondary" onClick={() => { void carregarColaboradores(); }}>Tentar novamente</button>}
            </div>
          )}
          {quickEditing && <EmployeeQuickEdit key={quickEditing.id} employee={quickEditing} available={workFields} onClose={() => setQuickEditing(null)} onSaved={carregarColaboradores} />}

          {modoCadastro ? (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-yellow-600">
                    Novo cadastro
                  </p>

                  <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    Cadastrar colaborador
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Preencha os dados básicos do colaborador.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setModoCadastro(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50"
                >
                  Voltar para lista
                </button>
              </div>

              <form onSubmit={cadastrarColaborador} className="space-y-5">
                {workFields && <EmployeeWorkFields nomeSmart={form.nome_smart} mode={form.modalidade_trabalho} onChange={(values) => setForm((current) => ({ ...current, ...values }))} />}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="colaboradores-field-1" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Matrícula
                    </label>
<input id="colaboradores-field-1"
                      value={form.matricula}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          matricula: event.target.value,
                        }))
                      }
                      placeholder="Ex: 1001"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="colaboradores-field-2" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Nome completo
                    </label>
<input id="colaboradores-field-2"
                      value={form.nome}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          nome: event.target.value,
                        }))
                      }
                      placeholder="Nome do colaborador"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="colaboradores-field-3" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Cargo
                    </label>
<select id="colaboradores-field-3"
                      value={form.cargo_id}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          cargo_id: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                      
                    >
                      <option value="">Selecione um cargo</option>
                      {cargos.map((cargo) => (
                        <option key={cargo.id} value={cargo.id}>
                          {cargo.nome} - {cargo.codigo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="colaboradores-field-4" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Supervisor responsável
                    </label>
<select id="colaboradores-field-4"
                      value={form.supervisor_id}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          supervisor_id: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    >
                      <option value="">Sem supervisor</option>
                      {supervisores.map((supervisor) => (
                        <option key={supervisor.id} value={supervisor.id}>
                          {supervisor.nome}
                          {supervisor.codigo ? ` - ${supervisor.codigo}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="colaboradores-field-5" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Regional
                    </label>
<select id="colaboradores-field-5"
                      value={form.regional_id}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          regional_id: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    >
                      <option value="">Selecione uma regional</option>
                      {regionais.map((regional) => (
                        <option key={regional.id} value={regional.id}>
                          {regional.nome} - {regional.codigo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="colaboradores-field-6" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Data de admissão
                    </label>
<input id="colaboradores-field-6"
                      type="date"
                      value={form.data_admissao}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          data_admissao: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="colaboradores-field-7" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Status
                    </label>
<select id="colaboradores-field-7"
                      value={form.status}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          status: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="ferias">Férias</option>
                      <option value="afastado">Afastado</option>
                      <option value="inativo">Inativo</option>
                      <option value="desligado">Desligado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="colaboradores-field-8" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                    Observação
                  </label>
<textarea id="colaboradores-field-8"
                    value={form.observacao}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        observacao: event.target.value,
                      }))
                    }
                    placeholder="Observação opcional"
                    rows={4}
                    className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                  />
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setModoCadastro(false)}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={salvando}
                    className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {salvando ? "Salvando..." : "Salvar colaborador"}
                  </button>
                </div>
              </form>
            </section>
          ) : modoEdicao ? (
                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-yellow-600">
                        Editar cadastro
                      </p>

                      <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        Editar colaborador
                      </h2>

                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Atualize cargo, supervisor, status e dados básicos.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setModoEdicao(false);
                        setColaboradorEditando(null);
                      }}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50"
                    >
                      Voltar para lista
                    </button>
                  </div>

                  <form onSubmit={salvarEdicaoColaborador} className="space-y-5">
                    {workFields && <EmployeeWorkFields nomeSmart={formEdicao.nome_smart} mode={formEdicao.modalidade_trabalho} onChange={(values) => setFormEdicao((current) => ({ ...current, ...values }))} />}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="colaboradores-field-9" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Matrícula
                        </label>
<input id="colaboradores-field-9"
                          value={formEdicao.matricula}
                          onChange={(event) =>
                            setFormEdicao((atual) => ({
                              ...atual,
                              matricula: event.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                        />
                      </div>

                      <div>
                        <label htmlFor="colaboradores-field-10" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Nome completo
                        </label>
<input id="colaboradores-field-10"
                          value={formEdicao.nome}
                          onChange={(event) =>
                            setFormEdicao((atual) => ({
                              ...atual,
                              nome: event.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                        />
                      </div>

                      <div>
                        <label htmlFor="colaboradores-field-11" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Cargo
                        </label>
<select id="colaboradores-field-11"
                          value={formEdicao.cargo_id}
                          onChange={(event) =>
                            setFormEdicao((atual) => ({
                              ...atual,
                              cargo_id: event.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                        >
                          <option value="">Selecione um cargo</option>
                          {cargos.map((cargo) => (
                            <option key={cargo.id} value={cargo.id}>
                              {cargo.nome} - {cargo.codigo}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="colaboradores-field-12" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Supervisor responsável
                        </label>
<select id="colaboradores-field-12"
                          value={formEdicao.supervisor_id}
                          onChange={(event) =>
                            setFormEdicao((atual) => ({
                              ...atual,
                              supervisor_id: event.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                        >
                          <option value="">Sem supervisor</option>
                          {supervisores.map((supervisor) => (
                            <option key={supervisor.id} value={supervisor.id}>
                              {supervisor.nome}
                              {supervisor.codigo ? ` - ${supervisor.codigo}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="colaboradores-field-13" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Regional
                        </label>
<select id="colaboradores-field-13"
                          value={formEdicao.regional_id}
                          onChange={(event) =>
                            setFormEdicao((atual) => ({
                              ...atual,
                              regional_id: event.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                        >
                          <option value="">Selecione uma regional</option>
                          {regionais.map((regional) => (
                            <option key={regional.id} value={regional.id}>
                              {regional.nome} - {regional.codigo}
                            </option>
                          ))}
                        </select>
                      </div>            
                      <div>
                        <label htmlFor="colaboradores-field-14" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Data de admissão
                        </label>
<input id="colaboradores-field-14"
                          type="date"
                          value={formEdicao.data_admissao}
                          onChange={(event) =>
                            setFormEdicao((atual) => ({
                              ...atual,
                              data_admissao: event.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                        />
                      </div>

                      <div>
                        <label htmlFor="colaboradores-field-15" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Status do colaborador
                        </label>
<select id="colaboradores-field-15"
                          value={formEdicao.status}
                          onChange={(event) =>
                            setFormEdicao((atual) => ({
                              ...atual,
                              status: event.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                        >
                          <option value="ativo">Ativo</option>
                          <option value="ferias">Férias</option>
                          <option value="afastado">Afastado</option>
                          <option value="inativo">Inativo</option>
                          <option value="desligado">Desligado</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="colaboradores-field-16" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Ativo no sistema
                        </label>
<select id="colaboradores-field-16"
                          value={formEdicao.ativo ? "ativo" : "inativo"}
                          onChange={(event) =>
                            setFormEdicao((atual) => ({
                              ...atual,
                              ativo: event.target.value === "ativo",
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                        >
                          <option value="ativo">Ativo</option>
                          <option value="inativo">Inativo</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="colaboradores-field-17" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                        Observação
                      </label>
<textarea id="colaboradores-field-17"
                        value={formEdicao.observacao}
                        onChange={(event) =>
                          setFormEdicao((atual) => ({
                            ...atual,
                            observacao: event.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                      />
                    </div>

                    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setModoEdicao(false);
                          setColaboradorEditando(null);
                        }}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50"
                      >
                        Cancelar
                      </button>

                      <button
                        type="submit"
                        disabled={salvando}
                        className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {salvando ? "Salvando..." : "Salvar alterações"}
                      </button>
                    </div>
                  </form>
                </section>
          ) :  (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Lista de colaboradores
                  </h2>

                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {erro ? "Não foi possível atualizar a lista" : `${colaboradoresFiltrados.length} colaboradores encontrados`}
                  </p>
                </div>

                <div className="relative w-full lg:w-80">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Buscar por nome, matrícula, cargo..."
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                  />
                </div>
              </div>

              <div className="data-table-wrap overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="data-table min-w-[920px] w-full border-collapse text-center text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                        Matrícula
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                        Nome
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">Nome Smart</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">Modalidade</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                        Cargo
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                        Supervisor
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                        Regional
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                        Ações
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {colaboradoresFiltrados.map((item) => (
                      <tr
                        key={item.id}
                        className="transition hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <td data-label="Matrícula" className="px-4 py-4 text-center font-bold text-slate-700 dark:text-slate-200">
                          {item.matricula}
                        </td>

                        <td data-label="Nome" className="px-4 py-4 text-center">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.nome}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.data_admissao
                              ? `Admissão: ${new Date(
                                  item.data_admissao + "T00:00:00"
                                ).toLocaleDateString("pt-BR")}`
                              : "Sem data de admissão"}
                          </p>
                        </td>

                        <td data-label="Nome Smart" className="px-4 py-4 text-center">{item.nome_smart || "—"}</td>
                        <td data-label="Modalidade" className="px-4 py-4 text-center">{WORK_MODES[item.modalidade_trabalho] ?? "Não informado"}</td>
                        <td data-label="Cargo" className="px-4 py-4 text-center">
                          <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                            {item.cargo_nome}
                          </span>
                        </td>
                                
                        <td data-label="Supervisor" className="px-4 py-4 text-center text-slate-600 dark:text-slate-300">
                          {item.supervisor_nome ?? "Sem supervisor"}
                        </td>

                        <td data-label="Regional" className="px-4 py-4 text-center text-slate-600 dark:text-slate-300">
                          {item.regional_nome ?? "Sem regional"}
                        </td>         
                        <td data-label="Status" className="px-4 py-4 text-center">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              item.ativo && item.status === "ativo"
                                ? "bg-green-50 text-green-700"
                                : "bg-slate-100 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {item.ativo ? item.status : "inativo"}
                          </span>
                        </td>
                        <td data-label="Ações" className="px-4 py-4 text-center">
                          {canEdit ? <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEdicaoColaborador(item)}
                              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => alternarStatusColaborador(item)}
                              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                item.ativo
                                  ? "bg-red-50 text-red-700 hover:bg-red-100"
                                  : "bg-green-50 text-green-700 hover:bg-green-100"
                              }`}
                            >
                              {item.ativo ? "Inativar" : "Ativar"}
                            </button>
                          </div> : isSupervisor ? <button type="button" className="button-secondary" onClick={() => setQuickEditing(item)}>Editar dados</button> : <span className="text-xs text-slate-500 dark:text-slate-400">Consulta</span>}
                        </td>
                      </tr>
                    ))}

                    {colaboradoresFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
                        >
                          {erro ? "A lista não pôde ser carregada." : "Nenhum colaborador encontrado para esta busca."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </AppShell>
  );
}
