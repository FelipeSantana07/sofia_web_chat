import type { Pedido } from "@sofia/shared";
import { visaoDoPedido } from "../pedidos/visao.js";
import type { Perfil } from "./perfis.js";
import type { TurnoRegistrado, Verificacao } from "./tipos.js";

export interface DadosExportacao {
  numero: number;
  perfil: Perfil;
  turnos: TurnoRegistrado[];
  pedido: Pedido | null;
  /** Fala fixa da Sofia quando o pagamento é simulado (a mesma que a tela mostra no chat). */
  confirmacaoDoPagamento: string | null;
  verificacoes: Verificacao[];
  modelo: string;
  configuracao: string;
  quando: string;
  /** Qual tentativa de rodar o perfil gerou este arquivo (o modelo varia de uma execução para outra). */
  tentativa: number;
}

const nomeDaFerramenta = (nome: string) => `\`${nome}\``;

/** Cita uma fala preservando as quebras de linha. */
const citar = (texto: string) =>
  texto
    .trim()
    .split("\n")
    .map((linha) => (linha.trim() === "" ? ">" : `> ${linha}`))
    .join("\n");

/**
 * Uma conversa exportada em markdown legível: cabeçalho, as falas na ordem (com as ferramentas de cada resposta),
 * o pedido ao final e as verificações automáticas. Sem JSON bruto e sem nenhuma chave.
 */
export function formatarConversaExportada(d: DadosExportacao): string {
  const usadas = [...new Set(d.turnos.flatMap((t) => t.ferramentas.map((f) => f.nome)))];
  const visao = d.pedido ? visaoDoPedido(d.pedido, d.pedido.pagoEm ?? 0) : null;
  const falhas = d.verificacoes.filter((v) => !v.ok);

  const linhas = [
    `# Conversa ${d.numero} · ${d.perfil.titulo}`,
    "",
    `**Perfil:** ${d.perfil.descricao}`,
    "",
    ...(visao
      ? [`**Resultado:** pedido ${visao.id} ${visao.status === "pago" ? "pago" : "aguardando pagamento"} · total no PIX ${visao.totais.total_no_pix.texto} · entrega ${visao.entrega.nome_modalidade} (${visao.entrega.prazo})`]
      : ["**Resultado:** a conversa não chegou a fechar um pedido"]),
    "",
    "**O que esta conversa mostra:**",
    ...d.perfil.mostra.map((m) => `- ${m}`),
    "",
    `_Gerada com \`pnpm conversas:exportar\` em ${d.quando}, com o Gemini real (${d.modelo}: ${d.configuracao}). Tentativa ${d.tentativa}; as falas da Sofia não foram editadas. Os dados de entrega são fictícios._`,
    "",
    "---",
    "",
  ];

  for (const t of d.turnos) {
    linhas.push(`**Cliente:** ${t.cliente}`, "", "**Sofia:**", "", citar(t.sofia || "(sem texto)"), "");
    if (t.ferramentas.length > 0) linhas.push(`_Ferramentas: ${t.ferramentas.map((f) => nomeDaFerramenta(f.nome)).join(" → ")}_`, "");
  }

  if (d.confirmacaoDoPagamento) {
    linhas.push(
      "**Cliente:** _(toca em \"Simular pagamento\" na tela do PIX)_",
      "",
      "**Sofia:**",
      "",
      citar(d.confirmacaoDoPagamento),
      "",
    );
  }

  linhas.push("---", "");

  if (visao) {
    linhas.push("## Pedido", "");
    for (const i of visao.itens) linhas.push(`- ${i.quantidade}× ${i.nome} — ${i.total_do_item.texto}`);
    const t = visao.totais;
    linhas.push(
      "",
      `- Subtotal: ${t.subtotal.texto}`,
      ...(visao.cupom ? [`- Cupom ${visao.cupom}: − ${t.desconto_cupom.texto}`] : []),
      `- Desconto PIX (5%): − ${t.desconto_pix.texto}`,
      `- Frete ${visao.entrega.nome_modalidade}: ${t.frete_gratis ? "grátis" : t.frete.texto}`,
      `- **Total no PIX: ${t.total_no_pix.texto}**`,
      `- Entrega: ${visao.entrega.endereco}, ${visao.entrega.numero}${visao.entrega.complemento ? ` — ${visao.entrega.complemento}` : ""} · CEP ${visao.entrega.cep}`,
    );
    if (d.pedido?.pix) {
      linhas.push(`- PIX de teste (válido por 15 minutos, não paga nada): \`${d.pedido.pix.texto}\``);
    }
    linhas.push("");
  }

  linhas.push(`## Ferramentas usadas`, "", usadas.map(nomeDaFerramenta).join(", ") || "nenhuma", "", "## Verificações automáticas", "");
  for (const v of d.verificacoes) linhas.push(`- ${v.ok ? "✅" : "❌"} ${v.descricao}${v.detalhe ? ` — ${v.detalhe}` : ""}`);
  if (falhas.length > 0) linhas.push("", "_Há verificações que falharam: a conversa não deve ser usada como evidência._");
  return `${linhas.join("\n").trimEnd()}\n`;
}
