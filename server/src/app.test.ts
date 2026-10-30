import type { Part } from "@google/genai";
import { describe, expect, it } from "vitest";
import { criarAgente, type Agente, type EventoAgente } from "./agent/agente.js";
import type { ModeloChat } from "./agent/modelo.js";
import { criarApp } from "./app.js";
import { criarStoreSessoes } from "./sessao/store.js";
import { criarDespachante } from "./tools/registro.js";
import { criarCatalogo } from "./catalogo/catalogo.js";
import { adicionarAoCarrinho, aplicarCupom, calcularFrete } from "./tools/carrinho-frete.js";
import { finalizarPedido } from "./tools/pedido.js";
import { PRODUTOS_DE_TESTE, contextoDeTeste } from "./tools/teste-util.js";

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
    const app = criarApp({ catalogo: criarCatalogo(PRODUTOS_DE_TESTE), agente, store: criarStoreSessoes({ gerarId: () => "s-1" }) });
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
    const app = criarApp({ catalogo: criarCatalogo(PRODUTOS_DE_TESTE), agente, store });
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
    const app = criarApp({ catalogo: criarCatalogo(PRODUTOS_DE_TESTE), agente, store: criarStoreSessoes() });

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
    const app = criarApp({ catalogo: criarCatalogo(PRODUTOS_DE_TESTE), agente, store: criarStoreSessoes() });
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
    const app = criarApp({ catalogo: criarCatalogo(PRODUTOS_DE_TESTE), agente, store: criarStoreSessoes() });
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
    const app = criarApp({ catalogo: criarCatalogo(PRODUTOS_DE_TESTE), agente, store: criarStoreSessoes() });
    const r = await app.inject({ method: "POST", url: "/api/chat", payload });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toMatch(/mensagem/);
    expect(chamadas).toEqual([]);
  });

  it("recusa sessaoId com caracteres inválidos", async () => {
    const { agente } = agenteFalso(RESPOSTA);
    const app = criarApp({ catalogo: criarCatalogo(PRODUTOS_DE_TESTE), agente, store: criarStoreSessoes() });
    const r = await app.inject({ method: "POST", url: "/api/chat", payload: { mensagem: "oi", sessaoId: "../x" } });
    expect(r.statusCode).toBe(400);
  });

  it("recusa uma segunda mensagem da mesma sessão enquanto a primeira responde (409)", async () => {
    let liberar!: () => void;
    const espera = new Promise<void>((resolve) => (liberar = resolve));
    const { agente } = agenteFalso(RESPOSTA, espera);
    const app = criarApp({ catalogo: criarCatalogo(PRODUTOS_DE_TESTE), agente, store: criarStoreSessoes() });

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
    const app = criarApp({ catalogo: criarCatalogo(PRODUTOS_DE_TESTE), agente, store: criarStoreSessoes() });
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
    const app = criarApp({ catalogo: criarCatalogo(PRODUTOS_DE_TESTE), agente: agenteFalso([]).agente, store: criarStoreSessoes() });
    expect((await app.inject({ method: "GET", url: "/api/saude" })).json()).toEqual({ ok: true });
  });
});

