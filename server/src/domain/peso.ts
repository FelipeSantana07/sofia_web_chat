// Peso cobrado e faixa de frete (especificação, 5.2). Pesos em gramas (inteiros).

export const EMBALAGEM_G = 200;

export type Faixa = "F1" | "F2" | "F3" | "F4";

export interface ItemPeso {
  pesoBrutoG: number;
  quantidade: number;
}

export interface FaixaPeso {
  faixa: Faixa;
  /** kg adicionais acima de 5 kg, arredondados para cima; 0 até 5 kg. */
  kgExcedentes: number;
}

// Limites inclusivos: 1.000 g ainda é "até 1 kg".
const LIMITES: ReadonlyArray<readonly [number, Faixa]> = [
  [500, "F1"],
  [1000, "F2"],
  [2000, "F3"],
  [5000, "F4"],
];

export function calcularPesoCobrado(itens: readonly ItemPeso[]): number {
  let total = EMBALAGEM_G;
  for (const { pesoBrutoG, quantidade } of itens) {
    if (!Number.isInteger(pesoBrutoG) || pesoBrutoG < 0) {
      throw new RangeError(`Peso inválido: ${pesoBrutoG} g`);
    }
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      throw new RangeError(`Quantidade inválida: ${quantidade}`);
    }
    total += pesoBrutoG * quantidade;
  }
  return total;
}

export function classificarFaixa(pesoCobradoG: number): FaixaPeso {
  if (!Number.isInteger(pesoCobradoG) || pesoCobradoG < 1) {
    throw new RangeError(`Peso cobrado inválido: ${pesoCobradoG} g`);
  }
  const encontrada = LIMITES.find(([limite]) => pesoCobradoG <= limite);
  if (encontrada) return { faixa: encontrada[1], kgExcedentes: 0 };
  return { faixa: "F4", kgExcedentes: Math.ceil((pesoCobradoG - 5000) / 1000) };
}
