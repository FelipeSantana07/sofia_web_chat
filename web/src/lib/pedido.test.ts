import { describe, expect, it } from "vitest";
import { criarPedido, type EstadoPedido } from "./pedido.js";
import type { DadosCheckoutForm, PedidoView } from "./tipos.js";

const din = (c: number) => ({ centavos: c, texto: `R$ ${(c / 100).toFixed(2).replace(".", ",")}` });

function pedidoView(extra: Partial<PedidoView> = {}): PedidoView {
  return {
    id: "PH-TESTE-000001",
    status: "aguardando_pagamento",
    cliente: { nome: "Ana", email: "ana@teste.com" },
    entrega: { cep: "01310-100", endereco: "Av. Teste", numero: "1", complemento: null, nome_modalidade: "Econômica", prazo: "3 a 5 dias úteis" },
    itens: [],
    cupom: null,
    totais: {
      subtotal: din(10000),
      desconto_cupom: din(0),
      base_produtos: din(10000),
      frete: din(1890),
      frete_gratis: false,
      desconto_pix: din(500),
      total_no_pix: din(11390),
    },
    pix: null,
    ...extra,
  };
}
const comPix = (segundos = 900, status: "ativo" | "expirado" | "pago" = "ativo"): PedidoView =>
  pedidoView({
    pix: {
      copia_e_cola: "PIX-TESTE|PROHALL|PH-TESTE-000001|113.90|NAO-PAGAVEL",
      valor: din(11390),
      status,
      gerado_em: "",
      expira_em: "",
      segundos_restantes: segundos,
      aviso: "teste",
    },
  });

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const FORM: DadosCheckoutForm = {
  nome: "Ana",
  email: "ana@teste.com",
  cep: "01310-100",
  endereco: "Av. Teste",
  numero: "1",
  complemento: " ",
  modalidade_frete: "economica",
};

function montar(...respostas: (Response | Error)[]) {
  const pedidos: { url: string; metodo: string; corpo?: Record<string, unknown> }[] = [];
  const buscar = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url, metodo: init?.method ?? "GET", corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = respostas.shift();
    if (!r) throw new Error("sem resposta combinada");
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  const eventos = { carrinho: 0, falas: [] as string[] };
  const controle = criarPedido({
    obterSessaoId: () => "s-1",
    fetch: buscar,
    agora: () => 1_000_000,
    aoMudarCarrinho: () => void eventos.carrinho++,
    aoPagar: (m) => eventos.falas.push(m),
  });
  let atual!: EstadoPedido;
  controle.subscribe((e) => (atual = e));
  return { controle, estado: () => atual, pedidos, eventos };
}

