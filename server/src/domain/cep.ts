// Zona de frete pelo CEP de destino (especificação, tabela 5.1).

export type Zona = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

export type ResultadoZona = { ok: true; zona: Zona } | { ok: false; erro: string };

// Faixas inclusivas, em número inteiro do CEP sem hífen.
const FAIXAS: ReadonlyArray<readonly [number, number, Zona]> = [
  [1_000_000, 19_999_999, "Z1"],
  [30_000_000, 39_999_999, "Z1"],
  [20_000_000, 29_999_999, "Z2"],
  [80_000_000, 89_999_999, "Z2"],
  [70_000_000, 76_799_999, "Z3"],
  [78_000_000, 79_999_999, "Z3"],
  [90_000_000, 99_999_999, "Z3"],
  [40_000_000, 65_999_999, "Z4"],
  [66_000_000, 69_999_999, "Z5"],
  [76_800_000, 77_999_999, "Z5"],
];

/** Remove o hífen opcional e devolve 8 dígitos, ou null se o formato for inválido. */
export function normalizarCep(cep: string): string | null {
  const limpo = cep.trim().replace(/^(\d{5})-(\d{3})$/, "$1$2");
  return /^\d{8}$/.test(limpo) ? limpo : null;
}

export function identificarZona(cep: string): ResultadoZona {
  const normalizado = normalizarCep(cep);
  if (!normalizado) {
    return { ok: false, erro: "CEP inválido: informe 8 dígitos, com ou sem hífen (ex.: 01310-100)." };
  }
  const numero = Number(normalizado);
  const faixa = FAIXAS.find(([inicio, fim]) => numero >= inicio && numero <= fim);
  if (!faixa) {
    return { ok: false, erro: "Esse CEP está fora das regiões atendidas. Confira o número e tente de novo." };
  }
  return { ok: true, zona: faixa[2] };
}
