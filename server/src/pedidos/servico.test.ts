import { describe, expect, it } from "vitest";
import type { DadosCheckout } from "@sofia/shared";
import { PIX_VALIDADE_MS } from "../domain/pix.js";
import { aplicarCupom, adicionarAoCarrinho, calcularFrete } from "../tools/carrinho-frete.js";
import { chamar, contextoDeTeste } from "../tools/teste-util.js";
import { emitirPix, fecharPedido, localizarPedido, pagarPedido } from "./servico.js";

const T0 = 1_700_000_000_000;
const MIN = 60_000;

// Relógio da loja nos testes: o catálogo e as chamadas usam o mesmo horário.
let agora = T0;

const DADOS: DadosCheckout = {
  nome: "Ana Souza",
  email: "ana@teste.com",
  cep: "01310-100",
  endereco: "Av. Teste",
  numero: "100",
  modalidade_frete: "economica",
};

/** Conversa com 3× PH-001 (R$ 300,00), cupom PROHALL10 e CEP de São Paulo já informado. */
function conversaComCarrinho() {
  agora = T0;
  const ctx = contextoDeTeste(undefined, () => agora);
  chamar(adicionarAoCarrinho, { id: "PH-001", quantidade: 3 }, ctx);
  chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
  chamar(calcularFrete, { cep: "01310-100" }, ctx);
  return ctx;
}

describe("fecharPedido", () => {
  it("cria o pedido com o mesmo total que o carrinho mostrou, baixa o estoque e esvazia o carrinho", () => {
    const ctx = conversaComCarrinho();
    const mostrado = chamar(calcularFrete, { cep: "01310-100" }, ctx).opcoes.find(
      (o: { modalidade: string }) => o.modalidade === "economica",
    );

    const r = fecharPedido(ctx, DADOS, T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.pedido.id).toBe("PH-TESTE-000001");
    expect(r.pedido.status).toBe("aguardando_pagamento");
    expect(r.pedido.cupom).toBe("PROHALL10");
    expect(r.pedido.itens).toEqual([
      { produtoId: "PH-001", nome: "Shampoo Antifrizz", quantidade: 3, precoUnitarioCentavos: 10000, totalCentavos: 30000 },
    ]);
    expect(r.pedido.totais.baseCentavos).toBe(27000);
    expect(r.pedido.totais.descontoPixCentavos).toBe(1350);
    expect(r.pedido.totais.totalPixCentavos).toBe(mostrado.total_no_pix.centavos);

    expect(ctx.catalogo.obter("PH-001")?.estoque_teste).toBe(9);
    expect(ctx.sessao.carrinho.itens).toEqual([]);
    expect(ctx.sessao.cupom).toBeNull();
    expect(ctx.sessao.pedidos).toHaveLength(1);
  });

  it("deixa a conversa fechar mais de um pedido, com números em sequência", () => {
    const ctx = conversaComCarrinho();
    const primeiro = fecharPedido(ctx, DADOS, T0);
    chamar(adicionarAoCarrinho, { id: "PH-004", quantidade: 1 }, ctx);
    const segundo = fecharPedido(ctx, { ...DADOS, modalidade_frete: "expressa" }, T0);

    expect(primeiro.ok && segundo.ok).toBe(true);
    expect(ctx.sessao.pedidos.map((p) => p.id)).toEqual(["PH-TESTE-000001", "PH-TESTE-000002"]);
    expect(ctx.sessao.pedidos[1]?.entrega.modalidade).toBe("expressa");
    expect(ctx.catalogo.obter("PH-004")?.estoque_teste).toBe(9);
  });

  it("trata complemento vazio como ausente", () => {
    const r = fecharPedido(conversaComCarrinho(), { ...DADOS, complemento: "" }, T0);
    expect(r.ok && r.pedido.entrega.complemento).toBeNull();
  });

  it("recusa carrinho vazio", () => {
    const r = fecharPedido(contextoDeTeste(), DADOS, T0);
    expect(r).toMatchObject({ ok: false, motivo: "carrinho_vazio" });
  });

  it("recusa CEP inválido sem mexer no carrinho nem no estoque", () => {
    const ctx = conversaComCarrinho();
    const r = fecharPedido(ctx, { ...DADOS, cep: "123" }, T0);
    expect(r).toMatchObject({ ok: false, motivo: "cep_invalido" });
    expect(ctx.sessao.carrinho.itens).toHaveLength(1);
    expect(ctx.catalogo.obter("PH-001")?.estoque_teste).toBe(12);
  });

  it("recusa se o estoque acabou depois de o item entrar no carrinho, sem baixar nada", () => {
    const ctx = conversaComCarrinho();
    chamar(adicionarAoCarrinho, { id: "PH-004", quantidade: 1 }, ctx);
    ctx.catalogo.baixarEstoque("PH-001", 10); // outra cliente comprou: restam 2, e o carrinho tem 3

    const r = fecharPedido(ctx, DADOS, T0);
    expect(r).toMatchObject({ ok: false, motivo: "estoque_insuficiente", produto_id: "PH-001", disponivel: 2 });
    expect(ctx.catalogo.obter("PH-004")?.estoque_teste).toBe(10);
    expect(ctx.sessao.carrinho.itens).toHaveLength(2);
    expect(ctx.sessao.pedidos).toHaveLength(0);
  });
});

