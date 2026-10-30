import type { ItemPedido, Pedido } from "@sofia/shared";
import type { Zona } from "./cep.js";
import type { Modalidade } from "./frete.js";
import { calcularTotais } from "./totais.js";

export interface EntradaPedido {
  id: string;
  agora: number;
  itens: ItemPedido[];
  /** Cupom aplicado ao carrinho; só entra no pedido se ainda valer para o subtotal. */
  cupom: string | null;
  cliente: Pedido["cliente"];
  endereco: { cep: string; endereco: string; numero: string; complemento: string | null };
  zona: Zona;
  pesoCobradoG: number;
  modalidade: Modalidade;
}

/** Monta o pedido em `aguardando_pagamento`, com todos os valores calculados pelo domínio. */
export function montarPedido(e: EntradaPedido): Pedido {
  const subtotalCentavos = e.itens.reduce((soma, i) => soma + i.totalCentavos, 0);
  const t = calcularTotais({
    subtotalCentavos,
    cupom: e.cupom,
    entrega: { zona: e.zona, pesoCobradoG: e.pesoCobradoG, modalidade: e.modalidade },
  });
  const frete = t.frete!; // a entrega foi informada

  return {
    id: e.id,
    status: "aguardando_pagamento",
    criadoEm: e.agora,
    pagoEm: null,
    cliente: e.cliente,
    entrega: {
      ...e.endereco,
      zona: e.zona,
      modalidade: e.modalidade,
      prazoMinDias: frete.prazoMinDias,
      prazoMaxDias: frete.prazoMaxDias,
    },
    itens: e.itens,
    cupom: t.cupom.codigo,
    totais: {
      subtotalCentavos,
      descontoCupomCentavos: t.cupom.descontoCentavos,
      baseCentavos: t.baseCentavos,
      freteCentavos: frete.valorCentavos,
      freteGratis: frete.gratis,
      descontoPixCentavos: t.descontoPixCentavos,
      totalPixCentavos: t.totalPixCentavos,
    },
    pix: null,
  };
}
