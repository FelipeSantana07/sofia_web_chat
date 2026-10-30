import { describe, expect, it } from "vitest";
import { CUPOM_PROHALL10, reavaliarCupom, validarCupom } from "./cupom.js";

describe("validarCupom", () => {
  it("aplica 10% sobre o subtotal", () => {
    expect(validarCupom("PROHALL10", 30000)).toEqual({
      ok: true,
      codigo: CUPOM_PROHALL10,
      descontoCentavos: 3000,
    });
  });

  it("aceita o mínimo exato de R$ 150,00", () => {
    expect(validarCupom("PROHALL10", 15000)).toMatchObject({ ok: true, descontoCentavos: 1500 });
  });

  it("recusa abaixo do mínimo e informa quanto falta", () => {
    const r = validarCupom("PROHALL10", 14999);
    expect(r).toMatchObject({ ok: false, motivo: "abaixo_do_minimo", faltaParaMinimoCentavos: 1 });
  });

  it("normaliza maiúsculas e espaços", () => {
    expect(validarCupom("  prohall10 ", 20000)).toMatchObject({ ok: true, codigo: "PROHALL10" });
  });

  it("qualquer outro código é inválido", () => {
    expect(validarCupom("PROHALL20", 30000)).toMatchObject({ ok: false, motivo: "invalido" });
    expect(validarCupom("DESCONTO50", 30000)).toMatchObject({ ok: false, motivo: "invalido" });
    expect(validarCupom("", 30000)).toMatchObject({ ok: false, motivo: "invalido" });
  });

  it("arredonda o desconto no centavo (meio para cima)", () => {
    expect(validarCupom("PROHALL10", 15005)).toMatchObject({ ok: true, descontoCentavos: 1501 });
  });

  it("devolve mensagens amigáveis", () => {
    const a = validarCupom("XYZ", 30000);
    const b = validarCupom("PROHALL10", 10000);
    if (!a.ok) expect(a.erro).toMatch(/cupom/i);
    if (!b.ok) expect(b.erro).toMatch(/150,00/);
  });
});

describe("reavaliarCupom", () => {
  it("sem cupom aplicado não há desconto nem aviso", () => {
    expect(reavaliarCupom(null, 30000)).toEqual({ codigo: null, descontoCentavos: 0, perdeuValidade: false });
  });

  it("mantém o cupom enquanto o subtotal atinge o mínimo", () => {
    expect(reavaliarCupom("PROHALL10", 20000)).toEqual({
      codigo: "PROHALL10",
      descontoCentavos: 2000,
      perdeuValidade: false,
    });
  });

  it("perde a validade se o subtotal cair abaixo de R$ 150,00", () => {
    expect(reavaliarCupom("PROHALL10", 14000)).toEqual({
      codigo: null,
      descontoCentavos: 0,
      perdeuValidade: true,
    });
  });

  it("recalcula o desconto quando o subtotal muda", () => {
    expect(reavaliarCupom("PROHALL10", 40000).descontoCentavos).toBe(4000);
  });
});
