// Configuração lida do .env. Não há valores padrão no código: o que falta é erro, com mensagem clara.

export interface ConfigGemini {
  apiKey: string;
  modelo: string;
}

export class ErroDeConfiguracao extends Error {}

function exigir(nomes: readonly string[], env: NodeJS.ProcessEnv): string[] {
  const faltando = nomes.filter((nome) => !env[nome]?.trim());
  if (faltando.length > 0) {
    throw new ErroDeConfiguracao(
      `Defina ${faltando.join(" e ")} no arquivo .env na raiz do projeto (veja .env.example).`,
    );
  }
  return nomes.map((nome) => env[nome]!.trim());
}

/** Nome do modelo (GEMINI_MODEL). */
export function lerModeloGemini(env: NodeJS.ProcessEnv = process.env): string {
  return exigir(["GEMINI_MODEL"], env)[0]!;
}

/** Chave e modelo para chamar o Gemini de verdade. */
export function lerConfigGemini(env: NodeJS.ProcessEnv = process.env): ConfigGemini {
  const [apiKey, modelo] = exigir(["GEMINI_API_KEY", "GEMINI_MODEL"], env) as [string, string];
  if (apiKey === "mock") {
    throw new ErroDeConfiguracao("GEMINI_API_KEY=mock só vale para pnpm gemini:teste; use a chave real no .env.");
  }
  return { apiKey, modelo };
}

/** Para scripts e para o start do servidor: erro de configuração vira mensagem e saída com código 1, sem stack trace. */
export function ouEncerrar<T>(ler: () => T): T {
  try {
    return ler();
  } catch (erro) {
    if (!(erro instanceof ErroDeConfiguracao)) throw erro;
    console.error(erro.message);
    process.exit(1);
  }
}
