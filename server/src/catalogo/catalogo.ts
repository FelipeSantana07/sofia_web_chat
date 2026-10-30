import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validarCatalogo, type Produto } from "@sofia/shared";
import type { ProdutoCarrinho } from "../domain/carrinho.js";
import { reaisParaCentavos } from "../domain/dinheiro.js";
import { CAMINHO_ESTOQUE, criarEstoque, type Estoque } from "./estoque.js";

/** Estoque de teste a partir do qual a Sofia pode falar em "estoque baixo" (especificação 8.3). */
export const LIMITE_ESTOQUE_BAIXO = 3;

/**
 * O que a loja guarda e todas as conversas compartilham: os produtos (com o estoque de agora em `estoque_teste`)
 * e a numeração dos pedidos.
 */
export interface Catalogo {
  readonly produtos: readonly Produto[];
  obter(id: string): Produto | undefined;
  /** Produto no formato do domínio do carrinho: preços em centavos e estoque atual. */
  paraCarrinho(produto: Produto): ProdutoCarrinho;
  /** Tira unidades do estoque de vez (ex.: venda feita fora das conversas). */
  baixarEstoque(id: string, quantidade: number): void;
  /**
   * Reserva as unidades de um pedido até `expiraEm`: o estoque baixa na hora e volta sozinho se o pedido
   * não for pago até lá (a reserva dura o mesmo que o PIX).
   */
  reservarEstoque(pedidoId: string, itens: readonly { id: string; quantidade: number }[], expiraEm: number): void;
  /** Muda até quando a reserva do pedido vale (novo PIX). */
  prolongarReserva(pedidoId: string, expiraEm: number): void;
  /** O pedido foi pago: as unidades saem do estoque definitivamente. */
  confirmarReserva(pedidoId: string): void;
  temReserva(pedidoId: string): boolean;
  /** Devolve ao estoque as reservas vencidas até `agora`. As leituras do catálogo já fazem isso com o relógio dele. */
  liberarVencidas(agora: number): void;
  /** Soma `quantidade` ao estoque de todos os produtos (usado por `pnpm estoque:repor`). */
  reporEstoque(quantidade: number): void;
  /** Próximo número de pedido, ex.: PH-TESTE-000001. */
  proximoNumeroPedido(): string;
}

export const CAMINHO_CATALOGO = fileURLToPath(new URL("../../../data/produtos.json", import.meta.url));

export function criarCatalogo(
  produtos: readonly Produto[],
  estoque?: Estoque,
  /** Relógio, trocado nos testes para simular a validade das reservas. */
  agora: () => number = Date.now,
): Catalogo {
  const base = new Map(produtos.map((p) => [p.id, p]));
  const controle = estoque ?? criarEstoque(new Map(produtos.map((p) => [p.id, p.estoque_teste])));
  const comEstoque = (p: Produto): Produto => ({ ...p, estoque_teste: controle.obter(p.id) });
  const atual = (): void => liberarVencidas(agora());
  let ultimoPedido = 0;
  const reservas = new Map<string, { itens: readonly { id: string; quantidade: number }[]; expiraEm: number }>();

  function liberarVencidas(t: number): void {
    for (const [pedidoId, r] of reservas) {
      if (r.expiraEm > t) continue;
      for (const item of r.itens) controle.devolver(item.id, item.quantidade);
      reservas.delete(pedidoId);
    }
  }

  return {
    get produtos() {
      atual();
      return produtos.map(comEstoque);
    },
    obter: (id) => {
      atual();
      const p = base.get(id);
      return p ? comEstoque(p) : undefined;
    },
    paraCarrinho: (p) => (atual(), {
      id: p.id,
      precoCentavos: reaisParaCentavos(p.preco),
      precoPromocionalCentavos: p.preco_promocional === null ? null : reaisParaCentavos(p.preco_promocional),
      estoque: controle.obter(p.id),
    }),
    baixarEstoque: (id, quantidade) => controle.baixar(id, quantidade),
    reservarEstoque(pedidoId, itens, expiraEm) {
      for (const item of itens) controle.baixar(item.id, item.quantidade);
      reservas.set(pedidoId, { itens, expiraEm });
    },
    prolongarReserva(pedidoId, expiraEm) {
      const r = reservas.get(pedidoId);
      if (r) r.expiraEm = expiraEm;
    },
    confirmarReserva: (pedidoId) => void reservas.delete(pedidoId),
    temReserva: (pedidoId) => reservas.has(pedidoId),
    liberarVencidas,
    reporEstoque: (quantidade) => controle.repor(quantidade),
    proximoNumeroPedido: () => `PH-TESTE-${String(++ultimoPedido).padStart(6, "0")}`,
  };
}

/**
 * Lê e valida data/produtos.json. Falha alto no start do servidor se o catálogo estiver inválido.
 * O estoque parte do `estoque_teste` e é gravado em `caminhoEstoque` (null = só em memória).
 */
export function carregarCatalogo(
  caminho: string = CAMINHO_CATALOGO,
  caminhoEstoque: string | null = CAMINHO_ESTOQUE,
): Catalogo {
  const resultado = validarCatalogo(JSON.parse(readFileSync(caminho, "utf8")) as unknown);
  if (!resultado.ok) {
    throw new Error(`Catálogo inválido em ${caminho}:\n${resultado.erros.map((e) => `  - ${e}`).join("\n")}`);
  }
  const estoque = criarEstoque(new Map(resultado.produtos.map((p) => [p.id, p.estoque_teste])), caminhoEstoque);
  return criarCatalogo(resultado.produtos, estoque);
}
