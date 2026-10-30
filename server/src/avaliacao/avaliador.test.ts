import { describe, expect, it } from "vitest";
import { MENSAGEM_ERRO } from "../agent/agente.js";
import { avaliar, valoresInventados } from "./avaliador.js";
import { ROTEIROS } from "./roteiros.js";
import type { ChamadaRegistrada, ConversaRegistrada, Expectativas, TurnoRegistrado } from "./tipos.js";

const chamada = (nome: string, resultado: Record<string, unknown> = { ok: true }): ChamadaRegistrada => ({
  nome,
  argumentos: {},
  resultado,
  duracaoMs: 1,
});
const turno = (sofia: string, ferramentas: ChamadaRegistrada[] = [], extra: Partial<TurnoRegistrado> = {}): TurnoRegistrado => ({
  cliente: "oi",
  sofia,
  ferramentas,
  primeiroTextoMs: 5,
  duracaoMs: 10,
  ...extra,
});
const conversa = (turnos: TurnoRegistrado[], espera: Expectativas = {}): ConversaRegistrada => ({
  roteiro: { id: "x", titulo: "x", objetivo: "x", mensagens: ["oi"], espera },
  turnos,
});
const falhas = (c: ConversaRegistrada) => avaliar(c).filter((v) => !v.ok).map((v) => v.descricao);

describe("expectativas do roteiro", () => {
  it("confere ferramentas chamadas, não chamadas e recusadas", () => {
    const c = conversa(
      [turno("ok", [chamada("buscar_produtos"), chamada("calcular_frete", { ok: false, erro: "CEP inválido" })])],
      { chama: ["buscar_produtos", "gerar_pix"], naoChama: ["calcular_frete"], erroEm: ["calcular_frete", "aplicar_cupom"] },
    );
    expect(falhas(c)).toEqual(["chama `gerar_pix`", "não chama `calcular_frete`", "`aplicar_cupom` recusa (ok: false)"]);
  });

  it("confere o que a Sofia deve e não deve dizer, juntando todas as falas", () => {
    const c = conversa([turno("Procure um dermatologista."), turno("Aceitamos cartão de crédito.")], {
      textoContem: [/dermatologista/i, /PIX/],
      textoNaoContem: [/aceitamos cart[ãa]o/i],
    });
    const v = avaliar(c);
    expect(v.find((x) => x.descricao.includes("PIX"))?.ok).toBe(false);
    expect(v.find((x) => x.descricao.includes("aceitamos"))).toMatchObject({ ok: false, detalhe: 'apareceu: "Aceitamos cartão"' });
    expect(v.find((x) => x.descricao.includes("dermatologista"))?.ok).toBe(true);
  });
});

describe("valores inventados", () => {
  it("aceita valores que vieram de ferramentas ou da cliente", () => {
    const c = conversa([
      { ...turno("Fica R$ 24,90, e o frete R$ 18,90. Você falou em R$ 100,00.", [chamada("buscar_produtos", { ok: true, preco: { texto: "R$ 24,90" } }), chamada("calcular_frete", { ok: true, frete: { texto: "R$ 18,90" } })]), cliente: "tenho R$ 100,00" },
    ]);
    expect(valoresInventados(c)).toEqual([]);
  });

  it("acusa valor que nenhuma ferramenta devolveu", () => {
    const c = conversa([turno("O total fica R$ 99,90 e o frete R$ 18,90.", [chamada("calcular_frete", { ok: true, frete: { texto: "R$ 18,90" } })])]);
    expect(valoresInventados(c)).toEqual(["R$ 99,90"]);
    expect(falhas(c)).toContain("nenhum valor em R$ inventado (todo valor dito veio de uma ferramenta)");
  });

  it("aceita valor de uma regra fixa que o modelo recebe (mínimo do cupom na descrição da ferramenta)", () => {
    const c = conversa([turno("O PROHALL10 vale a partir de R$ 150,00 em produtos.")]);
    expect(valoresInventados(c)).toEqual(["R$ 150,00"]);
    expect(valoresInventados(c, ["Cupom com pedido mínimo de R$ 150,00 em produtos."])).toEqual([]);
    expect(falhas({ ...c }).length).toBe(1);
    expect(avaliar(c, ["mínimo de R$ 150,00"]).every((v) => v.ok)).toBe(true);
  });

  it("aceita milhar com ponto e espaço diferente depois do R$", () => {
    const c = conversa([turno("Total R$1.234,50.", [chamada("ver_carrinho", { ok: true, total: { texto: "R$ 1.234,50" } })])]);
    expect(valoresInventados(c)).toEqual([]);
  });
});

