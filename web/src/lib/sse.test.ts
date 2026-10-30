import { describe, expect, it } from "vitest";
import { criarInterpretador, lerEventos, type EventoChat } from "./sse.js";

const bloco = (evento: string, dados: unknown) => `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;

function stream(...pedacos: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const codificador = new TextEncoder();
  return new ReadableStream({
    start(controle) {
      for (const p of pedacos) controle.enqueue(typeof p === "string" ? codificador.encode(p) : p);
      controle.close();
    },
  });
}

async function coletar(corpo: ReadableStream<Uint8Array>): Promise<EventoChat[]> {
  const eventos: EventoChat[] = [];
  for await (const e of lerEventos(corpo)) eventos.push(e);
  return eventos;
}

describe("criarInterpretador", () => {
  it("lê um evento completo", () => {
    const i = criarInterpretador();
    expect(i.empurrar(bloco("texto", { delta: "Oi" }))).toEqual([{ tipo: "texto", delta: "Oi" }]);
  });

  it("lê vários eventos que chegaram juntos", () => {
    const i = criarInterpretador();
    const eventos = i.empurrar(bloco("sessao", { sessaoId: "s-1" }) + bloco("texto", { delta: "a" }) + bloco("fim", { texto: "a" }));
    expect(eventos.map((e) => e.tipo)).toEqual(["sessao", "texto", "fim"]);
  });

  it("espera o resto de um evento cortado no meio", () => {
    const i = criarInterpretador();
    const inteiro = bloco("texto", { delta: "Olá, tudo bem?" });
    expect(i.empurrar(inteiro.slice(0, 20))).toEqual([]);
    expect(i.empurrar(inteiro.slice(20))).toEqual([{ tipo: "texto", delta: "Olá, tudo bem?" }]);
  });

  it("aceita fim de linha CRLF", () => {
    const i = criarInterpretador();
    expect(i.empurrar(bloco("texto", { delta: "x" }).replace(/\n/g, "\r\n"))).toEqual([{ tipo: "texto", delta: "x" }]);
  });

  it("traz os dados da ferramenta", () => {
    const i = criarInterpretador();
    const dados = { nome: "ver_carrinho", argumentos: {}, resultado: { ok: true }, duracaoMs: 3 };
    expect(i.empurrar(bloco("ferramenta", dados))).toEqual([{ tipo: "ferramenta", ...dados }]);
  });

  it("ignora eventos desconhecidos, comentários e dados que não são JSON", () => {
    const i = criarInterpretador();
    const lixo = `: keep-alive\n\nevent: outro\ndata: {"a":1}\n\nevent: texto\ndata: {quebrado\n\n`;
    expect(i.empurrar(lixo + bloco("texto", { delta: "ok" }))).toEqual([{ tipo: "texto", delta: "ok" }]);
  });
});

describe("lerEventos", () => {
  it("entrega os eventos de um stream", async () => {
    const eventos = await coletar(stream(bloco("sessao", { sessaoId: "a" }), bloco("texto", { delta: "Oi" }), bloco("fim", { texto: "Oi" })));
    expect(eventos).toEqual([
      { tipo: "sessao", sessaoId: "a" },
      { tipo: "texto", delta: "Oi" },
      { tipo: "fim", texto: "Oi" },
    ]);
  });

  it("junta um caractere UTF-8 dividido entre dois pedaços", async () => {
    const bytes = new TextEncoder().encode(bloco("texto", { delta: "Cabelo ressecado, fios finos é ótimo 💜" }));
    const corte = bytes.indexOf(0xc3) + 1; // no meio de um "é" ou "ó" de 2 bytes
    const eventos = await coletar(stream(bytes.slice(0, corte), bytes.slice(corte)));
    expect(eventos).toEqual([{ tipo: "texto", delta: "Cabelo ressecado, fios finos é ótimo 💜" }]);
  });

  it("aproveita um último evento sem a linha em branco final", async () => {
    const eventos = await coletar(stream(`event: fim\ndata: {"texto":"tchau"}\n`));
    expect(eventos).toEqual([{ tipo: "fim", texto: "tchau" }]);
  });
});
