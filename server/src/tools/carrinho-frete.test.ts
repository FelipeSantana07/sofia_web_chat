import { describe, expect, it } from "vitest";
import {
  adicionarAoCarrinho,
  aplicarCupom,
  calcularFrete,
  removerDoCarrinho,
  verCarrinho,
} from "./carrinho-frete.js";
import { chamar, contextoDeTeste } from "./teste-util.js";

// Catálogo de teste: PH-001 R$ 100 (400 g, estoque 12), PH-002 R$ 200 → R$ 150 promo (1.200 g, estoque 2),
// PH-003 R$ 80 (400 g, estoque 5), PH-004 R$ 60 (400 g, estoque 10).

function comItens(...itens: [string, number][]) {
  const ctx = contextoDeTeste();
  for (const [id, quantidade] of itens) {
    const r = chamar(adicionarAoCarrinho, { id, quantidade }, ctx);
    if (!r.ok) throw new Error(`setup falhou: ${r.erro}`);
  }
  return ctx;
}

describe("adicionar_ao_carrinho", () => {
  it("adiciona e devolve o carrinho atualizado", () => {
    const r = chamar(adicionarAoCarrinho, { id: "PH-001", quantidade: 2 }, contextoDeTeste());
    expect(r.ok).toBe(true);
    expect(r.mensagem).toMatch(/2x Produto PH-001|2x Shampoo Antifrizz/);
    expect(r.carrinho.itens).toEqual([
      {
        id: "PH-001",
        nome: "Shampoo Antifrizz",
        quantidade: 2,
        preco_unitario: { centavos: 10000, texto: "R$ 100,00" },
        total_do_item: { centavos: 20000, texto: "R$ 200,00" },
      },
    ]);
    expect(r.carrinho.subtotal).toEqual({ centavos: 20000, texto: "R$ 200,00" });
  });

  it("soma quando o item já está no carrinho", () => {
    const ctx = comItens(["PH-001", 2]);
    const r = chamar(adicionarAoCarrinho, { id: "PH-001", quantidade: 3 }, ctx);
    expect(r.carrinho.itens[0].quantidade).toBe(5);
  });

  it("usa o preço promocional como preço vigente", () => {
    const r = chamar(adicionarAoCarrinho, { id: "PH-002", quantidade: 1 }, contextoDeTeste());
    expect(r.carrinho.itens[0].preco_unitario.centavos).toBe(15000);
    expect(r.carrinho.subtotal.centavos).toBe(15000);
  });

  it("aceita id em minúsculas", () => {
    expect(chamar(adicionarAoCarrinho, { id: "ph-003", quantidade: 1 }, contextoDeTeste()).ok).toBe(true);
  });

  it("bloqueia acima do estoque com erro amigável e sem alterar o carrinho", () => {
    const ctx = contextoDeTeste();
    const r = chamar(adicionarAoCarrinho, { id: "PH-002", quantidade: 3 }, ctx);
    expect(r).toMatchObject({ ok: false, motivo: "estoque_insuficiente", pode_adicionar_ate: 2 });
    expect(r.erro).toMatch(/Só temos 2 unidade/);
    expect(ctx.sessao.carrinho.itens).toEqual([]);
  });

  it("bloqueia acima de 10 unidades por item", () => {
    const r = chamar(adicionarAoCarrinho, { id: "PH-001", quantidade: 11 }, contextoDeTeste());
    expect(r).toMatchObject({ ok: false, motivo: "limite_por_item", pode_adicionar_ate: 10 });
    expect(r.erro).toMatch(/máximo é 10/);
  });

  it("produto inexistente devolve erro amigável", () => {
    const r = chamar(adicionarAoCarrinho, { id: "PH-999", quantidade: 1 }, contextoDeTeste());
    expect(r).toMatchObject({ ok: false, motivo: "produto_nao_encontrado" });
  });

  it("valida os argumentos (quantidade negativa, zero, fracionária ou texto)", () => {
    const ctx = contextoDeTeste();
    for (const quantidade of [-1, 0, 1.5, "2"]) {
      const r = chamar(adicionarAoCarrinho, { id: "PH-001", quantidade }, ctx);
      expect(r.ok).toBe(false);
      expect(r.erro).toMatch(/quantidade:/);
    }
    expect(chamar(adicionarAoCarrinho, { quantidade: 1 }, ctx).erro).toMatch(/id: campo obrigatório/);
    expect(ctx.sessao.carrinho.itens).toEqual([]);
  });
});

