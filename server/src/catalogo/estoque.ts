import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Estoque que mudou desde o data/produtos.json (pedidos e reposição). Fica fora do Git. */
export const CAMINHO_ESTOQUE = fileURLToPath(new URL("../../../data/estoque.json", import.meta.url));

export interface Estoque {
  obter(id: string): number;
  /** Tira `quantidade` do estoque do produto (nunca abaixo de zero). */
  baixar(id: string, quantidade: number): void;
  /** Devolve `quantidade` ao estoque do produto (reserva que venceu sem pagamento). */
  devolver(id: string, quantidade: number): void;
  /** Soma `quantidade` ao estoque de todos os produtos. */
  repor(quantidade: number): void;
}

/**
 * Estoque de teste mutável, que parte do `estoque_teste` do catálogo. Com `caminho`, cada mudança é gravada
 * e sobrevive ao reinício; uma reposição feita por outro processo (`pnpm estoque:repor`) é lida na hora.
 */
export function criarEstoque(inicial: ReadonlyMap<string, number>, caminho: string | null = null): Estoque {
  const atual = new Map(inicial);
  let versaoLida = 0;

  function sincronizar(): void {
    if (!caminho || !existsSync(caminho)) return;
    const versao = statSync(caminho).mtimeMs;
    if (versao === versaoLida) return;
    versaoLida = versao;
    try {
      const gravado = JSON.parse(readFileSync(caminho, "utf8")) as Record<string, unknown>;
      for (const [id, qtd] of Object.entries(gravado)) {
        if (atual.has(id) && typeof qtd === "number" && Number.isInteger(qtd) && qtd >= 0) atual.set(id, qtd);
      }
    } catch {
      // arquivo ilegível: segue com o que já está em memória
    }
  }

  function gravar(): void {
    if (!caminho) return;
    writeFileSync(caminho, `${JSON.stringify(Object.fromEntries(atual), null, 2)}\n`);
    versaoLida = statSync(caminho).mtimeMs;
  }

  return {
    obter(id) {
      sincronizar();
      return atual.get(id) ?? 0;
    },
    baixar(id, quantidade) {
      sincronizar();
      atual.set(id, Math.max(0, (atual.get(id) ?? 0) - quantidade));
      gravar();
    },
    devolver(id, quantidade) {
      sincronizar();
      atual.set(id, (atual.get(id) ?? 0) + quantidade);
      gravar();
    },
    repor(quantidade) {
      sincronizar();
      for (const [id, qtd] of atual) atual.set(id, qtd + quantidade);
      gravar();
    },
  };
}
