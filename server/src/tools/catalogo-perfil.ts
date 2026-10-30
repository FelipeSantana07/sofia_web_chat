import { z } from "zod";
import { CATEGORIAS, USOS_PERFIL, type Produto } from "@sofia/shared";
import { LIMITE_ESTOQUE_BAIXO, type Catalogo } from "../catalogo/catalogo.js";
import { precoVigenteCentavos } from "../domain/carrinho.js";
import { acharProduto, definirFerramenta, dinheiro, falha, type Ferramenta, type ResultadoFerramenta } from "./base.js";

/** Valor devolvido no lugar de qualquer campo que a ficha não informa (a Sofia deve dizer que não tem a informação). */
export const SEM_INFORMACAO = "sem informação";

const STOPWORDS = new Set(["de", "do", "da", "com", "para", "que", "uma", "uns", "por", "cabelo", "cabelos", "fios", "fio"]);

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Radical simples: sem plural e com no máximo 6 letras, para "ressecado" achar "ressecamento". */
function radical(palavra: string): string {
  const singular = palavra.length > 3 && palavra.endsWith("s") ? palavra.slice(0, -1) : palavra;
  return singular.slice(0, 6);
}

function palavrasDaBusca(termo: string): string[] {
  const todas = normalizar(termo)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3);
  const uteis = todas.filter((p) => !STOPWORDS.has(p));
  return (uteis.length > 0 ? uteis : todas).map(radical);
}

function textoBuscavel(p: Produto): string {
  return normalizar(
    [
      p.nome,
      p.linha ?? "",
      p.categoria,
      p.descricao_curta,
      p.descricao_completa,
      ...p.indicado_para,
      ...p.beneficios,
      ...p.ativos_principais,
    ].join(" "),
  );
}

export function resumirProduto(p: Produto, catalogo: Catalogo) {
  const vigente = precoVigenteCentavos(catalogo.paraCarrinho(p));
  const promocao = p.preco_promocional !== null;
  return {
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    uso: p.uso ?? SEM_INFORMACAO,
    preco: dinheiro(vigente),
    ...(promocao ? { preco_cheio: dinheiro(catalogo.paraCarrinho(p).precoCentavos) } : {}),
    em_promocao: promocao,
    descricao_curta: p.descricao_curta,
    // Só aparece quando o estoque de teste é realmente baixo (gatilho permitido, especificação 8.3).
    ...(p.estoque_teste <= LIMITE_ESTOQUE_BAIXO ? { estoque_baixo: true } : {}),
    imagem_url: p.imagem_url,
    url: p.url,
  };
}

const idProduto = z.string().min(1).describe("Id do produto no catálogo, ex.: PH-001");

export const buscarProdutos = definirFerramenta({
  nome: "buscar_produtos",
  descricao:
    "Lista resumida dos produtos do catálogo (id, nome, categoria, uso, preço, uma linha de descrição). " +
    "Chame antes de qualquer recomendação. Todos os filtros são opcionais; sem filtros devolve o catálogo inteiro.",
  parametros: z.object({
    termo: z.string().optional().describe("Necessidade ou palavras-chave, ex.: 'frizz', 'cabelo fino e sem volume'"),
    categoria: z.enum(CATEGORIAS).optional().describe("Categoria do produto"),
    uso: z
      .enum(USOS_PERFIL)
      .optional()
      .describe("'profissional' (salão) ou 'home_care' (em casa); produtos de uso 'ambos' entram nos dois"),
  }),
  executar({ termo, categoria, uso }, { catalogo }) {
    const palavras = termo?.trim() ? palavrasDaBusca(termo) : [];
    let candidatos = catalogo.produtos.filter((p) => categoria === undefined || p.categoria === categoria);

    let semInfoDeUso = 0;
    if (uso !== undefined) {
      semInfoDeUso = candidatos.filter((p) => p.uso === null).length;
      candidatos = candidatos.filter((p) => p.uso === "ambos" || p.uso === uso);
    }

    let resultado = candidatos.map((p) => ({ p, pontos: 0 }));
    if (palavras.length > 0) {
      resultado = candidatos
        .map((p) => {
          const texto = textoBuscavel(p);
          return { p, pontos: palavras.filter((w) => texto.includes(w)).length };
        })
        .filter((r) => r.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos || a.p.id.localeCompare(b.p.id));
    }

    const produtos = resultado.map((r) => resumirProduto(r.p, catalogo));
    const extras: Record<string, unknown> = {};
    if (uso !== undefined && semInfoDeUso > 0) {
      extras.observacao =
        `${semInfoDeUso} produto(s) não informam se são de uso profissional ou em casa e ficaram fora deste filtro; ` +
        "não afirme o uso deles.";
    }
    if (produtos.length === 0) {
      extras.mensagem =
        "Nenhum produto do catálogo corresponde à busca. Diga à cliente que não temos esse produto; não invente nem cite produtos de fora do catálogo.";
    }
    return { ok: true, total: produtos.length, produtos, ...extras };
  },
});

