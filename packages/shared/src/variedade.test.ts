import { describe, expect, it } from "vitest";
import { contarParesCombinados, verificarVariedade, type Produto } from "./index.js";

function produto(id: string, extra: Partial<Produto> = {}): Produto {
  return {
    id,
    sku: null,
    nome: id,
    linha: null,
    categoria: "shampoo",
    url: "https://lojaprohall.com.br/products/x",
    imagem_url: "https://lojaprohall.com.br/x.jpg",
    preco: 10,
    preco_promocional: null,
    volume: null,
    peso_bruto_g: 100,
    peso_estimado: true,
    estoque_teste: 10,
    uso: null,
    descricao_curta: "x",
    descricao_completa: "x",
    indicado_para: [],
    nao_indicado_para: [],
    beneficios: [],
    ativos_principais: [],
    modo_de_uso: [],
    cuidados_e_avisos: [],
    duracao_resultado: null,
    rendimento: null,
    combina_com: [],
    perguntas_frequentes: [],
    ...extra,
  };
}

const porDescricao = (produtos: Produto[]) =>
  Object.fromEntries(verificarVariedade(produtos).map((m) => [m.descricao, m]));

describe("contarParesCombinados", () => {
  it("conta A→B e B→A como um par só", () => {
    const ps = [
      produto("PH-001", { combina_com: ["PH-002", "PH-003"] }),
      produto("PH-002", { combina_com: ["PH-001"] }),
      produto("PH-003"),
    ];
    expect(contarParesCombinados(ps)).toBe(2);
  });
});

describe("verificarVariedade", () => {
  it("aponta o que falta num catálogo pequeno", () => {
    const m = porDescricao([produto("PH-001")]);
    expect(m["produtos"]).toMatchObject({ atual: 1, minimo: 15, ok: false });
    expect(m["kits"]?.ok).toBe(false);
    expect(m["uso em casa (home care)"]?.ok).toBe(false);
    expect(m["estoque de teste ≤ 3"]?.ok).toBe(false);
  });

  it("conta 'ambos' como profissional e como home care", () => {
    const m = porDescricao([produto("PH-001", { uso: "ambos" })]);
    expect(m["uso profissional"]?.ok).toBe(true);
    expect(m["uso em casa (home care)"]?.ok).toBe(true);
  });

  it("uso null não conta para nenhum dos dois", () => {
    const m = porDescricao([produto("PH-001", { uso: null })]);
    expect(m["uso profissional"]?.atual).toBe(0);
    expect(m["uso em casa (home care)"]?.atual).toBe(0);
  });

  it("estoque 3 conta como baixo e 4 não", () => {
    expect(porDescricao([produto("PH-001", { estoque_teste: 3 })])["estoque de teste ≤ 3"]?.ok).toBe(true);
    expect(porDescricao([produto("PH-001", { estoque_teste: 4 })])["estoque de teste ≤ 3"]?.ok).toBe(false);
  });
});
