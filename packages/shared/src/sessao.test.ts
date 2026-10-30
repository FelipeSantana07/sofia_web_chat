import { describe, expect, it } from "vitest";
import { perfilClienteSchema, perfilVazio } from "./index.js";

describe("perfilClienteSchema", () => {
  it("o perfil vazio é válido e tem tudo null", () => {
    expect(perfilClienteSchema.safeParse(perfilVazio()).success).toBe(true);
    expect(Object.values(perfilVazio()).every((v) => v === null)).toBe(true);
  });

  it("aceita um perfil preenchido", () => {
    const r = perfilClienteSchema.safeParse({
      nome: "Ana",
      tipo_cabelo: "cacheado",
      quimica: "progressiva",
      incomodo: "frizz",
      uso: "home_care",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita uso desconhecido", () => {
    expect(perfilClienteSchema.safeParse({ ...perfilVazio(), uso: "ambos" }).success).toBe(false);
  });

  it("cada chamada devolve um objeto novo", () => {
    expect(perfilVazio()).not.toBe(perfilVazio());
  });
});
