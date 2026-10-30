import { GoogleGenAI } from "@google/genai";

const modelo = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const chave = process.env.GEMINI_API_KEY;
const prompt = "Responda apenas: ok";

// Sem chave (ou com GEMINI_API_KEY=mock) o script roda em modo mock, sem chamar a API.
const mock = !chave || chave === "mock";

async function main() {
  if (mock) {
    console.log(`[mock] modelo: ${modelo}`);
    console.log("[mock] resposta: ok (simulada; nenhuma chamada foi feita à API)");
    return;
  }

  const ai = new GoogleGenAI({ apiKey: chave });
  const resposta = await ai.models.generateContent({ model: modelo, contents: prompt });
  console.log(`modelo: ${modelo}`);
  console.log(`resposta: ${resposta.text ?? "(vazia)"}`);
}

main().catch((erro: unknown) => {
  console.error("Falha na chamada ao Gemini:", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
