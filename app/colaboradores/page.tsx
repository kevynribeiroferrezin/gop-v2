"use client";
import Sidebar from "../../src/components/Sidebar";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Search,
} from "lucide-react";
import { supabase } from "../../src/lib/supabase/client";
import { GENERIC_DATA_ERROR, GENERIC_SAVE_ERROR } from "../../src/lib/errors";
import { registrarAuditoria } from "../../src/lib/audit";

type Colaborador = {
  id: string;
  matricula: string;
  nome: string;
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
  created_at: string;
  updated_at: string;
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
  email: string;
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

    if (!profile.ativo || !["admin", "supervisor", "rh"].includes(profile.role)) {
      router.push("/acesso-negado");
      return;
    }

    await Promise.all([
      carregarColaboradores(),
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

    const { data, error } = await supabase
      .from("vw_funcionarios_completo")
      .select(
        "id, matricula, nome, cargo_id, cargo_codigo, cargo_nome, supervisor_id, supervisor_codigo, supervisor_nome, data_admissao, status, ativo, observacao, created_at, updated_at, regional_id, regional_codigo, regional_nome"
      )
      .order("nome", { ascending: true });

    if (error) {
      setErro(GENERIC_DATA_ERROR);
      setCarregando(false);
      return;
    }

    setColaboradores((data ?? []) as Colaborador[]);
    setCarregando(false);
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
      .select("id, codigo, nome, email")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) {
      setErro(GENERIC_DATA_ERROR);
      return;
    }

    setSupervisores((data ?? []) as Supervisor[]);
  }

function abrirEdicaoColaborador(colaborador: Colaborador) {
  setErro(null);
  setColaboradorEditando(colaborador);

  setFormEdicao({
    matricula: colaborador.matricula,
    nome: colaborador.nome,
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
        item.matricula.toLowerCase().includes(termo) ||
        item.cargo_nome.toLowerCase().includes(termo) ||
        item.supervisor_nome?.toLowerCase().includes(termo)
      );
    });
  }, [busca, colaboradores]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb]">
        <div className="flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 px-8 py-6 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
          <Loader2 className="animate-spin text-yellow-500" size={20} />
          Carregando colaboradores...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] pb-24 dark:bg-slate-950 lg:pb-0">
      <div className="flex min-h-screen">
        <Sidebar active="colaboradores" />

        <section className="flex-1 p-4 lg:p-8">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <button
                onClick={() => router.push("/")}
                className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 transition hover:text-slate-900 dark:text-slate-100"
              >
                <ArrowLeft size={18} />
                Voltar ao dashboard
              </button>

              <p className="text-sm font-semibold text-yellow-600">
                Cadastro base
              </p>

              <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">
                Colaboradores
              </h1>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Consulte os funcionários, cargos e supervisores responsáveis.
              </p>
            </div>

            {!modoCadastro && !modoEdicao && (
              <button
                onClick={() => {
                  setErro(null);
                  setModoEdicao(false);
                  setColaboradorEditando(null);
                  setModoCadastro(true);
                }}
                className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_10px_25px_rgba(234,179,8,0.25)] transition hover:bg-yellow-400"
              >
                Novo colaborador
              </button>
            )}
          </header>

          {erro && (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {erro}
            </div>
          )}

          {modoCadastro ? (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-yellow-600">
                    Novo cadastro
                  </p>

                  <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                    Cadastrar colaborador
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Preencha os dados básicos do colaborador.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setModoCadastro(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm font-black text-slate-600 dark:text-slate-300 transition hover:bg-slate-50"
                >
                  Voltar para lista
                </button>
              </div>

              <form onSubmit={cadastrarColaborador} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Matrícula
                    </label>
                    <input
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
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Nome completo
                    </label>
                    <input
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
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Cargo
                    </label>
                    <select
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
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Supervisor responsável
                    </label>
                    <select
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
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Regional
                    </label>

                    <select
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
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Data de admissão
                    </label>
                    <input
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
                    <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                      Status
                    </label>
                    <select
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
                  <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                    Observação
                  </label>
                  <textarea
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
                    className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm font-black text-slate-600 dark:text-slate-300 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={salvando}
                    className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_10px_25px_rgba(234,179,8,0.25)] transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
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

                      <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
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
                      className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm font-black text-slate-600 dark:text-slate-300 transition hover:bg-slate-50"
                    >
                      Voltar para lista
                    </button>
                  </div>

                  <form onSubmit={salvarEdicaoColaborador} className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Matrícula
                        </label>
                        <input
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
                        <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Nome completo
                        </label>
                        <input
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
                        <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Cargo
                        </label>
                        <select
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
                        <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Supervisor responsável
                        </label>
                        <select
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
                        <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Regional
                        </label>

                        <select
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
                        <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Data de admissão
                        </label>
                        <input
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
                        <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Status do colaborador
                        </label>
                        <select
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
                        <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Ativo no sistema
                        </label>
                        <select
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
                      <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                        Observação
                      </label>
                      <textarea
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
                        className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm font-black text-slate-600 dark:text-slate-300 transition hover:bg-slate-50"
                      >
                        Cancelar
                      </button>

                      <button
                        type="submit"
                        disabled={salvando}
                        className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_10px_25px_rgba(234,179,8,0.25)] transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    Lista de colaboradores
                  </h2>

                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Total encontrado: {colaboradoresFiltrados.length}
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

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-[920px] w-full border-collapse text-center text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Matrícula
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Nome
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Cargo
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Supervisor
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Regional
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center font-black text-slate-600 dark:text-slate-300">
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
                        <td className="px-4 py-4 text-center font-bold text-slate-700 dark:text-slate-200">
                          {item.matricula}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <p className="font-black text-slate-900 dark:text-slate-100">
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

                        <td className="px-4 py-4 text-center">
                          <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700">
                            {item.cargo_nome}
                          </span>
                        </td>
                                
                        <td className="px-4 py-4 text-center text-slate-600 dark:text-slate-300">
                          {item.supervisor_nome ?? "Sem supervisor"}
                        </td>

                        <td className="px-4 py-4 text-center text-slate-600 dark:text-slate-300">
                          {item.regional_nome ?? "Sem regional"}
                        </td>         
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              item.ativo && item.status === "ativo"
                                ? "bg-green-50 text-green-700"
                                : "bg-slate-100 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {item.ativo ? item.status : "inativo"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEdicaoColaborador(item)}
                              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => alternarStatusColaborador(item)}
                              className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                                item.ativo
                                  ? "bg-red-50 text-red-700 hover:bg-red-100"
                                  : "bg-green-50 text-green-700 hover:bg-green-100"
                              }`}
                            >
                              {item.ativo ? "Inativar" : "Ativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {colaboradoresFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
                        >
                          Nenhum colaborador encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
