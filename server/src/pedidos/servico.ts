import type { DadosCheckout, ItemPedido, Pedido } from "@sofia/shared";
import { carrinhoVazio, precoVigenteCentavos } from "../domain/carrinho.js";
import { identificarZona, normalizarCep } from "../domain/cep.js";
import { montarPedido } from "../domain/pedido.js";
import { PIX_VALIDADE_MS, gerarPix, statusDoPix } from "../domain/pix.js";
import type { ContextoFerramenta } from "../tools/base.js";
import { pesoCobradoDoCarrinho } from "../tools/resumo-carrinho.js";
import { mensagemPagamentoConfirmado } from "./mensagens.js";

// Regras de pedido e PIX usadas pelas ferramentas da Sofia e pelas rotas do formulário: os dois caminhos
// passam por aqui, então chegam ao mesmo pedido.

export interface Falha {
  ok: false;
  erro: string;
  motivo: string;
  [extra: string]: unknown;
}

const falhar = (erro: string, motivo: string, extras: Record<string, unknown> = {}): Falha => ({
  ok: false,
  erro,
  motivo,
  ...extras,
});

/** Fecha o pedido com o que está no carrinho: confere estoque, calcula, reserva o estoque e esvazia o carrinho. */
export function fecharPedido(
  ctx: ContextoFerramenta,
  dados: DadosCheckout,
  agora: number,
): { ok: true; pedido: Pedido } | Falha {
  const { catalogo, sessao } = ctx;
  catalogo.liberarVencidas(agora);

  if (sessao.carrinho.itens.length === 0) {
    return falhar("O carrinho está vazio. Adicione ao menos um produto antes de fechar o pedido.", "carrinho_vazio");
  }
  const zona = identificarZona(dados.cep);
  if (!zona.ok) return falhar(zona.erro, "cep_invalido");

  // O estoque pode ter mudado desde que o item entrou no carrinho (outra cliente comprou, por exemplo).
  const itens: ItemPedido[] = [];
  for (const item of sessao.carrinho.itens) {
    const produto = catalogo.obter(item.produtoId);
    if (!produto) throw new Error(`Produto não encontrado no catálogo: ${item.produtoId}`);
    if (item.quantidade > produto.estoque_teste) {
      return falhar(
        `Não há mais ${item.quantidade} unidade(s) de ${produto.nome} em estoque (restam ${produto.estoque_teste}). Ajuste o carrinho antes de fechar.`,
        "estoque_insuficiente",
        { produto_id: produto.id, disponivel: produto.estoque_teste },
      );
    }
    const unitario = precoVigenteCentavos(catalogo.paraCarrinho(produto));
    itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      quantidade: item.quantidade,
      precoUnitarioCentavos: unitario,
      totalCentavos: unitario * item.quantidade,
    });
  }

  const cep = normalizarCep(dados.cep)!; // identificarZona já validou o formato
  const pedido = montarPedido({
    id: catalogo.proximoNumeroPedido(),
    agora,
    itens,
    cupom: sessao.cupom,
    cliente: { nome: dados.nome, email: dados.email },
    endereco: { cep, endereco: dados.endereco, numero: dados.numero, complemento: dados.complemento || null },
    zona: zona.zona,
    pesoCobradoG: pesoCobradoDoCarrinho(ctx)!, // o carrinho não está vazio
    modalidade: dados.modalidade_frete,
  });

  // O estoque fica reservado enquanto o PIX vale; sem pagamento, volta sozinho.
  catalogo.reservarEstoque(
    pedido.id,
    itens.map((i) => ({ id: i.produtoId, quantidade: i.quantidade })),
    agora + PIX_VALIDADE_MS,
  );
  sessao.pedidos.push(pedido);
  sessao.carrinho = carrinhoVazio();
  sessao.cupom = null;
  sessao.entrega = { cep, zona: zona.zona };
  return { ok: true, pedido };
}

