const APP_TIME_ZONE = "America/Sao_Paulo";

export function dataHojeBrasil() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const ano = parts.find((part) => part.type === "year")?.value;
  const mes = parts.find((part) => part.type === "month")?.value;
  const dia = parts.find((part) => part.type === "day")?.value;

  if (!ano || !mes || !dia) {
    throw new Error("Nao foi possivel calcular a data atual do Brasil.");
  }

  return `${ano}-${mes}-${dia}`;
}

export function gerarDatasPeriodo(inicio: string, fim: string) {
  const datas: string[] = [];
  const [anoInicio, mesInicio, diaInicio] = inicio.split("-").map(Number);
  const [anoFim, mesFim, diaFim] = fim.split("-").map(Number);

  const atual = new Date(Date.UTC(anoInicio, mesInicio - 1, diaInicio));
  const dataFim = new Date(Date.UTC(anoFim, mesFim - 1, diaFim));

  while (atual <= dataFim) {
    const ano = atual.getUTCFullYear();
    const mes = String(atual.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(atual.getUTCDate()).padStart(2, "0");

    datas.push(`${ano}-${mes}-${dia}`);
    atual.setUTCDate(atual.getUTCDate() + 1);
  }

  return datas;
}

