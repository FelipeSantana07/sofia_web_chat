import { describe, expect, it } from "vitest";
import { descreverAjustes, ErroDeConfiguracao, lerConfigGemini, lerModeloGemini } from "./config.js";

describe("lerConfigGemini", () => {
  it("lê a chave e o modelo do ambiente", () => {
    expect(lerConfigGemini({ GEMINI_API_KEY: "chave", GEMINI_MODEL: "gemini-3.8-flash" })).toEqual({
      apiKey: "chave",
      modelo: "gemini-3.8-flash",
    });
  });

  it("não tem modelo padrão: GEMINI_MODEL ausente é erro", () => {
    expect(() => lerConfigGemini({ GEMINI_API_KEY: "chave" })).toThrow(ErroDeConfiguracao);
    expect(() => lerConfigGemini({ GEMINI_API_KEY: "chave" })).toThrow("Defina GEMINI_MODEL no arquivo .env");
  });

  it("lista todas as variáveis que faltam", () => {
    expect(() => lerConfigGemini({})).toThrow("Defina GEMINI_API_KEY e GEMINI_MODEL no arquivo .env");
  });

  it("valor vazio ou só com espaços conta como ausente", () => {
    expect(() => lerConfigGemini({ GEMINI_API_KEY: "chave", GEMINI_MODEL: "  " })).toThrow(/GEMINI_MODEL/);
    expect(() => lerConfigGemini({ GEMINI_API_KEY: "", GEMINI_MODEL: "m" })).toThrow(/GEMINI_API_KEY/);
  });

  it("remove espaços das pontas", () => {
    expect(lerConfigGemini({ GEMINI_API_KEY: " chave ", GEMINI_MODEL: " gemini-3.8-flash " })).toEqual({
      apiKey: "chave",
      modelo: "gemini-3.8-flash",
    });
  });

  it("recusa a chave de mentira do modo mock", () => {
    expect(() => lerConfigGemini({ GEMINI_API_KEY: "mock", GEMINI_MODEL: "m" })).toThrow(/mock só vale/);
  });
});

describe("lerModeloGemini", () => {
  it("lê só o modelo, sem exigir a chave (modo mock do gemini:teste)", () => {
    expect(lerModeloGemini({ GEMINI_MODEL: "gemini-3.8-flash" })).toBe("gemini-3.8-flash");
  });

  it("GEMINI_MODEL ausente é erro", () => {
    expect(() => lerModeloGemini({})).toThrow("Defina GEMINI_MODEL no arquivo .env");
  });
});

describe("ajustes opcionais do modelo", () => {
  const base = { GEMINI_API_KEY: "chave", GEMINI_MODEL: "m" };

  it("sem os ajustes, fica com o padrão do modelo (nada definido)", () => {
    const config = lerConfigGemini(base);
    expect(config).not.toHaveProperty("temperatura");
    expect(config).not.toHaveProperty("nivelPensamento");
    expect(descreverAjustes(config)).toBe("temperatura padrão do modelo, pensamento padrão do modelo");
  });

  it("lê temperatura e nível de pensamento (sem diferenciar caixa)", () => {
    const config = lerConfigGemini({ ...base, GEMINI_TEMPERATURE: "0.3", GEMINI_THINKING_LEVEL: "low" });
    expect(config).toMatchObject({ temperatura: 0.3, nivelPensamento: "LOW" });
    expect(descreverAjustes(config)).toBe("temperatura 0.3, pensamento LOW");
  });

  it("aceita temperatura 0 e trata valor vazio como não definido", () => {
    expect(lerConfigGemini({ ...base, GEMINI_TEMPERATURE: "0" }).temperatura).toBe(0);
    expect(lerConfigGemini({ ...base, GEMINI_TEMPERATURE: " ", GEMINI_THINKING_LEVEL: "" })).not.toHaveProperty("temperatura");
  });

  it("recusa valores fora do esperado com mensagem clara", () => {
    expect(() => lerConfigGemini({ ...base, GEMINI_TEMPERATURE: "3" })).toThrow(/GEMINI_TEMPERATURE deve ser um número de 0 a 2/);
    expect(() => lerConfigGemini({ ...base, GEMINI_TEMPERATURE: "baixa" })).toThrow(/GEMINI_TEMPERATURE/);
    expect(() => lerConfigGemini({ ...base, GEMINI_THINKING_LEVEL: "NENHUM" })).toThrow(/GEMINI_THINKING_LEVEL deve ser MINIMAL, LOW, MEDIUM, HIGH/);
  });
});
