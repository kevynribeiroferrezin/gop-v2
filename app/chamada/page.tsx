"use client";
import Sidebar from "../../src/components/Sidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
  UserCheck,
} from "lucide-react";
import { supabase } from "../../src/lib/supabase/client";
import { GENERIC_DATA_ERROR, GENERIC_SAVE_ERROR } from "../../src/lib/errors";
import { dataHojeBrasil, gerarDatasPeriodo } from "../../src/lib/dates";
import { registrarAuditoria } from "../../src/lib/audit";

type ChamadaItem = {
  funcionario_id: string;
  matricula: string;
  funcionario_nome: string;
  cargo_nome: string;
  supervisor_id: string;
  supervisor_codigo: string;
  supervisor_nome: string;
  supervisor_email: string;
  data_presenca: string;
  presenca_id: string | null;
  status_presenca: StatusPresenca;
  hora_entrada: string | null;
  hora_saida: string | null;
  observacao: string | null;
  regional_id: number | null;
  regional_codigo: string | null;
  regional_nome: string | null;
  possui_registro_manual: boolean;
  origem_status: string;
};

type StatusPresenca =
  | "presente"
  | "falta"
  | "atraso"
  | "atestado"
  | "folga"
  | "ferias"
  | "afastado";

const statusOptions: {
  value: StatusPresenca;
  label: string;
  className: string;
}[] = [
  {
    value: "presente",
    label: "Presente",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  {
    value: "falta",
    label: "Falta",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  {
    value: "atraso",
    label: "Atraso",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    value: "atestado",
    label: "Atestado",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  },
  {
    value: "folga",
    label: "Folga",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  {
    value: "ferias",
    label: "Férias",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    value: "afastado",
    label: "Afastado",
    className: "bg-slate-100 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800",
  },
];

export default function ChamadaPage() {
  const router = useRouter();
  const [dataSelecionada, setDataSelecionada] = useState(dataHojeBrasil());
  const [dados, setDados] = useState<ChamadaItem[]>([]);
  const [statusPorFuncionario, setStatusPorFuncionario] = useState<
    Record<string, StatusPresenca>
  >({});
  const [observacaoPorFuncionario, setObservacaoPorFuncionario] = useState<
    Record<string, string>
  >({});
  const [modalFerias, setModalFerias] = useState<{
  aberto: boolean;
  colaborador: ChamadaItem | null;
  dataInicio: string;
  dataFim: string;
}>({
  aberto: false,
  colaborador: null,
  dataInicio: dataHojeBrasil(),
  dataFim: dataHojeBrasil(),
});
  const [supervisorSelecionado, setSupervisorSelecionado] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregarChamada = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setSucesso(null);

    const { data, error } = await supabase.rpc("get_chamada_por_data", {
      p_data: dataSelecionada,
    });

    if (error) {
      setErro(GENERIC_DATA_ERROR);
      setCarregando(false);
      return;
    }

    const lista = (data ?? []) as ChamadaItem[];

    setDados(lista);

    const statusInicial: Record<string, StatusPresenca> = {};
    const observacaoInicial: Record<string, string> = {};

    lista.forEach((item) => {
      statusInicial[item.funcionario_id] = item.status_presenca ?? "presente";
      observacaoInicial[item.funcionario_id] = item.observacao ?? "";
    });

    setStatusPorFuncionario(statusInicial);
    setObservacaoPorFuncionario(observacaoInicial);

    if (lista.length > 0) {
      setSupervisorSelecionado(lista[0].supervisor_id);
    }

    setCarregando(false);
  }, [dataSelecionada]);

  useEffect(() => {
    async function iniciar() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      await carregarChamada();
    }

    iniciar();
  }, [carregarChamada, router]);

  const supervisores = useMemo(() => {
    const mapa = new Map<
      string,
      {
        id: string;
        nome: string;
        codigo: string;
      }
    >();

    dados.forEach((item) => {
      if (item.supervisor_id) {
        mapa.set(item.supervisor_id, {
          id: item.supervisor_id,
          nome: item.supervisor_nome,
          codigo: item.supervisor_codigo,
        });
      }
    });

    return Array.from(mapa.values());
  }, [dados]);

  const funcionariosFiltrados = useMemo(() => {
    return dados.filter((item) => item.supervisor_id === supervisorSelecionado);
  }, [dados, supervisorSelecionado]);

  const resumo = useMemo(() => {
    const total = funcionariosFiltrados.length;

    const excecoes = funcionariosFiltrados.filter((item) => {
      const status = statusPorFuncionario[item.funcionario_id];
      return status && status !== "presente";
    }).length;

    const presentes = total - excecoes;

    return {
      total,
      presentes,
      excecoes,
    };
  }, [funcionariosFiltrados, statusPorFuncionario]);

function abrirModalFerias(colaborador: ChamadaItem) {
  setModalFerias({
    aberto: true,
    colaborador,
    dataInicio: dataSelecionada,
    dataFim: dataSelecionada,
  });
}

async function confirmarFerias() {
  if (!modalFerias.colaborador) {
    return;
  }

  if (!modalFerias.dataInicio || !modalFerias.dataFim) {
    setErro("Informe o período de férias.");
    return;
  }

  if (modalFerias.dataInicio > modalFerias.dataFim) {
    setErro("A data inicial não pode ser maior que a data final.");
    return;
  }

  const confirmar = window.confirm(
    `Deseja lançar férias para ${modalFerias.colaborador.funcionario_nome} no período selecionado?`
  );

  if (!confirmar) {
    return;
  }

  setErro(null);
  setSucesso(null);
  setSalvando(true);

  const datas = gerarDatasPeriodo(modalFerias.dataInicio, modalFerias.dataFim);

  // Férias são gravadas dia a dia para manter a chamada consultável por data.
  const registros = datas.map((data) => ({
    funcionario_id: modalFerias.colaborador!.funcionario_id,
    supervisor_id: modalFerias.colaborador!.supervisor_id,
    data_presenca: data,
    status: "ferias",
    observacao: `Férias de ${new Date(
      modalFerias.dataInicio + "T00:00:00"
    ).toLocaleDateString("pt-BR")} até ${new Date(
      modalFerias.dataFim + "T00:00:00"
    ).toLocaleDateString("pt-BR")}`,
  }));

  const { error } = await supabase.from("presencas").upsert(registros, {
    onConflict: "funcionario_id,data_presenca",
  });

  if (error) {
    setErro(GENERIC_SAVE_ERROR);
    setSalvando(false);
    return;
  }

  await registrarAuditoria({
    entidade: "presencas",
    entidadeId: modalFerias.colaborador.funcionario_id,
    acao: "lancar_ferias",
    detalhes: {
      data_inicio: modalFerias.dataInicio,
      data_fim: modalFerias.dataFim,
      total_dias: datas.length,
      supervisor_id: modalFerias.colaborador.supervisor_id,
    },
  });

  setModalFerias({
    aberto: false,
    colaborador: null,
    dataInicio: dataHojeBrasil(),
    dataFim: dataHojeBrasil(),
  });

  setSucesso("Férias lançadas com sucesso para o período selecionado.");
  setSalvando(false);

  await carregarChamada();
}
  async function salvarAlteracoes() {
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    const registros = funcionariosFiltrados
      .filter((item) => {
        const statusAtual = statusPorFuncionario[item.funcionario_id];
        const observacaoAtual = observacaoPorFuncionario[item.funcionario_id];

        return (
          statusAtual !== "presente" ||
          item.possui_registro_manual ||
          Boolean(observacaoAtual?.trim())
        );
      })
      .map((item) => ({
        funcionario_id: item.funcionario_id,
        supervisor_id: item.supervisor_id,
        data_presenca: item.data_presenca,
        status: statusPorFuncionario[item.funcionario_id] ?? "presente",
        observacao: observacaoPorFuncionario[item.funcionario_id] || null,
      }));

    if (registros.length === 0) {
      setSucesso("Nenhuma exceção para salvar. Todos permanecem como presentes.");
      setSalvando(false);
      return;
    }

    const confirmar = window.confirm(
      `Deseja salvar ${registros.length} registro(s) de chamada para esta data?`
    );

    if (!confirmar) {
      setSalvando(false);
      return;
    }

    const { error } = await supabase.from("presencas").upsert(registros, {
      onConflict: "funcionario_id,data_presenca",
    });

    if (error) {
      setErro(GENERIC_SAVE_ERROR);
      setSalvando(false);
      return;
    }

    await registrarAuditoria({
      entidade: "presencas",
      acao: "salvar_chamada",
      detalhes: {
        data_presenca: dataSelecionada,
        supervisor_id: supervisorSelecionado,
        total_registros: registros.length,
        statuses: registros.reduce((totais, item) => {
          totais[item.status] = (totais[item.status] ?? 0) + 1;
          return totais;
        }, {} as Record<string, number>),
      },
    });

    setSucesso("Alterações salvas com sucesso.");
    setSalvando(false);

    await carregarChamada();
  }

  async function finalizarChamada() {
    const confirmar = window.confirm(
      `Deseja finalizar a chamada de ${new Date(
        dataSelecionada + "T00:00:00"
      ).toLocaleDateString("pt-BR")}?`
    );

    if (!confirmar) {
      return;
    }

    setFinalizando(true);
    setErro(null);
    setSucesso(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", session.user.id)
      .single();

    if (profileError) {
      setErro(profileError.message);
      setFinalizando(false);
      return;
    }

    const { error } = await supabase.from("fechamentos_chamada").upsert(
      {
        supervisor_id: supervisorSelecionado,
        data_chamada: dataSelecionada,
        total_funcionarios: resumo.total,
        total_excecoes: resumo.excecoes,
        observacao: "Chamada finalizada pelo sistema.",
        fechado_por: profile.id,
      },
      {
        onConflict: "supervisor_id,data_chamada",
      }
    );

    if (error) {
      setErro(GENERIC_SAVE_ERROR);
      setFinalizando(false);
      return;
    }

    await registrarAuditoria({
      entidade: "fechamentos_chamada",
      entidadeId: `${supervisorSelecionado}:${dataSelecionada}`,
      acao: "finalizar_chamada",
      detalhes: {
        supervisor_id: supervisorSelecionado,
        data_chamada: dataSelecionada,
        total_funcionarios: resumo.total,
        total_excecoes: resumo.excecoes,
      },
    });

    setSucesso("Chamada finalizada com sucesso.");
    setFinalizando(false);
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb]">
        <div className="flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 px-8 py-6 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
          <Loader2 className="animate-spin text-yellow-500" size={20} />
          Carregando chamada...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] pb-24 dark:bg-slate-950 lg:pb-0">
      <div className="flex min-h-screen">
        <Sidebar active="chamada" />

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
                Chamada diária
              </p>
              <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">
                Controle de presença
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Todos começam como presente. Marque somente as exceções.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={salvarAlteracoes}
                disabled={salvando}
                className="flex items-center justify-center gap-2 rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_10px_25px_rgba(234,179,8,0.25)] transition hover:bg-yellow-400 disabled:opacity-60"
              >
                {salvando ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Salvar alterações
              </button>

              <button
                onClick={finalizarChamada}
                disabled={finalizando}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {finalizando ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Finalizar chamada
              </button>
            </div>
          </header>

          {erro && (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="mb-4 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-700">
              {sucesso}
            </div>
          )}

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">
                {resumo.total}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Presentes</p>
              <p className="mt-2 text-3xl font-black text-green-600">
                {resumo.presentes}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Exceções</p>
              <p className="mt-2 text-3xl font-black text-yellow-600">
                {resumo.excecoes}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Data da chamada
              </p>
              <input
                type="date"
                value={dataSelecionada}
                onChange={(event) => setDataSelecionada(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  Lista de colaboradores
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Altere apenas quem não estiver presente.
                </p>
              </div>

              <select
                value={supervisorSelecionado}
                onChange={(event) => setSupervisorSelecionado(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
              >
                {supervisores.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.nome} - {supervisor.codigo}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {funcionariosFiltrados.map((item) => {
                const statusAtual =
                  statusPorFuncionario[item.funcionario_id] ?? "presente";

                return (
                  <div
                    key={item.funcionario_id}
                    className="rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_420px] lg:items-center">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-600">
                            <UserCheck size={22} />
                          </div>

                          <div>
                            <p className="font-black text-slate-900 dark:text-slate-100">
                              {item.funcionario_nome}
                            </p>

                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Matrícula {item.matricula} • {item.cargo_nome}
                              {item.regional_nome
                                ? ` • ${item.regional_nome}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <input
                          value={
                            observacaoPorFuncionario[item.funcionario_id] ?? ""
                          }
                          onChange={(event) =>
                            setObservacaoPorFuncionario((atual) => ({
                              ...atual,
                              [item.funcionario_id]: event.target.value,
                            }))
                          }
                          placeholder="Observação opcional"
                          className="mt-3 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((status) => {
                          const ativo = statusAtual === status.value;

                          return (
                            <button
                              key={status.value}
                              type="button"
                              onClick={() => {
                                if (status.value === "ferias") {
                                  abrirModalFerias(item);
                                  return;
                                }

                                setModalFerias({
                                  aberto: false,
                                  colaborador: null,
                                  dataInicio: dataHojeBrasil(),
                                  dataFim: dataHojeBrasil(),
                                });

                                setStatusPorFuncionario((atual) => ({
                                  ...atual,
                                  [item.funcionario_id]: status.value,
                                }));
                              }}
                              className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                                ativo
                                  ? status.className
                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50"
                              }`}
                            >
                              {status.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {modalFerias.aberto &&
                      modalFerias.colaborador?.funcionario_id ===
                        item.funcionario_id && (
                        <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                          <div className="mb-4">
                            <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                              Lançar férias para {item.funcionario_nome}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-yellow-700">
                              Selecione o período. O sistema vai registrar
                              férias em todos os dias escolhidos.
                            </p>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                                Data inicial
                              </label>

                              <input
                                type="date"
                                value={modalFerias.dataInicio}
                                onChange={(event) =>
                                  setModalFerias((atual) => ({
                                    ...atual,
                                    dataInicio: event.target.value,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                                Data final
                              </label>

                              <input
                                type="date"
                                value={modalFerias.dataFim}
                                onChange={(event) =>
                                  setModalFerias((atual) => ({
                                    ...atual,
                                    dataFim: event.target.value,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-yellow-500 focus:ring-4 focus:ring-yellow-100"
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setModalFerias({
                                  aberto: false,
                                  colaborador: null,
                                  dataInicio: dataHojeBrasil(),
                                  dataFim: dataHojeBrasil(),
                                })
                              }
                              className="rounded-xl border border-yellow-300 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-black text-slate-600 dark:text-slate-300 transition hover:bg-yellow-100"
                            >
                              Cancelar
                            </button>

                            <button
                              type="button"
                              onClick={confirmarFerias}
                              disabled={salvando}
                              className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {salvando ? "Salvando..." : "Confirmar férias"}
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
