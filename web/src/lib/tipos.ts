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

export interface PixView {
  copia_e_cola: string;
  valor: Dinheiro;
  status: "ativo" | "expirado" | "pago";
  gerado_em: string;
  expira_em: string;
  segundos_restantes: number;
  aviso: string;
}

/** O pedido como o servidor devolve (visaoDoPedido). */
export interface PedidoView {
  id: string;
  status: "aguardando_pagamento" | "pago";
  cliente: { nome: string; email: string };
  entrega: {
    cep: string;
    endereco: string;
    numero: string;
    complemento: string | null;
    nome_modalidade: string;
    prazo: string;
  };
  itens: ItemCarrinho[];
  cupom: string | null;
  totais: {
    subtotal: Dinheiro;
    desconto_cupom: Dinheiro;
    base_produtos: Dinheiro;
    frete: Dinheiro;
    frete_gratis: boolean;
    desconto_pix: Dinheiro;
    total_no_pix: Dinheiro;
  };
  pix: PixView | null;
}

export interface DadosCheckoutForm {
  nome: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  modalidade_frete: "economica" | "expressa";
}
