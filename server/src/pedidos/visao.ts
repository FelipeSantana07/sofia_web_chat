import type { Pedido } from "@sofia/shared";
import { statusDoPix } from "../domain/pix.js";
import { dinheiro } from "../tools/base.js";
import { textoPrazo } from "../tools/resumo-carrinho.js";

const NOMES_MODALIDADE = { economica: "Econômica", expressa: "Expressa" } as const;
const iso = (t: number) => new Date(t).toISOString();

/**
 * O pedido como o modelo e a interface o veem: valores em `{ centavos, texto }`, PIX com status e tempo restante.
 * O QR Code não entra aqui: só a rota de PIX o devolve.
 */
export function visaoDoPedido(pedido: Pedido, agora: number) {
  const { totais, entrega, pix } = pedido;
  return {
    id: pedido.id,
    status: pedido.status,
    criado_em: iso(pedido.criadoEm),
    pago_em: pedido.pagoEm === null ? null : iso(pedido.pagoEm),
    cliente: pedido.cliente,
    entrega: {
      cep: `${entrega.cep.slice(0, 5)}-${entrega.cep.slice(5)}`,
      endereco: entrega.endereco,
      numero: entrega.numero,
      complemento: entrega.complemento,
      zona: entrega.zona,
      modalidade: entrega.modalidade,
      nome_modalidade: NOMES_MODALIDADE[entrega.modalidade],
      prazo: textoPrazo(entrega.prazoMinDias, entrega.prazoMaxDias),
    },
    itens: pedido.itens.map((i) => ({
      id: i.produtoId,
      nome: i.nome,
      quantidade: i.quantidade,
      preco_unitario: dinheiro(i.precoUnitarioCentavos),
      total_do_item: dinheiro(i.totalCentavos),
    })),
    cupom: pedido.cupom,
    totais: {
      subtotal: dinheiro(totais.subtotalCentavos),
      desconto_cupom: dinheiro(totais.descontoCupomCentavos),
      base_produtos: dinheiro(totais.baseCentavos),
      frete: dinheiro(totais.freteCentavos),
      frete_gratis: totais.freteGratis,
      desconto_pix: dinheiro(totais.descontoPixCentavos),
      total_no_pix: dinheiro(totais.totalPixCentavos),
    },
    pix: pix
      ? {
          copia_e_cola: pix.texto,
          valor: dinheiro(pix.valorCentavos),
          status: pedido.status === "pago" ? ("pago" as const) : statusDoPix(pix, agora),
          gerado_em: iso(pix.geradoEm),
          expira_em: iso(pix.expiraEm),
          segundos_restantes: Math.max(0, Math.ceil((pix.expiraEm - agora) / 1000)),
          aviso: "PIX de teste: não é um código real e não cobra ninguém.",
        }
      : null,
  };
}

export type VisaoPedido = ReturnType<typeof visaoDoPedido>;
