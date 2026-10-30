import { describe, expect, it } from "vitest";
import { produtoSchema, validarCatalogo } from "./index.js";

function produtoValido(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: "PH-001",
    sku: null,
    nome: "Produto de teste",
    linha: null,
    categoria: "shampoo",
    url: "https://lojaprohall.com.br/products/teste",
    imagem_url: "https://lojaprohall.com.br/imagem.jpg",
    preco: 189.9,
    preco_promocional: null,
    volume: "1 L",
    peso_bruto_g: 1150,
    peso_estimado: false,
    estoque_teste: 12,
    uso: "ambos",
    descricao_curta: "Uma frase.",
    descricao_completa: "Texto completo.",
    indicado_para: ["cabelos com frizz"],
    nao_indicado_para: [],
    beneficios: [],
    ativos_principais: [],
    modo_de_uso: ["Passo 1"],
    cuidados_e_avisos: [],
    duracao_resultado: null,
    rendimento: null,
    combina_com: [],
    perguntas_frequentes: [{ pergunta: "P?", resposta: "R." }],
    ...sobrescrever,
  };
}

describe("produtoSchema", () => {
  it("aceita um produto válido", () => {
    expect(produtoSchema.safeParse(produtoValido()).success).toBe(true);
  });

  it("aceita campos opcionais ausentes como null e listas vazias", () => {
    const r = produtoSchema.safeParse(produtoValido({ sku: null, linha: null, beneficios: [] }));
    expect(r.success).toBe(true);
  });

  it("aceita volume e uso null quando o site não informa", () => {
    expect(produtoSchema.safeParse(produtoValido({ volume: null, uso: null })).success).toBe(true);
    expect(produtoSchema.safeParse(produtoValido({ volume: "" })).success).toBe(false);
  });

  it("rejeita id fora do formato PH-000", () => {
    expect(produtoSchema.safeParse(produtoValido({ id: "P-1" })).success).toBe(false);
  });

  it("rejeita categoria e uso desconhecidos", () => {
    expect(produtoSchema.safeParse(produtoValido({ categoria: "perfume" })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ uso: "industrial" })).success).toBe(false);
  });

  it("rejeita preço inválido", () => {
    expect(produtoSchema.safeParse(produtoValido({ preco: 0 })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ preco: -5 })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ preco: 10.123 })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ preco: "189,90" })).success).toBe(false);
  });

  it("rejeita promocional maior ou igual ao preço", () => {
    expect(produtoSchema.safeParse(produtoValido({ preco_promocional: 189.9 })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ preco_promocional: 150 })).success).toBe(true);
  });

  it("rejeita peso e estoque inválidos", () => {
    expect(produtoSchema.safeParse(produtoValido({ peso_bruto_g: 0 })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ peso_bruto_g: 10.5 })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ estoque_teste: -1 })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ estoque_teste: 0 })).success).toBe(true);
  });

  it("rejeita URL inválida e texto vazio", () => {
    expect(produtoSchema.safeParse(produtoValido({ url: "lojaprohall" })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ nome: "  " })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ sku: "" })).success).toBe(false);
  });

  it("rejeita campo desconhecido e campo ausente", () => {
    expect(produtoSchema.safeParse(produtoValido({ extra: 1 })).success).toBe(false);
    const { nome: _nome, ...semNome } = produtoValido();
    expect(produtoSchema.safeParse(semNome).success).toBe(false);
  });

  it("rejeita combina_com consigo mesmo ou repetido", () => {
    expect(produtoSchema.safeParse(produtoValido({ combina_com: ["PH-001"] })).success).toBe(false);
    expect(produtoSchema.safeParse(produtoValido({ combina_com: ["PH-002", "PH-002"] })).success).toBe(false);
  });
});

describe("validarCatalogo", () => {
  it("aceita um catálogo coerente", () => {
    const r = validarCatalogo([
      produtoValido({ id: "PH-001", combina_com: ["PH-002"] }),
      produtoValido({ id: "PH-002", combina_com: ["PH-001"] }),
    ]);
    expect(r.ok).toBe(true);
  });

  it("aponta ids repetidos", () => {
    const r = validarCatalogo([produtoValido(), produtoValido()]);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.erros.join("\n")).toMatch(/\[1\]\.id: id repetido: PH-001/);
  });

  it("aponta combina_com para produto inexistente", () => {
    const r = validarCatalogo([produtoValido({ combina_com: ["PH-009"] })]);
    if (r.ok) throw new Error("esperava erro");
    expect(r.erros.join("\n")).toMatch(/\[0\]\.combina_com\[0\]: .*PH-009/);
  });

  it("mostra o caminho do campo com erro", () => {
    const r = validarCatalogo([produtoValido(), produtoValido({ id: "PH-002", preco: -1 })]);
    if (r.ok) throw new Error("esperava erro");
    expect(r.erros.join("\n")).toMatch(/\[1\]\.preco:/);
  });

  it("rejeita algo que não é lista", () => {
    expect(validarCatalogo({}).ok).toBe(false);
  });
});
