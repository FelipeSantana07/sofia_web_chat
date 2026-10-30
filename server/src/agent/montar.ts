import type { Catalogo } from "../catalogo/catalogo.js";
import { criarDespachante } from "../tools/registro.js";
import { criarAgente, type Agente } from "./agente.js";
import { criarModeloGemini, MODELO_PADRAO } from "./modelo.js";
import { montarPromptSistema } from "./prompt.js";
import type { Registro } from "./registro-log.js";

/** Monta a Sofia com o Gemini, as ferramentas registradas e o prompt de prompts/sofia.md. Usado pelo servidor e pela CLI. */
export function montarSofia({
  apiKey,
  modelo = MODELO_PADRAO,
  catalogo,
  registro,
}: {
  apiKey: string;
  modelo?: string;
  catalogo: Catalogo;
  registro?: Registro;
}): Agente {
  return criarAgente({
    modelo: criarModeloGemini({ apiKey, modelo }),
    despachante: criarDespachante(),
    catalogo,
    promptSistema: montarPromptSistema(catalogo.produtos),
    ...(registro ? { registro } : {}),
  });
}

/** Lê GEMINI_API_KEY e GEMINI_MODEL do ambiente; sem chave, encerra com uma mensagem clara. */
export function lerConfigGemini(): { apiKey: string; modelo: string } {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "mock") {
    console.error("Defina GEMINI_API_KEY no arquivo .env na raiz do projeto (veja .env.example).");
    process.exit(1);
  }
  return { apiKey, modelo: process.env.GEMINI_MODEL || MODELO_PADRAO };
}