describe("remover_do_carrinho", () => {
  it("sem quantidade remove o item inteiro", () => {
    const ctx = comItens(["PH-001", 3], ["PH-003", 1]);
    const r = chamar(removerDoCarrinho, { id: "PH-001" }, ctx);
    expect(r.ok).toBe(true);
    expect(r.carrinho.itens.map((i: { id: string }) => i.id)).toEqual(["PH-003"]);
  });

  it("com quantidade remove só uma parte", () => {
    const ctx = comItens(["PH-001", 5]);
    const r = chamar(removerDoCarrinho, { id: "PH-001", quantidade: 2 }, ctx);
    expect(r.carrinho.itens[0].quantidade).toBe(3);
    expect(r.carrinho.subtotal.centavos).toBe(30000);
  });

  it("quantidade igual à do carrinho remove o item", () => {
    const ctx = comItens(["PH-001", 2]);
    const r = chamar(removerDoCarrinho, { id: "PH-001", quantidade: 2 }, ctx);
    expect(r.carrinho.itens).toEqual([]);
    expect(r.carrinho.vazio).toBe(true);
  });

  it("não deixa remover mais do que há no carrinho", () => {
    const ctx = comItens(["PH-001", 2]);
    const r = chamar(removerDoCarrinho, { id: "PH-001", quantidade: 3 }, ctx);
    expect(r).toMatchObject({ ok: false, no_carrinho: 2 });
    expect(ctx.sessao.carrinho.itens[0]?.quantidade).toBe(2);
  });

  it("avisa quando o produto não está no carrinho ou não existe", () => {
    const ctx = comItens(["PH-001", 1]);
    expect(chamar(removerDoCarrinho, { id: "PH-003" }, ctx)).toMatchObject({ ok: false, motivo: "item_ausente" });
    expect(chamar(removerDoCarrinho, { id: "PH-999" }, ctx)).toMatchObject({ ok: false, motivo: "produto_nao_encontrado" });
  });

  it("valida a quantidade", () => {
    const ctx = comItens(["PH-001", 2]);
    expect(chamar(removerDoCarrinho, { id: "PH-001", quantidade: -1 }, ctx).ok).toBe(false);
    expect(chamar(removerDoCarrinho, { id: "PH-001", quantidade: 0 }, ctx).ok).toBe(false);
  });

  it("o cupom perde a validade se o subtotal cair abaixo de R$ 150,00 e a Sofia é avisada", () => {
    const ctx = comItens(["PH-001", 2]); // R$ 200
    chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    expect(ctx.sessao.cupom).toBe("PROHALL10");

    const r = chamar(removerDoCarrinho, { id: "PH-001", quantidade: 1 }, ctx); // R$ 100
    expect(r.aviso_cupom).toMatch(/deixou de valer/);
    expect(r.carrinho.cupom).toBeNull();
    expect(ctx.sessao.cupom).toBeNull();
  });

  it("o cupom continua enquanto o subtotal atinge o mínimo", () => {
    const ctx = comItens(["PH-001", 3]); // R$ 300
    chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    const r = chamar(removerDoCarrinho, { id: "PH-001", quantidade: 1 }, ctx); // R$ 200
    expect(r).not.toHaveProperty("aviso_cupom");
    expect(r.carrinho.cupom.desconto.centavos).toBe(2000);
  });
});

