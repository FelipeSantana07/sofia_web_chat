import { describe, expect, it } from "vitest";
import { gerarRelatorio, type ResultadoRoteiro } from "./relatorio.js";

function resultado(id: string, ok: boolean, execucao = 1): ResultadoRoteiro {
  return {
    execucao,
    conversa: {
      roteiro: { id, titulo: `Roteiro ${id}`, objetivo: "testar", mensagens: ["oi"], espera: {} },
      turnos: [
        {
          cliente: "Meu CEP é 123",
          sofia: "Esse CEP é inválido.\nPode conferir?",
          ferramentas: [{ nome: "calcular_frete", argumentos: { cep: "123" }, resultado: { ok: false, erro: "CEP inválido" }, duracaoMs: 2 }],
          duracaoMs: 2300,
        },
      ],
    },
    verificacoes: [
      { descricao: "`calcular_frete` recusa (ok: false)", ok: true },
      { descricao: "a Sofia diz algo como /CEP/", ok, ...(ok ? {} : { detalhe: "não apareceu | nas falas" }) },
    ],
  };
}

describe("gerarRelatorio", () => {
  const md = gerarRelatorio({ modelo: "gemini-teste", quando: "30/10/2026 10:00", resultados: [resultado("a", true), resultado("b", false)] });

  it("traz o resumo com modelo, data e contagem", () => {
    expect(md).toContain("- **Modelo:** gemini-teste");
    expect(md).toContain("- **Quando:** 30/10/2026 10:00");
    expect(md).toContain("1 de 2 roteiro(s) com todas as verificações ok");
  });

  it("lista as falhas na tabela, escapando o separador", () => {
    expect(md).toContain("| Roteiro a | ✅ | — |");
    expect(md).toContain("| Roteiro b | ❌ | a Sofia diz algo como /CEP/ |");
  });

  it("mostra cada conversa com ferramentas, falas citadas e verificações", () => {
    expect(md).toContain("## ❌ Roteiro b (`b`)");
    expect(md).toContain("**1. Cliente:** Meu CEP é 123");
    expect(md).toContain('- `calcular_frete({"cep":"123"})` → erro: CEP inválido');
    expect(md).toContain("**Sofia** (2.3 s):\n\n> Esse CEP é inválido.\n> Pode conferir?");
    expect(md).toContain("- ❌ a Sofia diz algo como /CEP/ — não apareceu | nas falas");
  });

  it("numera as execuções quando um roteiro roda mais de uma vez", () => {
    const varias = gerarRelatorio({ modelo: "m", quando: "q", resultados: [resultado("a", true, 1), resultado("a", true, 2)] });
    expect(varias).toContain("## ✅ Roteiro a · execução 2 (`a`)");
    expect(varias).toContain("| Roteiro a (2) | ✅ | — |");
  });
});
