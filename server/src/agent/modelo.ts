import { GoogleGenAI, ThinkingLevel, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import type { ConfigGemini } from "../config.js";

export interface PedidoModelo {
  historico: Content[];
  instrucaoSistema: string;
  ferramentas: FunctionDeclaration[];
}

/** O mínimo que o agente precisa de um LLM: gerar em streaming, devolvendo as partes de cada pedaço. */
export interface ModeloChat {
  gerar(pedido: PedidoModelo): AsyncIterable<Part[]>;
}

/** Adaptador para o Gemini via SDK oficial (formato de ferramentas validado na T-05). O modelo vem do .env (GEMINI_MODEL). */
export function criarModeloGemini({ apiKey, modelo, temperatura, nivelPensamento }: ConfigGemini): ModeloChat {
  const ai = new GoogleGenAI({ apiKey });
  // Ajustes opcionais do .env: o que não foi definido fica com o padrão do modelo.
  const ajustes = {
    ...(temperatura === undefined ? {} : { temperature: temperatura }),
    ...(nivelPensamento === undefined ? {} : { thinkingConfig: { thinkingLevel: ThinkingLevel[nivelPensamento] } }),
  };
  return {
    async *gerar({ historico, instrucaoSistema, ferramentas }) {
      const stream = await ai.models.generateContentStream({
        model: modelo,
        contents: historico,
        config: { systemInstruction: instrucaoSistema, tools: [{ functionDeclarations: ferramentas }], ...ajustes },
      });
      for await (const pedaco of stream) yield pedaco.candidates?.[0]?.content?.parts ?? [];
    },
  };
}
