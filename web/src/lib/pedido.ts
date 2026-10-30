import type { EventoChat } from "./sse.js";
import type { DadosCheckoutForm, PedidoView } from "./tipos.js";

export type TelaPedido = "nenhuma" | "checkout" | "pix";

export interface EstadoPedido {
  tela: TelaPedido;
  /** O pedido mais recente da conversa, ou null. */
  pedido: PedidoView | null;
  /** QR Code do PIX em SVG, gerado no servidor. */
  qrSvg: string | null;
  /** Instante (relógio local) em que o PIX expira, calculado a partir do tempo restante que o servidor informou. */
  limiteEm: number | null;
  ocupado: boolean;
  erro: string | null;
  /** Problemas por campo do formulário, vindos do servidor. */
  camposComErro: Record<string, string>;
}

export interface ResultadoPagamento {
  ok: boolean;
  erro?: string;
}

export interface OpcoesPedido {
  /** Id da conversa atual; null antes da primeira mensagem. */
  obterSessaoId: () => string | null;
  /** O pedido muda o carrinho (esvazia) e o CEP: quem mostra o carrinho deve recarregar. */
  aoMudarCarrinho?: () => void;
  /** A Sofia "fala" no chat quando o pagamento é confirmado. */
  aoPagar?: (mensagemDaSofia: string) => void;
  /** Trocado nos testes. */
  fetch?: typeof fetch;
  agora?: () => number;
}

export interface ControlePedido {
  /** Contrato de store do Svelte: use `$pedido` nos componentes. */
  subscribe(ouvinte: (estado: EstadoPedido) => void): () => void;
  abrirCheckout(): void;
  abrirPix(): Promise<void>;
  fechar(): void;
  /** Calcula o frete de um CEP para o carrinho atual (o carrinho é recarregado em seguida). */
  consultarFrete(cep: string): Promise<{ ok: boolean; erro?: string }>;
  /** Fecha o pedido pelo formulário e já mostra o PIX. */
  finalizar(dados: DadosCheckoutForm): Promise<boolean>;
  /** Gera o PIX; só sai um novo depois que o anterior expirou. */
  gerarPix(): Promise<boolean>;
  pagar(): Promise<ResultadoPagamento>;
  /** Acompanha a Sofia: pedido e PIX criados por ferramenta também aparecem na tela. */
  aoEvento(evento: EventoChat): void;
}

const MENSAGEM_REDE = "Não consegui falar com o servidor. Tente de novo.";

const vazio: EstadoPedido = {
  tela: "nenhuma",
  pedido: null,
  qrSvg: null,
  limiteEm: null,
  ocupado: false,
  erro: null,
  camposComErro: {},
};

