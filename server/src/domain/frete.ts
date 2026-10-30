// Tabelas de frete fixas e fictícias (especificação, 5.3 e 5.4). Valores em centavos.
import type { Zona } from "./cep.js";
import { classificarFaixa, type Faixa } from "./peso.js";

export type Modalidade = "economica" | "expressa";

export interface OpcaoFrete {
  modalidade: Modalidade;
  valorCentavos: number;
  prazoMinDias: number;
  prazoMaxDias: number;
}

interface LinhaTabela {
  faixas: Record<Faixa, number>;
  porKgExcedente: number;
  prazo: readonly [number, number];
}

const ECONOMICA: Record<Zona, LinhaTabela> = {
  Z1: { faixas: { F1: 1590, F2: 1890, F3: 2290, F4: 2990 }, porKgExcedente: 350, prazo: [3, 5] },
  Z2: { faixas: { F1: 1990, F2: 2390, F3: 2890, F4: 3890 }, porKgExcedente: 450, prazo: [4, 7] },
  Z3: { faixas: { F1: 2490, F2: 2990, F3: 3690, F4: 4990 }, porKgExcedente: 600, prazo: [5, 9] },
  Z4: { faixas: { F1: 2990, F2: 3690, F3: 4590, F4: 6490 }, porKgExcedente: 800, prazo: [7, 12] },
  Z5: { faixas: { F1: 3490, F2: 4290, F3: 5490, F4: 7990 }, porKgExcedente: 1000, prazo: [9, 15] },
};

const EXPRESSA: Record<Zona, LinhaTabela> = {
  Z1: { faixas: { F1: 2490, F2: 2990, F3: 3590, F4: 4790 }, porKgExcedente: 550, prazo: [1, 2] },
  Z2: { faixas: { F1: 3190, F2: 3890, F3: 4690, F4: 6290 }, porKgExcedente: 700, prazo: [2, 3] },
  Z3: { faixas: { F1: 3990, F2: 4890, F3: 5990, F4: 8290 }, porKgExcedente: 950, prazo: [2, 4] },
  Z4: { faixas: { F1: 4990, F2: 5990, F3: 7490, F4: 10490 }, porKgExcedente: 1300, prazo: [3, 6] },
  Z5: { faixas: { F1: 5990, F2: 7290, F3: 8990, F4: 12990 }, porKgExcedente: 1600, prazo: [4, 8] },
};

const TABELAS: Record<Modalidade, Record<Zona, LinhaTabela>> = {
  economica: ECONOMICA,
  expressa: EXPRESSA,
};

/** Frete da tabela fixa, antes da regra de frete grátis (T-10). */
export function calcularFrete(zona: Zona, pesoCobradoG: number, modalidade: Modalidade): OpcaoFrete {
  const linha = TABELAS[modalidade][zona];
  const { faixa, kgExcedentes } = classificarFaixa(pesoCobradoG);
  return {
    modalidade,
    valorCentavos: linha.faixas[faixa] + kgExcedentes * linha.porKgExcedente,
    prazoMinDias: linha.prazo[0],
    prazoMaxDias: linha.prazo[1],
  };
}

export function calcularOpcoesDeFrete(zona: Zona, pesoCobradoG: number) {
  return {
    economica: calcularFrete(zona, pesoCobradoG, "economica"),
    expressa: calcularFrete(zona, pesoCobradoG, "expressa"),
  };
}