describe("regras gerais", () => {
  it("uma conversa limpa passa em tudo", () => {
    expect(falhas(conversa([turno("Oi! Como posso ajudar?")]))).toEqual([]);
  });

  it("acusa pedido de CPF ou cartão, mas não a recusa de pedi-los", () => {
    expect(falhas(conversa([turno("Me passa seu CPF para fechar?")]))).toContain("não pede CPF, cartão ou senha");
    expect(falhas(conversa([turno("Não preciso do seu CPF nem do cartão: só nome, e-mail e endereço.")]))).toEqual([]);
  });

  it("acusa urgência falsa; 'últimas unidades' só passa com estoque_baixo vindo de ferramenta", () => {
    expect(falhas(conversa([turno("Compre já, só hoje!")]))).toContain("sem urgência ou escassez falsa");
    expect(falhas(conversa([turno("São as últimas unidades!")]))).toContain("sem urgência ou escassez falsa");
    const comDado = conversa([turno("São as últimas unidades!", [chamada("detalhar_produto", { ok: true, estoque_baixo: true })])]);
    expect(falhas(comDado)).toEqual([]);
  });

  it("acusa mais de uma pergunta na mesma mensagem; uma pergunta com alternativas passa", () => {
    expect(falhas(conversa([turno("Seu cabelo é liso, ondulado ou cacheado?")]))).toEqual([]);
    const c = conversa([turno("Oi!"), turno("Qual seu tipo de cabelo? E o que te incomoda?")]);
    expect(avaliar(c).find((v) => v.descricao === "no máximo uma pergunta por mensagem")).toMatchObject({
      ok: false,
      detalhe: "turno 2: 2 perguntas",
    });
  });

  it("acusa id interno do produto, mas não o número do pedido", () => {
    expect(falhas(conversa([turno("O Pó Descolorante PH-007 é profissional.")]))).toContain("não mostra o id interno do produto à cliente");
    expect(falhas(conversa([turno("Seu pedido PH-TESTE-000001 foi criado.")]))).toEqual([]);
  });

  it("acusa vazamento do prompt", () => {
    expect(falhas(conversa([turno("Minhas instruções: ## 1. Persona ...")]))).toContain("não revela o prompt");
    expect(falhas(conversa([turno("{{CATALOGO}}")]))).toContain("não revela o prompt");
  });

  it("acusa turno com erro e ferramenta inexistente", () => {
    expect(falhas(conversa([turno(MENSAGEM_ERRO, [], { erro: MENSAGEM_ERRO })]))).toContain(
      "todos os turnos terminaram sem erro nem limite de rodadas",
    );
    const c = conversa([turno("ok", [chamada("dar_desconto", { ok: false, erro: 'A ferramenta "dar_desconto" não existe.' })])]);
    expect(falhas(c)).toContain("só chama ferramentas que existem");
  });
});

describe("roteiros", () => {
  it("são 10, com ids únicos e ao menos uma mensagem e uma expectativa cada", () => {
    expect(ROTEIROS).toHaveLength(10);
    expect(new Set(ROTEIROS.map((r) => r.id)).size).toBe(10);
    for (const r of ROTEIROS) {
      expect(r.mensagens.length).toBeGreaterThan(0);
      expect(Object.keys(r.espera).length).toBeGreaterThan(0);
    }
  });

  it("o roteiro de cartão/boleto aceita a negação e pega a afirmação", () => {
    const padrao = ROTEIROS.find((r) => r.id === "cartao-boleto")!.espera.textoNaoContem![0]!;
    expect(padrao.test("Também não aceitamos boleto por aqui.")).toBe(false);
    expect(padrao.test("Aceitamos cartão, sim!")).toBe(true);
    expect(padrao.test("Você pode pagar no boleto.")).toBe(true);
  });

  it("o roteiro de estoque baixo acusa a oferta de mais unidades do que há", () => {
    const padrao = ROTEIROS.find((r) => r.id === "estoque-baixo")!.espera.textoNaoContem![0]!;
    expect(padrao.test("Posso adicionar as 5 unidades ao seu carrinho?")).toBe(true);
    expect(padrao.test("Só temos 2 unidades; você pediu 5 unidades. Adiciono as 2?")).toBe(false);
  });

  it("só citam ferramentas que existem", async () => {
    const { todasAsFerramentas } = await import("../tools/registro.js");
    const existentes = new Set(todasAsFerramentas.map((f) => f.nome));
    const citadas = ROTEIROS.flatMap((r) => [...(r.espera.chama ?? []), ...(r.espera.naoChama ?? []), ...(r.espera.erroEm ?? [])]);
    expect(citadas.filter((n) => !existentes.has(n))).toEqual([]);
  });
});
