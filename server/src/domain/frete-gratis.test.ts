import { describe, expect, it } from "vitest";
import { aplicarFreteGratis, limiteFreteGratisCentavos } from "./frete-gratis.js";
import { calcularFrete } from "./frete.js";

describe("limiteFreteGratisCentavos", () => {
  it("Z1 e Z2 a partir de R$ 299,00", () => {
    expect(limiteFreteGratisCentavos("Z1")).toBe(29900);
    expect(limiteFreteGratisCentavos("Z2")).toBe(29900);
  });

  it("Z3, Z4 e Z5 a partir de R$ 399,00", () => {
    expect(limiteFreteGratisCentavos("Z3")).toBe(39900);
    expect(limiteFreteGratisCentavos("Z4")).toBe(39900);
    expect(limiteFreteGratisCentavos("Z5")).toBe(39900);
  });
});

describe("aplicarFreteGratis", () => {
  const economicaZ1 = calcularFrete("Z1", 2000, "economica"); // R$ 22,90

  it("abaixo do limite cobra o frete e informa quanto falta (exemplo 6.2: R$ 29,00)", () => {
    const r = aplicarFreteGratis("Z1", 27000, economicaZ1);
    expect(r.gratis).toBe(false);
    expect(r.valorCentavos).toBe(2290);
    expect(r.faltaParaGratisCentavos).toBe(2900);
  });

  it("no limite exato o frete é grátis", () => {
    const r = aplicarFreteGratis("Z1", 29900, economicaZ1);
    expect(r.gratis).toBe(true);
    expect(r.valorCentavos).toBe(0);
    expect(r.faltaParaGratisCentavos).toBe(0);
  });

  it("um centavo abaixo do limite ainda cobra", () => {
    const r = aplicarFreteGratis("Z1", 29899, economicaZ1);
    expect(r.gratis).toBe(false);
    expect(r.faltaParaGratisCentavos).toBe(1);
  });

  it("Z3 a Z5 usam o limite de R$ 399,00", () => {
    const z4 = calcularFrete("Z4", 1000, "economica");
    expect(aplicarFreteGratis("Z4", 39899, z4).gratis).toBe(false);
    expect(aplicarFreteGratis("Z4", 39900, z4).gratis).toBe(true);
    expect(aplicarFreteGratis("Z4", 30000, z4).faltaParaGratisCentavos).toBe(9900);
  });

  it("a Expressa nunca é grátis, mesmo acima do limite", () => {
    const expressa = calcularFrete("Z1", 2000, "expressa");
    const r = aplicarFreteGratis("Z1", 100000, expressa);
    expect(r.gratis).toBe(false);
    expect(r.valorCentavos).toBe(3590);
    expect(r.faltaParaGratisCentavos).toBeNull();
  });

  it("preserva o valor de tabela e o prazo", () => {
    const r = aplicarFreteGratis("Z1", 29900, economicaZ1);
    expect(r.valorTabelaCentavos).toBe(2290);
    expect(r.prazoMinDias).toBe(3);
    expect(r.prazoMaxDias).toBe(5);
  });

  it("rejeita base inválida", () => {
    expect(() => aplicarFreteGratis("Z1", -1, economicaZ1)).toThrow();
    expect(() => aplicarFreteGratis("Z1", 10.5, economicaZ1)).toThrow();
  });
});