export function criarPedido({
  obterSessaoId,
  aoMudarCarrinho,
  aoPagar,
  fetch: buscar = globalThis.fetch.bind(globalThis),
  agora = Date.now,
}: OpcoesPedido): ControlePedido {
  let estado: EstadoPedido = { ...vazio };
  /** Último PIX que a Sofia gerou e já abriu na tela: o mesmo PIX não reabre a tela que a cliente fechou. */
  let pixJaAberto = "";
  const ouvintes = new Set<(e: EstadoPedido) => void>();

  function mudar(parcial: Partial<EstadoPedido>): void {
    estado = { ...estado, ...parcial };
    for (const ouvinte of ouvintes) ouvinte(estado);
  }

  const base = (sessaoId: string) => `/api/sessoes/${encodeURIComponent(sessaoId)}`;
  const urlDoPedido = (sessaoId: string, pedidoId: string) => `${base(sessaoId)}/pedidos/${encodeURIComponent(pedidoId)}`;

  /** Guarda o pedido e, se ele tem PIX, o relógio da contagem regressiva. */
  function guardar(pedido: PedidoView, qrSvg?: string | null): Partial<EstadoPedido> {
    const pix = pedido.pix;
    return {
      pedido,
      ...(qrSvg !== undefined ? { qrSvg } : {}),
      limiteEm: pix ? agora() + pix.segundos_restantes * 1000 : null,
    };
  }

  async function pedirJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; corpo: T & { erro?: string; campos?: { campo: string; problema: string }[] } }> {
    const resposta = await buscar(url, init);
    const corpo = (await resposta.json().catch(() => ({}))) as T & { erro?: string; campos?: { campo: string; problema: string }[] };
    return { ok: resposta.ok, status: resposta.status, corpo };
  }

  async function carregarPedido(sessaoId: string, pedidoId: string): Promise<void> {
    try {
      const r = await pedirJson<{ pedido?: PedidoView; qr_svg?: string }>(urlDoPedido(sessaoId, pedidoId));
      if (r.ok && r.corpo.pedido) mudar(guardar(r.corpo.pedido, r.corpo.qr_svg ?? null));
    } catch {
      // sem rede: mantém o que está na tela
    }
  }

  const controle: ControlePedido = {
    subscribe(ouvinte) {
      ouvintes.add(ouvinte);
      ouvinte(estado);
      return () => void ouvintes.delete(ouvinte);
    },
    abrirCheckout: () => mudar({ tela: "checkout", erro: null, camposComErro: {} }),
    async abrirPix() {
      mudar({ tela: "pix", erro: null });
      const sessaoId = obterSessaoId();
      if (sessaoId && estado.pedido) await carregarPedido(sessaoId, estado.pedido.id);
    },
    fechar: () => mudar({ tela: "nenhuma", erro: null, camposComErro: {} }),

    async consultarFrete(cep) {
      const sessaoId = obterSessaoId();
      if (!sessaoId) return { ok: false, erro: "Comece a conversa com a Sofia primeiro." };
      try {
        const r = await pedirJson<object>(`${base(sessaoId)}/frete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cep }),
        });
        if (!r.ok) return { ok: false, erro: r.corpo.erro ?? "Não foi possível calcular o frete." };
        aoMudarCarrinho?.();
        return { ok: true };
      } catch {
        return { ok: false, erro: MENSAGEM_REDE };
      }
    },

    async finalizar(dados) {
      const sessaoId = obterSessaoId();
      if (!sessaoId) {
        mudar({ erro: "Comece a conversa com a Sofia primeiro." });
        return false;
      }
      mudar({ ocupado: true, erro: null, camposComErro: {} });
      try {
        const corpo = { ...dados, complemento: dados.complemento.trim() || undefined };
        const r = await pedirJson<{ pedido?: PedidoView }>(`${base(sessaoId)}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });
        if (!r.ok || !r.corpo.pedido) {
          const campos = Object.fromEntries((r.corpo.campos ?? []).map((c) => [c.campo, c.problema]));
          mudar({ erro: r.corpo.erro ?? "Não foi possível fechar o pedido.", camposComErro: campos });
          return false;
        }
        mudar({ ...guardar(r.corpo.pedido, null), tela: "pix" });
        aoMudarCarrinho?.(); // o carrinho foi esvaziado pelo pedido
        mudar({ ocupado: false });
        return await controle.gerarPix();
      } catch {
        mudar({ erro: MENSAGEM_REDE });
        return false;
      } finally {
        mudar({ ocupado: false });
      }
    },

    async gerarPix() {
      const sessaoId = obterSessaoId();
      if (!sessaoId || !estado.pedido) return false;
      mudar({ ocupado: true, erro: null });
      try {
        const r = await pedirJson<{ pedido?: PedidoView; qr_svg?: string }>(`${urlDoPedido(sessaoId, estado.pedido.id)}/pix`, { method: "POST" });
        if (!r.ok || !r.corpo.pedido) {
          mudar({ erro: r.corpo.erro ?? "Não foi possível gerar o PIX." });
          return false;
        }
        mudar(guardar(r.corpo.pedido, r.corpo.qr_svg ?? null));
        return true;
      } catch {
        mudar({ erro: MENSAGEM_REDE });
        return false;
      } finally {
        mudar({ ocupado: false });
      }
    },

    async pagar() {
      const sessaoId = obterSessaoId();
      if (!sessaoId || !estado.pedido) return { ok: false, erro: "Não há pedido para pagar." };
      mudar({ ocupado: true, erro: null });
      try {
        const r = await pedirJson<{ pedido?: PedidoView; mensagem?: string; ja_estava_pago?: boolean }>(
          `${urlDoPedido(sessaoId, estado.pedido.id)}/pagar`,
          { method: "POST" },
        );
        if (!r.ok || !r.corpo.pedido) {
          const erro = r.corpo.erro ?? "Não foi possível confirmar o pagamento.";
          mudar({ erro });
          return { ok: false, erro };
        }
        mudar({ pedido: r.corpo.pedido, limiteEm: null });
        if (r.corpo.mensagem && !r.corpo.ja_estava_pago) aoPagar?.(r.corpo.mensagem);
        return { ok: true };
      } catch {
        mudar({ erro: MENSAGEM_REDE });
        return { ok: false, erro: MENSAGEM_REDE };
      } finally {
        mudar({ ocupado: false });
      }
    },

    aoEvento(evento) {
      if (evento.tipo !== "ferramenta" || evento.resultado.ok !== true) return;
      const pedido = evento.resultado.pedido as PedidoView | undefined;
      if (!pedido || typeof pedido !== "object" || typeof pedido.id !== "string") return;
      if (evento.nome === "finalizar_pedido") {
        mudar(guardar(pedido, null));
        aoMudarCarrinho?.();
      } else if (evento.nome === "gerar_pix") {
        // O PIX que a Sofia gerou aparece na tela, com o QR Code (só o servidor o devolve pela rota do pedido).
        const chave = `${pedido.id}|${pedido.pix?.gerado_em ?? ""}`;
        const jaAbriu = chave === pixJaAberto;
        pixJaAberto = chave;
        mudar({ ...guardar(pedido, null), ...(jaAbriu ? {} : { tela: "pix" as const }) });
        const sessaoId = obterSessaoId();
        if (sessaoId) void carregarPedido(sessaoId, pedido.id);
      } else if (evento.nome === "consultar_pedido") {
        mudar(guardar(pedido));
      }
    },
  };
  return controle;
}
