import type { ConversaRegistrada, Verificacao } from "./tipos.js";

export interface ResultadoRoteiro {
  conversa: ConversaRegistrada;
  verificacoes: Verificacao[];
  /** Número da execução quando o mesmo roteiro roda mais de uma vez (`--vezes N`). */
  execucao: number;
}

export interface DadosRelatorio {
  modelo: string;
  /** Data e hora da execução, já formatada. */
  quando: string;
  resultados: ResultadoRoteiro[];
}

const passou = (r: ResultadoRoteiro) => r.verificacoes.every((v) => v.ok);

const resumir = (valor: unknown, max = 220) => {
  const texto = JSON.stringify(valor) ?? "";
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
};

/** Cita uma fala em markdown, preservando as quebras de linha. */
const citar = (texto: string) =>
  texto
    .trim()
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

function secao(r: ResultadoRoteiro, varias: boolean): string {
  const { roteiro, turnos } = r.conversa;
  const titulo = `${roteiro.titulo}${varias ? ` · execução ${r.execucao}` : ""}`;
  const linhas = [`## ${passou(r) ? "✅" : "❌"} ${titulo} (\`${roteiro.id}\`)`, "", `**Objetivo:** ${roteiro.objetivo}`, ""];

  turnos.forEach((t, i) => {
    linhas.push(`**${i + 1}. Cliente:** ${t.cliente}`, "");
    for (const f of t.ferramentas) {
      const desfecho = f.resultado.ok === true ? "ok" : `erro: ${String(f.resultado.erro ?? "")}`;
      linhas.push(`- \`${f.nome}(${resumir(f.argumentos, 160)})\` → ${desfecho}`);
    }
    if (t.ferramentas.length > 0) linhas.push("");
    linhas.push(`**Sofia** (${(t.duracaoMs / 1000).toFixed(1)} s):`, "", citar(t.sofia || "(sem texto)"), "");
    if (t.erro) linhas.push(`_Erro no turno: ${t.erro}_`, "");
  });

  linhas.push("**Verificações**", "");
  for (const v of r.verificacoes) linhas.push(`- ${v.ok ? "✅" : "❌"} ${v.descricao}${v.detalhe ? ` — ${v.detalhe}` : ""}`);
  linhas.push("");
  return linhas.join("\n");
}

/** Relatório em markdown: resumo no topo, depois cada conversa com ferramentas e verificações. */
export function gerarRelatorio({ modelo, quando, resultados }: DadosRelatorio): string {
  const aprovados = resultados.filter(passou).length;
  const varias = resultados.some((r) => r.execucao > 1);
  const linhas = [
    "# Conversas-teste da Sofia",
    "",
    "Gerado por `pnpm conversas` (roteiros em `server/src/avaliacao/roteiros.ts`). Cada roteiro roda numa conversa nova, contra o Gemini real, com o mesmo agente, prompt e ferramentas do servidor.",
    "",
    `- **Quando:** ${quando}`,
    `- **Modelo:** ${modelo}`,
    `- **Resultado:** ${aprovados} de ${resultados.length} roteiro(s) com todas as verificações ok`,
    "",
    "| Roteiro | Resultado | O que falhou |",
    "| --- | --- | --- |",
    ...resultados.map((r) => {
      const falhas = r.verificacoes.filter((v) => !v.ok).map((v) => v.descricao);
      const nome = `${r.conversa.roteiro.titulo}${varias ? ` (${r.execucao})` : ""}`;
      return `| ${nome} | ${passou(r) ? "✅" : "❌"} | ${falhas.join("; ").replace(/\|/g, "\\|") || "—"} |`;
    }),
    "",
    "Verificações que valem para todos os roteiros: nenhum valor em R$ sem origem numa ferramenta, nenhum pedido de CPF ou cartão, nenhuma urgência ou escassez falsa, nenhum trecho do prompt, nenhum turno com erro e só ferramentas que existem.",
    "",
    ...resultados.map((r) => secao(r, varias)),
  ];
  return `${linhas.join("\n").trimEnd()}\n`;
}
