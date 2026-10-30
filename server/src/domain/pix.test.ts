import { describe, expect, it } from "vitest";
import { PIX_VALIDADE_MS, gerarPix, statusDoPix } from "./pix.js";

const pedido = (totalPixCentavos: number) => ({
  id: "PH-TESTE-000123",
  totais: { totalPixCentavos } as never,
});

describe("gerarPix", () => {
  it("monta o texto de mentira com o número do pedido e o valor (exemplo 6.2)", () => {
    const pix = gerarPix(pedido(27940), 1000);
    expect(pix.texto).toBe("PIX-TESTE|PROHALL|PH-TESTE-000123|279.40|NAO-PAGAVEL");
    expect(pix.valorCentavos).toBe(27940);
  });

  it.each([
    [5, "0.05"],
    [100, "1.00"],
    [12050, "120.50"],
  ])("formata %i centavos como %s", (centavos, esperado) => {
    expect(gerarPix(pedido(centavos), 0).texto).toContain(`|${esperado}|`);
  });

  it("vale 15 minutos a partir da geração", () => {
    const pix = gerarPix(pedido(27940), 5000);
    expect(pix.geradoEm).toBe(5000);
    expect(pix.expiraEm).toBe(5000 + 15 * 60 * 1000);
  });

  it("nunca parece um BR Code/EMV nem leva chave PIX", () => {
    const { texto } = gerarPix(pedido(27940), 0);
    expect(texto).not.toMatch(/^0002/); // início do payload EMV
    expect(texto).not.toMatch(/br\.gov\.bcb/i);
    expect(texto).toContain("NAO-PAGAVEL");
  });
});

describe("statusDoPix", () => {
  const pix = gerarPix(pedido(1000), 0);

  it("está ativo até 14 min 59 s e expirado aos 15 min", () => {
    expect(statusDoPix(pix, 0)).toBe("ativo");
    expect(statusDoPix(pix, PIX_VALIDADE_MS - 1000)).toBe("ativo");
    expect(statusDoPix(pix, PIX_VALIDADE_MS)).toBe("expirado");
    expect(statusDoPix(pix, PIX_VALIDADE_MS + 60_000)).toBe("expirado");
  });
});
