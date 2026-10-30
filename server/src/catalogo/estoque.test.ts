import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { criarEstoque } from "./estoque.js";
import { criarCatalogo } from "./catalogo.js";
import { PRODUTOS_DE_TESTE } from "../tools/teste-util.js";

const inicial = () =>
  new Map([
    ["PH-001", 12],
    ["PH-002", 2],
  ]);
const novoArquivo = () => join(mkdtempSync(join(tmpdir(), "sofia-estoque-")), "estoque.json");

describe("criarEstoque", () => {
  it("parte do estoque de teste e baixa sem passar de zero", () => {
    const e = criarEstoque(inicial());
    e.baixar("PH-001", 5);
    expect(e.obter("PH-001")).toBe(7);
    e.baixar("PH-002", 9);
    expect(e.obter("PH-002")).toBe(0);
  });

  it("repõe a mesma quantidade em todos os produtos", () => {
    const e = criarEstoque(inicial());
    e.repor(10);
    expect([e.obter("PH-001"), e.obter("PH-002")]).toEqual([22, 12]);
  });

  it("grava no arquivo e um novo estoque lê o que foi gravado", () => {
    const caminho = novoArquivo();
    const a = criarEstoque(inicial(), caminho);
    a.baixar("PH-001", 3);
    expect(JSON.parse(readFileSync(caminho, "utf8"))).toEqual({ "PH-001": 9, "PH-002": 2 });

    const b = criarEstoque(inicial(), caminho);
    expect(b.obter("PH-001")).toBe(9);
  });

  it("enxerga a reposição feita por outro processo sem reiniciar", () => {
    const caminho = novoArquivo();
    const servidor = criarEstoque(inicial(), caminho);
    servidor.baixar("PH-002", 2);
    expect(servidor.obter("PH-002")).toBe(0);

    criarEstoque(inicial(), caminho).repor(10); // o comando pnpm estoque:repor
    utimesSync(caminho, new Date(), new Date(Date.now() + 5000)); // garante mtime diferente em disco rápido
    expect(servidor.obter("PH-002")).toBe(10);
    expect(servidor.obter("PH-001")).toBe(22);
  });

  it("ignora ids desconhecidos e valores inválidos do arquivo", () => {
    const caminho = novoArquivo();
    writeFileSync(caminho, JSON.stringify({ "PH-001": -4, "PH-002": 1.5, "PH-999": 7 }));
    const e = criarEstoque(inicial(), caminho);
    expect([e.obter("PH-001"), e.obter("PH-002"), e.obter("PH-999")]).toEqual([12, 2, 0]);
  });

  it("segue com a memória se o arquivo estiver ilegível", () => {
    const caminho = novoArquivo();
    writeFileSync(caminho, "{ não é json");
    expect(criarEstoque(inicial(), caminho).obter("PH-001")).toBe(12);
  });
});

describe("catálogo com estoque", () => {
  it("mostra o estoque atual nos produtos e no carrinho", () => {
    const catalogo = criarCatalogo(PRODUTOS_DE_TESTE);
    catalogo.baixarEstoque("PH-001", 5);
    expect(catalogo.obter("PH-001")?.estoque_teste).toBe(7);
    expect(catalogo.produtos.find((p) => p.id === "PH-001")?.estoque_teste).toBe(7);
    expect(catalogo.paraCarrinho(catalogo.obter("PH-001")!).estoque).toBe(7);
  });

  it("repõe o estoque de todos os produtos de uma vez", () => {
    const catalogo = criarCatalogo(PRODUTOS_DE_TESTE);
    catalogo.reporEstoque(10);
    expect(catalogo.produtos.map((p) => p.estoque_teste)).toEqual([22, 12, 15, 20]);
  });

  it("numera os pedidos em sequência a partir de PH-TESTE-000001", () => {
    const catalogo = criarCatalogo(PRODUTOS_DE_TESTE);
    expect(catalogo.proximoNumeroPedido()).toBe("PH-TESTE-000001");
    expect(catalogo.proximoNumeroPedido()).toBe("PH-TESTE-000002");
  });
});
