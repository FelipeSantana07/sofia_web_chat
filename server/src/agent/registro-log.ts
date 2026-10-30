import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Uma linha de log: o que aconteceu na conversa (mensagem, chamada de ferramenta, resposta, erro). */
export type EntradaLog = { sessao: string; tipo: string; [campo: string]: unknown };

export interface Registro {
  registrar(entrada: EntradaLog): void;
}

/** logs/ na raiz do repositório (ignorado pelo Git). */
export const CAMINHO_LOG_PADRAO = fileURLToPath(new URL("../../../logs/conversas.jsonl", import.meta.url));

/** Grava uma linha JSON por evento (JSON Lines), com data e hora. */
export function criarRegistroArquivo(caminho: string = CAMINHO_LOG_PADRAO): Registro {
  mkdirSync(dirname(caminho), { recursive: true });
  return {
    registrar(entrada) {
      appendFileSync(caminho, `${JSON.stringify({ em: new Date().toISOString(), ...entrada })}\n`);
    },
  };
}

/** Guarda as entradas em memória (testes). */
export function criarRegistroMemoria(): Registro & { entradas: EntradaLog[] } {
  const entradas: EntradaLog[] = [];
  return { entradas, registrar: (e) => void entradas.push(e) };
}
