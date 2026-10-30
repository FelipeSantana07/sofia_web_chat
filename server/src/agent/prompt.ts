import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Produto } from "@sofia/shared";

export const CAMINHO_PROMPT = fileURLToPath(new URL("../../../prompts/sofia.md", import.meta.url));

const MARCADOR_CATALOGO = "{{CATALOGO}}";

/**
 * Uma linha por produto: o que existe e para quem serve. Sem preço e sem estoque de propósito:
 * esses valores mudam e o modelo só pode citá-los a partir das ferramentas.
 */
export function resumirCatalogoParaPrompt(produtos: readonly Produto[]): string {
  return produtos
    .map((p) => {
      const partes = [
        p.id,
        p.nome,
        `categoria: ${p.categoria}`,
        p.linha ? `linha: ${p.linha}` : null,
        `uso: ${p.uso ?? "não informado"}`,
        p.indicado_para.length > 0 ? `indicado para: ${p.indicado_para.join("; ")}` : null,
      ];
      return `- ${partes.filter((x) => x !== null).join(" | ")}`;
    })
    .join("\n");
}

/** Monta o prompt de sistema: o texto de prompts/sofia.md com o catálogo resumido no lugar do marcador. */
export function montarPromptSistema(produtos: readonly Produto[], modelo: string = readFileSync(CAMINHO_PROMPT, "utf8")): string {
  const ocorrencias = modelo.split(MARCADOR_CATALOGO).length - 1;
  if (ocorrencias !== 1) {
    throw new Error(`O prompt precisa ter exatamente um marcador ${MARCADOR_CATALOGO} (encontrados: ${ocorrencias}).`);
  }
  return modelo.replace(MARCADOR_CATALOGO, () => resumirCatalogoParaPrompt(produtos));
}
