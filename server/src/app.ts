import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { z } from "zod";
import type { Agente, EventoAgente } from "./agent/agente.js";
import type { StoreSessoes } from "./sessao/store.js";

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

export function criarApp({
  agente,
  store,
  logger = false,
}: {
  agente: Agente;
  store: StoreSessoes;
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

  return app;
}
