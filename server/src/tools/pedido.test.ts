import { describe, expect, it } from "vitest";
import { adicionarAoCarrinho, aplicarCupom, calcularFrete } from "./carrinho-frete.js";
import { consultarPedido, finalizarPedido, gerarPix } from "./pedido.js";
import { criarDespachante } from "./registro.js";
import { chamar, contextoDeTeste } from "./teste-util.js";

const ARGS = {
  nome: "Ana Souza",
  email: "ana@teste.com",
  cep: "01310-100",
  endereco: "Av. Teste",
  numero: "100",
  modalidade_frete: "economica",
};

function conversa() {
  const ctx = contextoDeTeste();
  chamar(adicionarAoCarrinho, { id: "PH-001", quantidade: 3 }, ctx);
  chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
  chamar(calcularFrete, { cep: "01310-100" }, ctx);
  return ctx;
}

describe("finalizar_pedido", () => {
  it("cria o pedido aguardando pagamento com itens, cupom, frete, desconto PIX e total", () => {
    const r = chamar(finalizarPedido, ARGS, conversa());
    expect(r.ok).toBe(true);
    expect(r.pedido).toMatchObject({
      id: "PH-TESTE-000001",
      status: "aguardando_pagamento",
      cupom: "PROHALL10",
      itens: [{ id: "PH-001", quantidade: 3 }],
      pix: null,
    });
    expect(r.pedido.totais.desconto_cupom.texto).toBe("R$ 30,00");
    expect(r.pedido.totais.desconto_pix.texto).toBe("R$ 13,50");
    expect(r.pedido.totais.total_no_pix.texto).toMatch(/^R\$ /);
    expect(r.mensagem).toContain("gerar_pix");
  });

  it("devolve erro amigável com os campos que faltam ou estão errados", () => {
    const r = chamar(finalizarPedido, { ...ARGS, email: "ana", nome: undefined, modalidade_frete: "sedex" }, conversa());
    expect(r.ok).toBe(false);
    const campos = (r.campos as { campo: string; problema: string }[]).map((c) => c.campo).sort();
    expect(campos).toEqual(["email", "modalidade_frete", "nome"]);
    expect(r.erro).toMatch(/e-mail inválido/);
  });

  it("recusa carrinho vazio, CEP inválido e estoque insuficiente com o motivo", () => {
    expect(chamar(finalizarPedido, ARGS, contextoDeTeste())).toMatchObject({ ok: false, motivo: "carrinho_vazio" });
    expect(chamar(finalizarPedido, { ...ARGS, cep: "12" }, conversa())).toMatchObject({ ok: false, motivo: "cep_invalido" });

    const ctx = conversa();
    ctx.catalogo.baixarEstoque("PH-001", 11);
    expect(chamar(finalizarPedido, ARGS, ctx)).toMatchObject({ ok: false, motivo: "estoque_insuficiente" });
  });

  it("nunca pede CPF nem dado de cartão", () => {
    const decl = criarDespachante().declaracoes.find((d) => d.name === "finalizar_pedido");
    const campos = Object.keys((decl?.parametersJsonSchema as { properties: object }).properties);
    expect(campos.join(" ")).not.toMatch(/cpf|cartao|senha/i);
  });
});

describe("gerar_pix", () => {
  it("gera o PIX falso do pedido mais recente quando não recebe o número", () => {
    const ctx = conversa();
    chamar(finalizarPedido, ARGS, ctx);
    const r = chamar(gerarPix, {}, ctx);
    expect(r.ok).toBe(true);
    expect(r.pedido.pix.copia_e_cola).toMatch(/^PIX-TESTE\|PROHALL\|PH-TESTE-000001\|\d+\.\d{2}\|NAO-PAGAVEL$/);
    expect(r.pedido.pix).toMatchObject({ status: "ativo", segundos_restantes: expect.any(Number) });
    expect(r.pedido.pix.segundos_restantes).toBeLessThanOrEqual(900);
    expect(JSON.stringify(r)).not.toContain("<svg");
  });

  it("reaproveita o PIX que ainda vale e gera outro quando ele expirou", () => {
    const ctx = conversa();
    chamar(finalizarPedido, ARGS, ctx);
    const primeiro = chamar(gerarPix, { pedido_id: "PH-TESTE-000001" }, ctx);
    const segundo = chamar(gerarPix, { pedido_id: "PH-TESTE-000001" }, ctx);
    expect(segundo.mensagem).toMatch(/ainda está valendo/);
    expect(segundo.pedido.pix.gerado_em).toBe(primeiro.pedido.pix.gerado_em);

    ctx.sessao.pedidos[0]!.pix!.expiraEm = Date.now() - 1; // venceu
    const terceiro = chamar(gerarPix, {}, ctx);
    expect(terceiro.mensagem).toMatch(/novo/);
    expect(terceiro.pedido.pix.status).toBe("ativo");
  });

  it("explica quando ainda não há pedido", () => {
    expect(chamar(gerarPix, {}, contextoDeTeste())).toMatchObject({ ok: false, motivo: "sem_pedido" });
  });
});

describe("consultar_pedido", () => {
  it("mostra o status do pedido e do PIX, inclusive PIX expirado", () => {
    const ctx = conversa();
    chamar(finalizarPedido, ARGS, ctx);
    expect(chamar(consultarPedido, {}, ctx).pedido).toMatchObject({ status: "aguardando_pagamento", pix: null });

    chamar(gerarPix, {}, ctx);
    expect(chamar(consultarPedido, { pedido_id: "PH-TESTE-000001" }, ctx).pedido.pix.status).toBe("ativo");

    ctx.sessao.pedidos[0]!.pix!.expiraEm = Date.now() - 1;
    const r = chamar(consultarPedido, {}, ctx);
    expect(r.pedido.status).toBe("aguardando_pagamento");
    expect(r.pedido.pix).toMatchObject({ status: "expirado", segundos_restantes: 0 });
  });

  it("não mostra pedido de outra conversa", () => {
    const dona = conversa();
    chamar(finalizarPedido, ARGS, dona);
    const outra = contextoDeTeste();
    const r = chamar(consultarPedido, { pedido_id: "PH-TESTE-000001" }, outra);
    expect(r.ok).toBe(false);
  });
});

describe("registro das ferramentas de pedido", () => {
  it("as três entram no despachante com declaração para o Gemini", () => {
    const nomes = criarDespachante().declaracoes.map((d) => d.name);
    expect(nomes).toEqual(expect.arrayContaining(["finalizar_pedido", "gerar_pix", "consultar_pedido", "mostrar_produtos"]));
    expect(nomes).toHaveLength(13);
  });

  it("a declaração de finalizar_pedido exige os campos do enunciado e limita a modalidade", () => {
    const decl = criarDespachante().declaracoes.find((d) => d.name === "finalizar_pedido");
    const schema = decl?.parametersJsonSchema as { required: string[]; properties: Record<string, { enum?: string[] }> };
    expect(schema.required.sort()).toEqual(["cep", "email", "endereco", "modalidade_frete", "nome", "numero"]);
    expect(schema.properties.complemento).toBeDefined();
    expect(schema.properties.modalidade_frete?.enum).toEqual(["economica", "expressa"]);
  });
});
