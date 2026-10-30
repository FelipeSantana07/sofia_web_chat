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

/** Status do pedido. O PIX tem status próprio (ativo/expirado), tratado na T-26. */
export const STATUS_PEDIDO = ["aguardando_pagamento", "pago"] as const;

export type StatusPedido = (typeof STATUS_PEDIDO)[number];

/** Pedido da sessão. Itens, entrega e totais entram na T-25, que estende este tipo. */
export interface Pedido {
  /** Número exibido à cliente, ex.: PH-TESTE-000123. */
  id: string;
  status: StatusPedido;
}
