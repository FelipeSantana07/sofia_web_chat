import { describe, expect, it } from "vitest";
import { calcularPesoCobrado, classificarFaixa } from "./peso.js";

describe("calcularPesoCobrado", () => {
  it("soma peso × quantidade + 200 g de embalagem", () => {
    expect(calcularPesoCobrado([{ pesoBrutoG: 1150, quantidade: 2 }])).toBe(2500);
    expect(
      calcularPesoCobrado([
        { pesoBrutoG: 500, quantidade: 1 },
        { pesoBrutoG: 300, quantidade: 3 },
      ]),
    ).toBe(1600);
  });

  it("carrinho vazio só tem a embalagem", () => {
    expect(calcularPesoCobrado([])).toBe(200);
  });

  it("rejeita peso ou quantidade inválidos", () => {
    expect(() => calcularPesoCobrado([{ pesoBrutoG: -1, quantidade: 1 }])).toThrow();
    expect(() => calcularPesoCobrado([{ pesoBrutoG: 100, quantidade: 0 }])).toThrow();
    expect(() => calcularPesoCobrado([{ pesoBrutoG: 100.5, quantidade: 1 }])).toThrow();
  });
});

describe("classificarFaixa", () => {
  it.each([
    [1, "F1"],
    [500, "F1"],
    [501, "F2"],
    [1000, "F2"],
    [1001, "F3"],
    [2000, "F3"],
    [2001, "F4"],
    [5000, "F4"],
  ])("%i g cai em %s", (peso, faixa) => {
    expect(classificarFaixa(peso)).toEqual({ faixa, kgExcedentes: 0 });
  });

  it("acima de 5 kg usa F4 + kg excedente arredondado para cima", () => {
    expect(classificarFaixa(5001)).toEqual({ faixa: "F4", kgExcedentes: 1 });
    expect(classificarFaixa(5300)).toEqual({ faixa: "F4", kgExcedentes: 1 });
    expect(classificarFaixa(6000)).toEqual({ faixa: "F4", kgExcedentes: 1 });
    expect(classificarFaixa(6300)).toEqual({ faixa: "F4", kgExcedentes: 2 });
    expect(classificarFaixa(7001)).toEqual({ faixa: "F4", kgExcedentes: 3 });
  });

  it("rejeita peso inválido", () => {
    expect(() => classificarFaixa(0)).toThrow();
    expect(() => classificarFaixa(-5)).toThrow();
    expect(() => classificarFaixa(10.5)).toThrow();
  });
});
