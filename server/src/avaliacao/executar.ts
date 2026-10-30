import { montarSofia } from "../agent/montar.js";
import { criarRegistroArquivo } from "../agent/registro-log.js";
import { carregarCatalogo, type Catalogo } from "../catalogo/catalogo.js";
import type { ConfigGemini } from "../config.js";
import { criarStoreSessoes, type EstadoSessao } from "../sessao/store.js";
import type { Roteiro, TurnoRegistrado } from "./tipos.js";

export interface ExecucaoDeRoteiro {
  turnos: TurnoRegistrado[];
  /** Mantidos para quem precisa continuar a conversa (ex.: simular o pagamento do pedido). */
  catalogo: Catalogo;
  sessao: EstadoSessao;
}

/**
 * Roda um roteiro contra o Gemini real, numa conversa nova. O catálogo é novo e só em memória: cada
 * roteiro parte do estoque inicial e não mexe no data/estoque.json.
 */
export async function executarRoteiro(config: ConfigGemini, roteiro: Pick<Roteiro, "mensagens">): Promise<ExecucaoDeRoteiro> {
  const catalogo = carregarCatalogo(undefined, null);
  const agente = montarSofia({ ...config, catalogo, registro: criarRegistroArquivo() });
  const sessao = criarStoreSessoes().obterOuCriar();
  const turnos: TurnoRegistrado[] = [];

  for (const mensagem of roteiro.mensagens) {
    const inicio = Date.now();
    const turno: TurnoRegistrado = { cliente: mensagem, sofia: "", ferramentas: [], primeiroTextoMs: null, duracaoMs: 0 };
    for await (const evento of agente.responder(sessao, mensagem)) {
      if (evento.tipo === "texto") {
        turno.primeiroTextoMs ??= Date.now() - inicio;
      } else if (evento.tipo === "ferramenta") {
        const { nome, argumentos, resultado, duracaoMs } = evento;
        turno.ferramentas.push({ nome, argumentos, resultado, duracaoMs });
      } else if (evento.tipo === "fim") {
        turno.sofia = evento.texto;
      } else if (evento.tipo === "erro") {
        turno.erro = evento.mensagem;
        turno.sofia ||= evento.mensagem;
      }
    }
    turno.duracaoMs = Date.now() - inicio;
    turnos.push(turno);
  }
  return { turnos, catalogo, sessao };
}
