// Configuração lida do .env. Não há valores padrão no código: o que é obrigatório e falta é erro, com mensagem clara;
// o que é opcional e não foi definido fica com o padrão do próprio modelo.

export const NIVEIS_PENSAMENTO = ["MINIMAL", "LOW", "MEDIUM", "HIGH"] as const;
export type NivelPensamento = (typeof NIVEIS_PENSAMENTO)[number];

export interface ConfigGemini {
  apiKey: string;
  modelo: string;
  /** GEMINI_TEMPERATURE (opcional, de 0 a 2). */
  temperatura?: number;
  /** GEMINI_THINKING_LEVEL (opcional): quanto o modelo pensa antes de responder. */
  nivelPensamento?: NivelPensamento;
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
  return { apiKey, modelo, ...lerAjustesOpcionais(env) };
}

function lerAjustesOpcionais(env: NodeJS.ProcessEnv): Pick<ConfigGemini, "temperatura" | "nivelPensamento"> {
  const ajustes: Pick<ConfigGemini, "temperatura" | "nivelPensamento"> = {};
  const temperatura = env.GEMINI_TEMPERATURE?.trim();
  if (temperatura) {
    const valor = Number(temperatura);
    if (!Number.isFinite(valor) || valor < 0 || valor > 2) {
      throw new ErroDeConfiguracao(`GEMINI_TEMPERATURE deve ser um número de 0 a 2 (recebi "${temperatura}").`);
    }
    ajustes.temperatura = valor;
  }
  const nivel = env.GEMINI_THINKING_LEVEL?.trim().toUpperCase();
  if (nivel) {
    if (!(NIVEIS_PENSAMENTO as readonly string[]).includes(nivel)) {
      throw new ErroDeConfiguracao(`GEMINI_THINKING_LEVEL deve ser ${NIVEIS_PENSAMENTO.join(", ")} (recebi "${nivel}").`);
    }
    ajustes.nivelPensamento = nivel as NivelPensamento;
  }
  return ajustes;
}

/** Os ajustes opcionais em texto, para logs e relatórios. */
export function descreverAjustes({ temperatura, nivelPensamento }: Pick<ConfigGemini, "temperatura" | "nivelPensamento">): string {
  return [
    `temperatura ${temperatura ?? "padrão do modelo"}`,
    `pensamento ${nivelPensamento ?? "padrão do modelo"}`,
  ].join(", ");
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
