import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ferramentasCarrinhoFrete } from "./carrinho-frete.js";
import { ferramentasCatalogoPerfil } from "./catalogo-perfil.js";

const todas = [...ferramentasCatalogoPerfil, ...ferramentasCarrinhoFrete];

describe("conjunto de ferramentas", () => {
  it("tem os nomes da Parte 4 da especificação, sem repetição", () => {
    const nomes = todas.map((f) => f.nome);
    expect(nomes).toEqual([
      "buscar_produtos",
      "detalhar_produto",
      "produtos_complementares",
      "mostrar_produtos",
      "atualizar_perfil",
      "adicionar_ao_carrinho",
      "remover_do_carrinho",
      "aplicar_cupom",
      "ver_carrinho",
      "calcular_frete",
    ]);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("toda ferramenta tem descrição", () => {
    for (const f of todas) expect(f.descricao.length).toBeGreaterThan(20);
  });

  it("todo schema vira JSON Schema de objeto (base da declaração de função do Gemini, T-20)", () => {
    for (const f of todas) {
      const schema = z.toJSONSchema(f.parametros) as { type: string; properties: Record<string, unknown> };
      expect(schema.type, f.nome).toBe("object");
      expect(schema.properties, f.nome).toBeDefined();
    }
  });
});
