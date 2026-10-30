import { GoogleGenAI, type Content, type FunctionDeclaration, type Part } from "@google/genai";

export interface PedidoModelo {
  historico: Content[];
  instrucaoSistema: string;
  ferramentas: FunctionDeclaration[];
}

/** O mínimo que o agente precisa de um LLM: gerar em streaming, devolvendo as partes de cada pedaço. */
export interface ModeloChat {
  gerar(pedido: PedidoModelo): AsyncIterable<Part[]>;
}

export const MODELO_PADRAO = "gemini-3.8-flash";

/** Adaptador para o Gemini via SDK oficial (formato de ferramentas validado na T-05). */
export function criarModeloGemini({ apiKey, modelo = MODELO_PADRAO }: { apiKey: string; modelo?: string }): ModeloChat {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async *gerar({ historico, instrucaoSistema, ferramentas }) {
      const stream = await ai.models.generateContentStream({
        model: modelo,
        contents: historico,
        config: { systemInstruction: instrucaoSistema, tools: [{ functionDeclarations: ferramentas }] },
      });
      for await (const pedaco of stream) yield pedaco.candidates?.[0]?.content?.parts ?? [];
    },
  };
}
