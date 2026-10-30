import { describe, expect, it } from "vitest";
import {
  atualizarPerfil,
  buscarProdutos,
  detalharProduto,
  mostrarProdutos,
  produtosComplementares,
  SEM_INFORMACAO,
} from "./catalogo-perfil.js";
import { chamar, contextoDeTeste, produtoDeTeste } from "./teste-util.js";

const ids = (r: Record<string, any>): string[] => r.produtos.map((p: { id: string }) => p.id);

describe("buscar_produtos", () => {
  it("sem filtros devolve o catálogo inteiro em lista resumida", () => {
    const r = chamar(buscarProdutos, {}, contextoDeTeste());
    expect(r.ok).toBe(true);
    expect(r.total).toBe(4);
    expect(r.produtos[0]).toMatchObject({
      id: "PH-001",
      nome: "Shampoo Antifrizz",
      categoria: "shampoo",
      uso: "ambos",
      preco: { centavos: 10000, texto: "R$ 100,00" },
      em_promocao: false,
      descricao_curta: "Descrição curta de PH-001.",
    });
  });

  it("mostra o preço vigente e o cheio quando há promoção", () => {
    const kit = chamar(buscarProdutos, { categoria: "kit" }, contextoDeTeste()).produtos[0];
    expect(kit.preco).toEqual({ centavos: 15000, texto: "R$ 150,00" });
    expect(kit.preco_cheio).toEqual({ centavos: 20000, texto: "R$ 200,00" });
    expect(kit.em_promocao).toBe(true);
  });

  it("filtra por categoria", () => {
    expect(ids(chamar(buscarProdutos, { categoria: "mascara" }, contextoDeTeste()))).toEqual(["PH-003"]);
  });

  it("filtra por termo, ignorando acentos e caixa", () => {
    expect(ids(chamar(buscarProdutos, { termo: "FRIZZ" }, contextoDeTeste()))).toEqual(["PH-001"]);
    expect(ids(chamar(buscarProdutos, { termo: "hidratacao" }, contextoDeTeste()))).toEqual(["PH-003"]);
  });

  it("acha 'ressecado' em 'ressecamento' e tolera plural", () => {
    expect(ids(chamar(buscarProdutos, { termo: "cabelo ressecado" }, contextoDeTeste()))).toEqual(["PH-004"]);
    expect(ids(chamar(buscarProdutos, { termo: "fios finos" }, contextoDeTeste()))).toEqual(["PH-002"]);
  });

  it("ordena pelos produtos que casam mais palavras", () => {
    const ps = [
      produtoDeTeste("PH-001", { beneficios: ["brilho"] }),
      produtoDeTeste("PH-002", { beneficios: ["brilho", "maciez"] }),
    ];
    expect(ids(chamar(buscarProdutos, { termo: "brilho e maciez" }, contextoDeTeste(ps)))).toEqual(["PH-002", "PH-001"]);
  });

  it("termo só com palavras genéricas ainda busca por elas", () => {
    const ps = [produtoDeTeste("PH-001", { nome: "Tratamento para cabelos" }), produtoDeTeste("PH-002")];
    expect(ids(chamar(buscarProdutos, { termo: "cabelos" }, contextoDeTeste(ps)))).toEqual(["PH-001"]);
  });

  it("ignora palavras genéricas quando há outras na busca", () => {
    // "cabelos" aparece em PH-001 e PH-002, mas só "frizz" pontua: a busca é por "frizz"
    expect(ids(chamar(buscarProdutos, { termo: "cabelos com frizz" }, contextoDeTeste()))).toEqual(["PH-001"]);
  });

  it("uso home_care inclui 'ambos', exclui profissional e avisa dos sem informação", () => {
    const r = chamar(buscarProdutos, { uso: "home_care" }, contextoDeTeste());
    expect(ids(r)).toEqual(["PH-001", "PH-004"]);
    expect(r.observacao).toMatch(/1 produto\(s\) não informam/);
  });

  it("uso profissional inclui 'ambos' e profissional", () => {
    expect(ids(chamar(buscarProdutos, { uso: "profissional" }, contextoDeTeste()))).toEqual(["PH-001", "PH-003"]);
  });

  it("combina filtros", () => {
    expect(ids(chamar(buscarProdutos, { categoria: "shampoo", uso: "home_care", termo: "frizz" }, contextoDeTeste()))).toEqual([
      "PH-001",
    ]);
  });

  it("marca estoque baixo só quando o estoque de teste é ≤ 3", () => {
    const r = chamar(buscarProdutos, {}, contextoDeTeste());
    expect(r.produtos.find((p: { id: string }) => p.id === "PH-002").estoque_baixo).toBe(true);
    expect(r.produtos.find((p: { id: string }) => p.id === "PH-001")).not.toHaveProperty("estoque_baixo");
  });

  it("sem resultado orienta a não inventar produtos", () => {
    const r = chamar(buscarProdutos, { termo: "perfume importado" }, contextoDeTeste());
    expect(r).toMatchObject({ ok: true, total: 0, produtos: [] });
    expect(r.mensagem).toMatch(/não invente/);
  });

  it("valida os argumentos com erro amigável", () => {
    const r = chamar(buscarProdutos, { categoria: "perfume", uso: 3 }, contextoDeTeste());
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/categoria: valor inválido; use um destes: "progressiva"/);
    expect(r.campos.map((c: { campo: string }) => c.campo)).toEqual(["categoria", "uso"]);
  });

  it("não lança com argumentos ausentes", () => {
    expect(buscarProdutos.executar(undefined, contextoDeTeste()).ok).toBe(true);
  });
});

