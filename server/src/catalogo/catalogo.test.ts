import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buscarProdutos } from "../tools/catalogo-perfil.js";
import { contextoDeTeste, produtoDeTeste } from "../tools/teste-util.js";
import { carregarCatalogo, criarCatalogo } from "./catalogo.js";

describe("criarCatalogo", () => {
  const catalogo = criarCatalogo([
    produtoDeTeste("PH-001", { preco: 74.9, preco_promocional: 24.9, estoque_teste: 18 }),
    produtoDeTeste("PH-002", { preco: 54.9 }),
  ]);

  it("busca por id", () => {
    expect(catalogo.obter("PH-001")?.id).toBe("PH-001");
    expect(catalogo.obter("PH-999")).toBeUndefined();
  });

  it("converte preços de reais para centavos sem erro de ponto flutuante", () => {
    const p = catalogo.obter("PH-001")!;
    expect(catalogo.paraCarrinho(p)).toEqual({
      id: "PH-001",
      precoCentavos: 7490,
      precoPromocionalCentavos: 2490,
      estoque: 18,
    });
    expect(catalogo.paraCarrinho(catalogo.obter("PH-002")!).precoPromocionalCentavos).toBeNull();
  });
});

describe("carregarCatalogo", () => {
  it("carrega e valida o data/produtos.json do projeto", () => {
    const catalogo = carregarCatalogo(undefined, null);
    expect(catalogo.produtos).toHaveLength(15);
    expect(catalogo.obter("PH-001")?.nome).toMatch(/Tônico/);
  });

  it("as ferramentas funcionam sobre o catálogo real", () => {
    const ctx = { ...contextoDeTeste(), catalogo: carregarCatalogo(undefined, null) };
    const r = buscarProdutos.executar({ termo: "queda de cabelo" }, ctx) as { ok: boolean; produtos: { id: string }[] };
    expect(r.ok).toBe(true);
    expect(r.produtos.map((p) => p.id)).toContain("PH-001");
  });

  it("falha alto com a lista de erros se o catálogo for inválido", () => {
    const pasta = mkdtempSync(join(tmpdir(), "sofia-catalogo-"));
    const arquivo = join(pasta, "produtos.json");
    writeFileSync(arquivo, JSON.stringify([{ id: "X" }]));
    expect(() => carregarCatalogo(arquivo)).toThrow(/Catálogo inválido[\s\S]*\[0\]\.id/);
  });
});
