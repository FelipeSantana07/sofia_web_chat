import { z } from "zod";
import { dadosCheckoutSchema } from "@sofia/shared";
import { emitirPix, fecharPedido, localizarPedido } from "../pedidos/servico.js";
import { visaoDoPedido } from "../pedidos/visao.js";
import { definirFerramenta, type Ferramenta } from "./base.js";

const pedidoId = z
  .string()
  .optional()
  .describe("Número do pedido, ex.: PH-TESTE-000123; omita para usar o pedido mais recente da conversa");

export const finalizarPedido = definirFerramenta({
  nome: "finalizar_pedido",
  descricao:
    "Fecha o pedido com o que está no carrinho, depois que a cliente confirmar o resumo, o frete escolhido e os dados de entrega " +
    "(nome, e-mail, CEP, endereço, número e complemento opcional). Cria o pedido em aguardando_pagamento e devolve o resumo e os totais; " +
    "o carrinho fica vazio. Não peça CPF nem cartão: os dados são fictícios. Depois chame gerar_pix.",
  parametros: dadosCheckoutSchema,
  executar(dados, ctx) {
    const r = fecharPedido(ctx, dados, Date.now());
    if (!r.ok) return r;
    return {
      ok: true,
      mensagem: `Pedido ${r.pedido.id} criado e aguardando pagamento. Chame gerar_pix para gerar o PIX.`,
      pedido: visaoDoPedido(r.pedido, Date.now()),
    };
  },
});

export const gerarPix = definirFerramenta({
  nome: "gerar_pix",
  descricao:
    "Gera o PIX falso de um pedido aguardando pagamento: devolve o copia e cola de teste, o valor e a validade (15 minutos). " +
    "Se já houver um PIX valendo, devolve o mesmo; só gera outro depois que o anterior expirar. " +
    "O QR Code aparece na tela da cliente. Explique que é uma simulação e que o código não paga nada de verdade.",
  parametros: z.object({ pedido_id: pedidoId }),
  executar({ pedido_id }, ctx) {
    const agora = Date.now();
    const r = emitirPix(ctx, pedido_id, agora);
    if (!r.ok) return r;
    return {
      ok: true,
      mensagem: r.reaproveitado
        ? "O PIX anterior ainda está valendo; é este."
        : r.substituiuExpirado
          ? "O PIX anterior tinha expirado; este é um novo, válido por 15 minutos."
          : "PIX gerado, válido por 15 minutos.",
      pedido: visaoDoPedido(r.pedido, agora),
    };
  },
});

export const consultarPedido = definirFerramenta({
  nome: "consultar_pedido",
  descricao:
    "Consulta um pedido da conversa: status do pedido (aguardando_pagamento ou pago), itens, totais e o status do PIX " +
    "(ativo, expirado ou pago, com o tempo que falta). Use quando a cliente perguntar do pedido ou disser que pagou. " +
    "Se o PIX expirou, ofereça gerar outro.",
  parametros: z.object({ pedido_id: pedidoId }),
  executar({ pedido_id }, ctx) {
    const r = localizarPedido(ctx, pedido_id);
    if (!r.ok) return r;
    return { ok: true, pedido: visaoDoPedido(r.pedido, Date.now()) };
  },
});

export const ferramentasPedido: Ferramenta[] = [finalizarPedido, gerarPix, consultarPedido];
