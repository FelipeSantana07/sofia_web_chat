// Formato do que o servidor devolve: valores em reais já vêm formatados em `texto`, e o front não calcula nada.

export interface Dinheiro {
  centavos: number;
  texto: string;
}

/** Dados de um card de produto (resultado da ferramenta mostrar_produtos). */
export interface CardProduto {
  id: string;
  nome: string;
  categoria: string;
  preco: Dinheiro;
  preco_cheio?: Dinheiro;
  em_promocao: boolean;
  descricao_curta: string;
  estoque_baixo?: boolean;
  esgotado?: boolean;
  imagem_url: string;
  url: string;
}

export interface ItemCarrinho {
  id: string;
  nome: string;
  quantidade: number;
  preco_unitario: Dinheiro;
  total_do_item: Dinheiro;
}

export interface OpcaoFrete {
  modalidade: "economica" | "expressa";
  nome: string;
  frete: Dinheiro;
  frete_gratis: boolean;
  /** null na Expressa: ela nunca é grátis. */
  falta_para_frete_gratis: Dinheiro | null;
  prazo: string;
  desconto_pix: Dinheiro;
  total_no_pix: Dinheiro;
}

export interface Carrinho {
  itens: ItemCarrinho[];
  vazio: boolean;
  subtotal: Dinheiro;
  cupom: { codigo: string; desconto: Dinheiro } | null;
  base_produtos: Dinheiro;
  economia_no_pix: Dinheiro;
  entrega: { cep: string; zona: string; limite_frete_gratis: Dinheiro; opcoes: OpcaoFrete[] } | null;
}