describe("detalhar_produto", () => {
  it("devolve a ficha completa", () => {
    const r = chamar(detalharProduto, { id: "PH-001" }, contextoDeTeste());
    expect(r).toMatchObject({
      ok: true,
      id: "PH-001",
      nome: "Shampoo Antifrizz",
      preco: { centavos: 10000, texto: "R$ 100,00" },
      estoque: 12,
      rendimento: "Até 25 aplicações",
      modo_de_uso: ["Aplique e enxágue."],
      perguntas_frequentes: [{ pergunta: "Pode usar todo dia?", resposta: "Sim." }],
      combina_com: ["PH-002"],
    });
  });

  it("aceita id em minúsculas e com espaços", () => {
    expect(chamar(detalharProduto, { id: " ph-003 " }, contextoDeTeste()).id).toBe("PH-003");
  });

  it("campos null viram 'sem informação' e entram em campos_sem_informacao", () => {
    const r = chamar(detalharProduto, { id: "PH-001" }, contextoDeTeste());
    expect(r.linha).toBe(SEM_INFORMACAO);
    expect(r.duracao_resultado).toBe(SEM_INFORMACAO);
    expect(r.campos_sem_informacao).toEqual(
      expect.arrayContaining(["linha", "duracao_resultado", "nao_indicado_para", "ativos_principais"]),
    );
    expect(r.campos_sem_informacao).not.toContain("rendimento");
  });

  it("uso null avisa para não afirmar o uso", () => {
    const r = chamar(detalharProduto, { id: "PH-002" }, contextoDeTeste());
    expect(r.uso).toBe(SEM_INFORMACAO);
    expect(r.campos_sem_informacao).toContain("uso");
    expect(r.aviso_uso).toMatch(/não informa/);
  });

  it("produto profissional traz o aviso de aplicação por profissional", () => {
    const r = chamar(detalharProduto, { id: "PH-003" }, contextoDeTeste());
    expect(r.aviso_uso).toMatch(/profissional habilitado/);
    expect(chamar(detalharProduto, { id: "PH-004" }, contextoDeTeste())).not.toHaveProperty("aviso_uso");
  });

  it("mostra preço cheio e promocional", () => {
    const r = chamar(detalharProduto, { id: "PH-002" }, contextoDeTeste());
    expect(r.preco.centavos).toBe(15000);
    expect(r.preco_cheio.centavos).toBe(20000);
    expect(r.estoque_baixo).toBe(true);
  });

  it("não expõe o peso interno do produto", () => {
    const r = chamar(detalharProduto, { id: "PH-001" }, contextoDeTeste());
    expect(r).not.toHaveProperty("peso_bruto_g");
    expect(r).not.toHaveProperty("peso_estimado");
  });

  it("id inexistente devolve erro amigável", () => {
    const r = chamar(detalharProduto, { id: "PH-999" }, contextoDeTeste());
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/PH-999 não encontrado/);
  });

  it("id ausente ou de tipo errado é erro de validação", () => {
    expect(chamar(detalharProduto, {}, contextoDeTeste()).erro).toMatch(/id: campo obrigatório/);
    expect(chamar(detalharProduto, { id: 1 }, contextoDeTeste()).erro).toMatch(/id: deve ser um texto/);
  });
});

