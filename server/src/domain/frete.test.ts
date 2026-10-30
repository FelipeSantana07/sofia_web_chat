import { describe, expect, it } from "vitest";
import { calcularFrete, calcularOpcoesDeFrete } from "./frete.js";
import type { Zona } from "./cep.js";

describe("frete Econômica (5.3)", () => {
  it.each<[Zona, number, number, number, number]>([
    // zona, peso (g), valor esperado (centavos), prazo mín, prazo máx
    ["Z1", 500, 1590, 3, 5],
    ["Z1", 1000, 1890, 3, 5],
    ["Z1", 2000, 2290, 3, 5],
    ["Z1", 5000, 2990, 3, 5],
    ["Z2", 500, 1990, 4, 7],
    ["Z2", 1000, 2390, 4, 7],
    ["Z2", 2000, 2890, 4, 7],
    ["Z2", 5000, 3890, 4, 7],
    ["Z3", 500, 2490, 5, 9],
    ["Z3", 1000, 2990, 5, 9],
    ["Z3", 2000, 3690, 5, 9],
    ["Z3", 5000, 4990, 5, 9],
    ["Z4", 500, 2990, 7, 12],
    ["Z4", 1000, 3690, 7, 12],
    ["Z4", 2000, 4590, 7, 12],
    ["Z4", 5000, 6490, 7, 12],
    ["Z5", 500, 3490, 9, 15],
    ["Z5", 1000, 4290, 9, 15],
    ["Z5", 2000, 5490, 9, 15],
    ["Z5", 5000, 7990, 9, 15],
  ])("%s com %i g", (zona, peso, valor, min, max) => {
    expect(calcularFrete(zona, peso, "economica")).toEqual({
      modalidade: "economica",
      valorCentavos: valor,
      prazoMinDias: min,
      prazoMaxDias: max,
    });
  });
});

describe("frete Expressa (5.4)", () => {
  it.each<[Zona, number, number, number, number]>([
    ["Z1", 500, 2490, 1, 2],
    ["Z1", 1000, 2990, 1, 2],
    ["Z1", 2000, 3590, 1, 2],
    ["Z1", 5000, 4790, 1, 2],
    ["Z2", 500, 3190, 2, 3],
    ["Z2", 1000, 3890, 2, 3],
    ["Z2", 2000, 4690, 2, 3],
    ["Z2", 5000, 6290, 2, 3],
    ["Z3", 500, 3990, 2, 4],
    ["Z3", 1000, 4890, 2, 4],
    ["Z3", 2000, 5990, 2, 4],
    ["Z3", 5000, 8290, 2, 4],
    ["Z4", 500, 4990, 3, 6],
    ["Z4", 1000, 5990, 3, 6],
    ["Z4", 2000, 7490, 3, 6],
    ["Z4", 5000, 10490, 3, 6],
    ["Z5", 500, 5990, 4, 8],
    ["Z5", 1000, 7290, 4, 8],
    ["Z5", 2000, 8990, 4, 8],
    ["Z5", 5000, 12990, 4, 8],
  ])("%s com %i g", (zona, peso, valor, min, max) => {
    expect(calcularFrete(zona, peso, "expressa")).toEqual({
      modalidade: "expressa",
      valorCentavos: valor,
      prazoMinDias: min,
      prazoMaxDias: max,
    });
  });
});

describe("faixas e adicional por kg", () => {
  it("1.000 g usa a faixa até 1 kg e 1.001 g a de até 2 kg", () => {
    expect(calcularFrete("Z1", 1000, "economica").valorCentavos).toBe(1890);
    expect(calcularFrete("Z1", 1001, "economica").valorCentavos).toBe(2290);
  });

  it("acima de 5 kg soma o adicional por kg excedente (arredondado para cima)", () => {
    // 5,3 kg → +1 kg; 6,3 kg → +2 kg
    expect(calcularFrete("Z1", 5300, "economica").valorCentavos).toBe(2990 + 350);
    expect(calcularFrete("Z1", 6300, "economica").valorCentavos).toBe(2990 + 2 * 350);
    expect(calcularFrete("Z5", 6300, "expressa").valorCentavos).toBe(12990 + 2 * 1600);
    expect(calcularFrete("Z3", 5001, "economica").valorCentavos).toBe(4990 + 600);
  });
});

describe("calcularOpcoesDeFrete", () => {
  it("devolve as duas modalidades", () => {
    const opcoes = calcularOpcoesDeFrete("Z1", 2000);
    expect(opcoes.economica.valorCentavos).toBe(2290);
    expect(opcoes.expressa.valorCentavos).toBe(3590);
  });
});