describe("aplicar_cupom", () => {
  it("aplica o PROHALL10: 10% sobre o subtotal", () => {
    const ctx = comItens(["PH-001", 3]);
    const r = chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    expect(r).toMatchObject({ ok: true, cupom: { codigo: "PROHALL10", percentual: 10 } });
    expect(r.cupom.desconto).toEqual({ centavos: 3000, texto: "R$ 30,00" });
    expect(r.carrinho.base_produtos.centavos).toBe(27000);
  });

  it("aceita caixa e espaços", () => {
    expect(chamar(aplicarCupom, { codigo: " prohall10 " }, comItens(["PH-001", 2])).ok).toBe(true);
  });

  it("qualquer outro código é inválido e não altera o carrinho", () => {
    const ctx = comItens(["PH-001", 3]);
    const r = chamar(aplicarCupom, { codigo: "DESCONTO50" }, ctx);
    expect(r).toMatchObject({ ok: false, motivo: "invalido" });
    expect(ctx.sessao.cupom).toBeNull();
  });

  it("recusa abaixo do mínimo e diz quanto falta", () => {
    const ctx = comItens(["PH-004", 2]); // R$ 120
    const r = chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    expect(r).toMatchObject({ ok: false, motivo: "abaixo_do_minimo" });
    expect(r.falta_para_o_minimo).toEqual({ centavos: 3000, texto: "R$ 30,00" });
    expect(r.erro).toMatch(/150,00/);
  });

  it("carrinho vazio não aceita o cupom", () => {
    expect(chamar(aplicarCupom, { codigo: "PROHALL10" }, contextoDeTeste()).ok).toBe(false);
  });

  it("aplicar duas vezes não duplica o desconto (um cupom por pedido)", () => {
    const ctx = comItens(["PH-001", 3]);
    chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    const r = chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    expect(r.ok).toBe(true);
    expect(r.mensagem).toMatch(/já estava aplicado/);
    expect(r.carrinho.cupom.desconto.centavos).toBe(3000);
  });

  it("um código inválido não derruba o cupom já aplicado", () => {
    const ctx = comItens(["PH-001", 3]);
    chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    chamar(aplicarCupom, { codigo: "OUTRO" }, ctx);
    expect(ctx.sessao.cupom).toBe("PROHALL10");
  });

  it("valida o argumento", () => {
    expect(chamar(aplicarCupom, {}, contextoDeTeste()).erro).toMatch(/codigo: campo obrigatório/);
  });
});

describe("ver_carrinho", () => {
  it("carrinho vazio", () => {
    const r = chamar(verCarrinho, {}, contextoDeTeste());
    expect(r.ok).toBe(true);
    expect(r.carrinho).toMatchObject({ itens: [], vazio: true, subtotal: { centavos: 0 }, peso_cobrado_g: null });
  });

  it("mostra itens, subtotal, cupom, base e peso cobrado", () => {
    const ctx = comItens(["PH-001", 3]); // 3 × 400 g + 200 g
    chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    const c = chamar(verCarrinho, {}, ctx).carrinho;
    expect(c.subtotal.centavos).toBe(30000);
    expect(c.cupom).toEqual({ codigo: "PROHALL10", desconto: { centavos: 3000, texto: "R$ 30,00" } });
    expect(c.base_produtos.centavos).toBe(27000);
    expect(c.economia_no_pix.centavos).toBe(1350);
    expect(c.peso_cobrado_g).toBe(1400);
  });

  it("sem CEP informa que o frete ainda não foi calculado", () => {
    const c = chamar(verCarrinho, {}, comItens(["PH-001", 1])).carrinho;
    expect(c.entrega).toBeNull();
    expect(c.frete).toMatch(/calcular_frete/);
  });

  it("com CEP mostra frete e total no PIX das duas modalidades", () => {
    const ctx = comItens(["PH-001", 3]);
    chamar(calcularFrete, { cep: "01310-100" }, ctx);
    const c = chamar(verCarrinho, {}, ctx).carrinho;
    expect(c.entrega).toMatchObject({ cep: "01310100", zona: "Z1" });
    expect(c.entrega.opcoes.map((o: { modalidade: string }) => o.modalidade)).toEqual(["economica", "expressa"]);
  });

  it("recalcula o frete quando o carrinho muda depois do CEP", () => {
    const ctx = comItens(["PH-001", 1]);
    chamar(calcularFrete, { cep: "01310-100" }, ctx);
    const antes = chamar(verCarrinho, {}, ctx).carrinho.entrega.opcoes[0].total_no_pix.centavos;
    chamar(adicionarAoCarrinho, { id: "PH-003", quantidade: 1 }, ctx);
    const depois = chamar(verCarrinho, {}, ctx).carrinho.entrega.opcoes[0].total_no_pix.centavos;
    expect(depois).toBeGreaterThan(antes);
  });

  it("sessões diferentes têm carrinhos diferentes", () => {
    const a = comItens(["PH-001", 1]);
    const b = contextoDeTeste();
    expect(chamar(verCarrinho, {}, b).carrinho.vazio).toBe(true);
    expect(chamar(verCarrinho, {}, a).carrinho.vazio).toBe(false);
  });
});