const CAMPOS_DA_FICHA = [
  "linha",
  "volume",
  "uso",
  "indicado_para",
  "nao_indicado_para",
  "beneficios",
  "ativos_principais",
  "modo_de_uso",
  "cuidados_e_avisos",
  "duracao_resultado",
  "rendimento",
  "perguntas_frequentes",
] as const;

export const detalharProduto = definirFerramenta({
  nome: "detalhar_produto",
  descricao:
    "Ficha completa de um produto (descrição, indicações, ativos, modo de uso, cuidados, rendimento, FAQ, estoque). " +
    "Use para responder dúvidas específicas. Campos que a ficha não informa vêm como 'sem informação' " +
    "e são listados em campos_sem_informacao: nesses casos diga que não tem a informação.",
  parametros: z.object({ id: idProduto }),
  executar({ id }, { catalogo }): ResultadoFerramenta {
    const p = acharProduto(catalogo, id);
    if (!p) return falha(`Produto ${id.trim()} não encontrado no catálogo. Use buscar_produtos para ver os ids válidos.`);

    const sem = CAMPOS_DA_FICHA.filter((c) => {
      const v = p[c];
      return v === null || (Array.isArray(v) && v.length === 0);
    });
    const escalar = <T>(v: T | null) => (v === null ? SEM_INFORMACAO : v);
    const cp = catalogo.paraCarrinho(p);

    const avisoUso =
      p.uso === "profissional"
        ? "Produto de uso profissional: avise a cliente que a aplicação é por profissional habilitado."
        : p.uso === null
          ? "A ficha não informa se o produto é de uso profissional ou em casa; não afirme."
          : undefined;

    return {
      ok: true,
      id: p.id,
      nome: p.nome,
      linha: escalar(p.linha),
      categoria: p.categoria,
      url: p.url,
      imagem_url: p.imagem_url,
      preco: dinheiro(precoVigenteCentavos(cp)),
      ...(p.preco_promocional !== null ? { preco_cheio: dinheiro(cp.precoCentavos) } : {}),
      em_promocao: p.preco_promocional !== null,
      volume: escalar(p.volume),
      uso: escalar(p.uso),
      ...(avisoUso ? { aviso_uso: avisoUso } : {}),
      estoque: p.estoque_teste,
      ...(p.estoque_teste <= LIMITE_ESTOQUE_BAIXO ? { estoque_baixo: true } : {}),
      descricao_curta: p.descricao_curta,
      descricao_completa: p.descricao_completa,
      indicado_para: p.indicado_para,
      nao_indicado_para: p.nao_indicado_para,
      beneficios: p.beneficios,
      ativos_principais: p.ativos_principais,
      modo_de_uso: p.modo_de_uso,
      cuidados_e_avisos: p.cuidados_e_avisos,
      duracao_resultado: escalar(p.duracao_resultado),
      rendimento: escalar(p.rendimento),
      combina_com: p.combina_com,
      perguntas_frequentes: p.perguntas_frequentes,
      campos_sem_informacao: sem,
    };
  },
});

