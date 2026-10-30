import { z } from "zod";
import { MODALIDADES_FRETE } from "./sessao.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Dados do checkout, iguais na conversa (`finalizar_pedido`) e no formulário. Só nome, e-mail e endereço:
 * nada de CPF ou cartão, e os dados devem ser fictícios.
 */
export const dadosCheckoutSchema = z.object({
  nome: z.string().trim().min(2, "informe o nome").max(100).describe("Nome da cliente (fictício no teste)"),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => EMAIL.test(v), "e-mail inválido")
    .describe("E-mail da cliente (fictício no teste)"),
  cep: z.string().trim().min(1, "informe o CEP").describe("CEP de entrega, com ou sem hífen"),
  endereco: z.string().trim().min(3, "informe o endereço").max(150).describe("Rua ou avenida"),
  numero: z.string().trim().min(1, "informe o número").max(20).describe("Número da casa ou prédio"),
  complemento: z.string().trim().max(80).optional().describe("Apartamento, bloco etc.; omita se não houver"),
  modalidade_frete: z.enum(MODALIDADES_FRETE).describe("Modalidade de frete escolhida pela cliente"),
});

export type DadosCheckout = z.infer<typeof dadosCheckoutSchema>;
