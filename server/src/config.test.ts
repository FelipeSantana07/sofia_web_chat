import { describe, expect, it } from "vitest";
import { ErroDeConfiguracao, lerConfigGemini, lerModeloGemini } from "./config.js";

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