/** Acha um pedido desta conversa pelo número; sem número, o mais recente. */
export function localizarPedido(
  { catalogo, sessao }: ContextoFerramenta,
  pedidoId?: string,
  agora: number = Date.now(),
): { ok: true; pedido: Pedido } | Falha {
  catalogo.liberarVencidas(agora);
  if (sessao.pedidos.length === 0) {
    return falhar("Ainda não há nenhum pedido nesta conversa. Feche o pedido primeiro.", "sem_pedido");
  }
  if (pedidoId === undefined || pedidoId.trim() === "") {
    return { ok: true, pedido: sessao.pedidos[sessao.pedidos.length - 1]! };
  }
  const id = pedidoId.trim().toUpperCase();
  const pedido = sessao.pedidos.find((p) => p.id === id);
  return pedido
    ? { ok: true, pedido }
    : falhar(`Não encontrei o pedido ${pedidoId.trim()} nesta conversa.`, "pedido_nao_encontrado");
}

/** Gera o PIX do pedido. Enquanto o atual estiver valendo ele é reaproveitado; só depois de expirar sai outro. */
export function emitirPix(
  ctx: ContextoFerramenta,
  pedidoId: string | undefined,
  agora: number,
): { ok: true; pedido: Pedido; reaproveitado: boolean; substituiuExpirado: boolean } | Falha {
  const achado = localizarPedido(ctx, pedidoId, agora);
  if (!achado.ok) return achado;
  const { pedido } = achado;

  if (pedido.status === "pago") {
    return falhar(`O pedido ${pedido.id} já está pago; não precisa de outro PIX.`, "pedido_ja_pago");
  }
  if (pedido.pix && statusDoPix(pedido.pix, agora) === "ativo") {
    return { ok: true, pedido, reaproveitado: true, substituiuExpirado: false };
  }
  // Se a reserva venceu junto com o PIX anterior, o estoque voltou: confere e reserva de novo.
  if (!ctx.catalogo.temReserva(pedido.id)) {
    for (const item of pedido.itens) {
      const disponivel = ctx.catalogo.obter(item.produtoId)?.estoque_teste ?? 0;
      if (item.quantidade > disponivel) {
        return falhar(
          `O PIX anterior expirou e, nesse meio tempo, ${item.nome} ficou com apenas ${disponivel} unidade(s) em estoque (o pedido tem ${item.quantidade}). Não dá para gerar outro PIX para este pedido.`,
          "estoque_insuficiente",
          { produto_id: item.produtoId, disponivel },
        );
      }
    }
    ctx.catalogo.reservarEstoque(
      pedido.id,
      pedido.itens.map((i) => ({ id: i.produtoId, quantidade: i.quantidade })),
      agora,
    );
  }
  const substituiuExpirado = pedido.pix !== null;
  pedido.pix = gerarPix(pedido, agora);
  ctx.catalogo.prolongarReserva(pedido.id, pedido.pix.expiraEm);
  return { ok: true, pedido, reaproveitado: false, substituiuExpirado };
}

/**
 * Simula o pagamento: precisa de um PIX ativo. Quem paga é a cliente, na interface; o sistema só marca o pedido
 * como pago e deixa na conversa a confirmação da Sofia (texto fixo, sem chamar o modelo).
 */
export function pagarPedido(
  ctx: ContextoFerramenta,
  pedidoId: string | undefined,
  agora: number,
): { ok: true; pedido: Pedido; jaEstavaPago: boolean; mensagem: string } | Falha {
  const { sessao, catalogo } = ctx;
  const achado = localizarPedido(ctx, pedidoId, agora);
  if (!achado.ok) return achado;
  const { pedido } = achado;
  const mensagem = mensagemPagamentoConfirmado(pedido);

  if (pedido.status === "pago") return { ok: true, pedido, jaEstavaPago: true, mensagem };
  if (!pedido.pix) return falhar(`Gere o PIX do pedido ${pedido.id} antes de pagar.`, "sem_pix");
  if (statusDoPix(pedido.pix, agora) === "expirado") {
    return falhar(`O PIX do pedido ${pedido.id} expirou. Gere outro para pagar.`, "pix_expirado");
  }

  catalogo.confirmarReserva(pedido.id);
  pedido.status = "pago";
  pedido.pagoEm = agora;
  // A Sofia "fala" na conversa e fica sabendo do pagamento nas próximas respostas.
  sessao.historico.push(
    { role: "user", parts: [{ text: `[aviso do sistema] A cliente pagou o pedido ${pedido.id} (pagamento simulado).` }] },
    { role: "model", parts: [{ text: mensagem }] },
  );
  sessao.atualizadoEm = agora;
  return { ok: true, pedido, jaEstavaPago: false, mensagem };
}
