import type { Content, Part } from "@google/genai";
import type { Catalogo } from "../catalogo/catalogo.js";
import type { EstadoSessao } from "../sessao/store.js";
import type { ResultadoFerramenta } from "../tools/base.js";
import type { Despachante } from "../tools/registro.js";
import type { ModeloChat } from "./modelo.js";
import type { Registro } from "./registro-log.js";

/** Eventos de um turno, na ordem em que acontecem. A rota /api/chat e a CLI repassam esses eventos. */
export type EventoAgente =
  | { tipo: "texto"; delta: string }
  | { tipo: "ferramenta"; nome: string; argumentos: unknown; resultado: ResultadoFerramenta; duracaoMs: number }
  | { tipo: "fim"; texto: string }
  | { tipo: "erro"; mensagem: string };

export interface DependenciasAgente {
  modelo: ModeloChat;
  despachante: Despachante;
  catalogo: Catalogo;
  promptSistema: string;
  registro?: Registro;
  /** Máximo de chamadas ao modelo por mensagem da cliente (cada rodada pode executar várias ferramentas). */
  maxRodadas?: number;
}

export interface Agente {
  responder(sessao: EstadoSessao, mensagem: string): AsyncGenerator<EventoAgente>;
}

export const MAX_RODADAS_PADRAO = 8;

export const MENSAGEM_LIMITE =
  "Desculpe, me enrolei aqui e não consegui concluir agora. Pode me dizer de novo o que você precisa?";
export const MENSAGEM_VAZIA = "Desculpe, não consegui responder. Pode reformular a sua mensagem?";
export const MENSAGEM_ERRO = "Tive um problema para responder agora. Pode tentar de novo em instantes?";

export function criarAgente({
  modelo,
  despachante,
  catalogo,
  promptSistema,
  registro = { registrar: () => {} },
  maxRodadas = MAX_RODADAS_PADRAO,
}: DependenciasAgente): Agente {
  return {
    async *responder(sessao, mensagem) {
      const ctx = { catalogo, sessao };
      // Ações feitas na tela desde a última mensagem (botão Adicionar etc.) entram junto desta, como avisos do sistema.
      const avisos = sessao.avisosPendentes.splice(0);
      const textoDoTurno = avisos.length > 0 ? `${avisos.join("\n")}\n\n${mensagem}` : mensagem;
      // O turno só entra no histórico da sessão quando termina: um erro no meio não deixa o histórico pela metade.
      const turno: Content[] = [{ role: "user", parts: [{ text: textoDoTurno }] }];
      registro.registrar({ sessao: sessao.id, tipo: "mensagem_cliente", texto: mensagem });

      let resposta = "";
      const emitirTexto = function* (texto: string, novaRodada: boolean): Generator<EventoAgente> {
        // Texto de uma rodada nova (depois de ferramentas) vira um parágrafo novo.
        const delta = novaRodada && resposta.length > 0 ? `\n\n${texto}` : texto;
        resposta += delta;
        yield { tipo: "texto", delta };
      };

      try {
        for (let rodada = 1; rodada <= maxRodadas; rodada++) {
          const partes: Part[] = [];
          let primeiroTextoDaRodada = true;

          for await (const pedaco of modelo.gerar({
            historico: [...sessao.historico, ...turno],
            instrucaoSistema: promptSistema,
            ferramentas: despachante.declaracoes,
          })) {
            for (const parte of pedaco) {
              partes.push(parte); // guarda tudo como veio, inclusive pensamentos e assinaturas
              if (parte.text && !parte.thought) {
                yield* emitirTexto(parte.text, primeiroTextoDaRodada);
                primeiroTextoDaRodada = false;
              }
            }
          }
          turno.push({ role: "model", parts: partes });

          const chamadas = partes.flatMap((p) => (p.functionCall ? [p.functionCall] : []));
          if (chamadas.length === 0) {
            if (resposta.trim() === "") {
              yield* emitirTexto(MENSAGEM_VAZIA, false);
              turno.push({ role: "model", parts: [{ text: MENSAGEM_VAZIA }] });
            }
            sessao.historico.push(...turno);
            registro.registrar({ sessao: sessao.id, tipo: "resposta_sofia", texto: resposta, rodadas: rodada });
            yield { tipo: "fim", texto: resposta };
            return;
          }

          // O modelo pode pedir várias ferramentas de uma vez: executa na ordem e responde todas juntas.
          const respostas: Part[] = [];
          for (const chamada of chamadas) {
            const nome = chamada.name ?? "";
            const argumentos = chamada.args ?? {};
            const inicio = Date.now();
            const resultado = despachante.executar(nome, argumentos, ctx);
            const duracaoMs = Date.now() - inicio;

            registro.registrar({ sessao: sessao.id, tipo: "ferramenta", nome, argumentos, resultado, duracao_ms: duracaoMs });
            yield { tipo: "ferramenta", nome, argumentos, resultado, duracaoMs };
            respostas.push({
              functionResponse: { ...(chamada.id ? { id: chamada.id } : {}), name: nome, response: resultado },
            });
          }
          turno.push({ role: "user", parts: respostas });
        }

        // Limite de rodadas: encerra o turno com uma mensagem honesta, sem inventar resultado.
        registro.registrar({ sessao: sessao.id, tipo: "limite_de_rodadas", max_rodadas: maxRodadas });
        yield* emitirTexto(MENSAGEM_LIMITE, true);
        turno.push({ role: "model", parts: [{ text: MENSAGEM_LIMITE }] });
        sessao.historico.push(...turno);
        registro.registrar({ sessao: sessao.id, tipo: "resposta_sofia", texto: resposta, rodadas: maxRodadas });
        yield { tipo: "fim", texto: resposta };
      } catch (erro) {
        sessao.avisosPendentes.unshift(...avisos); // o turno foi descartado: os avisos ficam para a próxima tentativa
        registro.registrar({
          sessao: sessao.id,
          tipo: "erro",
          mensagem: erro instanceof Error ? erro.message : String(erro),
        });
        yield { tipo: "erro", mensagem: MENSAGEM_ERRO };
      }
    },
  };
}
