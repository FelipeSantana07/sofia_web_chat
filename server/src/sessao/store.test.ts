import { describe, expect, it } from "vitest";
import { perfilVazio } from "@sofia/shared";
import { criarStoreSessoes } from "./store.js";

describe("criarStoreSessoes", () => {
  it("cria uma sessão vazia com id gerado", () => {
    const store = criarStoreSessoes({ gerarId: () => "abc-123", agora: () => 1000 });
    const s = store.obterOuCriar();
    expect(s).toEqual({
      id: "abc-123",
      perfil: perfilVazio(),
      carrinho: { itens: [] },
      cupom: null,
      entrega: null,
      pedidos: [],
      avisosPendentes: [],
      historico: [],
      criadoEm: 1000,
      atualizadoEm: 1000,
    });
  });

  it("devolve a mesma sessão para o mesmo id", () => {
    const store = criarStoreSessoes();
    const a = store.obterOuCriar("cliente-1");
    a.cupom = "PROHALL10";
    const b = store.obterOuCriar("cliente-1");
    expect(b).toBe(a);
    expect(b.cupom).toBe("PROHALL10");
    expect(store.tamanho()).toBe(1);
  });

  it("isola o estado entre sessões", () => {
    const store = criarStoreSessoes();
    const a = store.obterOuCriar("a");
    const b = store.obterOuCriar("b");
    a.perfil.nome = "Ana";
    a.carrinho = { itens: [{ produtoId: "PH-001", quantidade: 1 }] };
    expect(b.perfil.nome).toBeNull();
    expect(b.carrinho.itens).toEqual([]);
    expect(store.tamanho()).toBe(2);
  });

  it("não compartilha o perfil entre sessões novas", () => {
    const store = criarStoreSessoes();
    const a = store.obterOuCriar("a");
    a.perfil.incomodo = "frizz";
    expect(store.obterOuCriar("b").perfil.incomodo).toBeNull();
  });

  it("obter não cria sessão", () => {
    const store = criarStoreSessoes();
    expect(store.obter("nova")).toBeUndefined();
    expect(store.tamanho()).toBe(0);
    store.obterOuCriar("nova");
    expect(store.obter("nova")).toBeDefined();
  });

  it("remove uma sessão", () => {
    const store = criarStoreSessoes();
    store.obterOuCriar("a");
    expect(store.remover("a")).toBe(true);
    expect(store.remover("a")).toBe(false);
    expect(store.obter("a")).toBeUndefined();
  });

  it("gera ids diferentes por padrão", () => {
    const store = criarStoreSessoes();
    expect(store.obterOuCriar().id).not.toBe(store.obterOuCriar().id);
  });

  it("rejeita ids com caracteres inseguros ou longos demais", () => {
    const store = criarStoreSessoes();
    expect(() => store.obterOuCriar("../etc")).toThrow(/inválido/);
    expect(() => store.obterOuCriar("")).toThrow(/inválido/);
    expect(() => store.obterOuCriar("a".repeat(101))).toThrow(/inválido/);
    expect(store.obterOuCriar("a".repeat(100)).id).toHaveLength(100);
  });
});
