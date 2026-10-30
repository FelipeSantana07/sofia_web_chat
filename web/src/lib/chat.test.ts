import { describe, expect, it } from "vitest";
import { BOAS_VINDAS, criarChat, type EstadoChat } from "./chat.js";

const bloco = (evento: string, dados: unknown) => `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;

/** Resposta de stream cujos pedaços só saem quando o teste manda, para observar o estado no meio do caminho. */
function respostaControlada() {
  const codificador = new TextEncoder();
  let controle!: ReadableStreamDefaultController<Uint8Array>;
  const corpo = new ReadableStream<Uint8Array>({ start: (c) => void (controle = c) });
  return {
    resposta: new Response(corpo, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    enviar: (evento: string, dados: unknown) => controle.enqueue(codificador.encode(bloco(evento, dados))),
    fechar: () => controle.close(),
  };
}

const respostaCompleta = (...eventos: [string, unknown][]) =>
  new Response(eventos.map(([e, d]) => bloco(e, d)).join(""), { status: 200 });

function fetchFalso(...respostas: (Response | Error)[]) {
  const pedidos: { url: string; corpo: Record<string, unknown> }[] = [];
  const buscar = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, corpo: JSON.parse(String(init.body)) });
    const r = respostas.shift();
    if (!r) throw new Error("sem resposta combinada no teste");
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { buscar, pedidos };
}

function observar(chat: ReturnType<typeof criarChat>) {
  const estados: EstadoChat[] = [];
  chat.subscribe((e) => estados.push(e));
  return { estados, atual: () => estados[estados.length - 1]! };
}

const aguardar = () => new Promise((r) => setTimeout(r, 0));

describe("criarChat", () => {
  it("começa com as boas-vindas da Sofia, sem enviar nada", () => {
    const { buscar, pedidos } = fetchFalso();
    const { atual } = observar(criarChat({ fetch: buscar }));
    expect(atual().mensagens).toEqual([{ id: 1, autor: "sofia", texto: BOAS_VINDAS }]);
    expect(atual()).toMatchObject({ enviando: false, digitando: false, sessaoId: null });
    expect(pedidos).toHaveLength(0);
  });

  it("mostra o texto aos pedaços e o 'digitando' só até o primeiro pedaço", async () => {
    const r = respostaControlada();
    const { buscar } = fetchFalso(r.resposta);
    const chat = criarChat({ fetch: buscar });
    const { atual } = observar(chat);

    const envio = chat.enviar("Oi, Sofia");
    expect(atual()).toMatchObject({ enviando: true, digitando: true });
    expect(atual().mensagens.at(-1)).toMatchObject({ autor: "cliente", texto: "Oi, Sofia" });

    r.enviar("sessao", { sessaoId: "s-1" });
    await aguardar();
    expect(atual().sessaoId).toBe("s-1");
    expect(atual().digitando).toBe(true);

    r.enviar("texto", { delta: "Oi! " });
    await aguardar();
    expect(atual().digitando).toBe(false);
    expect(atual().mensagens.at(-1)).toMatchObject({ autor: "sofia", texto: "Oi! " });

    r.enviar("texto", { delta: "Tudo bem?" });
    await aguardar();
    expect(atual().mensagens.at(-1)).toMatchObject({ texto: "Oi! Tudo bem?" });

    r.enviar("fim", { texto: "Oi! Tudo bem?" });
    r.fechar();
    await envio;
    expect(atual()).toMatchObject({ enviando: false, digitando: false, podeTentarDeNovo: false });
    expect(atual().mensagens).toHaveLength(3); // boas-vindas, cliente, Sofia
  });

  it("volta a mostrar 'digitando' enquanto a Sofia chama ferramentas", async () => {
    const r = respostaControlada();
    const chat = criarChat({ fetch: fetchFalso(r.resposta).buscar });
    const { atual } = observar(chat);
    const envio = chat.enviar("Quero o tônico");

    r.enviar("texto", { delta: "Vou ver. " });
    await aguardar();
    expect(atual().digitando).toBe(false);

    r.enviar("ferramenta", { nome: "buscar_produtos", argumentos: {}, resultado: { ok: true }, duracaoMs: 2 });
    await aguardar();
    expect(atual().digitando).toBe(true);

    r.enviar("texto", { delta: "\n\nAchei!" });
    await aguardar();
    expect(atual().digitando).toBe(false);
    expect(atual().mensagens.at(-1)).toMatchObject({ texto: "Vou ver. \n\nAchei!" });

    r.enviar("fim", { texto: "Vou ver. \n\nAchei!" });
    r.fechar();
    await envio;
  });

  it("reenvia o sessaoId nas mensagens seguintes", async () => {
    const { buscar, pedidos } = fetchFalso(
      respostaCompleta(["sessao", { sessaoId: "s-9" }], ["texto", { delta: "a" }], ["fim", { texto: "a" }]),
      respostaCompleta(["sessao", { sessaoId: "s-9" }], ["texto", { delta: "b" }], ["fim", { texto: "b" }]),
    );
    const chat = criarChat({ fetch: buscar });
    await chat.enviar("um");
    await chat.enviar("dois");
    expect(pedidos[0]?.corpo).toEqual({ mensagem: "um" });
    expect(pedidos[1]?.corpo).toEqual({ mensagem: "dois", sessaoId: "s-9" });
    expect(pedidos[0]?.url).toBe("/api/chat");
  });

  it("ignora mensagem vazia e envio duplicado enquanto responde", async () => {
    const r = respostaControlada();
    const { buscar, pedidos } = fetchFalso(r.resposta);
    const chat = criarChat({ fetch: buscar });
    await chat.enviar("   ");
    const primeiro = chat.enviar("Oi");
    await chat.enviar("outra enquanto responde");
    expect(pedidos).toHaveLength(1);
    r.enviar("fim", { texto: "ok" });
    r.fechar();
    await primeiro;
  });

  it("avisa quando o servidor recusa (409) e permite tentar de novo sem duplicar a mensagem", async () => {
    const { buscar, pedidos } = fetchFalso(
      new Response(JSON.stringify({ erro: "Aguarde a resposta anterior terminar." }), { status: 409 }),
      respostaCompleta(["texto", { delta: "Agora foi!" }], ["fim", { texto: "Agora foi!" }]),
    );
    const chat = criarChat({ fetch: buscar });
    const { atual } = observar(chat);

    await chat.enviar("Oi");
    expect(atual().mensagens.at(-1)).toMatchObject({ autor: "aviso", texto: "Aguarde a resposta anterior terminar." });
    expect(atual().podeTentarDeNovo).toBe(true);

    await chat.tentarDeNovo();
    expect(pedidos.map((p) => p.corpo.mensagem)).toEqual(["Oi", "Oi"]);
    expect(atual().mensagens.filter((m) => m.autor === "cliente")).toHaveLength(1);
    expect(atual().mensagens.some((m) => m.autor === "aviso")).toBe(false);
    expect(atual().mensagens.at(-1)).toMatchObject({ texto: "Agora foi!" });
    expect(atual().podeTentarDeNovo).toBe(false);
  });

  it("trata falha de rede com um aviso e libera o campo", async () => {
    const chat = criarChat({ fetch: fetchFalso(new TypeError("Failed to fetch")).buscar });
    const { atual } = observar(chat);
    await chat.enviar("Oi");
    expect(atual().mensagens.at(-1)).toMatchObject({ autor: "aviso" });
    expect(atual()).toMatchObject({ enviando: false, digitando: false, podeTentarDeNovo: true });
  });

  it("mostra o aviso do evento de erro e mantém o texto que já chegou", async () => {
    const { buscar } = fetchFalso(
      respostaCompleta(["texto", { delta: "Deixa eu ver" }], ["erro", { mensagem: "Tive um problema para responder agora." }]),
    );
    const chat = criarChat({ fetch: buscar });
    const { atual } = observar(chat);
    await chat.enviar("Oi");
    const [, , sofia, aviso] = atual().mensagens;
    expect(sofia).toMatchObject({ autor: "sofia", texto: "Deixa eu ver" });
    expect(aviso).toMatchObject({ autor: "aviso", texto: "Tive um problema para responder agora." });
    expect(atual().podeTentarDeNovo).toBe(true);
  });

  it("trata um stream que acaba sem o evento final como falha", async () => {
    const chat = criarChat({ fetch: fetchFalso(respostaCompleta(["texto", { delta: "Ola" }])).buscar });
    const { atual } = observar(chat);
    await chat.enviar("Oi");
    expect(atual().mensagens.at(-1)?.autor).toBe("aviso");
    expect(atual().podeTentarDeNovo).toBe(true);
  });

  it("só tenta de novo se a última resposta falhou", async () => {
    const { buscar, pedidos } = fetchFalso(respostaCompleta(["texto", { delta: "ok" }], ["fim", { texto: "ok" }]));
    const chat = criarChat({ fetch: buscar });
    await chat.enviar("Oi");
    await chat.tentarDeNovo();
    expect(pedidos).toHaveLength(1);
  });
});

describe("depuração", () => {
  it("guarda, para cada mensagem da cliente, as ferramentas chamadas com argumentos, resultado e duração", async () => {
    const { buscar } = fetchFalso(
      respostaCompleta(
        ["ferramenta", { nome: "buscar_produtos", argumentos: { termo: "frizz" }, resultado: { ok: true, total: 2 }, duracaoMs: 3 }],
        ["ferramenta", { nome: "calcular_frete", argumentos: { cep: "123" }, resultado: { ok: false, erro: "CEP inválido" }, duracaoMs: 1 }],
        ["fim", { texto: "ok" }],
      ),
      respostaCompleta(["fim", { texto: "oi" }]),
    );
    const chat = criarChat({ fetch: buscar });
    const { atual } = observar(chat);
    expect(atual().depuracao).toEqual([]);

    await chat.enviar("tenho frizz");
    await chat.enviar("obrigada");

    const [primeiro, segundo] = atual().depuracao;
    expect(primeiro).toMatchObject({
      mensagem: "tenho frizz",
      ferramentas: [
        { nome: "buscar_produtos", argumentos: { termo: "frizz" }, resultado: { ok: true, total: 2 }, duracaoMs: 3 },
        { nome: "calcular_frete", argumentos: { cep: "123" }, resultado: { ok: false, erro: "CEP inválido" }, duracaoMs: 1 },
      ],
    });
    expect(segundo).toMatchObject({ mensagem: "obrigada", ferramentas: [] });
    expect(primeiro?.id).not.toBe(segundo?.id);
  });
});

describe("anunciar", () => {
  it("mostra uma fala da Sofia sem enviar nada ao servidor", () => {
    const { buscar, pedidos } = fetchFalso();
    const chat = criarChat({ fetch: buscar });
    const { atual } = observar(chat);
    chat.anunciar("Pagamento confirmado!");
    expect(atual().mensagens.at(-1)).toMatchObject({ autor: "sofia", texto: "Pagamento confirmado!" });
    expect(pedidos).toHaveLength(0);
  });
});

describe("cards de produto", () => {
  const card = (id: string) => ({
    id,
    nome: `Produto ${id}`,
    categoria: "shampoo",
    preco: { centavos: 10000, texto: "R$ 100,00" },
    em_promocao: false,
    descricao_curta: "x",
    imagem_url: "https://exemplo.com/x.jpg",
    url: "https://exemplo.com/x",
  });

  it("mostra os cards depois do texto da Sofia, sem repetir produto", async () => {
    const { buscar } = fetchFalso(
      respostaCompleta(
        ["ferramenta", { nome: "buscar_produtos", argumentos: {}, resultado: { ok: true, produtos: [card("PH-009")] }, duracaoMs: 1 }],
        ["ferramenta", { nome: "mostrar_produtos", argumentos: {}, resultado: { ok: true, produtos: [card("PH-001"), card("PH-002")] }, duracaoMs: 1 }],
        ["ferramenta", { nome: "mostrar_produtos", argumentos: {}, resultado: { ok: true, produtos: [card("PH-001")] }, duracaoMs: 1 }],
        ["texto", { delta: "Indico estes dois." }],
        ["fim", { texto: "Indico estes dois." }],
      ),
    );
    const chat = criarChat({ fetch: buscar });
    const { atual } = observar(chat);
    await chat.enviar("o que você indica?");

    const ultimas = atual().mensagens.slice(-2);
    expect(ultimas[0]).toMatchObject({ autor: "sofia", texto: "Indico estes dois." });
    expect(ultimas[1]).toMatchObject({ autor: "cards" });
    expect((ultimas[1] as { produtos: { id: string }[] }).produtos.map((p) => p.id)).toEqual(["PH-001", "PH-002"]);
  });

  it("não cria cards quando a Sofia não chamou mostrar_produtos ou a chamada falhou", async () => {
    const { buscar } = fetchFalso(
      respostaCompleta(
        ["ferramenta", { nome: "buscar_produtos", argumentos: {}, resultado: { ok: true, produtos: [card("PH-001")] }, duracaoMs: 1 }],
        ["ferramenta", { nome: "mostrar_produtos", argumentos: {}, resultado: { ok: false, erro: "id inválido" }, duracaoMs: 1 }],
        ["fim", { texto: "ok" }],
      ),
    );
    const chat = criarChat({ fetch: buscar });
    const { atual } = observar(chat);
    await chat.enviar("oi");
    expect(atual().mensagens.some((m) => m.autor === "cards")).toBe(false);
  });

  it("repassa cada evento e o fim da resposta a quem acompanha (carrinho)", async () => {
    const eventos: string[] = [];
    let terminou = 0;
    const { buscar } = fetchFalso(respostaCompleta(["texto", { delta: "a" }], ["fim", { texto: "a" }]));
    const chat = criarChat({ fetch: buscar, aoEvento: (e) => eventos.push(e.tipo), aoTerminar: () => terminou++ });
    await chat.enviar("oi");
    expect(eventos).toEqual(["texto", "fim"]);
    expect(terminou).toBe(1);
  });
});
