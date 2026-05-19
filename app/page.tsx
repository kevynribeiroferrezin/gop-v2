"use client";
import Sidebar from "../src/components/Sidebar";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock3,
  UserCheck,
  Users,
} from "lucide-react";
import { supabase } from "../src/lib/supabase/client";
import { GENERIC_DATA_ERROR } from "../src/lib/errors";
import { dataHojeBrasil } from "../src/lib/dates";



type DashboardResumo = {
  data_referencia: string;
  total_presentes: number;
  total_faltas: number;
  total_atrasos: number;
  total_atestados: number;
  total_folgas: number;
  total_ferias: number;
  total_funcionarios_ativos: number;
  total_presencas_lancadas: number;
  total_pendentes: number;
};

type ChamadaPendente = {
  data_pendente: string;
  supervisor_id: string;
  supervisor_nome: string;
  supervisor_email: string;
  total_funcionarios: number;
  total_excecoes_registradas: number;
  chamada_pendente: boolean;
};

type ChamadaDoDia = {
  funcionario_id: string;
  supervisor_id: string;
  supervisor_nome: string;
  supervisor_email: string;
  status_presenca: string | null;
  possui_registro_manual: boolean;
};

type FechamentoChamada = {
  supervisor_id: string;
};

function formatarDataBR(data: string | null | undefined) {
  if (!data) return "-";

  const somenteData = data.split("T")[0];
  const [ano, mes, dia] = somenteData.split("-");

  if (!ano || !mes || !dia) return data;

  return `${dia}/${mes}/${ano}`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [pendentes, setPendentes] = useState<ChamadaPendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDashboard = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const hojeBrasil = dataHojeBrasil();

    const { data: chamadaData, error: chamadaError } = await supabase.rpc(
      "get_chamada_por_data",
      {
        p_data: hojeBrasil,
      }
    );

    if (chamadaError) {
      setErro(GENERIC_DATA_ERROR);
      setCarregando(false);
      return;
    }

    const chamada = (chamadaData ?? []) as ChamadaDoDia[];
    const supervisorIds = Array.from(
      new Set(chamada.map((item) => item.supervisor_id).filter(Boolean))
    );

    let fechamentos: FechamentoChamada[] = [];

    if (supervisorIds.length > 0) {
      const { data: fechamentosData, error: fechamentosError } = await supabase
        .from("fechamentos_chamada")
        .select("supervisor_id")
        .eq("data_chamada", hojeBrasil)
        .in("supervisor_id", supervisorIds);

      if (fechamentosError) {
        setErro(GENERIC_DATA_ERROR);
        setCarregando(false);
        return;
      }

      fechamentos = (fechamentosData ?? []) as FechamentoChamada[];
    }

    const supervisoresFinalizados = new Set(
      fechamentos.map((item) => item.supervisor_id)
    );

    const pendentesDoDia = Array.from(
      chamada.reduce((mapa, item) => {
        if (!item.supervisor_id || supervisoresFinalizados.has(item.supervisor_id)) {
          return mapa;
        }

        const atual = mapa.get(item.supervisor_id) ?? {
          data_pendente: hojeBrasil,
          supervisor_id: item.supervisor_id,
          supervisor_nome: item.supervisor_nome,
          supervisor_email: item.supervisor_email,
          total_funcionarios: 0,
          total_excecoes_registradas: 0,
          chamada_pendente: true,
        };

        atual.total_funcionarios += 1;

        if (item.status_presenca && item.status_presenca !== "presente") {
          atual.total_excecoes_registradas += 1;
        }

        mapa.set(item.supervisor_id, atual);
        return mapa;
      }, new Map<string, ChamadaPendente>())
    )
      .map(([, item]) => item)
      .sort((a, b) => a.supervisor_nome.localeCompare(b.supervisor_nome));

    const totalPorStatus = chamada.reduce(
      (totais, item) => {
        const status = item.status_presenca ?? "presente";
        totais[status] = (totais[status] ?? 0) + 1;
        return totais;
      },
      {} as Record<string, number>
    );

    const resumoDoDia: DashboardResumo = {
      data_referencia: hojeBrasil,
      total_presentes: totalPorStatus.presente ?? 0,
      total_faltas: totalPorStatus.falta ?? 0,
      total_atrasos: totalPorStatus.atraso ?? 0,
      total_atestados: totalPorStatus.atestado ?? 0,
      total_folgas: totalPorStatus.folga ?? 0,
      total_ferias: totalPorStatus.ferias ?? 0,
      total_funcionarios_ativos: chamada.length,
      total_presencas_lancadas: chamada.filter(
        (item) => item.possui_registro_manual
      ).length,
      total_pendentes: pendentesDoDia.length,
    };

    setResumo(resumoDoDia);
    setPendentes(pendentesDoDia);
    setCarregando(false);
  }, []);

  useEffect(() => {
    async function iniciar() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      await carregarDashboard();
    }

    iniciar();
  }, [carregarDashboard, router]);

  return (
    <main className="min-h-screen bg-[#f6f7fb] pb-24 dark:bg-slate-950 lg:pb-0">
      <div className="flex min-h-screen">
        <Sidebar active="dashboard" />

        <section className="flex-1 p-4 lg:p-8">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-600">
                Visão geral
              </p>
              <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">
                Dashboard
              </h1>
            </div>

            <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-yellow-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:hidden">
              GOP V2
            </span>
          </header>

          {carregando && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 text-slate-600 dark:text-slate-300 shadow-sm">
              Carregando dashboard...
            </div>
          )}

          {erro && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">
              {erro}
            </div>
          )}

          {!carregando && !erro && resumo && (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <CardResumo
                  titulo="Presentes hoje"
                  valor={resumo.total_presentes}
                  detalhe="Padrão + registros"
                  icone={<UserCheck size={22} />}
                  cor="verde"
                />

                <CardResumo
                  titulo="Faltas hoje"
                  valor={resumo.total_faltas}
                  detalhe="Exceções registradas"
                  icone={<AlertTriangle size={22} />}
                  cor="vermelho"
                />

                <CardResumo
                  titulo="Atrasos hoje"
                  valor={resumo.total_atrasos}
                  detalhe="Exceções registradas"
                  icone={<Clock3 size={22} />}
                  cor="laranja"
                />

                <CardResumo
                  titulo="Colaboradores ativos"
                  valor={resumo.total_funcionarios_ativos}
                  detalhe="Base atual"
                  icone={<Users size={22} />}
                  cor="amarelo"
                />
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                        Resumo do dia
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Situação da chamada de hoje
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <MiniIndicador
                      label="Presenças lançadas"
                      value={resumo.total_presencas_lancadas}
                    />
                    <MiniIndicador
                      label="Pendentes"
                      value={pendentes.length}
                    />
                    <MiniIndicador
                      label="Folgas"
                      value={resumo.total_folgas}
                    />
                    <MiniIndicador
                      label="Férias"
                      value={resumo.total_ferias}
                    />
                    <MiniIndicador
                      label="Atestados"
                      value={resumo.total_atestados}
                    />
                    <MiniIndicador
                      label="Data"
                      value={formatarDataBR(resumo.data_referencia)}
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    Chamadas pendentes
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Supervisores que ainda não finalizaram
                  </p>

                  <div className="mt-5 space-y-3">
                    {pendentes.length === 0 && (
                      <div className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700">
                        Nenhuma chamada pendente.
                      </div>
                    )}

                    {pendentes.map((item) => (
                      <div
                        key={item.supervisor_id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-4"
                      >
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {item.supervisor_nome}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {item.supervisor_email}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Funcionários</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {item.total_funcionarios}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function CardResumo({
  titulo,
  valor,
  detalhe,
  icone,
  cor,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  icone: React.ReactNode;
  cor: "verde" | "vermelho" | "laranja" | "amarelo";
}) {
  const cores = {
    verde: "bg-green-50 text-green-600",
    vermelho: "bg-red-50 text-red-600",
    laranja: "bg-orange-50 text-orange-600",
    amarelo: "bg-yellow-50 text-yellow-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{titulo}</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{valor}</p>
          <p className="mt-1 text-sm text-slate-400">{detalhe}</p>
        </div>

        <div className={`rounded-2xl p-3 ${cores[cor]}`}>{icone}</div>
      </div>
    </div>
  );
}

function MiniIndicador({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}
