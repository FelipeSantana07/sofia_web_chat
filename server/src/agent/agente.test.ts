import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Part } from "@google/genai";
import { describe, expect, it } from "vitest";
import { criarDespachante } from "../tools/registro.js";
import { contextoDeTeste } from "../tools/teste-util.js";
import { criarAgente, MENSAGEM_ERRO, MENSAGEM_LIMITE, MENSAGEM_VAZIA, type EventoAgente } from "./agente.js";
import type { ModeloChat, PedidoModelo } from "./modelo.js";
import { criarRegistroArquivo, criarRegistroMemoria } from "./registro-log.js";

/** Modelo falso: cada chamada devolve a próxima resposta do roteiro, em pedaços (como o streaming). */
function modeloRoteirizado(roteiro: Part[][][]) {
  const pedidos: PedidoModelo[] = [];
  const modelo: ModeloChat = {
    async *gerar(pedido) {
      pedidos.push(structuredClone(pedido));
      const resposta = roteiro[pedidos.length - 1];
      if (!resposta) throw new Error("roteiro acabou");
      for (const pedaco of resposta) yield pedaco;
    },
  };
  return { modelo, pedidos };
}

const texto = (t: string): Part => ({ text: t });
const chamada = (name: string, args: Record<string, unknown>, id?: string): Part => ({
  functionCall: { name, args, ...(id ? { id } : {}) },
});

function montar(roteiro: Part[][][], maxRodadas?: number) {
  const { modelo, pedidos } = modeloRoteirizado(roteiro);
  const ctx = contextoDeTeste();
  const registro = criarRegistroMemoria();
  const agente = criarAgente({
    modelo,
    despachante: criarDespachante(),
    catalogo: ctx.catalogo,
    promptSistema: "PROMPT DE TESTE",
    registro,
    ...(maxRodadas ? { maxRodadas } : {}),
  });
  return { agente, ctx, pedidos, registro };
}

async function coletar(gerador: AsyncGenerator<EventoAgente>): Promise<EventoAgente[]> {
  const eventos: EventoAgente[] = [];
  for await (const e of gerador) eventos.push(e);
  return eventos;
}

describe("agente: resposta simples", () => {
  it("transmite o texto em pedaços e encerra com o texto completo", async () => {
    const { agente, ctx } = montar([[[texto("Oi! Sou a Sofia, ")], [texto("assistente virtual da Prohall.")]]]);
    const eventos = await coletar(agente.responder(ctx.sessao, "oi"));
    expect(eventos).toEqual([
      { tipo: "texto", delta: "Oi! Sou a Sofia, " },
      { tipo: "texto", delta: "assistente virtual da Prohall." },
      { tipo: "fim", texto: "Oi! Sou a Sofia, assistente virtual da Prohall." },
    ]);
  });

  it("envia histórico, prompt de sistema e as declarações das ferramentas", async () => {
    const { agente, ctx, pedidos } = montar([[[texto("Oi!")]]]);
    await coletar(agente.responder(ctx.sessao, "oi"));
    expect(pedidos[0]?.instrucaoSistema).toBe("PROMPT DE TESTE");
    expect(pedidos[0]?.historico).toEqual([{ role: "user", parts: [{ text: "oi" }] }]);
    expect(pedidos[0]?.ferramentas.map((f) => f.name)).toContain("calcular_frete");
  });

  it("guarda o turno no histórico da sessão e o reenvia na mensagem seguinte", async () => {
    const { agente, ctx, pedidos } = montar([[[texto("Oi!")]], [[texto("Claro.")]]]);
    await coletar(agente.responder(ctx.sessao, "oi"));
    await coletar(agente.responder(ctx.sessao, "me ajuda?"));
    expect(pedidos[1]?.historico).toEqual([
      { role: "user", parts: [{ text: "oi" }] },
      { role: "model", parts: [{ text: "Oi!" }] },
      { role: "user", parts: [{ text: "me ajuda?" }] },
    ]);
    expect(ctx.sessao.historico).toHaveLength(4);
  });

  it("resposta vazia do modelo vira uma mensagem padrão", async () => {
    const { agente, ctx } = montar([[[]]]);
    const eventos = await coletar(agente.responder(ctx.sessao, "oi"));
    expect(eventos.at(-1)).toEqual({ tipo: "fim", texto: MENSAGEM_VAZIA });
  });
});

