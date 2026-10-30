import type { Part } from "@google/genai";
import { describe, expect, it } from "vitest";
import { criarAgente, type Agente, type EventoAgente } from "./agent/agente.js";
import type { ModeloChat } from "./agent/modelo.js";
import { criarApp } from "./app.js";
import { criarStoreSessoes } from "./sessao/store.js";
import { criarDespachante } from "./tools/registro.js";
import { contextoDeTeste } from "./tools/teste-util.js";

/** Lê um corpo text/event-stream e devolve [{ evento, dados }]. */
function lerSSE(corpo: string): { evento: string; dados: any }[] {
  return corpo
    .split("\n\n")
    .filter((bloco) => bloco.trim() !== "")
    .map((bloco) => {
      const evento = /^event: (.+)$/m.exec(bloco)?.[1] ?? "";
      const dados = JSON.parse(/^data: (.+)$/m.exec(bloco)?.[1] ?? "null");
      return { evento, dados };
    });
}

/** Agente falso: devolve os eventos dados e lembra o que recebeu. */
function agenteFalso(eventos: EventoAgente[], antesDeTerminar?: Promise<void>) {
  const chamadas: { sessaoId: string; mensagem: string }[] = [];
  const agente: Agente = {
    async *responder(sessao, mensagem) {
      chamadas.push({ sessaoId: sessao.id, mensagem });
      for (const e of eventos) yield e;
      if (antesDeTerminar) await antesDeTerminar;
    },
  };
  return { agente, chamadas };
}

const RESPOSTA: EventoAgente[] = [
  { tipo: "texto", delta: "Oi! " },
  { tipo: "texto", delta: "Sou a Sofia." },
  { tipo: "fim", texto: "Oi! Sou a Sofia." },
];

