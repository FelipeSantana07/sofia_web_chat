import { z } from "zod";

// Formato 4.1 da especificação. Campos que o site não informa são null (simples) ou [] (listas).

export const CATEGORIAS = [
  "progressiva",
  "tratamento",
  "shampoo",
  "condicionador",
  "mascara",
  "finalizador",
  "kit",
  "outro",
] as const;

export const USOS = ["profissional", "home_care", "ambos"] as const;

const idProduto = z.string().regex(/^PH-\d{3}$/, "id deve seguir o formato PH-001");

const textoObrigatorio = z.string().trim().min(1, "não pode ficar vazio");

const textoOuNull = z.string().trim().min(1, "use null em vez de texto vazio").nullable();

const lista = z.array(textoObrigatorio);

/** Reais com no máximo 2 casas decimais (o catálogo é convertido para centavos ao carregar). */
const reais = z
  .number()
  .positive("deve ser maior que zero")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "use no máximo 2 casas decimais");

export const perguntaFrequenteSchema = z.object({
  pergunta: textoObrigatorio,
  resposta: textoObrigatorio,
});

export const produtoSchema = z
  .object({
    id: idProduto,
    sku: textoOuNull,
    nome: textoObrigatorio,
    linha: textoOuNull,
    categoria: z.enum(CATEGORIAS),
    url: z.url(),
    imagem_url: z.url(),
    preco: reais,
    preco_promocional: reais.nullable(),
    volume: textoOuNull,
    peso_bruto_g: z.number().int().positive(),
    peso_estimado: z.boolean(),
    estoque_teste: z.number().int().min(0),
    // null quando a página não diz se é profissional ou de uso em casa.
    uso: z.enum(USOS).nullable(),
    descricao_curta: textoObrigatorio,
    descricao_completa: textoObrigatorio,
    indicado_para: lista,
    nao_indicado_para: lista,
    beneficios: lista,
    ativos_principais: lista,
    modo_de_uso: lista,
    cuidados_e_avisos: lista,
    duracao_resultado: textoOuNull,
    rendimento: textoOuNull,
    combina_com: z.array(idProduto),
    perguntas_frequentes: z.array(perguntaFrequenteSchema),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.preco_promocional !== null && p.preco_promocional >= p.preco) {
      ctx.addIssue({
        code: "custom",
        path: ["preco_promocional"],
        message: "o preço promocional deve ser menor que o preço",
      });
    }
    if (p.combina_com.includes(p.id)) {
      ctx.addIssue({ code: "custom", path: ["combina_com"], message: "um produto não combina com ele mesmo" });
    }
    if (new Set(p.combina_com).size !== p.combina_com.length) {
      ctx.addIssue({ code: "custom", path: ["combina_com"], message: "ids repetidos em combina_com" });
    }
  });

/** O arquivo data/produtos.json: lista de produtos com ids únicos e combinações que existem. */
export const catalogoSchema = z.array(produtoSchema).superRefine((produtos, ctx) => {
  const ids = new Set<string>();
  produtos.forEach((p, i) => {
    if (ids.has(p.id)) {
      ctx.addIssue({ code: "custom", path: [i, "id"], message: `id repetido: ${p.id}` });
    }
    ids.add(p.id);
  });
  produtos.forEach((p, i) => {
    p.combina_com.forEach((alvo, j) => {
      if (!ids.has(alvo)) {
        ctx.addIssue({
          code: "custom",
          path: [i, "combina_com", j],
          message: `combina_com aponta para um produto que não existe: ${alvo}`,
        });
      }
    });
  });
});

export type Produto = z.infer<typeof produtoSchema>;
export type Categoria = (typeof CATEGORIAS)[number];
export type Uso = (typeof USOS)[number];
