import { GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { lerConfigGemini, ouEncerrar } from "../src/config.js";

const { apiKey: chave, modelo } = ouEncerrar(() => lerConfigGemini());

// Ferramenta fictícia: só serve para validar o formato de ida e volta.
const consultarClima: FunctionDeclaration = {
  name: "consultar_clima",
  description: "Consulta o clima atual de uma cidade.",
  parametersJsonSchema: {
    type: "object",
    properties: { cidade: { type: "string", description: "Nome da cidade" } },
    required: ["cidade"],
  },
};

function executar(nome: string, args: Record<string, unknown>) {
  if (nome !== "consultar_clima") return { erro: `ferramenta desconhecida: ${nome}` };
  return { cidade: args.cidade, temperatura_c: 29, condicao: "ensolarado" };
}

async function main() {
  const ai = new GoogleGenAI({ apiKey: chave });
  const config = { tools: [{ functionDeclarations: [consultarClima] }] };
  const historico: Content[] = [
    { role: "user", parts: [{ text: "Como está o clima em Recife agora?" }] },
  ];

  const primeira = await ai.models.generateContent({ model: modelo, contents: historico, config });
  const chamada = primeira.functionCalls?.[0];
  if (!chamada?.name) {
    console.error("O modelo não chamou a função. Resposta:", primeira.text);
    process.exit(1);
  }
  console.log("1. chamada recebida:", chamada.name, JSON.stringify(chamada.args));

  const resultado = executar(chamada.name, chamada.args ?? {});
  console.log("2. resultado local:", JSON.stringify(resultado));

  // Guarda o turno do modelo como veio e devolve o resultado como functionResponse.
  const turnoModelo = primeira.candidates?.[0]?.content;
  if (turnoModelo) historico.push(turnoModelo);
  historico.push({
    role: "user",
    parts: [{ functionResponse: { name: chamada.name, response: resultado } }],
  });

  const final = await ai.models.generateContent({ model: modelo, contents: historico, config });
  console.log("3. resposta final:", final.text);
}

main().catch((erro: unknown) => {
  console.error("Falha:", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