describe("POST /api/chat", () => {
  it("transmite a resposta em Server-Sent Events, começando pela sessão", async () => {
    const { agente } = agenteFalso(RESPOSTA);
    const app = criarApp({ agente, store: criarStoreSessoes({ gerarId: () => "s-1" }) });
    const r = await app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "oi" } });

    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(lerSSE(r.body)).toEqual([
      { evento: "sessao", dados: { sessaoId: "s-1" } },
      { evento: "texto", dados: { delta: "Oi! " } },
      { evento: "texto", dados: { delta: "Sou a Sofia." } },
      { evento: "fim", dados: { texto: "Oi! Sou a Sofia." } },
    ]);
  });

  it("reaproveita a sessão quando o cliente manda o sessaoId", async () => {
    const { agente, chamadas } = agenteFalso(RESPOSTA);
    const store = criarStoreSessoes();
    const app = criarApp({ agente, store });
    const primeira = lerSSE((await app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "oi" } })).body);
    const sessaoId = primeira[0]!.dados.sessaoId as string;
    await app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "de novo", sessaoId } });

    expect(chamadas.map((c) => c.sessaoId)).toEqual([sessaoId, sessaoId]);
    expect(store.tamanho()).toBe(1);
  });

  it("emite as ferramentas chamadas, com argumentos e resultado (painel de debug)", async () => {
    // agente real com modelo roteirizado: chama adicionar_ao_carrinho e depois responde
    const roteiro: Part[][] = [
      [{ functionCall: { name: "adicionar_ao_carrinho", args: { id: "PH-001", quantidade: 1 } } }],
      [{ text: "Adicionei!" }],
    ];
    let rodada = 0;
    const modelo: ModeloChat = {
      async *gerar() {
        yield roteiro[rodada++]!;
      },
    };
    const { catalogo } = contextoDeTeste();
    const agente = criarAgente({ modelo, despachante: criarDespachante(), catalogo, promptSistema: "teste" });
    const app = criarApp({ agente, store: criarStoreSessoes() });

    const eventos = lerSSE((await app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "quero 1" } })).body);
    expect(eventos.map((e) => e.evento)).toEqual(["sessao", "ferramenta", "texto", "fim"]);
    expect(eventos[1]!.dados).toMatchObject({
      nome: "adicionar_ao_carrinho",
      argumentos: { id: "PH-001", quantidade: 1 },
      resultado: { ok: true, carrinho: { itens: [{ id: "PH-001", quantidade: 1 }] } },
      duracaoMs: expect.any(Number),
    });
  });

  it("repassa o evento de erro do agente", async () => {
    const { agente } = agenteFalso([{ tipo: "erro", mensagem: "Tive um problema." }]);
    const app = criarApp({ agente, store: criarStoreSessoes() });
    const eventos = lerSSE((await app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "oi" } })).body);
    expect(eventos.at(-1)).toEqual({ evento: "erro", dados: { mensagem: "Tive um problema." } });
  });

  it("exceção inesperada no agente vira evento de erro e fecha o stream", async () => {
    const agente: Agente = {
      // eslint-disable-next-line require-yield
      async *responder() {
        throw new Error("bug");
      },
    };
    const app = criarApp({ agente, store: criarStoreSessoes() });
    const r = await app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "oi" } });
    expect(lerSSE(r.body).at(-1)?.evento).toBe("erro");
  });

  it.each<[Record<string, unknown>, string]>([
    [{}, "sem mensagem"],
    [{ mensagem: "   " }, "mensagem vazia"],
    [{ mensagem: 123 }, "mensagem não é texto"],
    [{ mensagem: "x".repeat(2001) }, "mensagem longa demais"],
  ])("recusa corpo inválido (%s: %s) com 400", async (payload) => {
    const { agente, chamadas } = agenteFalso(RESPOSTA);
    const app = criarApp({ agente, store: criarStoreSessoes() });
    const r = await app.inject({ method: "POST", url: "/api/chat", payload });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toMatch(/mensagem/);
    expect(chamadas).toEqual([]);
  });

  it("recusa sessaoId com caracteres inválidos", async () => {
    const { agente } = agenteFalso(RESPOSTA);
    const app = criarApp({ agente, store: criarStoreSessoes() });
    const r = await app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "oi", sessaoId: "../x" } });
    expect(r.statusCode).toBe(400);
  });

  it("recusa uma segunda mensagem da mesma sessão enquanto a primeira responde (409)", async () => {
    let liberar!: () => void;
    const espera = new Promise<void>((resolve) => (liberar = resolve));
    const { agente } = agenteFalso(RESPOSTA, espera);
    const app = criarApp({ agente, store: criarStoreSessoes() });

    const primeira = app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "oi", sessaoId: "s-1" } });
    await new Promise((r) => setTimeout(r, 20));
    const segunda = await app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "oi?", sessaoId: "s-1" } });
    expect(segunda.statusCode).toBe(409);

    liberar();
    expect((await primeira).statusCode).toBe(200);
    // depois que termina, a sessão volta a aceitar mensagens
    liberar();
    const terceira = await app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "e agora?", sessaoId: "s-1" } });
    expect(terceira.statusCode).toBe(200);
  });

  it("sessões diferentes respondem em paralelo", async () => {
    let liberar!: () => void;
    const espera = new Promise<void>((resolve) => (liberar = resolve));
    const { agente } = agenteFalso(RESPOSTA, espera);
    const app = criarApp({ agente, store: criarStoreSessoes() });
    const a = app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "oi", sessaoId: "a" } });
    await new Promise((r) => setTimeout(r, 20));
    const b = app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "oi", sessaoId: "b" } });
    liberar();
    expect((await a).statusCode).toBe(200);
    expect((await b).statusCode).toBe(200);
  });
});

describe("GET /api/saude", () => {
  it("responde ok", async () => {
    const app = criarApp({ agente: agenteFalso([]).agente, store: criarStoreSessoes() });
    expect((await app.inject({ method: "GET", url: "/api/saude" })).json()).toEqual({ ok: true });
  });
});
