import { catalogoSchema, type Produto } from "./produto.js";

export type ResultadoCatalogo =
  | { ok: true; produtos: Produto[] }
  | { ok: false; erros: string[] };

function caminho(path: ReadonlyArray<PropertyKey>): string {
  return path.reduce<string>(
    (acc, parte) => (typeof parte === "number" ? `${acc}[${parte}]` : acc ? `${acc}.${String(parte)}` : String(parte)),
    "",
  );
}

/** Valida o conteúdo já lido (JSON.parse) do catálogo e devolve erros legíveis, um por linha. */
export function validarCatalogo(dados: unknown): ResultadoCatalogo {
  const r = catalogoSchema.safeParse(dados);
  if (r.success) return { ok: true, produtos: r.data };
  const erros = r.error.issues.map((i) => {
    const onde = caminho(i.path);
    return onde ? `${onde}: ${i.message}` : i.message;
  });
  return { ok: false, erros };
}
