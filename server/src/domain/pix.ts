import type { Pedido, PixFalso } from "@sofia/shared";

export const PIX_VALIDADE_MS = 15 * 60 * 1000;

export type StatusPix = "ativo" | "expirado";

/** Valor em centavos como texto com ponto e duas casas (27940 → "279.40"), sem passar por ponto flutuante. */
function valorParaTexto(centavos: number): string {
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}

/**
 * PIX falso do pedido: um texto óbvio de teste, nunca um BR Code/EMV nem uma chave real,
 * com o total do pedido e validade de 15 minutos.
 */
export function gerarPix(pedido: Pick<Pedido, "id" | "totais">, agora: number): PixFalso {
  const valorCentavos = pedido.totais.totalPixCentavos;
  return {
    texto: `PIX-TESTE|PROHALL|${pedido.id}|${valorParaTexto(valorCentavos)}|NAO-PAGAVEL`,
    valorCentavos,
    geradoEm: agora,
    expiraEm: agora + PIX_VALIDADE_MS,
  };
}

/** O PIX vale até o instante em que completa 15 minutos: nesse instante já está expirado. */
export function statusDoPix(pix: PixFalso, agora: number): StatusPix {
  return agora < pix.expiraEm ? "ativo" : "expirado";
}