describe("localizarPedido", () => {
  it("acha pelo número (sem diferenciar caixa) ou devolve o mais recente", () => {
    const ctx = conversaComCarrinho();
    fecharPedido(ctx, DADOS, T0);
    chamar(adicionarAoCarrinho, { id: "PH-004", quantidade: 1 }, ctx);
    fecharPedido(ctx, DADOS, T0);

    expect(localizarPedido(ctx, "ph-teste-000001")).toMatchObject({ ok: true, pedido: { id: "PH-TESTE-000001" } });
    expect(localizarPedido(ctx)).toMatchObject({ ok: true, pedido: { id: "PH-TESTE-000002" } });
  });

  it("explica quando não há pedido ou o número não existe", () => {
    const ctx = conversaComCarrinho();
    expect(localizarPedido(ctx)).toMatchObject({ ok: false, motivo: "sem_pedido" });
    fecharPedido(ctx, DADOS, T0);
    expect(localizarPedido(ctx, "PH-TESTE-000999")).toMatchObject({ ok: false, motivo: "pedido_nao_encontrado" });
  });
});

describe("emitirPix", () => {
  function comPedido() {
    const ctx = conversaComCarrinho();
    const r = fecharPedido(ctx, DADOS, T0);
    return { ctx, pedido: r.ok ? r.pedido : (undefined as never) };
  }

  it("gera o PIX falso com o total do pedido e validade de 15 minutos", () => {
    const { ctx, pedido } = comPedido();
    const r = emitirPix(ctx, pedido.id, T0);
    expect(r).toMatchObject({ ok: true, reaproveitado: false, substituiuExpirado: false });
    expect(pedido.pix?.texto).toBe(`PIX-TESTE|PROHALL|PH-TESTE-000001|${(pedido.totais.totalPixCentavos / 100).toFixed(2)}|NAO-PAGAVEL`);
    expect(pedido.pix?.expiraEm).toBe(T0 + PIX_VALIDADE_MS);
  });

  it("devolve o mesmo PIX enquanto ele vale", () => {
    const { ctx, pedido } = comPedido();
    emitirPix(ctx, pedido.id, T0);
    const primeiro = pedido.pix;
    agora = T0 + PIX_VALIDADE_MS - 1000;
    const r = emitirPix(ctx, pedido.id, agora);
    expect(r).toMatchObject({ ok: true, reaproveitado: true });
    expect(pedido.pix).toBe(primeiro);
  });

  it("só gera outro depois de expirar", () => {
    const { ctx, pedido } = comPedido();
    emitirPix(ctx, pedido.id, T0);
    agora = T0 + PIX_VALIDADE_MS;
    const r = emitirPix(ctx, pedido.id, agora);
    expect(r).toMatchObject({ ok: true, reaproveitado: false, substituiuExpirado: true });
    expect(pedido.pix?.geradoEm).toBe(T0 + PIX_VALIDADE_MS);
    expect(pedido.pix?.expiraEm).toBe(T0 + 2 * PIX_VALIDADE_MS);
  });

  it("não gera PIX para pedido já pago nem sem pedido", () => {
    const { ctx, pedido } = comPedido();
    emitirPix(ctx, pedido.id, T0);
    agora = T0 + 1000;
    pagarPedido(ctx, pedido.id, agora);
    expect(emitirPix(ctx, pedido.id, agora)).toMatchObject({ ok: false, motivo: "pedido_ja_pago" });
    expect(emitirPix(contextoDeTeste(), undefined, T0)).toMatchObject({ ok: false, motivo: "sem_pedido" });
  });
});

