import { describe, expect, it } from "vitest";
import type { ItemPedido } from "@sofia/shared";
import { montarPedido, type EntradaPedido } from "./pedido.js";

const item = (produtoId: string, quantidade: number, unitario: number): ItemPedido => ({
  produtoId,
  nome: `Produto ${produtoId}`,
  quantidade,
  precoUnitarioCentavos: unitario,
  totalCentavos: unitario * quantidade,
});

function entrada(extra: Partial<EntradaPedido> = {}): EntradaPedido {
  return {
    id: "PH-TESTE-000123",
    agora: 1_000,
    itens: [item("PH-001", 3, 10000)], // R$ 300,00
    cupom: "PROHALL10",
    cliente: { nome: "Ana Teste", email: "ana@teste.com" },
    endereco: { cep: "01310100", endereco: "Av. Teste", numero: "100", complemento: null },
    zona: "Z1",
    pesoCobradoG: 1400,
    modalidade: "economica",
    ...extra,
  };
}

describe("montarPedido", () => {
  it("fecha o exemplo 6.2: cupom, frete R$ 22,90, desconto PIX e total R$ 279,40", () => {
    // Peso do exemplo da especificação: 2.000 g na Z1 econômica custa R$ 22,90.
    const p = montarPedido(entrada({ pesoCobradoG: 2000 }));
    expect(p.totais).toEqual({
      subtotalCentavos: 30000,
      descontoCupomCentavos: 3000,
      baseCentavos: 27000,
      freteCentavos: 2290,
      freteGratis: false,
      descontoPixCentavos: 1350,
      totalPixCentavos: 27940,
    });
    expect(p.cupom).toBe("PROHALL10");
  });

  it("nasce aguardando pagamento, sem PIX, com os dados da cliente e da entrega", () => {
    const p = montarPedido(entrada());
    expect(p.status).toBe("aguardando_pagamento");
    expect(p.pagoEm).toBeNull();
    expect(p.pix).toBeNull();
    expect(p.criadoEm).toBe(1_000);
    expect(p.cliente.email).toBe("ana@teste.com");
    expect(p.entrega).toMatchObject({ cep: "01310100", zona: "Z1", modalidade: "economica", complemento: null });
  });

  it("guarda o prazo da modalidade escolhida", () => {
    const eco = montarPedido(entrada({ modalidade: "economica" }));
    const exp = montarPedido(entrada({ modalidade: "expressa" }));
    expect([eco.entrega.prazoMinDias, eco.entrega.prazoMaxDias]).toEqual([3, 5]);
    expect([exp.entrega.prazoMinDias, exp.entrega.prazoMaxDias]).toEqual([1, 2]);
    expect(exp.totais.freteGratis).toBe(false);
  });

  it("aplica frete grátis na Econômica quando a base passa do limite", () => {
    const p = montarPedido(entrada({ itens: [item("PH-001", 4, 10000)] })); // base 360,00 ≥ 299,00
    expect(p.totais.freteGratis).toBe(true);
    expect(p.totais.freteCentavos).toBe(0);
  });

  it("descarta o cupom que não vale mais para o subtotal", () => {
    const p = montarPedido(entrada({ itens: [item("PH-001", 1, 10000)] })); // abaixo de R$ 150
    expect(p.cupom).toBeNull();
    expect(p.totais.descontoCupomCentavos).toBe(0);
  });

  it("guarda uma cópia dos itens", () => {
    const itens = [item("PH-001", 2, 5000)];
    const p = montarPedido(entrada({ itens, cupom: null }));
    expect(p.itens).toEqual(itens);
    expect(p.totais.subtotalCentavos).toBe(10000);
  });
});