describe("checkout, PIX e pagamento pelo formulário", () => {
  const DADOS = {
    nome: "Ana Souza",
    email: "ana@teste.com",
    cep: "01310-100",
    endereco: "Av. Teste",
    numero: "100",
    modalidade_frete: "economica",
  };

  function montar() {
    let agora = 1_700_000_000_000;
    const catalogo = criarCatalogo(PRODUTOS_DE_TESTE, undefined, () => agora);
    const store = criarStoreSessoes();
    const app = criarApp({ catalogo, agente: agenteFalso([]).agente, store, agora: () => agora });
    const comCarrinho = (id: string) => {
      const sessao = store.obterOuCriar(id);
      const ctx = { catalogo, sessao };
      adicionarAoCarrinho.executar({ id: "PH-001", quantidade: 3 }, ctx);
      aplicarCupom.executar({ codigo: "PROHALL10" }, ctx);
      calcularFrete.executar({ cep: "01310-100" }, ctx);
      return ctx;
    };
    const post = (url: string, payload?: unknown) => app.inject({ method: "POST", url, payload: payload as never });
    return { app, store, catalogo, comCarrinho, post, avancar: (ms: number) => (agora += ms) };
  }

  it("cria o pedido pelo formulário e esvazia o carrinho", async () => {
    const { comCarrinho, post } = montar();
    const ctx = comCarrinho("s1");
    const r = await post("/api/sessoes/s1/checkout", DADOS);

    expect(r.statusCode).toBe(201);
    expect(r.json().pedido).toMatchObject({ id: "PH-TESTE-000001", status: "aguardando_pagamento", cupom: "PROHALL10" });
    expect(ctx.sessao.carrinho.itens).toEqual([]);
    expect(ctx.catalogo.obter("PH-001")?.estoque_teste).toBe(9);
  });

  it("avisa a Sofia quando a cliente fecha o pedido e gera o PIX pela tela, sem repetir o aviso do PIX que já vale", async () => {
    const { comCarrinho, post, store } = montar();
    comCarrinho("s1");
    await post("/api/sessoes/s1/checkout", DADOS);
    await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pix");
    await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pix");
    const avisos = store.obter("s1")!.avisosPendentes;
    expect(avisos).toHaveLength(2);
    expect(avisos[0]).toMatch(/fechou o pedido PH-TESTE-000001 pelo formulário/);
    expect(avisos[1]).toMatch(/PIX do pedido PH-TESTE-000001/);
  });

  it("formulário e conversa chegam ao mesmo pedido", async () => {
    const { comCarrinho, post, store } = montar();
    comCarrinho("form");
    const ctxConversa = comCarrinho("chat");
    const pelaRota = (await post("/api/sessoes/form/checkout", DADOS)).json().pedido;
    const peloTool = finalizarPedido.executar(DADOS, ctxConversa) as unknown as { pedido: typeof pelaRota };

    const { id: _a, criado_em: _b, ...rota } = pelaRota;
    const { id: _c, criado_em: _d, ...conversa } = peloTool.pedido;
    expect(rota).toEqual(conversa);
    expect(store.obter("form")?.pedidos).toHaveLength(1);
  });

  it("recusa conversa inexistente, dados inválidos, carrinho vazio e CEP inválido", async () => {
    const { comCarrinho, post, store } = montar();
    expect((await post("/api/sessoes/nao-existe/checkout", DADOS)).statusCode).toBe(404);

    comCarrinho("s1");
    const invalido = await post("/api/sessoes/s1/checkout", { ...DADOS, email: "x", modalidade_frete: "sedex" });
    expect(invalido.statusCode).toBe(400);
    expect(invalido.json().campos.map((c: { campo: string }) => c.campo).sort()).toEqual(["email", "modalidade_frete"]);

    expect((await post("/api/sessoes/s1/checkout", { ...DADOS, cep: "1" })).json().motivo).toBe("cep_invalido");
    store.obterOuCriar("vazia");
    const vazio = await post("/api/sessoes/vazia/checkout", DADOS);
    expect(vazio.statusCode).toBe(422);
    expect(vazio.json().motivo).toBe("carrinho_vazio");
  });

  it("gera o PIX com QR Code no servidor, reaproveita enquanto vale e gera outro depois de expirar", async () => {
    const { app, comCarrinho, post, avancar } = montar();
    comCarrinho("s1");
    await post("/api/sessoes/s1/checkout", DADOS);

    const primeiro = (await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pix")).json();
    expect(primeiro.qr_svg).toContain("<svg");
    expect(primeiro.reaproveitado).toBe(false);
    expect(primeiro.pedido.pix).toMatchObject({ status: "ativo", segundos_restantes: 900 });
    expect(primeiro.pedido.pix.copia_e_cola).toMatch(/^PIX-TESTE\|PROHALL\|PH-TESTE-000001\|.+\|NAO-PAGAVEL$/);

    avancar(5 * 60_000);
    const mesmo = (await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pix")).json();
    expect(mesmo.reaproveitado).toBe(true);
    expect(mesmo.pedido.pix.segundos_restantes).toBe(600);

    avancar(10 * 60_000); // completa 15 minutos
    const get = (await app.inject({ method: "GET", url: "/api/sessoes/s1/pedidos/PH-TESTE-000001" })).json();
    expect(get.pedido.pix.status).toBe("expirado");
    expect(get.qr_svg).toContain("<svg"); // o QR continua disponível para a tela

    const novo = (await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pix")).json();
    expect(novo.reaproveitado).toBe(false);
    expect(novo.pedido.pix).toMatchObject({ status: "ativo", segundos_restantes: 900 });
  });

  it("devolve o estoque do pedido que não foi pago até o PIX expirar", async () => {
    const { comCarrinho, post, catalogo, avancar } = montar();
    comCarrinho("s1");
    await post("/api/sessoes/s1/checkout", DADOS);
    await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pix");
    expect(catalogo.obter("PH-001")?.estoque_teste).toBe(9);

    avancar(15 * 60_000);
    expect(catalogo.obter("PH-001")?.estoque_teste).toBe(12);
  });

  it("simula o pagamento e devolve a confirmação da Sofia; pagar de novo não repete", async () => {
    const { comCarrinho, post, store } = montar();
    comCarrinho("s1");
    await post("/api/sessoes/s1/checkout", DADOS);
    await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pix");

    const r = await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pagar");
    expect(r.statusCode).toBe(200);
    expect(r.json().pedido.status).toBe("pago");
    expect(r.json().pedido.pix.status).toBe("pago");
    expect(r.json().mensagem).toContain("PH-TESTE-000001");
    expect(r.json().ja_estava_pago).toBe(false);
    expect(store.obter("s1")?.historico).toHaveLength(2);

    const de_novo = (await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pagar")).json();
    expect(de_novo.ja_estava_pago).toBe(true);
    expect(store.obter("s1")?.historico).toHaveLength(2);
  });

  it("recusa pagar sem PIX ou com PIX expirado", async () => {
    const { comCarrinho, post, avancar } = montar();
    comCarrinho("s1");
    await post("/api/sessoes/s1/checkout", DADOS);

    const semPix = await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pagar");
    expect([semPix.statusCode, semPix.json().motivo]).toEqual([409, "sem_pix"]);

    await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pix");
    avancar(15 * 60_000);
    const expirado = await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pagar");
    expect([expirado.statusCode, expirado.json().motivo]).toEqual([409, "pix_expirado"]);
  });

  it("responde 404 para pedido inexistente e 409 para PIX de pedido pago", async () => {
    const { comCarrinho, post } = montar();
    comCarrinho("s1");
    await post("/api/sessoes/s1/checkout", DADOS);
    expect((await post("/api/sessoes/s1/pedidos/PH-TESTE-000099/pix")).statusCode).toBe(404);

    await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pix");
    await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pagar");
    const outroPix = await post("/api/sessoes/s1/pedidos/PH-TESTE-000001/pix");
    expect([outroPix.statusCode, outroPix.json().motivo]).toEqual([409, "pedido_ja_pago"]);
  });
});

describe("carrinho pela tela", () => {
  function montar() {
    const catalogo = criarCatalogo(PRODUTOS_DE_TESTE);
    const store = criarStoreSessoes();
    const app = criarApp({ catalogo, agente: agenteFalso([]).agente, store });
    const sessao = store.obterOuCriar("s1");
    const post = (url: string, payload?: unknown) => app.inject({ method: "POST", url, payload: payload as never });
    return { app, sessao, post, catalogo };
  }

  it("adiciona, soma e mostra o carrinho calculado pelo servidor", async () => {
    const { app, post } = montar();
    await post("/api/sessoes/s1/carrinho/itens", { id: "PH-001" });
    const r = await post("/api/sessoes/s1/carrinho/itens", { id: "PH-001", quantidade: 2 });

    expect(r.statusCode).toBe(200);
    expect(r.json().carrinho.itens).toMatchObject([{ id: "PH-001", quantidade: 3 }]);
    expect(r.json().carrinho.subtotal.texto).toBe("R$ 300,00");

    const get = (await app.inject({ method: "GET", url: "/api/sessoes/s1/carrinho" })).json();
    expect(get.carrinho.itens[0].quantidade).toBe(3);
  });

  it("aplica as regras de estoque e limite e devolve o motivo", async () => {
    const { post } = montar();
    const sobra = await post("/api/sessoes/s1/carrinho/itens", { id: "PH-002", quantidade: 3 }); // estoque 2
    expect([sobra.statusCode, sobra.json().motivo]).toEqual([422, "estoque_insuficiente"]);
    expect(sobra.json().pode_adicionar_ate).toBe(2);

    const inexistente = await post("/api/sessoes/s1/carrinho/itens", { id: "PH-999" });
    expect(inexistente.statusCode).toBe(404);
    expect((await post("/api/sessoes/s1/carrinho/itens", { id: "PH-001", quantidade: 0 })).statusCode).toBe(400);
  });

  it("remove parte ou tudo, e 404 para item que não está no carrinho", async () => {
    const { app, post, sessao } = montar();
    await post("/api/sessoes/s1/carrinho/itens", { id: "PH-001", quantidade: 3 });

    const parte = await app.inject({ method: "DELETE", url: "/api/sessoes/s1/carrinho/itens/PH-001?quantidade=1" });
    expect(parte.json().carrinho.itens[0].quantidade).toBe(2);
    const tudo = await app.inject({ method: "DELETE", url: "/api/sessoes/s1/carrinho/itens/PH-001" });
    expect(tudo.json().carrinho.vazio).toBe(true);
    expect(sessao.carrinho.itens).toEqual([]);

    const ausente = await app.inject({ method: "DELETE", url: "/api/sessoes/s1/carrinho/itens/PH-001" });
    expect(ausente.statusCode).toBe(404);
  });

  it("recusa conversa inexistente", async () => {
    const { app, post } = montar();
    expect((await post("/api/sessoes/x/carrinho/itens", { id: "PH-001" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/sessoes/x/carrinho" })).statusCode).toBe(404);
  });

  it("deixa avisos para a Sofia saber o que a cliente fez na tela", async () => {
    const { app, post, sessao } = montar();
    await post("/api/sessoes/s1/carrinho/itens", { id: "PH-001", quantidade: 2 });
    await app.inject({ method: "DELETE", url: "/api/sessoes/s1/carrinho/itens/PH-001?quantidade=1" });
    expect(sessao.avisosPendentes).toHaveLength(2);
    expect(sessao.avisosPendentes[0]).toMatch(/adicionou 2x Shampoo Antifrizz/);
    expect(sessao.avisosPendentes[1]).toMatch(/removeu 1x Shampoo Antifrizz/);
  });

  it("calcula o frete de um CEP pela tela e guarda o CEP na conversa", async () => {
    const { app, post } = montar();
    await post("/api/sessoes/s1/carrinho/itens", { id: "PH-001" });
    const r = await post("/api/sessoes/s1/frete", { cep: "01310-100" });
    expect(r.statusCode).toBe(200);
    expect(r.json().opcoes.map((o: { modalidade: string }) => o.modalidade)).toEqual(["economica", "expressa"]);

    const carrinho = (await app.inject({ method: "GET", url: "/api/sessoes/s1/carrinho" })).json().carrinho;
    expect(carrinho.entrega.cep).toBe("01310100");
    expect((await post("/api/sessoes/s1/frete", { cep: "12" })).json().motivo).toBe("cep_invalido");
    expect((await post("/api/sessoes/s1/frete", {})).statusCode).toBe(400);
  });

  it("aplica o cupom pela tela, em qualquer caixa, e avisa a Sofia", async () => {
    const { post, sessao } = montar();
    await post("/api/sessoes/s1/carrinho/itens", { id: "PH-001", quantidade: 2 }); // R$ 200,00

    const r = await post("/api/sessoes/s1/cupom", { codigo: " prohall10 " });
    expect(r.statusCode).toBe(200);
    expect(r.json().carrinho.cupom).toMatchObject({ codigo: "PROHALL10", desconto: { texto: "R$ 20,00" } });
    expect(sessao.cupom).toBe("PROHALL10");
    expect(sessao.avisosPendentes.at(-1)).toMatch(/aplicou o cupom PROHALL10 pela tela/);
  });

  it("recusa cupom inválido ou abaixo do mínimo com o motivo", async () => {
    const { post, sessao } = montar();
    await post("/api/sessoes/s1/carrinho/itens", { id: "PH-004" }); // R$ 60,00

    const abaixo = await post("/api/sessoes/s1/cupom", { codigo: "PROHALL10" });
    expect([abaixo.statusCode, abaixo.json().motivo]).toEqual([422, "abaixo_do_minimo"]);
    expect(abaixo.json().erro).toContain("R$ 150,00");

    const invalido = await post("/api/sessoes/s1/cupom", { codigo: "DESCONTO50" });
    expect([invalido.statusCode, invalido.json().motivo]).toEqual([422, "invalido"]);
    expect(sessao.cupom).toBeNull();
    expect((await post("/api/sessoes/s1/cupom", {})).statusCode).toBe(400);
    expect((await post("/api/sessoes/x/cupom", { codigo: "PROHALL10" })).statusCode).toBe(404);
  });

  it("mostra o frete no carrinho depois que o CEP é informado na conversa", async () => {
    const { app, post, sessao, catalogo } = montar();
    await post("/api/sessoes/s1/carrinho/itens", { id: "PH-001" });
    calcularFrete.executar({ cep: "01310-100" }, { catalogo, sessao });
    const get = (await app.inject({ method: "GET", url: "/api/sessoes/s1/carrinho" })).json();
    expect(get.carrinho.entrega.opcoes.map((o: { modalidade: string }) => o.modalidade)).toEqual(["economica", "expressa"]);
  });
});
