// Cupom único PROHALL10 (especificação, 6.1): 10% sobre o subtotal, pedido mínimo R$ 150,00.
import { formatarBRL, percentualDe } from "./dinheiro.js";

export const CUPOM_PROHALL10 = "PROHALL10";
export const CUPOM_PERCENTUAL = 10;
export const CUPOM_MINIMO_CENTAVOS = 15000;

export type ResultadoCupom =
  | { ok: true; codigo: typeof CUPOM_PROHALL10; descontoCentavos: number }
  | {
      ok: false;
      motivo: "invalido" | "abaixo_do_minimo";
      erro: string;
      faltaParaMinimoCentavos?: number;
    };

export interface CupomAplicado {
  /** Código ainda válido para o subtotal atual, ou null. */
  codigo: typeof CUPOM_PROHALL10 | null;
  descontoCentavos: number;
  /** true quando um cupom aplicado deixou de valer (subtotal abaixo do mínimo). */
  perdeuValidade: boolean;
}

export function validarCupom(codigo: string, subtotalCentavos: number): ResultadoCupom {
  if (codigo.trim().toUpperCase() !== CUPOM_PROHALL10) {
    return { ok: false, motivo: "invalido", erro: "Esse cupom não é válido." };
  }
  if (subtotalCentavos < CUPOM_MINIMO_CENTAVOS) {
    return {
      ok: false,
      motivo: "abaixo_do_minimo",
      erro: `O cupom ${CUPOM_PROHALL10} vale para pedidos a partir de ${formatarBRL(CUPOM_MINIMO_CENTAVOS)} em produtos.`,
      faltaParaMinimoCentavos: CUPOM_MINIMO_CENTAVOS - subtotalCentavos,
    };
  }
  return {
    ok: true,
    codigo: CUPOM_PROHALL10,
    descontoCentavos: percentualDe(subtotalCentavos, CUPOM_PERCENTUAL),
  };
}

/** Reavalia o cupom já aplicado depois de uma mudança no carrinho. Um cupom por pedido. */
export function reavaliarCupom(aplicado: string | null, subtotalCentavos: number): CupomAplicado {
  if (aplicado === null) return { codigo: null, descontoCentavos: 0, perdeuValidade: false };
  const r = validarCupom(aplicado, subtotalCentavos);
  if (r.ok) return { codigo: r.codigo, descontoCentavos: r.descontoCentavos, perdeuValidade: false };
  return { codigo: null, descontoCentavos: 0, perdeuValidade: true };
}
