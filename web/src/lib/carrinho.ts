import type { EventoChat } from "./sse.js";
import type { Carrinho } from "./tipos.js";

export interface EstadoCarrinho {
  /** O carrinho como o servidor calculou; null enquanto a conversa não começou. */
  carrinho: Carrinho | null;
  /** Total de unidades, para o contador do ícone. */
  quantidade: number;
  /** Uma alteração está em andamento. */
  ocupado: boolean;
  /** Última recusa do servidor (ex.: estoque insuficiente), em português. */
  erro: string | null;
  aberto: boolean;
}

export interface ResultadoAcao {
  ok: boolean;
  erro?: string;
}

export interface OpcoesCarrinho {
  /** Id da conversa atual; null antes da primeira mensagem. */
  obterSessaoId: () => string | null;
  /** Trocado nos testes. */
  fetch?: typeof fetch;
}

export interface ControleCarrinho {
  /** Contrato de store do Svelte: use `$carrinho` nos componentes. */
  subscribe(ouvinte: (estado: EstadoCarrinho) => void): () => void;
  adicionar(id: string, quantidade?: number): Promise<ResultadoAcao>;
  /** Sem `quantidade`, tira o item inteiro. */
  remover(id: string, quantidade?: number): Promise<ResultadoAcao>;
  /** Aplica o cupom digitado pela cliente; o servidor valida (código e pedido mínimo) e recalcula tudo. */
  aplicarCupom(codigo: string): Promise<ResultadoAcao>;
  /** Busca o carrinho no servidor (fonte da verdade). */
  atualizar(): Promise<void>;
  /** Acompanha as ferramentas da Sofia: se a resposta trouxe o carrinho, já mostra. */
  aoEvento(evento: EventoChat): void;
  abrir(): void;
  fechar(): void;
}

const MENSAGEM_REDE = "Não consegui falar com o servidor. Tente de novo.";

const contar = (c: Carrinho | null) => c?.itens.reduce((soma, i) => soma + i.quantidade, 0) ?? 0;

export function criarCarrinho({ obterSessaoId, fetch: buscar = globalThis.fetch.bind(globalThis) }: OpcoesCarrinho): ControleCarrinho {
  let estado: EstadoCarrinho = { carrinho: null, quantidade: 0, ocupado: false, erro: null, aberto: false };
  const ouvintes = new Set<(e: EstadoCarrinho) => void>();

  function mudar(parcial: Partial<EstadoCarrinho>): void {
    estado = { ...estado, ...parcial };
    estado.quantidade = contar(estado.carrinho);
    for (const ouvinte of ouvintes) ouvinte(estado);
  }

  const urlBase = (sessaoId: string) => `/api/sessoes/${encodeURIComponent(sessaoId)}/carrinho`;

  async function alterar(montar: (sessaoId: string) => Promise<Response>): Promise<ResultadoAcao> {
    const sessaoId = obterSessaoId();
    if (!sessaoId) return { ok: false, erro: "Comece a conversa com a Sofia primeiro." };
    mudar({ ocupado: true, erro: null });
    try {
      const resposta = await montar(sessaoId);
      const corpo = (await resposta.json().catch(() => ({}))) as { carrinho?: Carrinho; erro?: string };
      if (!resposta.ok) {
        const erro = corpo.erro ?? "Não foi possível alterar o carrinho.";
        mudar({ erro });
        return { ok: false, erro };
      }
      if (corpo.carrinho) mudar({ carrinho: corpo.carrinho });
      return { ok: true };
    } catch {
      mudar({ erro: MENSAGEM_REDE });
      return { ok: false, erro: MENSAGEM_REDE };
    } finally {
      mudar({ ocupado: false });
    }
  }

  return {
    subscribe(ouvinte) {
      ouvintes.add(ouvinte);
      ouvinte(estado);
      return () => void ouvintes.delete(ouvinte);
    },
    adicionar: (id, quantidade = 1) =>
      alterar((sessaoId) =>
        buscar(`${urlBase(sessaoId)}/itens`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, quantidade }),
        }),
      ),
    remover: (id, quantidade) =>
      alterar((sessaoId) =>
        buscar(`${urlBase(sessaoId)}/itens/${encodeURIComponent(id)}${quantidade ? `?quantidade=${quantidade}` : ""}`, {
          method: "DELETE",
        }),
      ),
    aplicarCupom: (codigo) =>
      alterar((sessaoId) =>
        buscar(`/api/sessoes/${encodeURIComponent(sessaoId)}/cupom`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo }),
        }),
      ),
    async atualizar() {
      const sessaoId = obterSessaoId();
      if (!sessaoId) return;
      try {
        const resposta = await buscar(urlBase(sessaoId));
        if (!resposta.ok) return;
        const corpo = (await resposta.json()) as { carrinho?: Carrinho };
        if (corpo.carrinho) mudar({ carrinho: corpo.carrinho });
      } catch {
        // sem rede: mantém o que já está na tela
      }
    },
    aoEvento(evento) {
      if (evento.tipo !== "ferramenta") return;
      const carrinho = evento.resultado.carrinho;
      if (evento.resultado.ok === true && carrinho && typeof carrinho === "object") {
        mudar({ carrinho: carrinho as Carrinho });
      }
    },
    abrir: () => mudar({ aberto: true, erro: null }),
    fechar: () => mudar({ aberto: false }),
  };
}
