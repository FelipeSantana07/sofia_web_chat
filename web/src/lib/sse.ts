// Leitor do stream de POST /api/chat (Server-Sent Events sobre fetch). Sem dependências.

export type EventoChat =
  | { tipo: "sessao"; sessaoId: string }
  | { tipo: "texto"; delta: string }
  | { tipo: "ferramenta"; nome: string; argumentos: unknown; resultado: Record<string, unknown>; duracaoMs: number }
  | { tipo: "fim"; texto: string }
  | { tipo: "erro"; mensagem: string };

const TIPOS = new Set(["sessao", "texto", "ferramenta", "fim", "erro"]);

/** Converte um bloco `event: x\ndata: {...}` em evento; devolve null se não for um evento conhecido e válido. */
function interpretarBloco(bloco: string): EventoChat | null {
  let tipo = "";
  const dados: string[] = [];
  for (const linha of bloco.split("\n")) {
    if (linha.startsWith("event:")) tipo = linha.slice(6).trim();
    else if (linha.startsWith("data:")) dados.push(linha.slice(5).replace(/^ /, ""));
  }
  if (!TIPOS.has(tipo) || dados.length === 0) return null;
  try {
    return { tipo, ...(JSON.parse(dados.join("\n")) as object) } as EventoChat;
  } catch {
    return null;
  }
}

/** Acumula texto recebido aos pedaços e devolve os eventos que já chegaram completos. */
export function criarInterpretador(): { empurrar(texto: string): EventoChat[] } {
  let resto = "";
  return {
    empurrar(texto) {
      resto = (resto + texto).replace(/\r\n/g, "\n");
      const blocos = resto.split("\n\n");
      resto = blocos.pop() ?? ""; // o último pode estar cortado no meio
      return blocos.flatMap((b) => {
        const evento = interpretarBloco(b);
        return evento ? [evento] : [];
      });
    },
  };
}

/** Lê o corpo da resposta e entrega os eventos à medida que chegam. */
export async function* lerEventos(corpo: ReadableStream<Uint8Array>): AsyncGenerator<EventoChat> {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder(); // `stream: true` junta caracteres UTF-8 divididos entre pedaços
  const interpretador = criarInterpretador();
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      yield* interpretador.empurrar(decodificador.decode(value, { stream: true }));
    }
    yield* interpretador.empurrar(`${decodificador.decode()}\n\n`);
  } finally {
    leitor.releaseLock();
  }
}
