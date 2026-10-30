import { describe, expect, it } from "vitest";
import { criarCarrinho, type EstadoCarrinho } from "./carrinho.js";
import type { Carrinho } from "./tipos.js";

const dinheiro = (centavos: number) => ({ centavos, texto: `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}` });

function carrinhoCom(...itens: [string, number][]): Carrinho {
  return {
    itens: itens.map(([id, quantidade]) => ({
      id,
      nome: `Produto ${id}`,
      quantidade,
      preco_unitario: dinheiro(10000),
      total_do_item: dinheiro(10000 * quantidade),
    })),
    vazio: itens.length === 0,
    subtotal: dinheiro(0),
    cupom: null,
    base_produtos: dinheiro(0),
    economia_no_pix: dinheiro(0),
    entrega: null,
  };
}

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

function fetchFalso(...respostas: (Response | Error)[]) {
  const pedidos: { url: string; metodo: string; corpo?: unknown }[] = [];
  const buscar = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url, metodo: init?.method ?? "GET", corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = respostas.shift();
    if (!r) throw new Error("sem resposta combinada");
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { buscar, pedidos };
}

function observar(c: ReturnType<typeof criarCarrinho>) {
  let atual!: EstadoCarrinho;
  c.subscribe((e) => (atual = e));
  return () => atual;
}

describe("criarCarrinho", () => {
  it("começa vazio, fechado e sem contador", () => {
    const estado = observar(criarCarrinho({ obterSessaoId: () => null, fetch: fetchFalso().buscar }));
    expect(estado()).toEqual({ carrinho: null, quantidade: 0, ocupado: false, erro: null, aberto: false });
  });

  it("adiciona pelo servidor e conta as unidades", async () => {
    const { buscar, pedidos } = fetchFalso(json({ ok: true, carrinho: carrinhoCom(["PH-001", 2], ["PH-004", 1]) }));
    const c = criarCarrinho({ obterSessaoId: () => "s-1", fetch: buscar });
    const estado = observar(c);

    expect(await c.adicionar("PH-001")).toEqual({ ok: true });
    expect(pedidos[0]).toEqual({ url: "/api/sessoes/s-1/carrinho/itens", metodo: "POST", corpo: { id: "PH-001", quantidade: 1 } });
    expect(estado().quantidade).toBe(3);
    expect(estado().ocupado).toBe(false);
  });

  it("mostra a recusa do servidor e não mexe no carrinho", async () => {
    const { buscar } = fetchFalso(
      json({ ok: true, carrinho: carrinhoCom(["PH-001", 1]) }),
      json({ ok: false, erro: "Só há 2 unidade(s) em estoque." }, 422),
    );
    const c = criarCarrinho({ obterSessaoId: () => "s-1", fetch: buscar });
    const estado = observar(c);
    await c.adicionar("PH-001");

    expect(await c.adicionar("PH-001", 5)).toEqual({ ok: false, erro: "Só há 2 unidade(s) em estoque." });
    expect(estado().erro).toBe("Só há 2 unidade(s) em estoque.");
    expect(estado().quantidade).toBe(1);
  });

  it("não adianta antes de existir uma conversa", async () => {
    const { buscar, pedidos } = fetchFalso();
    const c = criarCarrinho({ obterSessaoId: () => null, fetch: buscar });
    expect((await c.adicionar("PH-001")).ok).toBe(false);
    expect(pedidos).toHaveLength(0);
  });

  it("remove uma unidade (com quantidade) ou o item inteiro (sem)", async () => {
    const { buscar, pedidos } = fetchFalso(
      json({ ok: true, carrinho: carrinhoCom(["PH-001", 2]) }),
      json({ ok: true, carrinho: carrinhoCom() }),
    );
    const c = criarCarrinho({ obterSessaoId: () => "s-1", fetch: buscar });
    const estado = observar(c);
    await c.remover("PH-001", 1);
    await c.remover("PH-001");

    expect(pedidos.map((p) => [p.metodo, p.url])).toEqual([
      ["DELETE", "/api/sessoes/s-1/carrinho/itens/PH-001?quantidade=1"],
      ["DELETE", "/api/sessoes/s-1/carrinho/itens/PH-001"],
    ]);
    expect(estado().quantidade).toBe(0);
  });

  it("trata falha de rede com um aviso", async () => {
    const c = criarCarrinho({ obterSessaoId: () => "s-1", fetch: fetchFalso(new TypeError("Failed to fetch")).buscar });
    const estado = observar(c);
    expect((await c.adicionar("PH-001")).ok).toBe(false);
    expect(estado().erro).toMatch(/servidor/);
    expect(estado().ocupado).toBe(false);
  });

  it("atualiza o carrinho a partir do servidor", async () => {
    const { buscar, pedidos } = fetchFalso(json({ carrinho: carrinhoCom(["PH-002", 1]) }));
    const c = criarCarrinho({ obterSessaoId: () => "s-1", fetch: buscar });
    const estado = observar(c);
    await c.atualizar();
    expect(pedidos[0]).toMatchObject({ url: "/api/sessoes/s-1/carrinho", metodo: "GET" });
    expect(estado().quantidade).toBe(1);
  });

  it("acompanha a Sofia: o carrinho que veio numa ferramenta já aparece", () => {
    const c = criarCarrinho({ obterSessaoId: () => "s-1", fetch: fetchFalso().buscar });
    const estado = observar(c);
    c.aoEvento({ tipo: "ferramenta", nome: "adicionar_ao_carrinho", argumentos: {}, duracaoMs: 1, resultado: { ok: true, carrinho: carrinhoCom(["PH-001", 3]) } });
    expect(estado().quantidade).toBe(3);

    c.aoEvento({ tipo: "ferramenta", nome: "adicionar_ao_carrinho", argumentos: {}, duracaoMs: 1, resultado: { ok: false, erro: "sem estoque" } });
    c.aoEvento({ tipo: "texto", delta: "oi" });
    expect(estado().quantidade).toBe(3);
  });

  it("abre e fecha o painel", () => {
    const c = criarCarrinho({ obterSessaoId: () => "s-1", fetch: fetchFalso().buscar });
    const estado = observar(c);
    c.abrir();
    expect(estado().aberto).toBe(true);
    c.fechar();
    expect(estado().aberto).toBe(false);
  });
});
