import type { Produto } from "./produto.js";

// Variedade mínima do catálogo (especificação, Parte 1). Depende do conjunto, não de cada produto.

export interface MetaVariedade {
  descricao: string;
  atual: number;
  minimo: number;
  ok: boolean;
}

function meta(descricao: string, atual: number, minimo: number): MetaVariedade {
  return { descricao, atual, minimo, ok: atual >= minimo };
}

/** Pares sem ordem ligados por combina_com (A→B ou B→A conta uma vez). */
export function contarParesCombinados(produtos: readonly Produto[]): number {
  const pares = new Set<string>();
  for (const p of produtos) {
    for (const alvo of p.combina_com) pares.add([p.id, alvo].sort().join("+"));
  }
  return pares.size;
}

export function verificarVariedade(produtos: readonly Produto[]): MetaVariedade[] {
  const categorias = new Set(produtos.map((p) => p.categoria));
  return [
    meta("produtos", produtos.length, 15),
    meta("categorias diferentes", categorias.size, 4),
    meta("kits", produtos.filter((p) => p.categoria === "kit").length, 1),
    meta("pares em combina_com", contarParesCombinados(produtos), 3),
    meta("uso profissional", produtos.filter((p) => p.uso === "profissional" || p.uso === "ambos").length, 1),
    // "ambos" serve para uso em casa: conta como home care.
    meta("uso em casa (home care)", produtos.filter((p) => p.uso === "home_care" || p.uso === "ambos").length, 1),
    meta("estoque de teste ≤ 3", produtos.filter((p) => p.estoque_teste <= 3).length, 1),
  ];
}
