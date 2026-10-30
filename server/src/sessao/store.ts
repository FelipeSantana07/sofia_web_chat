import { randomUUID } from "node:crypto";
import { perfilVazio, type Pedido, type PerfilCliente } from "@sofia/shared";
import type { Zona } from "../domain/cep.js";
import { carrinhoVazio, type Carrinho } from "../domain/carrinho.js";

/** Estado de uma conversa: tudo o que as ferramentas leem e gravam. Fica em memória. */
export interface EstadoSessao {
  id: string;
  perfil: PerfilCliente;
  carrinho: Carrinho;
  /** Cupom aplicado ao carrinho (um por pedido), ou null. */
  cupom: string | null;
  /** Último CEP válido consultado (8 dígitos) e sua zona, ou null. */
  entrega: { cep: string; zona: Zona } | null;
  pedido: Pedido | null;
  criadoEm: number;
  atualizadoEm: number;
}

export interface OpcoesStore {
  gerarId?: () => string;
  agora?: () => number;
}

export interface StoreSessoes {
  /** Devolve a sessão existente ou undefined. */
  obter(id: string): EstadoSessao | undefined;
  /** Devolve a sessão do id (criando se não existir) ou cria uma nova com id gerado. */
  obterOuCriar(id?: string): EstadoSessao;
  remover(id: string): boolean;
  tamanho(): number;
}

// O id vem do cliente HTTP: aceita só caracteres seguros e tamanho limitado.
const ID_VALIDO = /^[A-Za-z0-9_-]{1,100}$/;

export function criarStoreSessoes({ gerarId = randomUUID, agora = Date.now }: OpcoesStore = {}): StoreSessoes {
  const sessoes = new Map<string, EstadoSessao>();

  function criar(id: string): EstadoSessao {
    const t = agora();
    const sessao: EstadoSessao = {
      id,
      perfil: perfilVazio(),
      carrinho: carrinhoVazio(),
      cupom: null,
      entrega: null,
      pedido: null,
      criadoEm: t,
      atualizadoEm: t,
    };
    sessoes.set(id, sessao);
    return sessao;
  }

  return {
    obter: (id) => sessoes.get(id),
    obterOuCriar(id) {
      if (id === undefined) return criar(gerarId());
      if (!ID_VALIDO.test(id)) throw new RangeError("Id de sessão inválido.");
      return sessoes.get(id) ?? criar(id);
    },
    remover: (id) => sessoes.delete(id),
    tamanho: () => sessoes.size,
  };
}
