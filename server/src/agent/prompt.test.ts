import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carregarCatalogo } from "../catalogo/catalogo.js";
import { produtoDeTeste } from "../tools/teste-util.js";
import { todasAsFerramentas } from "../tools/registro.js";
import { CAMINHO_PROMPT, montarPromptSistema, resumirCatalogoParaPrompt } from "./prompt.js";

describe("resumirCatalogoParaPrompt", () => {
  it("uma linha por produto com id, nome, categoria, linha, uso e indicações", () => {
    const resumo = resumirCatalogoParaPrompt([
      produtoDeTeste("PH-001", {
        nome: "Shampoo X",
        linha: "Linha Y",
        uso: "ambos",
        indicado_para: ["frizz", "cabelos com química"],
      }),
      produtoDeTeste("PH-002", { nome: "Kit Z", categoria: "kit", uso: null, indicado_para: [] }),
    ]);
    expect(resumo.split("\n")).toEqual([
      "- PH-001 | Shampoo X | categoria: shampoo | linha: Linha Y | uso: ambos | indicado para: frizz; cabelos com química",
      "- PH-002 | Kit Z | categoria: kit | uso: não informado",
    ]);
  });

  it("não inclui preço nem estoque", () => {
    const resumo = resumirCatalogoParaPrompt([
      produtoDeTeste("PH-001", { preco: 189.9, preco_promocional: 149.9, estoque_teste: 7 }),
    ]);
    expect(resumo).not.toMatch(/189|149|R\$|estoque|\b7\b/);
  });
});

describe("montarPromptSistema", () => {
  const catalogo = carregarCatalogo();
  const prompt = montarPromptSistema(catalogo.produtos);

  it("injeta os 15 produtos no lugar do marcador", () => {
    expect(prompt).not.toContain("{{CATALOGO}}");
    for (const p of catalogo.produtos) expect(prompt).toContain(`- ${p.id} | ${p.nome}`);
  });

  it("nenhum preço do catálogo aparece no prompt", () => {
    for (const p of catalogo.produtos) {
      const valores = [p.preco, p.preco_promocional].filter((v): v is number => v !== null);
      for (const v of valores) expect(prompt).not.toContain(v.toFixed(2).replace(".", ","));
    }
  });

  it("tem os blocos pedidos na especificação (Parte 5) e nos requisitos", () => {
    for (const bloco of [
      "## 1. Persona",
      "## 2. Objetivo",
      "## 3. Roteiro de venda",
      "## 4. Regras de uso das ferramentas",
      "## 5. Gatilhos permitidos",
      "## 6. Limites",
      "## 7. Formato das respostas",
      "## 8. Catálogo resumido",
    ]) {
      expect(prompt).toContain(bloco);
    }
  });

  it("cita todas as ferramentas registradas", () => {
    for (const f of todasAsFerramentas) expect(prompt).toContain(`\`${f.nome}\``);
  });

  it("exige exatamente um marcador de catálogo", () => {
    expect(() => montarPromptSistema([], "sem marcador")).toThrow(/exatamente um marcador/);
    expect(() => montarPromptSistema([], "{{CATALOGO}} {{CATALOGO}}")).toThrow(/encontrados: 2/);
  });

  it("o prompt fica em prompts/sofia.md, não no código", () => {
    expect(readFileSync(CAMINHO_PROMPT, "utf8")).toContain("Você é a Sofia");
  });
});
