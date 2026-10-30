import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validarCatalogo, type Produto } from "@sofia/shared";
import type { ProdutoCarrinho } from "../domain/carrinho.js";
import { reaisParaCentavos } from "../domain/dinheiro.js";

/** Estoque de teste a partir do qual a Sofia pode falar em "estoque baixo" (especificação 8.3). */
export const LIMITE_ESTOQUE_BAIXO = 3;

export interface Catalogo {
  readonly produtos: readonly Produto[];
  obter(id: string): Produto | undefined;
  /** Produto no formato do domínio do carrinho: preços em centavos. */
  paraCarrinho(produto: Produto): ProdutoCarrinho;
}

export const CAMINHO_CATALOGO = fileURLToPath(new URL("../../../data/produtos.json", import.meta.url));

export function criarCatalogo(produtos: readonly Produto[]): Catalogo {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  return {
    produtos,
    obter: (id) => porId.get(id),
    paraCarrinho: (p) => ({
      id: p.id,
      precoCentavos: reaisParaCentavos(p.preco),
      precoPromocionalCentavos: p.preco_promocional === null ? null : reaisParaCentavos(p.preco_promocional),
      estoque: p.estoque_teste,
    }),
  };
}

/** Lê e valida data/produtos.json. Falha alto no start do servidor se o catálogo estiver inválido. */
export function carregarCatalogo(caminho: string = CAMINHO_CATALOGO): Catalogo {
  const resultado = validarCatalogo(JSON.parse(readFileSync(caminho, "utf8")) as unknown);
  if (!resultado.ok) {
    throw new Error(`Catálogo inválido em ${caminho}:\n${resultado.erros.map((e) => `  - ${e}`).join("\n")}`);
  }
  return criarCatalogo(resultado.produtos);
}
