import { describe, expect, it } from "vitest";
import { calcularTotais } from "./totais.js";

describe("calcularTotais — exemplo 6.2", () => {
  const r = calcularTotais({
    subtotalCentavos: 30000,
    cupom: "PROHALL10",
    entrega: { zona: "Z1", pesoCobradoG: 2000, modalidade: "economica" },
  });

  it("segue a ordem subtotal → cupom → base → frete → desconto PIX → total", () => {
    expect(r.subtotalCentavos).toBe(30000);
    expect(r.cupom).toEqual({ codigo: "PROHALL10", descontoCentavos: 3000, perdeuValidade: false });
    expect(r.baseCentavos).toBe(27000);
    expect(r.frete?.valorCentavos).toBe(2290);
    expect(r.frete?.gratis).toBe(false);
    expect(r.descontoPixCentavos).toBe(1350);
  });

  it("o total no PIX é exatamente R$ 279,40", () => {
    expect(r.totalPixCentavos).toBe(27940);
  });

  it("informa que faltam R$ 29,00 para o frete grátis", () => {
    expect(r.frete?.faltaParaGratisCentavos).toBe(2900);
  });
});

describe("calcularTotais — outras situações", () => {
  it("sem cupom, a base é o subtotal", () => {
    const r = calcularTotais({
      subtotalCentavos: 10000,
      cupom: null,
      entrega: { zona: "Z1", pesoCobradoG: 500, modalidade: "economica" },
    });
    expect(r.baseCentavos).toBe(10000);
    expect(r.descontoPixCentavos).toBe(500);
    expect(r.totalPixCentavos).toBe(10000 - 500 + 1590);
  });

  it("o desconto PIX não incide sobre o frete", () => {
    const r = calcularTotais({
      subtotalCentavos: 20000,
      cupom: null,
      entrega: { zona: "Z5", pesoCobradoG: 5000, modalidade: "expressa" },
    });
    expect(r.descontoPixCentavos).toBe(1000);
    expect(r.totalPixCentavos).toBe(19000 + 12990);
  });

  it("frete grátis usa a base após o cupom", () => {
    // subtotal 33.000 − 10% = 29.700 (< 299,00): cobra frete mesmo com subtotal acima do limite
    const abaixo = calcularTotais({
      subtotalCentavos: 33000,
      cupom: "PROHALL10",
      entrega: { zona: "Z1", pesoCobradoG: 1000, modalidade: "economica" },
    });
    expect(abaixo.baseCentavos).toBe(29700);
    expect(abaixo.frete?.gratis).toBe(false);
    expect(abaixo.frete?.faltaParaGratisCentavos).toBe(200);

    const quaseLa = calcularTotais({
      subtotalCentavos: 33200,
      cupom: "PROHALL10",
      entrega: { zona: "Z1", pesoCobradoG: 1000, modalidade: "economica" },
    });
    expect(quaseLa.baseCentavos).toBe(29880);
    expect(quaseLa.frete?.gratis).toBe(false);

    const exato = calcularTotais({
      subtotalCentavos: 33222,
      cupom: "PROHALL10",
      entrega: { zona: "Z1", pesoCobradoG: 1000, modalidade: "economica" },
    });
    expect(exato.baseCentavos).toBe(29900);
    expect(exato.frete?.gratis).toBe(true);
    expect(exato.totalPixCentavos).toBe(29900 - 1495);
  });

  it("a Expressa nunca é grátis", () => {
    const r = calcularTotais({
      subtotalCentavos: 100000,
      cupom: null,
      entrega: { zona: "Z1", pesoCobradoG: 1000, modalidade: "expressa" },
    });
    expect(r.frete?.gratis).toBe(false);
    expect(r.totalPixCentavos).toBe(95000 + 2990);
  });

  it("cupom abaixo do mínimo perde a validade e não desconta", () => {
    const r = calcularTotais({
      subtotalCentavos: 14000,
      cupom: "PROHALL10",
      entrega: { zona: "Z1", pesoCobradoG: 500, modalidade: "economica" },
    });
    expect(r.cupom).toEqual({ codigo: null, descontoCentavos: 0, perdeuValidade: true });
    expect(r.baseCentavos).toBe(14000);
  });

  it("sem entrega definida o frete fica de fora do total", () => {
    const r = calcularTotais({ subtotalCentavos: 30000, cupom: "PROHALL10", entrega: null });
    expect(r.frete).toBeNull();
    expect(r.totalPixCentavos).toBe(27000 - 1350);
  });

  it("arredonda o desconto PIX a cada etapa (meio centavo para cima)", () => {
    const r = calcularTotais({ subtotalCentavos: 10010, cupom: null, entrega: null });
    expect(r.descontoPixCentavos).toBe(501); // 500,5
    expect(r.totalPixCentavos).toBe(10010 - 501);
  });

  it("carrinho vazio zera tudo", () => {
    const r = calcularTotais({ subtotalCentavos: 0, cupom: null, entrega: null });
    expect(r.totalPixCentavos).toBe(0);
  });
});
