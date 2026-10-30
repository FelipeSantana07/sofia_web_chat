import { z } from "zod";

// Tipos do estado de uma conversa que atravessam server e web.

/** Uso informado pela cliente: salão ou casa. */
export const USOS_PERFIL = ["profissional", "home_care"] as const;

/** O que a cliente contou sobre si (especificação 8.2, etapa "Acolher e entender"). null = ainda não sabemos. */
export const perfilClienteSchema = z.object({
  nome: z.string().nullable(),
  tipo_cabelo: z.string().nullable(),
  quimica: z.string().nullable(),
  incomodo: z.string().nullable(),
  uso: z.enum(USOS_PERFIL).nullable(),
});

export type PerfilCliente = z.infer<typeof perfilClienteSchema>;

export function perfilVazio(): PerfilCliente {
  return { nome: null, tipo_cabelo: null, quimica: null, incomodo: null, uso: null };
}

/** Status do pedido. O PIX tem status próprio (ativo/expirado), calculado pela validade. */
export const STATUS_PEDIDO = ["aguardando_pagamento", "pago"] as const;

export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const MODALIDADES_FRETE = ["economica", "expressa"] as const;

export type ModalidadeFrete = (typeof MODALIDADES_FRETE)[number];

export type ZonaEntrega = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

/** Item do pedido: cópia do que estava no carrinho no momento do fechamento (preço vigente naquele dia). */
export interface ItemPedido {
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitarioCentavos: number;
  totalCentavos: number;
}

/** Valores do pedido, todos em centavos e calculados pelo código. */
export interface TotaisPedido {
  subtotalCentavos: number;
  descontoCupomCentavos: number;
  /** Valor dos produtos depois do cupom (base do desconto PIX). */
  baseCentavos: number;
  freteCentavos: number;
  freteGratis: boolean;
  descontoPixCentavos: number;
  totalPixCentavos: number;
}

/** PIX falso de um pedido. Se expirou, o pedido guarda o último e um novo o substitui. */
export interface PixFalso {
  /** Texto de mentira que vira o QR Code. Nunca é um BR Code real. */
  texto: string;
  valorCentavos: number;
  geradoEm: number;
  expiraEm: number;
}

export interface Pedido {
  /** Número exibido à cliente, ex.: PH-TESTE-000123. */
  id: string;
  status: StatusPedido;
  criadoEm: number;
  pagoEm: number | null;
  cliente: { nome: string; email: string };
  entrega: {
    cep: string;
    endereco: string;
    numero: string;
    complemento: string | null;
    zona: ZonaEntrega;
    modalidade: ModalidadeFrete;
    prazoMinDias: number;
    prazoMaxDias: number;
  };
  itens: ItemPedido[];
  /** Cupom que valeu no pedido, ou null. */
  cupom: string | null;
  totais: TotaisPedido;
  pix: PixFalso | null;
}