describe("produtos_complementares", () => {
  it("devolve o combina_com e os kits que ainda não aparecem", () => {
    const r = chamar(produtosComplementares, { id: "PH-003" }, contextoDeTeste());
    expect(r.combina_com).toEqual([]);
    expect(r.kits.map((k: { id: string }) => k.id)).toEqual(["PH-002"]);
  });

  it("devolve os produtos combinados com resumo", () => {
    const r = chamar(produtosComplementares, { id: "PH-001" }, contextoDeTeste());
    expect(r.produto).toEqual({ id: "PH-001", nome: "Shampoo Antifrizz" });
    expect(r.combina_com.map((c: { id: string }) => c.id)).toEqual(["PH-002"]);
    // PH-002 já está em combina_com: não repete na lista de kits
    expect(r.kits).toEqual([]);
  });

  it("um kit não aparece como complemento de si mesmo", () => {
    const r = chamar(produtosComplementares, { id: "PH-002" }, contextoDeTeste());
    expect(r.kits).toEqual([]);
    expect(r.combina_com.map((c: { id: string }) => c.id)).toEqual(["PH-001"]);
  });

  it("avisa quando não há combinações", () => {
    const ps = [produtoDeTeste("PH-001")];
    expect(chamar(produtosComplementares, { id: "PH-001" }, contextoDeTeste(ps)).mensagem).toMatch(/Não há combinações/);
  });

  it("id inexistente devolve erro amigável", () => {
    expect(chamar(produtosComplementares, { id: "PH-999" }, contextoDeTeste()).ok).toBe(false);
  });
});

describe("atualizar_perfil", () => {
  it("grava os campos enviados e lista o que falta", () => {
    const ctx = contextoDeTeste();
    const r = chamar(atualizarPerfil, { tipo_cabelo: "cacheado", incomodo: "frizz" }, ctx);
    expect(r.ok).toBe(true);
    expect(r.perfil).toEqual({ nome: null, tipo_cabelo: "cacheado", quimica: null, incomodo: "frizz", uso: null });
    expect(r.campos_pendentes).toEqual(["nome", "quimica", "uso"]);
    expect(ctx.sessao.perfil.incomodo).toBe("frizz");
  });

  it("atualiza sem apagar o que já estava", () => {
    const ctx = contextoDeTeste();
    chamar(atualizarPerfil, { nome: "Ana", uso: "home_care" }, ctx);
    const r = chamar(atualizarPerfil, { quimica: "progressiva" }, ctx);
    expect(r.perfil).toMatchObject({ nome: "Ana", uso: "home_care", quimica: "progressiva" });
  });

  it("remove espaços e ignora texto vazio", () => {
    const ctx = contextoDeTeste();
    chamar(atualizarPerfil, { nome: "  Ana  ", incomodo: "   " }, ctx);
    expect(ctx.sessao.perfil.nome).toBe("Ana");
    expect(ctx.sessao.perfil.incomodo).toBeNull();
  });

  it("sem nenhuma informação devolve erro amigável", () => {
    const r = chamar(atualizarPerfil, { nome: "  " }, contextoDeTeste());
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/Nenhuma informação/);
  });

  it("valida o campo uso", () => {
    const r = chamar(atualizarPerfil, { uso: "ambos" }, contextoDeTeste());
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/uso: valor inválido/);
  });

  it("não mistura perfis de sessões diferentes", () => {
    const a = contextoDeTeste();
    const b = contextoDeTeste();
    chamar(atualizarPerfil, { nome: "Ana" }, a);
    expect(b.sessao.perfil.nome).toBeNull();
  });
});

describe("mostrar_produtos", () => {
  it("devolve os dados dos cards: id, nome, preço vigente, foto e estoque baixo", () => {
    const ctx = contextoDeTeste();
    const r = chamar(mostrarProdutos, { ids: ["PH-002", "ph-001"] }, ctx);
    expect(r.ok).toBe(true);
    expect(ids(r)).toEqual(["PH-002", "PH-001"]);
    expect(r.produtos[0]).toMatchObject({
      nome: "Kit Cronograma Fios Finos",
      preco: { centavos: 15000, texto: "R$ 150,00" },
      preco_cheio: { texto: "R$ 200,00" },
      em_promocao: true,
      estoque_baixo: true,
    });
    expect(r.produtos[0].imagem_url).toMatch(/^https:/);
    expect(r.produtos[1].estoque_baixo).toBeUndefined();
  });

  it("marca como esgotado o produto sem estoque", () => {
    const ctx = contextoDeTeste();
    ctx.catalogo.baixarEstoque("PH-002", 2);
    expect(chamar(mostrarProdutos, { ids: ["PH-002"] }, ctx).produtos[0].esgotado).toBe(true);
  });

  it("não repete ids e recusa mais de 3, lista vazia e id que não existe", () => {
    const ctx = contextoDeTeste();
    expect(ids(chamar(mostrarProdutos, { ids: ["PH-001", "PH-001"] }, ctx))).toEqual(["PH-001"]);
    expect(chamar(mostrarProdutos, { ids: ["PH-001", "PH-002", "PH-003", "PH-004"] }, ctx).ok).toBe(false);
    expect(chamar(mostrarProdutos, { ids: [] }, ctx).ok).toBe(false);
    const r = chamar(mostrarProdutos, { ids: ["PH-001", "PH-999"] }, ctx);
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("PH-999");
  });
});