describe("pagarPedido", () => {
  function comPix() {
    const ctx = conversaComCarrinho();
    const r = fecharPedido(ctx, DADOS, T0);
    if (!r.ok) throw new Error("pedido não foi criado");
    emitirPix(ctx, r.pedido.id, T0);
    return { ctx, pedido: r.pedido };
  }

  it("marca o pedido como pago e deixa a confirmação da Sofia na conversa", () => {
    const { ctx, pedido } = comPix();
    agora = T0 + MIN;
    const r = pagarPedido(ctx, pedido.id, agora);

    expect(r).toMatchObject({ ok: true, jaEstavaPago: false });
    expect(pedido.status).toBe("pago");
    expect(pedido.pagoEm).toBe(T0 + 60_000);
    const [aviso, resposta] = ctx.sessao.historico;
    expect(aviso?.role).toBe("user");
    expect(resposta?.role).toBe("model");
    const texto = resposta?.parts?.[0]?.text ?? "";
    expect(texto).toContain("Ana");
    expect(texto).toContain(pedido.id);
    expect(texto).toContain("R$");
    expect(texto).toMatch(/teste/i);
  });

  it("pagar de novo não duplica a confirmação", () => {
    const { ctx, pedido } = comPix();
    agora = T0 + MIN;
    pagarPedido(ctx, pedido.id, agora);
    agora = T0 + 2 * MIN;
    const r = pagarPedido(ctx, pedido.id, agora);
    expect(r).toMatchObject({ ok: true, jaEstavaPago: true });
    expect(ctx.sessao.historico).toHaveLength(2);
    expect(pedido.pagoEm).toBe(T0 + 60_000);
  });

  it("exige um PIX gerado", () => {
    const ctx = conversaComCarrinho();
    const r = fecharPedido(ctx, DADOS, T0);
    expect(pagarPedido(ctx, r.ok ? r.pedido.id : "", T0)).toMatchObject({ ok: false, motivo: "sem_pix" });
  });

  it("recusa PIX expirado e o pedido continua aguardando pagamento", () => {
    const { ctx, pedido } = comPix();
    agora = T0 + PIX_VALIDADE_MS;
    const r = pagarPedido(ctx, pedido.id, agora);
    expect(r).toMatchObject({ ok: false, motivo: "pix_expirado" });
    expect(pedido.status).toBe("aguardando_pagamento");
    expect(ctx.sessao.historico).toHaveLength(0);
  });
});

describe("reserva de estoque até o pagamento", () => {
  function comPix() {
    const ctx = conversaComCarrinho(); // PH-001 tem 12 em estoque
    const r = fecharPedido(ctx, DADOS, agora);
    if (!r.ok) throw new Error("pedido não foi criado");
    emitirPix(ctx, r.pedido.id, agora);
    return { ctx, pedido: r.pedido };
  }

  it("segura as unidades enquanto o PIX vale", () => {
    const { ctx } = comPix();
    agora = T0 + PIX_VALIDADE_MS - 1000;
    expect(ctx.catalogo.obter("PH-001")?.estoque_teste).toBe(9);
  });

  it("devolve o estoque quando o PIX expira sem pagamento, e o pedido continua aguardando", () => {
    const { ctx, pedido } = comPix();
    agora = T0 + PIX_VALIDADE_MS;
    expect(ctx.catalogo.obter("PH-001")?.estoque_teste).toBe(12);
    expect(pedido.status).toBe("aguardando_pagamento");
  });

  it("não devolve o estoque de um pedido pago", () => {
    const { ctx, pedido } = comPix();
    agora = T0 + MIN;
    pagarPedido(ctx, pedido.id, agora);
    agora = T0 + 3 * PIX_VALIDADE_MS;
    expect(ctx.catalogo.obter("PH-001")?.estoque_teste).toBe(9);
  });

  it("um novo PIX depois de expirar reserva as unidades de novo", () => {
    const { ctx, pedido } = comPix();
    agora = T0 + PIX_VALIDADE_MS;
    const r = emitirPix(ctx, pedido.id, agora);
    expect(r).toMatchObject({ ok: true, substituiuExpirado: true });
    expect(ctx.catalogo.obter("PH-001")?.estoque_teste).toBe(9);

    agora = T0 + 2 * PIX_VALIDADE_MS; // o segundo PIX também venceu
    expect(ctx.catalogo.obter("PH-001")?.estoque_teste).toBe(12);
  });

  it("não gera outro PIX se, enquanto isso, outra cliente levou as unidades", () => {
    const { ctx, pedido } = comPix();
    agora = T0 + PIX_VALIDADE_MS; // estoque volta a 12
    ctx.catalogo.liberarVencidas(agora);
    ctx.catalogo.baixarEstoque("PH-001", 11); // sobra 1, e o pedido tem 3
    const r = emitirPix(ctx, pedido.id, agora);
    expect(r).toMatchObject({ ok: false, motivo: "estoque_insuficiente", produto_id: "PH-001", disponivel: 1 });
    expect(ctx.catalogo.obter("PH-001")?.estoque_teste).toBe(1);
  });

  it("repor o estoque no meio do caminho não confunde a devolução", () => {
    const { ctx } = comPix();
    ctx.catalogo.reporEstoque(10); // 9 + 10
    agora = T0 + PIX_VALIDADE_MS;
    expect(ctx.catalogo.obter("PH-001")?.estoque_teste).toBe(22);
  });
});
