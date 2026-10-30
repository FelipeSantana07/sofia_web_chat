import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { z } from "zod";
import { dadosCheckoutSchema } from "@sofia/shared";
import type { Agente, EventoAgente } from "./agent/agente.js";
import type { Catalogo } from "./catalogo/catalogo.js";
import { emitirPix, fecharPedido, localizarPedido, pagarPedido, type Falha } from "./pedidos/servico.js";
import { gerarQrSvg } from "./pedidos/qr.js";
import { visaoDoPedido } from "./pedidos/visao.js";
import type { EstadoSessao, StoreSessoes } from "./sessao/store.js";
import { erroDeValidacao, type ResultadoFerramenta } from "./tools/base.js";
import { adicionarAoCarrinho, removerDoCarrinho } from "./tools/carrinho-frete.js";
import { montarResumoCarrinho } from "./tools/resumo-carrinho.js";

export const LIMITE_MENSAGEM = 2000;

const corpoChat = z.object({
  mensagem: z.string().trim().min(1).max(LIMITE_MENSAGEM),
  sessaoId: z.string().optional(),
});

/** Uma mensagem Server-Sent Events: `event` + `data` em JSON. */
function sse(evento: string, dados: unknown): string {
  return `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
}

function dadosDoEvento(e: EventoAgente): unknown {
  const { tipo: _tipo, ...dados } = e;
  return dados;
}

/** Status HTTP de cada motivo de recusa do checkout e do PIX. */
function statusDaFalha(motivo: string): number {
  if (motivo === "sem_pedido" || motivo === "pedido_nao_encontrado") return 404;
  if (motivo === "pedido_ja_pago" || motivo === "sem_pix" || motivo === "pix_expirado") return 409;
  return 422;
}

export function criarApp({
  agente,
  store,
  catalogo,
  agora = Date.now,
  logger = false,
}: {
  agente: Agente;
  store: StoreSessoes;
  catalogo: Catalogo;
  /** Relógio, trocado nos testes para simular a validade do PIX. */
  agora?: () => number;
  logger?: FastifyServerOptions["logger"];
}): FastifyInstance {
  const app = Fastify({ logger });
  // Uma resposta por vez por sessão: duas mensagens simultâneas embaralhariam o histórico e o carrinho.
  const ocupadas = new Set<string>();

  app.get("/api/saude", async () => ({ ok: true }));

  /**
   * POST /api/chat { mensagem, sessaoId? } → text/event-stream com os eventos:
   * sessao { sessaoId } · texto { delta } · ferramenta { nome, argumentos, resultado, duracaoMs } · fim { texto } · erro { mensagem }
   */
  app.post("/api/chat", async (request, reply) => {
    const corpo = corpoChat.safeParse(request.body);
    if (!corpo.success) {
      return reply.code(400).send({ erro: `Envie { mensagem } com 1 a ${LIMITE_MENSAGEM} caracteres.` });
    }

    let sessao;
    try {
      sessao = store.obterOuCriar(corpo.data.sessaoId);
    } catch {
      return reply.code(400).send({ erro: "sessaoId inválido." });
    }
    if (ocupadas.has(sessao.id)) {
      return reply.code(409).send({ erro: "Aguarde a resposta anterior terminar." });
    }

    ocupadas.add(sessao.id);
    reply.hijack();
    const saida = reply.raw;
    saida.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const escrever = (texto: string) => {
      if (!saida.destroyed && !saida.writableEnded) saida.write(texto);
    };

    try {
      escrever(sse("sessao", { sessaoId: sessao.id }));
      // Mesmo se a cliente fechar a conexão, o turno vai até o fim: o histórico e o carrinho ficam consistentes.
      for await (const evento of agente.responder(sessao, corpo.data.mensagem)) {
        escrever(sse(evento.tipo, dadosDoEvento(evento)));
      }
    } catch (erro) {
      request.log.error(erro);
      escrever(sse("erro", { mensagem: "Tive um problema para responder agora. Pode tentar de novo?" }));
    } finally {
      ocupadas.delete(sessao.id);
      saida.end();
    }
  });

  // --- Checkout, PIX e pagamento pelo formulário. Passam pelas mesmas regras das ferramentas da Sofia. ---

  type Contexto = { sessao: EstadoSessao };
  /** Acha a conversa da URL e a reserva enquanto a ação roda; responde o erro e devolve null se não der. */
  function comSessao(
    sessaoId: string,
    reply: { code(c: number): { send(corpo: unknown): unknown } },
  ): Contexto | null {
    const sessao = store.obter(sessaoId);
    if (!sessao) {
      reply.code(404).send({ erro: "Conversa não encontrada.", motivo: "sessao_nao_encontrada" });
      return null;
    }
    if (ocupadas.has(sessao.id)) {
      reply.code(409).send({ erro: "Aguarde a resposta anterior terminar.", motivo: "sessao_ocupada" });
      return null;
    }
    return { sessao };
  }
  const recusar = (reply: { code(c: number): { send(corpo: unknown): unknown } }, falha: Falha) =>
    reply.code(statusDaFalha(falha.motivo)).send(falha);

  /** POST /api/sessoes/:sessaoId/checkout { nome, email, cep, endereco, numero, complemento?, modalidade_frete } → 201 { pedido } */
  app.post<{ Params: { sessaoId: string } }>("/api/sessoes/:sessaoId/checkout", async (request, reply) => {
    const contexto = comSessao(request.params.sessaoId, reply);
    if (!contexto) return reply;
    const dados = dadosCheckoutSchema.safeParse(request.body);
    if (!dados.success) return reply.code(400).send(erroDeValidacao(dados.error, request.body));

    const r = fecharPedido({ catalogo, sessao: contexto.sessao }, dados.data, agora());
    if (!r.ok) return recusar(reply, r);
    return reply.code(201).send({ pedido: visaoDoPedido(r.pedido, agora()) });
  });

  /** GET /api/sessoes/:sessaoId/pedidos/:pedidoId → { pedido, qr_svg? } */
  app.get<{ Params: { sessaoId: string; pedidoId: string } }>(
    "/api/sessoes/:sessaoId/pedidos/:pedidoId",
    async (request, reply) => {
      const sessao = store.obter(request.params.sessaoId);
      if (!sessao) return reply.code(404).send({ erro: "Conversa não encontrada.", motivo: "sessao_nao_encontrada" });
      const r = localizarPedido({ catalogo, sessao }, request.params.pedidoId, agora());
      if (!r.ok) return recusar(reply, r);
      const qr = r.pedido.pix ? { qr_svg: await gerarQrSvg(r.pedido.pix.texto) } : {};
      return { pedido: visaoDoPedido(r.pedido, agora()), ...qr };
    },
  );

  /** POST /api/sessoes/:sessaoId/pedidos/:pedidoId/pix → { pedido, qr_svg, reaproveitado }. Só gera outro depois de expirar. */
  app.post<{ Params: { sessaoId: string; pedidoId: string } }>(
    "/api/sessoes/:sessaoId/pedidos/:pedidoId/pix",
    async (request, reply) => {
      const contexto = comSessao(request.params.sessaoId, reply);
      if (!contexto) return reply;
      const r = emitirPix({ catalogo, sessao: contexto.sessao }, request.params.pedidoId, agora());
      if (!r.ok) return recusar(reply, r);
      return {
        pedido: visaoDoPedido(r.pedido, agora()),
        qr_svg: await gerarQrSvg(r.pedido.pix!.texto),
        reaproveitado: r.reaproveitado,
      };
    },
  );

  /** POST /api/sessoes/:sessaoId/pedidos/:pedidoId/pagar → { pedido, mensagem, ja_estava_pago }. "Simular pagamento". */
  app.post<{ Params: { sessaoId: string; pedidoId: string } }>(
    "/api/sessoes/:sessaoId/pedidos/:pedidoId/pagar",
    async (request, reply) => {
      const contexto = comSessao(request.params.sessaoId, reply);
      if (!contexto) return reply;
      const r = pagarPedido({ catalogo, sessao: contexto.sessao }, request.params.pedidoId, agora());
      if (!r.ok) return recusar(reply, r);
      return { pedido: visaoDoPedido(r.pedido, agora()), mensagem: r.mensagem, ja_estava_pago: r.jaEstavaPago };
    },
  );

  // --- Carrinho pela tela: Adicionar, + e − usam as mesmas regras das ferramentas da Sofia. ---

  const statusDaFerramenta = (r: ResultadoFerramenta): number =>
    r.campos ? 400 : r.motivo === "produto_nao_encontrado" || r.motivo === "item_ausente" ? 404 : 422;
  const corpoItem = z.object({ id: z.string().min(1), quantidade: z.number().int().positive().default(1) });

  /** GET /api/sessoes/:sessaoId/carrinho → { carrinho } com itens, subtotal, cupom e frete já calculados pelo servidor. */
  app.get<{ Params: { sessaoId: string } }>("/api/sessoes/:sessaoId/carrinho", async (request, reply) => {
    const sessao = store.obter(request.params.sessaoId);
    if (!sessao) return reply.code(404).send({ erro: "Conversa não encontrada.", motivo: "sessao_nao_encontrada" });
    return { carrinho: montarResumoCarrinho({ catalogo, sessao }) };
  });

  /** POST /api/sessoes/:sessaoId/carrinho/itens { id, quantidade? = 1 } → { mensagem, carrinho, aviso_cupom? } */
  app.post<{ Params: { sessaoId: string } }>("/api/sessoes/:sessaoId/carrinho/itens", async (request, reply) => {
    const contexto = comSessao(request.params.sessaoId, reply);
    if (!contexto) return reply;
    const corpo = corpoItem.safeParse(request.body);
    if (!corpo.success) return reply.code(400).send(erroDeValidacao(corpo.error, request.body));

    const ctx = { catalogo, sessao: contexto.sessao };
    const r = adicionarAoCarrinho.executar(corpo.data, ctx);
    if (!r.ok) return reply.code(statusDaFerramenta(r)).send(r);
    const nome = catalogo.obter(corpo.data.id.trim().toUpperCase())?.nome ?? corpo.data.id;
    contexto.sessao.avisosPendentes.push(
      `[aviso do sistema, não é fala da cliente] Ela adicionou ${corpo.data.quantidade}x ${nome} ao carrinho pelo botão da tela.`,
    );
    return r;
  });

  /** DELETE /api/sessoes/:sessaoId/carrinho/itens/:produtoId?quantidade=n → remove n unidades (sem n, o item inteiro). */
  app.delete<{ Params: { sessaoId: string; produtoId: string }; Querystring: { quantidade?: string } }>(
    "/api/sessoes/:sessaoId/carrinho/itens/:produtoId",
    async (request, reply) => {
      const contexto = comSessao(request.params.sessaoId, reply);
      if (!contexto) return reply;
      const quantidade = request.query.quantidade === undefined ? undefined : Number(request.query.quantidade);
      const ctx = { catalogo, sessao: contexto.sessao };
      const r = removerDoCarrinho.executar({ id: request.params.produtoId, quantidade }, ctx);
      if (!r.ok) return reply.code(statusDaFerramenta(r)).send(r);
      const nome = catalogo.obter(request.params.produtoId.trim().toUpperCase())?.nome ?? request.params.produtoId;
      contexto.sessao.avisosPendentes.push(
        `[aviso do sistema, não é fala da cliente] Ela removeu ${quantidade ?? "todas as unidades de"}${quantidade ? "x" : ""} ${nome} do carrinho pela tela.`,
      );
      return r;
    },
  );

  return app;
}