describe("agente: avisos de ações na tela", () => {
  it("leva os avisos pendentes junto da próxima mensagem e os consome", async () => {
    const { agente, ctx, pedidos } = montar([[[texto("Anotado!")]], [[texto("Ok.")]]]);
    ctx.sessao.avisosPendentes.push("[aviso do sistema] Ela adicionou 1x Shampoo ao carrinho pelo botão da tela.");
    await coletar(agente.responder(ctx.sessao, "e agora?"));

    expect(pedidos[0]?.historico[0]?.parts?.[0]?.text).toBe(
      "[aviso do sistema] Ela adicionou 1x Shampoo ao carrinho pelo botão da tela.\n\ne agora?",
    );
    expect(ctx.sessao.avisosPendentes).toEqual([]);

    await coletar(agente.responder(ctx.sessao, "obrigada"));
    expect(pedidos[1]?.historico.at(-1)?.parts?.[0]?.text).toBe("obrigada");
  });

  it("devolve os avisos à fila se o turno falhar, para a próxima tentativa", async () => {
    const modelo: ModeloChat = {
      // eslint-disable-next-line require-yield
      async *gerar() {
        throw new Error("503");
      },
    };
    const ctx = contextoDeTeste();
    ctx.sessao.avisosPendentes.push("[aviso do sistema] x");
    const agente = criarAgente({ modelo, despachante: criarDespachante(), catalogo: ctx.catalogo, promptSistema: "x" });
    await coletar(agente.responder(ctx.sessao, "oi"));
    expect(ctx.sessao.avisosPendentes).toEqual(["[aviso do sistema] x"]);
  });
});

describe("agente: ferramentas", () => {
  it("executa a ferramenta pedida, devolve o resultado ao modelo e segue até a resposta final", async () => {
    const { agente, ctx, pedidos } = montar([
      [[chamada("adicionar_ao_carrinho", { id: "PH-001", quantidade: 2 })]],
      [[texto("Pronto, adicionei!")]],
    ]);
    const eventos = await coletar(agente.responder(ctx.sessao, "quero 2 do PH-001"));

    expect(eventos[0]).toMatchObject({
      tipo: "ferramenta",
      nome: "adicionar_ao_carrinho",
      argumentos: { id: "PH-001", quantidade: 2 },
      resultado: { ok: true },
    });
    expect(eventos.slice(1)).toEqual([
      { tipo: "texto", delta: "Pronto, adicionei!" },
      { tipo: "fim", texto: "Pronto, adicionei!" },
    ]);
    expect(ctx.sessao.carrinho.itens).toEqual([{ produtoId: "PH-001", quantidade: 2 }]);

    // a segunda chamada ao modelo leva a chamada e a resposta da função
    const historico = pedidos[1]!.historico;
    expect(historico[1]).toEqual({ role: "model", parts: [chamada("adicionar_ao_carrinho", { id: "PH-001", quantidade: 2 })] });
    expect(historico[2]?.role).toBe("user");
    expect(historico[2]?.parts?.[0]?.functionResponse).toMatchObject({
      name: "adicionar_ao_carrinho",
      response: { ok: true, carrinho: { subtotal: { texto: "R$ 200,00" } } },
    });
  });

  it("executa várias chamadas da mesma rodada, na ordem, e responde todas juntas", async () => {
    const { agente, ctx, pedidos } = montar([
      [[chamada("atualizar_perfil", { incomodo: "frizz" }), chamada("buscar_produtos", { termo: "frizz" })]],
      [[texto("Tenho uma indicação.")]],
    ]);
    const eventos = await coletar(agente.responder(ctx.sessao, "tenho frizz"));
    expect(eventos.filter((e) => e.tipo === "ferramenta").map((e) => (e as { nome: string }).nome)).toEqual([
      "atualizar_perfil",
      "buscar_produtos",
    ]);
    const respostas = pedidos[1]!.historico[2]!.parts!;
    expect(respostas.map((p) => p.functionResponse?.name)).toEqual(["atualizar_perfil", "buscar_produtos"]);
    expect(ctx.sessao.perfil.incomodo).toBe("frizz");
  });

  it("devolve o id da chamada na resposta da função quando o modelo manda um", async () => {
    const { agente, ctx, pedidos } = montar([[[chamada("ver_carrinho", {}, "call-1")]], [[texto("ok")]]]);
    await coletar(agente.responder(ctx.sessao, "carrinho?"));
    expect(pedidos[1]!.historico[2]!.parts![0]!.functionResponse).toMatchObject({ id: "call-1", name: "ver_carrinho" });
  });

  it("erro de validação volta ao modelo como resposta, e ele pode se corrigir", async () => {
    const { agente, ctx, pedidos } = montar([
      [[chamada("adicionar_ao_carrinho", { id: "PH-001", quantidade: -2 })]],
      [[chamada("adicionar_ao_carrinho", { id: "PH-001", quantidade: 2 })]],
      [[texto("Adicionei 2.")]],
    ]);
    const eventos = await coletar(agente.responder(ctx.sessao, "quero 2"));
    const ferramentas = eventos.filter((e) => e.tipo === "ferramenta") as Extract<EventoAgente, { tipo: "ferramenta" }>[];
    expect(ferramentas.map((f) => f.resultado.ok)).toEqual([false, true]);
    expect(pedidos[1]!.historico[2]!.parts![0]!.functionResponse!.response).toMatchObject({ ok: false });
    expect(ctx.sessao.carrinho.itens[0]?.quantidade).toBe(2);
  });

  it("separa em parágrafos o texto de rodadas diferentes", async () => {
    const { agente, ctx } = montar([
      [[texto("Vou ver o carrinho."), chamada("ver_carrinho", {})]],
      [[texto("Está vazio.")]],
    ]);
    const eventos = await coletar(agente.responder(ctx.sessao, "e o carrinho?"));
    expect(eventos.at(-1)).toEqual({ tipo: "fim", texto: "Vou ver o carrinho.\n\nEstá vazio." });
  });

  it("não mostra pensamentos do modelo, mas os mantém no histórico (assinaturas)", async () => {
    const pensamento: Part = { text: "pensando...", thought: true, thoughtSignature: "assinatura" };
    const { agente, ctx, pedidos } = montar([[[pensamento, chamada("ver_carrinho", {})]], [[texto("Vazio.")]]]);
    const eventos = await coletar(agente.responder(ctx.sessao, "carrinho"));
    expect(eventos.filter((e) => e.tipo === "texto")).toEqual([{ tipo: "texto", delta: "Vazio." }]);
    expect(pedidos[1]!.historico[1]!.parts![0]).toEqual(pensamento);
  });
});

