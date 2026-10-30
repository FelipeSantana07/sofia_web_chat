// Dinheiro sempre em centavos (inteiros). Reais só na entrada (JSON) e formatação só na saída.

function exigirCentavos(centavos: number): void {
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new RangeError(`Valor em centavos inválido: ${centavos}`);
  }
}

/** Converte reais (ex.: 189.9 do catálogo) em centavos, evitando o erro do ponto flutuante. */
export function reaisParaCentavos(reais: number): number {
  if (!Number.isFinite(reais) || reais < 0) {
    throw new RangeError(`Valor em reais inválido: ${reais}`);
  }
  const texto = String(reais);
  // "1.005e2" evita 1.005 * 100 = 100.49999...; notação científica cai no cálculo direto.
  const centavos = texto.includes("e") ? Math.round(reais * 100) : Math.round(Number(`${texto}e2`));
  exigirCentavos(centavos);
  return centavos;
}

export function centavosParaReais(centavos: number): number {
  exigirCentavos(centavos);
  return centavos / 100;
}

/** Aplica um percentual (ex.: 10, 5, 2.5) a um valor em centavos; meio centavo arredonda para cima. */
export function percentualDe(centavos: number, percentual: number): number {
  exigirCentavos(centavos);
  if (!Number.isFinite(percentual) || percentual < 0) {
    throw new RangeError(`Percentual inválido: ${percentual}`);
  }
  const pontosBase = Math.round(percentual * 100); // 10% = 1000 pb; cálculo em inteiros
  return Math.floor((centavos * pontosBase + 5000) / 10000);
}

/** Formata centavos como "R$ 1.234,56". */
export function formatarBRL(centavos: number): string {
  exigirCentavos(centavos);
  const reais = Math.floor(centavos / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = String(centavos % 100).padStart(2, "0");
  return `R$ ${reais},${resto}`;
}
