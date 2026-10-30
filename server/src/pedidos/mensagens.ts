import type { Pedido } from "@sofia/shared";
import { formatarBRL } from "../domain/dinheiro.js";
import { textoPrazo } from "../tools/resumo-carrinho.js";

const NOMES_MODALIDADE = { economica: "Econômica", expressa: "Expressa" } as const;

/**
 * Confirmação que a Sofia manda no chat quando o pagamento (simulado) cai. Texto fixo no tom dela:
 * os valores vêm do pedido, então nada é inventado e não gasta uma chamada ao modelo.
 */
export function mensagemPagamentoConfirmado(pedido: Pedido): string {
  const primeiroNome = pedido.cliente.nome.split(/\s+/)[0] ?? pedido.cliente.nome;
  const modalidade = NOMES_MODALIDADE[pedido.entrega.modalidade];
  const prazo = textoPrazo(pedido.entrega.prazoMinDias, pedido.entrega.prazoMaxDias);
  return (
    `Pagamento confirmado, ${primeiroNome}! 🎉 O pedido ${pedido.id} está pago: ${formatarBRL(pedido.totais.totalPixCentavos)} no PIX. ` +
    `Ele segue pela entrega ${modalidade} e chega em ${prazo}. ` +
    `Lembrando que aqui é só um teste, então nenhum valor foi cobrado de verdade. ` +
    `Obrigada por escolher a Prohall! Se tiver qualquer dúvida de como usar os produtos, é só me chamar.`
  );
}
