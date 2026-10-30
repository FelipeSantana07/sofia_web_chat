import type { Catalogo } from "../catalogo/catalogo.js";
import type { ConfigGemini } from "../config.js";
import { criarDespachante } from "../tools/registro.js";
import { criarAgente, type Agente } from "./agente.js";
import { criarModeloGemini } from "./modelo.js";
import { montarPromptSistema } from "./prompt.js";
import type { Registro } from "./registro-log.js";

/** Monta a Sofia com o Gemini, as ferramentas registradas e o prompt de prompts/sofia.md. Usado pelo servidor e pela CLI. */
export function montarSofia({
  apiKey,
  modelo,
  catalogo,
  registro,
}: ConfigGemini & { catalogo: Catalogo; registro?: Registro }): Agente {
  return criarAgente({
    modelo: criarModeloGemini({ apiKey, modelo }),
    despachante: criarDespachante(),
    catalogo,
    promptSistema: montarPromptSistema(catalogo.produtos),
    ...(registro ? { registro } : {}),
  });
}
