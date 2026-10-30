// Carrinho (especificação, 6.1 e 6.3): funções puras e imutáveis, dinheiro em centavos.

export const LIMITE_POR_ITEM = 10;

export interface ProdutoCarrinho {
  id: string;
  precoCentavos: number;
  precoPromocionalCentavos: number | null;
  estoque: number;
}

export interface ItemCarrinho {
  produtoId: string;
  quantidade: number;
}

export interface Carrinho {
  itens: readonly ItemCarrinho[];
}

export type MotivoErroCarrinho =
  | "quantidade_invalida"
  | "estoque_insuficiente"
  | "limite_por_item"
  | "item_ausente";

export type ResultadoCarrinho =
  | { ok: true; carrinho: Carrinho }
  | { ok: false; motivo: MotivoErroCarrinho; erro: string; disponivel?: number };

export function carrinhoVazio(): Carrinho {
  return { itens: [] };
}

/** Preço vigente = promocional se existir, senão o preço cheio. */
export function precoVigenteCentavos(produto: ProdutoCarrinho): number {
  return produto.precoPromocionalCentavos ?? produto.precoCentavos;
}

function falha(motivo: MotivoErroCarrinho, erro: string, disponivel?: number): ResultadoCarrinho {
  return disponivel === undefined ? { ok: false, motivo, erro } : { ok: false, motivo, erro, disponivel };
}

function quantidadeNoCarrinho(carrinho: Carrinho, produtoId: string): number {
  return carrinho.itens.find((i) => i.produtoId === produtoId)?.quantidade ?? 0;
}

/** Valida a quantidade total desejada de um produto contra estoque e limite por item. */
function validarTotal(produto: ProdutoCarrinho, total: number, atual: number): ResultadoCarrinho | null {
  if (total > produto.estoque) {
    return falha(
      "estoque_insuficiente",
      produto.estoque === 0
        ? "Esse produto está sem estoque no momento."
        : `Só temos ${produto.estoque} unidade(s) desse produto em estoque.`,
      Math.max(0, produto.estoque - atual),
    );
  }
  if (total > LIMITE_POR_ITEM) {
    return falha(
      "limite_por_item",
      `O máximo é ${LIMITE_POR_ITEM} unidades por item.`,
      Math.max(0, LIMITE_POR_ITEM - atual),
    );
  }
  return null;
}

function comQuantidade(carrinho: Carrinho, produtoId: string, quantidade: number): Carrinho {
  if (quantidade === 0) return { itens: carrinho.itens.filter((i) => i.produtoId !== produtoId) };
  if (carrinho.itens.some((i) => i.produtoId === produtoId)) {
    return { itens: carrinho.itens.map((i) => (i.produtoId === produtoId ? { ...i, quantidade } : i)) };
  }
  return { itens: [...carrinho.itens, { produtoId, quantidade }] };
}

export function adicionarItem(carrinho: Carrinho, produto: ProdutoCarrinho, quantidade: number): ResultadoCarrinho {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    return falha("quantidade_invalida", "A quantidade precisa ser um número inteiro maior que zero.");
  }
  const atual = quantidadeNoCarrinho(carrinho, produto.id);
  const erro = validarTotal(produto, atual + quantidade, atual);
  if (erro) return erro;
  return { ok: true, carrinho: comQuantidade(carrinho, produto.id, atual + quantidade) };
}

export function removerItem(carrinho: Carrinho, produtoId: string): ResultadoCarrinho {
  if (quantidadeNoCarrinho(carrinho, produtoId) === 0) {
    return falha("item_ausente", "Esse produto não está no carrinho.");
  }
  return { ok: true, carrinho: comQuantidade(carrinho, produtoId, 0) };
}

/** Define a quantidade de um item que já está no carrinho; 0 remove. */
export function alterarQuantidade(carrinho: Carrinho, produto: ProdutoCarrinho, quantidade: number): ResultadoCarrinho {
  if (!Number.isInteger(quantidade) || quantidade < 0) {
    return falha("quantidade_invalida", "A quantidade precisa ser um número inteiro, zero ou maior.");
  }
  if (quantidadeNoCarrinho(carrinho, produto.id) === 0) {
    return falha("item_ausente", "Esse produto não está no carrinho.");
  }
  const erro = validarTotal(produto, quantidade, 0);
  if (erro) return erro;
  return { ok: true, carrinho: comQuantidade(carrinho, produto.id, quantidade) };
}

/** Subtotal = soma de (preço vigente × quantidade), em centavos. */
export function calcularSubtotal(
  carrinho: Carrinho,
  buscarProduto: (id: string) => ProdutoCarrinho | undefined,
): number {
  return carrinho.itens.reduce((soma, item) => {
    const produto = buscarProduto(item.produtoId);
    if (!produto) throw new Error(`Produto não encontrado no catálogo: ${item.produtoId}`);
    return soma + precoVigenteCentavos(produto) * item.quantidade;
  }, 0);
}
