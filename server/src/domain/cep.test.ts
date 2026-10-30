import { describe, expect, it } from "vitest";
import { identificarZona, normalizarCep } from "./cep.js";

describe("normalizarCep", () => {
  it("aceita com ou sem hífen", () => {
    expect(normalizarCep("01310-100")).toBe("01310100");
    expect(normalizarCep("01310100")).toBe("01310100");
    expect(normalizarCep(" 01310-100 ")).toBe("01310100");
  });

  it("rejeita o que não tem 8 dígitos", () => {
    expect(normalizarCep("1234567")).toBeNull();
    expect(normalizarCep("123456789")).toBeNull();
    expect(normalizarCep("abcdefgh")).toBeNull();
    expect(normalizarCep("")).toBeNull();
    expect(normalizarCep("0131-0100")).toBeNull();
  });
});

describe("identificarZona", () => {
  it.each([
    ["01000-000", "Z1"],
    ["19999-999", "Z1"],
    ["30000-000", "Z1"],
    ["39999-999", "Z1"],
    ["20000-000", "Z2"],
    ["29999-999", "Z2"],
    ["80000-000", "Z2"],
    ["89999-999", "Z2"],
    ["70000-000", "Z3"],
    ["76799-999", "Z3"],
    ["78000-000", "Z3"],
    ["79999-999", "Z3"],
    ["90000-000", "Z3"],
    ["99999-999", "Z3"],
    ["40000-000", "Z4"],
    ["65999-999", "Z4"],
    ["66000-000", "Z5"],
    ["69999-999", "Z5"],
    ["76800-000", "Z5"],
    ["77999-999", "Z5"],
  ])("CEP %s está na zona %s", (cep, zona) => {
    expect(identificarZona(cep)).toEqual({ ok: true, zona });
  });

  it("respeita os limites entre zonas", () => {
    expect(identificarZona("19999999")).toEqual({ ok: true, zona: "Z1" });
    expect(identificarZona("20000000")).toEqual({ ok: true, zona: "Z2" });
    expect(identificarZona("76799999")).toEqual({ ok: true, zona: "Z3" });
    expect(identificarZona("76800000")).toEqual({ ok: true, zona: "Z5" });
  });

  it("rejeita CEP fora das faixas", () => {
    expect(identificarZona("00000-000")).toMatchObject({ ok: false });
    expect(identificarZona("00999-999")).toMatchObject({ ok: false });
  });

  it("devolve mensagem amigável para CEP malformado", () => {
    const r = identificarZona("123");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/CEP/);
  });
});
