import { describe, expect, it } from "vitest";
import {
  centavosParaReais,
  formatarBRL,
  percentualDe,
  reaisParaCentavos,
} from "./dinheiro.js";

describe("reaisParaCentavos", () => {
  it("converte valores do catálogo", () => {
    expect(reaisParaCentavos(189.9)).toBe(18990);
    expect(reaisParaCentavos(279.4)).toBe(27940);
    expect(reaisParaCentavos(0)).toBe(0);
  });

  it("não sofre com ponto flutuante", () => {
    expect(reaisParaCentavos(0.1 + 0.2)).toBe(30);
    expect(reaisParaCentavos(1.005)).toBe(101);
    expect(reaisParaCentavos(19.99)).toBe(1999);
  });

  it("aceita valores grandes", () => {
    expect(reaisParaCentavos(99999.99)).toBe(9999999);
  });

  it("rejeita valores inválidos", () => {
    expect(() => reaisParaCentavos(Number.NaN)).toThrow();
    expect(() => reaisParaCentavos(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => reaisParaCentavos(-1)).toThrow();
  });
});

describe("centavosParaReais", () => {
  it("converte centavos em reais", () => {
    expect(centavosParaReais(27940)).toBe(279.4);
    expect(centavosParaReais(5)).toBe(0.05);
    expect(centavosParaReais(0)).toBe(0);
  });

  it("rejeita centavos não inteiros", () => {
    expect(() => centavosParaReais(10.5)).toThrow();
    expect(() => centavosParaReais(Number.NaN)).toThrow();
  });
});

describe("percentualDe", () => {
  it("calcula percentuais exatos", () => {
    expect(percentualDe(20000, 10)).toBe(2000);
    expect(percentualDe(27940, 5)).toBe(1397);
  });

  it("arredonda o meio centavo para cima", () => {
    expect(percentualDe(15005, 10)).toBe(1501); // 1500,5
    expect(percentualDe(10, 5)).toBe(1); // 0,5
    expect(percentualDe(30, 5)).toBe(2); // 1,5
    expect(percentualDe(29, 5)).toBe(1); // 1,45
  });

  it("aceita percentual decimal", () => {
    expect(percentualDe(10000, 2.5)).toBe(250);
  });

  it("rejeita entradas inválidas", () => {
    expect(() => percentualDe(10.5, 10)).toThrow();
    expect(() => percentualDe(100, -1)).toThrow();
    expect(() => percentualDe(100, Number.NaN)).toThrow();
  });
});

describe("formatarBRL", () => {
  it("formata em reais com vírgula", () => {
    expect(formatarBRL(27940)).toBe("R$ 279,40");
    expect(formatarBRL(5)).toBe("R$ 0,05");
    expect(formatarBRL(0)).toBe("R$ 0,00");
    expect(formatarBRL(100)).toBe("R$ 1,00");
  });

  it("separa milhares com ponto", () => {
    expect(formatarBRL(123456)).toBe("R$ 1.234,56");
    expect(formatarBRL(100000000)).toBe("R$ 1.000.000,00");
  });

  it("rejeita centavos não inteiros ou negativos", () => {
    expect(() => formatarBRL(10.5)).toThrow();
    expect(() => formatarBRL(-1)).toThrow();
  });
});
