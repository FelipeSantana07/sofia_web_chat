// Frete grátis (especificação, 5.5): só na Econômica, com base = produtos após o cupom.
import type { Zona } from "./cep.js";
import type { OpcaoFrete } from "./frete.js";

export interface FreteComRegras extends OpcaoFrete {
  /** Valor da tabela, antes da regra de frete grátis. */
  valorTabelaCentavos: number;
  gratis: boolean;
  /** Quanto falta para o frete grátis; 0 se já é grátis; null na Expressa (nunca é grátis). */
  faltaParaGratisCentavos: number | null;
}

export function limiteFreteGratisCentavos(zona: Zona): number {
  return zona === "Z1" || zona === "Z2" ? 29900 : 39900;
}

export function aplicarFreteGratis(zona: Zona, baseCentavos: number, frete: OpcaoFrete): FreteComRegras {
  if (!Number.isSafeInteger(baseCentavos) || baseCentavos < 0) {
    throw new RangeError(`Base em centavos inválida: ${baseCentavos}`);
  }
  if (frete.modalidade !== "economica") {
    return { ...frete, valorTabelaCentavos: frete.valorCentavos, gratis: false, faltaParaGratisCentavos: null };
  }
  const falta = Math.max(0, limiteFreteGratisCentavos(zona) - baseCentavos);
  const gratis = falta === 0;
  return {
    ...frete,
    valorTabelaCentavos: frete.valorCentavos,
    valorCentavos: gratis ? 0 : frete.valorCentavos,
    gratis,
    faltaParaGratisCentavos: falta,
  };
}