describe("calcular_frete", () => {
  it("exemplo 6.2: R$ 300,00 + PROHALL10 em Z1 dá R$ 279,40 no PIX e faltam R$ 29,00 para o frete grátis", () => {
    const ctx = comItens(["PH-001", 3]); // subtotal R$ 300,00; 1.400 g cobrados → até 2 kg
    chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    const r = chamar(calcularFrete, { cep: "01310-100" }, ctx);

    expect(r).toMatchObject({ ok: true, cep: "01310-100", zona: "Z1", peso_cobrado_g: 1400 });
    expect(r.base_produtos).toEqual({ centavos: 27000, texto: "R$ 270,00" });
    const eco = r.opcoes[0];
    expect(eco).toMatchObject({ modalidade: "economica", nome: "Econômica", frete_gratis: false, prazo: "3 a 5 dias úteis" });
    expect(eco.frete).toEqual({ centavos: 2290, texto: "R$ 22,90" });
    expect(eco.falta_para_frete_gratis).toEqual({ centavos: 2900, texto: "R$ 29,00" });
    expect(eco.desconto_pix).toEqual({ centavos: 1350, texto: "R$ 13,50" });
    expect(eco.total_no_pix).toEqual({ centavos: 27940, texto: "R$ 279,40" });
  });

  it("devolve as duas modalidades com valor e prazo", () => {
    const r = chamar(calcularFrete, { cep: "01310100" }, comItens(["PH-001", 1])); // 600 g → até 1 kg
    expect(r.opcoes).toHaveLength(2);
    expect(r.opcoes[0].frete.centavos).toBe(1890);
    expect(r.opcoes[1]).toMatchObject({ modalidade: "expressa", nome: "Expressa", prazo: "1 a 2 dias úteis" });
    expect(r.opcoes[1].frete.centavos).toBe(2990);
  });

  it("a Expressa nunca tem 'quanto falta' para o frete grátis", () => {
    const r = chamar(calcularFrete, { cep: "01310-100" }, comItens(["PH-001", 1]));
    expect(r.opcoes[1].falta_para_frete_gratis).toBeNull();
    expect(r.opcoes[1].frete_gratis).toBe(false);
  });

  it("frete grátis na Econômica quando a base atinge R$ 299,00 (Z1/Z2)", () => {
    const r = chamar(calcularFrete, { cep: "01310-100" }, comItens(["PH-001", 4])); // R$ 400
    expect(r.opcoes[0]).toMatchObject({ frete_gratis: true, frete: { centavos: 0 }, falta_para_frete_gratis: { centavos: 0 } });
    expect(r.opcoes[1].frete_gratis).toBe(false); // Expressa continua cobrando
  });

  it("zonas 3 a 5 usam o limite de R$ 399,00", () => {
    const r = chamar(calcularFrete, { cep: "70000-000" }, comItens(["PH-001", 3])); // Z3, R$ 300
    expect(r.zona).toBe("Z3");
    expect(r.limite_frete_gratis.centavos).toBe(39900);
    expect(r.opcoes[0].falta_para_frete_gratis.centavos).toBe(9900);
  });

  it("o frete grátis considera a base depois do cupom, não o subtotal", () => {
    // subtotal R$ 330,00 (≥ 299), mas com PROHALL10 a base é R$ 297,00 (< 299): ainda cobra, faltam R$ 2,00
    const ctx = comItens(["PH-001", 1], ["PH-002", 1], ["PH-003", 1]); // 100 + 150 (promo) + 80
    chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    const r = chamar(calcularFrete, { cep: "01310-100" }, ctx);
    expect(r.base_produtos.centavos).toBe(29700);
    expect(r.opcoes[0].frete_gratis).toBe(false);
    expect(r.opcoes[0].falta_para_frete_gratis).toEqual({ centavos: 200, texto: "R$ 2,00" });
  });

  it("com o cupom aplicado e a base ainda ≥ R$ 299,00 o frete é grátis", () => {
    const ctx = comItens(["PH-001", 2], ["PH-003", 1], ["PH-004", 1]); // 200 + 80 + 60 = 340 → base 306
    chamar(aplicarCupom, { codigo: "PROHALL10" }, ctx);
    const r = chamar(calcularFrete, { cep: "01310-100" }, ctx);
    expect(r.base_produtos.centavos).toBe(30600);
    expect(r.opcoes[0]).toMatchObject({ frete_gratis: true, frete: { centavos: 0 } });
  });

  it("guarda o CEP e a zona na sessão", () => {
    const ctx = comItens(["PH-001", 1]);
    chamar(calcularFrete, { cep: "20000-000" }, ctx);
    expect(ctx.sessao.entrega).toEqual({ cep: "20000000", zona: "Z2" });
  });

  it("CEP inválido devolve erro amigável e não guarda nada", () => {
    for (const cep of ["1234567", "abcdefgh", "00000-000", "123456789", "0131-0100"]) {
      const ctx = comItens(["PH-001", 1]);
      const r = chamar(calcularFrete, { cep }, ctx);
      expect(r).toMatchObject({ ok: false, motivo: "cep_invalido" });
      expect(r.erro).toMatch(/CEP/);
      expect(ctx.sessao.entrega).toBeNull();
    }
  });

  it("carrinho vazio não calcula frete", () => {
    const r = chamar(calcularFrete, { cep: "01310-100" }, contextoDeTeste());
    expect(r).toMatchObject({ ok: false, motivo: "carrinho_vazio" });
  });

  it("peso acima de 5 kg soma o adicional por kg", () => {
    // 10 × 400 g + 200 g = 4.200 g (F4); 2 × PH-002 (1.200 g) + 10 × PH-001 → 6.600 g: +2 kg
    const ctx = comItens(["PH-001", 10], ["PH-002", 2]);
    const r = chamar(calcularFrete, { cep: "01310-100" }, ctx);
    expect(r.peso_cobrado_g).toBe(6600);
    expect(r.opcoes[1].frete.centavos).toBe(4790 + 2 * 550); // Expressa Z1: F4 + 2 kg excedentes
  });

  it("valida o argumento cep", () => {
    const ctx = comItens(["PH-001", 1]);
    expect(chamar(calcularFrete, {}, ctx).erro).toMatch(/cep: campo obrigatório/);
    expect(chamar(calcularFrete, { cep: 1310100 }, ctx).erro).toMatch(/cep: deve ser um texto/);
  });
});
