import { describe, expect, it } from "vitest";
import {
  adicionarItem,
  alterarQuantidade,
  calcularSubtotal,
  carrinhoVazio,
  LIMITE_POR_ITEM,
  precoVigenteCentavos,
  removerItem,
  type Carrinho,
  type ProdutoCarrinho,
  type ResultadoCarrinho,
} from "./carrinho.js";

const shampoo: ProdutoCarrinho = { id: "PH-001", precoCentavos: 10000, precoPromocionalCentavos: null, estoque: 12 };
const mascara: ProdutoCarrinho = { id: "PH-002", precoCentavos: 18990, precoPromocionalCentavos: 15990, estoque: 3 };
const catalogo = new Map([shampoo, mascara].map((p) => [p.id, p]));
const buscar = (id: string) => catalogo.get(id);

function ok(r: ResultadoCarrinho): Carrinho {
  if (!r.ok) throw new Error(r.erro);
  return r.carrinho;
}

describe("precoVigenteCentavos", () => {
  it("usa o promocional quando existe", () => {
    expect(precoVigenteCentavos(mascara)).toBe(15990);
  });
  it("senão usa o preço cheio", () => {
    expect(precoVigenteCentavos(shampoo)).toBe(10000);
  });
});

describe("adicionarItem", () => {
  it("adiciona um item novo", () => {
    const c = ok(adicionarItem(carrinhoVazio(), shampoo, 2));
    expect(c.itens).toEqual([{ produtoId: "PH-001", quantidade: 2 }]);
  });

  it("soma quando o item já está no carrinho", () => {
    const c = ok(adicionarItem(ok(adicionarItem(carrinhoVazio(), shampoo, 2)), shampoo, 3));
    expect(c.itens).toEqual([{ produtoId: "PH-001", quantidade: 5 }]);
  });

  it("não altera o carrinho original", () => {
    const original = carrinhoVazio();
    adicionarItem(original, shampoo, 1);
    expect(original.itens).toEqual([]);
  });

  it("bloqueia acima do estoque de teste", () => {
    expect(adicionarItem(carrinhoVazio(), mascara, 4)).toMatchObject({
      ok: false,
      motivo: "estoque_insuficiente",
      disponivel: 3,
    });
  });

  it("bloqueia somando acima do estoque", () => {
    const c = ok(adicionarItem(carrinhoVazio(), mascara, 2));
    expect(adicionarItem(c, mascara, 2)).toMatchObject({
      ok: false,
      motivo: "estoque_insuficiente",
      disponivel: 1,
    });
  });

  it("aceita exatamente o estoque", () => {
    expect(adicionarItem(carrinhoVazio(), mascara, 3).ok).toBe(true);
  });

  it("bloqueia acima de 10 unidades por item", () => {
    expect(LIMITE_POR_ITEM).toBe(10);
    expect(adicionarItem(carrinhoVazio(), shampoo, 10).ok).toBe(true);
    expect(adicionarItem(carrinhoVazio(), shampoo, 11)).toMatchObject({ ok: false, motivo: "limite_por_item" });
    const c = ok(adicionarItem(carrinhoVazio(), shampoo, 8));
    expect(adicionarItem(c, shampoo, 3)).toMatchObject({ ok: false, motivo: "limite_por_item", disponivel: 2 });
  });

  it("rejeita quantidade inválida", () => {
    expect(adicionarItem(carrinhoVazio(), shampoo, 0)).toMatchObject({ ok: false, motivo: "quantidade_invalida" });
    expect(adicionarItem(carrinhoVazio(), shampoo, -1)).toMatchObject({ ok: false, motivo: "quantidade_invalida" });
    expect(adicionarItem(carrinhoVazio(), shampoo, 1.5)).toMatchObject({ ok: false, motivo: "quantidade_invalida" });
  });

  it("estoque zero bloqueia a compra", () => {
    const esgotado = { ...shampoo, estoque: 0 };
    expect(adicionarItem(carrinhoVazio(), esgotado, 1)).toMatchObject({ ok: false, motivo: "estoque_insuficiente" });
  });
});

describe("removerItem", () => {
  it("remove o item", () => {
    const c = ok(adicionarItem(ok(adicionarItem(carrinhoVazio(), shampoo, 1)), mascara, 1));
    expect(ok(removerItem(c, "PH-001")).itens).toEqual([{ produtoId: "PH-002", quantidade: 1 }]);
  });

  it("avisa quando o item não está no carrinho", () => {
    expect(removerItem(carrinhoVazio(), "PH-001")).toMatchObject({ ok: false, motivo: "item_ausente" });
  });
});

describe("alterarQuantidade", () => {
  it("define a nova quantidade", () => {
    const c = ok(adicionarItem(carrinhoVazio(), shampoo, 2));
    expect(ok(alterarQuantidade(c, shampoo, 5)).itens).toEqual([{ produtoId: "PH-001", quantidade: 5 }]);
  });

  it("quantidade 0 remove o item", () => {
    const c = ok(adicionarItem(carrinhoVazio(), shampoo, 2));
    expect(ok(alterarQuantidade(c, shampoo, 0)).itens).toEqual([]);
  });

  it("respeita estoque e limite", () => {
    const c = ok(adicionarItem(carrinhoVazio(), mascara, 1));
    expect(alterarQuantidade(c, mascara, 4)).toMatchObject({ ok: false, motivo: "estoque_insuficiente" });
    const d = ok(adicionarItem(carrinhoVazio(), shampoo, 1));
    expect(alterarQuantidade(d, shampoo, 11)).toMatchObject({ ok: false, motivo: "limite_por_item" });
  });

  it("avisa quando o item não está no carrinho", () => {
    expect(alterarQuantidade(carrinhoVazio(), shampoo, 2)).toMatchObject({ ok: false, motivo: "item_ausente" });
  });
});

describe("calcularSubtotal", () => {
  it("soma preço vigente × quantidade", () => {
    const c = ok(adicionarItem(ok(adicionarItem(carrinhoVazio(), shampoo, 2)), mascara, 1));
    expect(calcularSubtotal(c, buscar)).toBe(2 * 10000 + 15990);
  });

  it("carrinho vazio vale zero", () => {
    expect(calcularSubtotal(carrinhoVazio(), buscar)).toBe(0);
  });

  it("falha se o produto não existe no catálogo", () => {
    const c = { itens: [{ produtoId: "PH-999", quantidade: 1 }] };
    expect(() => calcularSubtotal(c, buscar)).toThrow(/PH-999/);
  });
});