export const produtosComplementares = definirFerramenta({
  nome: "produtos_complementares",
  descricao:
    "Produtos que combinam com um produto (relações combina_com do catálogo) e os kits disponíveis. " +
    "Chame depois de cada recomendação aceita, para sugerir venda cruzada só quando fizer sentido para o problema da cliente.",
  parametros: z.object({ id: idProduto }),
  executar({ id }, { catalogo }) {
    const p = acharProduto(catalogo, id);
    if (!p) return falha(`Produto ${id.trim()} não encontrado no catálogo. Use buscar_produtos para ver os ids válidos.`);

    const combinam = p.combina_com
      .map((alvo) => catalogo.obter(alvo))
      .filter((c): c is Produto => c !== undefined);
    const kits = catalogo.produtos.filter(
      (k) => k.categoria === "kit" && k.id !== p.id && !p.combina_com.includes(k.id),
    );

    return {
      ok: true,
      produto: { id: p.id, nome: p.nome },
      combina_com: combinam.map((c) => resumirProduto(c, catalogo)),
      kits: kits.map((k) => resumirProduto(k, catalogo)),
      ...(combinam.length === 0 && kits.length === 0
        ? { mensagem: "Não há combinações cadastradas para este produto." }
        : {}),
    };
  },
});

export const mostrarProdutos = definirFerramenta({
  nome: "mostrar_produtos",
  descricao:
    "Mostra na tela da cliente os cards (foto, nome, preço e botão Adicionar) dos produtos que você está recomendando. " +
    "Chame junto com a recomendação, com os ids de 1 a 3 produtos que você citou no texto; a explicação de cada um continua sendo sua, em texto. " +
    "Não repita preço, nome ou foto na mensagem além do que fizer sentido na conversa.",
  parametros: z.object({
    ids: z.array(idProduto).min(1).max(3).describe("Ids dos produtos recomendados, de 1 a 3"),
  }),
  executar({ ids }, { catalogo }) {
    const unicos = [...new Set(ids.map((id) => id.trim().toUpperCase()))];
    const desconhecidos = unicos.filter((id) => !catalogo.obter(id));
    if (desconhecidos.length > 0) {
      return falha(`Produto(s) não encontrado(s) no catálogo: ${desconhecidos.join(", ")}. Use buscar_produtos para ver os ids válidos.`);
    }
    const produtos = unicos.map((id) => {
      const p = catalogo.obter(id)!;
      return { ...resumirProduto(p, catalogo), ...(p.estoque_teste <= 0 ? { esgotado: true } : {}) };
    });
    return { ok: true, mensagem: "Cards exibidos na tela da cliente.", produtos };
  },
});

const textoPerfil = (descricao: string) => z.string().optional().describe(descricao);

export const atualizarPerfil = definirFerramenta({
  nome: "atualizar_perfil",
  descricao:
    "Grava o que a cliente contou sobre si (nome, tipo de cabelo, química, principal incômodo, uso). " +
    "Chame a cada informação nova; só os campos enviados são atualizados. Devolve o perfil e o que ainda falta saber.",
  parametros: z.object({
    nome: textoPerfil("Nome da cliente"),
    tipo_cabelo: textoPerfil("Tipo de cabelo, ex.: liso, ondulado, cacheado, crespo, fino"),
    quimica: textoPerfil("Química atual, ex.: progressiva, coloração, descoloração, nenhuma"),
    incomodo: textoPerfil("Principal incômodo, ex.: frizz, queda, ressecamento, falta de volume"),
    uso: z.enum(USOS_PERFIL).optional().describe("'profissional' (salão) ou 'home_care' (uso em casa)"),
  }),
  executar(args, { sessao }) {
    const novos: Partial<typeof sessao.perfil> = {};
    for (const campo of ["nome", "tipo_cabelo", "quimica", "incomodo"] as const) {
      const valor = args[campo]?.trim();
      if (valor) novos[campo] = valor;
    }
    if (args.uso !== undefined) novos.uso = args.uso;

    if (Object.keys(novos).length === 0) {
      return falha("Nenhuma informação enviada. Informe ao menos um campo: nome, tipo_cabelo, quimica, incomodo ou uso.");
    }
    Object.assign(sessao.perfil, novos);

    const pendentes = Object.entries(sessao.perfil)
      .filter(([, v]) => v === null)
      .map(([k]) => k);
    return { ok: true, perfil: { ...sessao.perfil }, campos_pendentes: pendentes };
  },
});

export const ferramentasCatalogoPerfil: Ferramenta[] = [
  buscarProdutos,
  detalharProduto,
  produtosComplementares,
  mostrarProdutos,
  atualizarPerfil,
];
