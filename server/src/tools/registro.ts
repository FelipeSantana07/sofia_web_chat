import type { FunctionDeclaration } from "@google/genai";
import { z } from "zod";
import type { ContextoFerramenta, Ferramenta, ResultadoFerramenta } from "./base.js";
import { ferramentasCarrinhoFrete } from "./carrinho-frete.js";
import { ferramentasCatalogoPerfil } from "./catalogo-perfil.js";
import { ferramentasPedido } from "./pedido.js";

/** Todas as ferramentas que a Sofia pode chamar. */
export const todasAsFerramentas: readonly Ferramenta[] = [
  ...ferramentasCatalogoPerfil,
  ...ferramentasCarrinhoFrete,
  ...ferramentasPedido,
];

/** Converte o schema zod dos argumentos em JSON Schema, no formato validado na T-05 (`parametersJsonSchema`). */
export function paraDeclaracaoGemini(ferramenta: Ferramenta): FunctionDeclaration {
  const { $schema: _ignorado, ...schema } = z.toJSONSchema(ferramenta.parametros) as Record<string, unknown>;
  return { name: ferramenta.nome, description: ferramenta.descricao, parametersJsonSchema: schema };
}

export interface Despachante {
  readonly declaracoes: FunctionDeclaration[];
  /** Executa a ferramenta pelo nome. Nunca lança: nome desconhecido, argumento inválido ou falha interna voltam como `ok: false`. */
  executar(nome: string, argumentos: unknown, ctx: ContextoFerramenta): ResultadoFerramenta;
}

export function criarDespachante(ferramentas: readonly Ferramenta[] = todasAsFerramentas): Despachante {
  const porNome = new Map(ferramentas.map((f) => [f.nome, f]));
  if (porNome.size !== ferramentas.length) throw new Error("Há ferramentas com nome repetido.");

  return {
    declaracoes: ferramentas.map(paraDeclaracaoGemini),
    executar(nome, argumentos, ctx) {
      const ferramenta = porNome.get(nome);
      if (!ferramenta) {
        return {
          ok: false,
          erro: `A ferramenta "${nome}" não existe. Use apenas: ${[...porNome.keys()].join(", ")}.`,
        };
      }
      try {
        const resultado = ferramenta.executar(argumentos, ctx);
        ctx.sessao.atualizadoEm = Date.now();
        return resultado;
      } catch (erro) {
        // Falha inesperada (bug ou dado corrompido): o modelo recebe uma resposta e a conversa segue.
        return {
          ok: false,
          erro: "Falha interna ao executar a ferramenta. Não invente o resultado: avise a cliente e tente de novo.",
          detalhe_interno: erro instanceof Error ? erro.message : String(erro),
        };
      }
    },
  };
}