describe("agente: limites e falhas", () => {
  it("para no limite de rodadas com uma mensagem honesta", async () => {
    const sempreFerramenta = Array.from({ length: 5 }, () => [[chamada("ver_carrinho", {})]]);
    const { agente, ctx, pedidos, registro } = montar(sempreFerramenta, 3);
    const eventos = await coletar(agente.responder(ctx.sessao, "oi"));
    expect(pedidos).toHaveLength(3);
    expect(eventos.filter((e) => e.tipo === "ferramenta")).toHaveLength(3);
    expect(eventos.at(-1)).toEqual({ tipo: "fim", texto: MENSAGEM_LIMITE });
    expect(registro.entradas.some((e) => e.tipo === "limite_de_rodadas")).toBe(true);
    // o histórico termina com a resposta do modelo, para a próxima mensagem seguir a alternância
    expect(ctx.sessao.historico.at(-1)).toEqual({ role: "model", parts: [{ text: MENSAGEM_LIMITE }] });
  });

  it("falha do modelo vira evento de erro e não deixa o histórico pela metade", async () => {
    const modelo: ModeloChat = {
      // eslint-disable-next-line require-yield
      async *gerar() {
        throw new Error("503 indisponível");
      },
    };
    const ctx = contextoDeTeste();
    const registro = criarRegistroMemoria();
    const agente = criarAgente({ modelo, despachante: criarDespachante(), catalogo: ctx.catalogo, promptSistema: "x", registro });
    const eventos = await coletar(agente.responder(ctx.sessao, "oi"));
    expect(eventos).toEqual([{ tipo: "erro", mensagem: MENSAGEM_ERRO }]);
    expect(ctx.sessao.historico).toEqual([]);
    expect(registro.entradas.at(-1)).toMatchObject({ tipo: "erro", mensagem: "503 indisponível" });
  });
});

describe("agente: log", () => {
  it("registra a mensagem, cada chamada de ferramenta (argumentos e resultado) e a resposta", async () => {
    const { agente, ctx, registro } = montar([
      [[chamada("calcular_frete", { cep: "abc" })]],
      [[texto("Esse CEP não parece válido.")]],
    ]);
    await coletar(agente.responder(ctx.sessao, "meu cep é abc"));
    expect(registro.entradas.map((e) => e.tipo)).toEqual(["mensagem_cliente", "ferramenta", "resposta_sofia"]);
    expect(registro.entradas[1]).toMatchObject({
      sessao: "teste",
      nome: "calcular_frete",
      argumentos: { cep: "abc" },
      resultado: { ok: false, motivo: "cep_invalido" },
      duracao_ms: expect.any(Number),
    });
    expect(registro.entradas[2]).toMatchObject({ texto: "Esse CEP não parece válido.", rodadas: 2 });
  });

  it("o registro em arquivo grava uma linha JSON por evento", () => {
    const caminho = join(mkdtempSync(join(tmpdir(), "sofia-log-")), "sub", "conversas.jsonl");
    const registro = criarRegistroArquivo(caminho);
    registro.registrar({ sessao: "s1", tipo: "mensagem_cliente", texto: "oi" });
    registro.registrar({ sessao: "s1", tipo: "resposta_sofia", texto: "olá" });
    const linhas = readFileSync(caminho, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ sessao: "s1", tipo: "mensagem_cliente", texto: "oi", em: expect.any(String) });
  });
});
