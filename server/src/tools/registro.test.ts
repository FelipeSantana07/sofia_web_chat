import { describe, expect, it } from "vitest";
import { z } from "zod";
import { definirFerramenta } from "./base.js";
import { criarDespachante, paraDeclaracaoGemini, todasAsFerramentas } from "./registro.js";
import { contextoDeTeste } from "./teste-util.js";

describe("declarações do Gemini", () => {
  const { declaracoes } = criarDespachante();

  it("há uma declaração por ferramenta, com nome e descrição", () => {
    expect(declaracoes.map((d) => d.name)).toEqual(todasAsFerramentas.map((f) => f.nome));
    for (const d of declaracoes) expect(d.description?.length).toBeGreaterThan(20);
  });

  it("o schema zod vira parametersJsonSchema (formato da T-05), sem $schema", () => {
    const d = declaracoes.find((x) => x.name === "adicionar_ao_carrinho")!;
    expect(d.parametersJsonSchema).toMatchObject({
      type: "object",
      properties: {
        id: { type: "string", description: expect.stringContaining("PH-001") },
        quantidade: { type: "integer", exclusiveMinimum: 0 },
      },
      required: ["id", "quantidade"],
    });
    expect(d.parametersJsonSchema).not.toHaveProperty("$schema");
  });

  it("parâmetros opcionais não entram em required", () => {
    const d = declaracoes.find((x) => x.name === "remover_do_carrinho")!;
    expect((d.parametersJsonSchema as { required: string[] }).required).toEqual(["id"]);
  });

  it("enums viram lista de valores", () => {
    const d = declaracoes.find((x) => x.name === "buscar_produtos")!;
    const props = (d.parametersJsonSchema as { properties: Record<string, { enum?: string[] }> }).properties;
    expect(props.uso?.enum).toEqual(["profissional", "home_care"]);
    expect(props.categoria?.enum).toContain("kit");
  });

  it("ferramenta sem argumentos vira objeto vazio", () => {
    const d = declaracoes.find((x) => x.name === "ver_carrinho")!;
    expect(d.parametersJsonSchema).toMatchObject({ type: "object", properties: {} });
  });
});

describe("despacho", () => {
  it("executa a ferramenta pelo nome e altera o estado da sessão", () => {
    const ctx = contextoDeTeste();
    const r = criarDespachante().executar("adicionar_ao_carrinho", { id: "PH-001", quantidade: 2 }, ctx);
    expect(r.ok).toBe(true);
    expect(ctx.sessao.carrinho.itens).toEqual([{ produtoId: "PH-001", quantidade: 2 }]);
  });

  it("nome desconhecido volta como resposta, sem exceção", () => {
    const r = criarDespachante().executar("dar_desconto", { percentual: 50 }, contextoDeTeste());
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/"dar_desconto" não existe/);
    expect(r.erro).toMatch(/buscar_produtos/);
  });

  it("erro de validação volta como resposta da função, sem exceção", () => {
    const despachante = criarDespachante();
    const ctx = contextoDeTeste();
    expect(() => despachante.executar("adicionar_ao_carrinho", { id: "PH-001", quantidade: -1 }, ctx)).not.toThrow();
    const r = despachante.executar("adicionar_ao_carrinho", { id: "PH-001", quantidade: -1 }, ctx);
    expect(r).toMatchObject({ ok: false, campos: [{ campo: "quantidade" }] });
  });

  it("argumentos ausentes ou de tipo errado também voltam como resposta", () => {
    const despachante = criarDespachante();
    const ctx = contextoDeTeste();
    expect(despachante.executar("calcular_frete", undefined, ctx).ok).toBe(false);
    expect(despachante.executar("calcular_frete", "01310-100", ctx).ok).toBe(false);
    expect(despachante.executar("ver_carrinho", undefined, ctx).ok).toBe(true);
  });

  it("falha inesperada dentro da ferramenta vira resposta, sem derrubar a conversa", () => {
    const quebrada = definirFerramenta({
      nome: "quebrada",
      descricao: "Ferramenta de teste que sempre lança uma exceção.",
      parametros: z.object({}),
      executar() {
        throw new Error("boom");
      },
    });
    const r = criarDespachante([quebrada]).executar("quebrada", {}, contextoDeTeste());
    expect(r).toMatchObject({ ok: false, detalhe_interno: "boom" });
    expect(r.erro).toMatch(/Não invente/);
  });

  it("marca a sessão como atualizada", () => {
    const ctx = contextoDeTeste();
    ctx.sessao.atualizadoEm = 0;
    criarDespachante().executar("ver_carrinho", {}, ctx);
    expect(ctx.sessao.atualizadoEm).toBeGreaterThan(0);
  });

  it("recusa nomes repetidos no registro", () => {
    const f = todasAsFerramentas[0]!;
    expect(() => criarDespachante([f, f])).toThrow(/repetido/);
  });

  it("paraDeclaracaoGemini mantém o nome e a descrição", () => {
    const f = todasAsFerramentas[0]!;
    expect(paraDeclaracaoGemini(f)).toMatchObject({ name: f.nome, description: f.descricao });
  });
});
