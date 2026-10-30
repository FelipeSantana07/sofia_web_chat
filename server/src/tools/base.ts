import { z } from "zod";
import type { Produto } from "@sofia/shared";
import type { Catalogo } from "../catalogo/catalogo.js";
import { formatarBRL } from "../domain/dinheiro.js";
import type { EstadoSessao } from "../sessao/store.js";

/** O que toda ferramenta recebe: o catálogo (somente leitura) e o estado da conversa. */
export interface ContextoFerramenta {
  catalogo: Catalogo;
  sessao: EstadoSessao;
}

/** Resposta devolvida ao modelo: JSON simples, sempre com `ok`. Erros trazem `erro` em português. */
export type ResultadoFerramenta = { ok: boolean; [campo: string]: unknown };

export interface Ferramenta {
  nome: string;
  descricao: string;
  /** Schema zod dos argumentos; vira a declaração de função do Gemini na T-20. */
  parametros: z.ZodType;
  /** Valida os argumentos brutos (vindos do modelo) e executa. Nunca lança por argumento inválido. */
  executar(argumentos: unknown, ctx: ContextoFerramenta): ResultadoFerramenta;
}

interface Definicao<S extends z.ZodType> {
  nome: string;
  descricao: string;
  parametros: S;
  executar(args: z.infer<S>, ctx: ContextoFerramenta): ResultadoFerramenta;
}

export function definirFerramenta<S extends z.ZodType>(def: Definicao<S>): Ferramenta {
  return {
    nome: def.nome,
    descricao: def.descricao,
    parametros: def.parametros,
    executar(argumentos, ctx) {
      const entrada = argumentos ?? {};
      const r = def.parametros.safeParse(entrada);
      if (!r.success) return erroDeValidacao(r.error, entrada);
      return def.executar(r.data, ctx);
    },
  };
}

/** Procura um produto pelo id que o modelo enviou, tolerando caixa e espaços. */
export function acharProduto(catalogo: Catalogo, id: string): Produto | undefined {
  return catalogo.obter(id.trim().toUpperCase());
}

export function falha(erro: string, extras: Record<string, unknown> = {}): ResultadoFerramenta {
  return { ok: false, erro, ...extras };
}

/** Valor monetário para o modelo: centavos (exatos) e o texto já formatado, para ele não calcular nem formatar. */
export function dinheiro(centavos: number): { centavos: number; texto: string } {
  return { centavos, texto: formatarBRL(centavos) };
}

function valorEm(entrada: unknown, caminho: readonly PropertyKey[]): unknown {
  let atual = entrada;
  for (const parte of caminho) {
    if (typeof atual !== "object" || atual === null) return undefined;
    atual = (atual as Record<PropertyKey, unknown>)[parte];
  }
  return atual;
}

function descreverProblema(issue: z.core.$ZodIssue, entrada: unknown): string {
  if (issue.code === "invalid_type") {
    if (valorEm(entrada, issue.path) === undefined) return "campo obrigatório";
    const esperado: Record<string, string> = {
      string: "deve ser um texto",
      number: "deve ser um número",
      int: "deve ser um número inteiro",
      boolean: "deve ser verdadeiro ou falso",
    };
    return esperado[issue.expected] ?? "tipo inválido";
  }
  if (issue.code === "too_small") return "valor pequeno demais (quantidades devem ser inteiros maiores que zero)";
  if (issue.code === "too_big") return "valor grande demais";
  if (issue.code === "invalid_value") {
    const opcoes = issue.values.map((v) => JSON.stringify(v)).join(", ");
    return `valor inválido; use um destes: ${opcoes}`;
  }
  return issue.message;
}

export function erroDeValidacao(erro: z.ZodError, entrada: unknown): ResultadoFerramenta {
  const campos = erro.issues.map((i) => ({
    campo: i.path.length > 0 ? i.path.join(".") : "(argumentos)",
    problema: descreverProblema(i, entrada),
  }));
  const resumo = campos.map((c) => `${c.campo}: ${c.problema}`).join("; ");
  return falha(`Argumentos inválidos — ${resumo}. Corrija e chame a ferramenta de novo.`, { campos });
}