describe("criarPedido", () => {
  it("começa sem tela aberta nem pedido", () => {
    expect(montar().estado()).toMatchObject({ tela: "nenhuma", pedido: null, qrSvg: null, limiteEm: null, ocupado: false });
  });

  it("abre e fecha o checkout", () => {
    const { controle, estado } = montar();
    controle.abrirCheckout();
    expect(estado().tela).toBe("checkout");
    controle.fechar();
    expect(estado().tela).toBe("nenhuma");
  });

  it("consulta o frete do CEP e manda recarregar o carrinho", async () => {
    const { controle, pedidos, eventos } = montar(json({ ok: true, opcoes: [] }));
    expect(await controle.consultarFrete("01310-100")).toEqual({ ok: true });
    expect(pedidos[0]).toEqual({ url: "/api/sessoes/s-1/frete", metodo: "POST", corpo: { cep: "01310-100" } });
    expect(eventos.carrinho).toBe(1);
  });

  it("devolve o erro de um CEP inválido", async () => {
    const { controle, eventos } = montar(json({ ok: false, erro: "CEP inválido" }, 422));
    expect(await controle.consultarFrete("12")).toEqual({ ok: false, erro: "CEP inválido" });
    expect(eventos.carrinho).toBe(0);
  });

  it("finaliza pelo formulário, esvazia o carrinho e já gera o PIX com o QR Code", async () => {
    const { controle, estado, pedidos, eventos } = montar(
      json({ pedido: pedidoView() }, 201),
      json({ pedido: comPix(900), qr_svg: "<svg></svg>", reaproveitado: false }),
    );
    expect(await controle.finalizar(FORM)).toBe(true);

    expect(pedidos[0]?.url).toBe("/api/sessoes/s-1/checkout");
    expect(pedidos[0]?.corpo).toMatchObject({ nome: "Ana", modalidade_frete: "economica" });
    expect(pedidos[0]?.corpo).not.toHaveProperty("complemento"); // vazio não é enviado
    expect(pedidos[1]?.url).toBe("/api/sessoes/s-1/pedidos/PH-TESTE-000001/pix");
    expect(estado()).toMatchObject({ tela: "pix", qrSvg: "<svg></svg>", ocupado: false, erro: null });
    expect(estado().pedido?.pix?.copia_e_cola).toContain("NAO-PAGAVEL");
    expect(estado().limiteEm).toBe(1_000_000 + 900_000);
    expect(eventos.carrinho).toBe(1);
  });

  it("mostra o erro por campo quando o servidor recusa o formulário", async () => {
    const { controle, estado } = montar(
      json({ ok: false, erro: "Argumentos inválidos", campos: [{ campo: "email", problema: "e-mail inválido" }] }, 400),
    );
    expect(await controle.finalizar({ ...FORM, email: "x" })).toBe(false);
    expect(estado()).toMatchObject({ tela: "nenhuma", erro: "Argumentos inválidos", camposComErro: { email: "e-mail inválido" } });
  });

  it("mostra a recusa de negócio (estoque) sem abrir o PIX", async () => {
    const { controle, estado } = montar(json({ ok: false, motivo: "estoque_insuficiente", erro: "Restam 1 unidade(s)." }, 422));
    expect(await controle.finalizar(FORM)).toBe(false);
    expect(estado()).toMatchObject({ pedido: null, erro: "Restam 1 unidade(s)." });
  });

  it("gera outro PIX e troca o QR Code", async () => {
    const { controle, estado } = montar(
      json({ pedido: pedidoView() }, 201),
      json({ pedido: comPix(900), qr_svg: "<svg>1</svg>" }),
      json({ pedido: comPix(900), qr_svg: "<svg>2</svg>" }),
    );
    await controle.finalizar(FORM);
    expect(await controle.gerarPix()).toBe(true);
    expect(estado().qrSvg).toBe("<svg>2</svg>");
  });

  it("paga: marca o pedido como pago, para a contagem e faz a Sofia confirmar no chat", async () => {
    const { controle, estado, eventos, pedidos } = montar(
      json({ pedido: pedidoView() }, 201),
      json({ pedido: comPix(900), qr_svg: "<svg></svg>" }),
      json({ pedido: { ...comPix(900, "pago"), status: "pago" }, mensagem: "Pagamento confirmado, Ana!", ja_estava_pago: false }),
    );
    await controle.finalizar(FORM);
    expect(await controle.pagar()).toEqual({ ok: true });
    expect(pedidos[2]?.url).toBe("/api/sessoes/s-1/pedidos/PH-TESTE-000001/pagar");
    expect(estado().pedido?.status).toBe("pago");
    expect(estado().limiteEm).toBeNull();
    expect(eventos.falas).toEqual(["Pagamento confirmado, Ana!"]);
  });

  it("não repete a confirmação se o pedido já estava pago", async () => {
    const { controle, eventos } = montar(
      json({ pedido: pedidoView() }, 201),
      json({ pedido: comPix(900), qr_svg: "" }),
      json({ pedido: { ...comPix(900, "pago"), status: "pago" }, mensagem: "x", ja_estava_pago: true }),
    );
    await controle.finalizar(FORM);
    await controle.pagar();
    expect(eventos.falas).toEqual([]);
  });

  it("mostra a recusa do pagamento (PIX expirado)", async () => {
    const { controle, estado } = montar(
      json({ pedido: pedidoView() }, 201),
      json({ pedido: comPix(900), qr_svg: "" }),
      json({ ok: false, erro: "O PIX expirou. Gere outro para pagar." }, 409),
    );
    await controle.finalizar(FORM);
    expect(await controle.pagar()).toEqual({ ok: false, erro: "O PIX expirou. Gere outro para pagar." });
    expect(estado().pedido?.status).toBe("aguardando_pagamento");
    expect(estado().erro).toMatch(/expirou/);
  });

  it("trata falha de rede", async () => {
    const { controle, estado } = montar(new TypeError("Failed to fetch"));
    expect(await controle.finalizar(FORM)).toBe(false);
    expect(estado().erro).toMatch(/servidor/);
    expect(estado().ocupado).toBe(false);
  });

  describe("quando a Sofia fecha o pedido pela conversa", () => {
    const ferramenta = (nome: string, resultado: Record<string, unknown>) =>
      ({ tipo: "ferramenta", nome, argumentos: {}, duracaoMs: 1, resultado }) as const;

    it("guarda o pedido ao finalizar e recarrega o carrinho", () => {
      const { controle, estado, eventos } = montar();
      controle.aoEvento(ferramenta("finalizar_pedido", { ok: true, pedido: pedidoView() }));
      expect(estado().pedido?.id).toBe("PH-TESTE-000001");
      expect(estado().tela).toBe("nenhuma");
      expect(eventos.carrinho).toBe(1);
    });

    it("abre a tela do PIX ao gerar o PIX e busca o QR Code", async () => {
      const { controle, estado, pedidos } = montar(json({ pedido: comPix(840), qr_svg: "<svg>q</svg>" }));
      controle.aoEvento(ferramenta("gerar_pix", { ok: true, pedido: comPix(900) }));
      expect(estado().tela).toBe("pix");
      await new Promise((r) => setTimeout(r, 0));
      expect(pedidos[0]?.url).toBe("/api/sessoes/s-1/pedidos/PH-TESTE-000001");
      expect(estado().qrSvg).toBe("<svg>q</svg>");
    });

    it("não reabre a tela que a cliente fechou quando a Sofia repete o mesmo PIX", async () => {
      const mesmoPix = () => ferramenta("gerar_pix", { ok: true, pedido: comPix(900) });
      const { controle, estado } = montar(json({ pedido: comPix(900), qr_svg: "<svg>q</svg>" }), json({ pedido: comPix(880), qr_svg: "<svg>q</svg>" }));
      controle.aoEvento(mesmoPix());
      expect(estado().tela).toBe("pix");
      controle.fechar();
      controle.aoEvento(mesmoPix());
      expect(estado().tela).toBe("nenhuma");
    });

    it("ignora ferramentas sem pedido, com erro ou de outro tipo", () => {
      const { controle, estado } = montar();
      controle.aoEvento(ferramenta("gerar_pix", { ok: false, erro: "x" }));
      controle.aoEvento(ferramenta("ver_carrinho", { ok: true, carrinho: {} }));
      controle.aoEvento({ tipo: "texto", delta: "oi" });
      expect(estado().pedido).toBeNull();
      expect(estado().tela).toBe("nenhuma");
    });
  });
});
