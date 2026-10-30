// Apoio aos testes das ferramentas: catálogo pequeno e fixo, independente dos preços reais do data/produtos.json.
import type { Produto } from "@sofia/shared";
import { criarCatalogo } from "../catalogo/catalogo.js";
import { criarStoreSessoes } from "../sessao/store.js";
import type { ContextoFerramenta, Ferramenta, ResultadoFerramenta } from "./base.js";

export function produtoDeTeste(id: string, extra: Partial<Produto> = {}): Produto {
  return {
    id,
    sku: null,
    nome: `Produto ${id}`,
    linha: null,
    categoria: "shampoo",
    url: `https://lojaprohall.com.br/products/${id.toLowerCase()}`,
    imagem_url: `https://lojaprohall.com.br/${id.toLowerCase()}.jpg`,
    preco: 100,
    preco_promocional: null,
    volume: "300 ml",
    peso_bruto_g: 400,
    peso_estimado: true,
    estoque_teste: 12,
    uso: "ambos",
    descricao_curta: `Descrição curta de ${id}.`,
    descricao_completa: `Descrição completa de ${id}.`,
    indicado_para: [],
    nao_indicado_para: [],
    beneficios: [],
    ativos_principais: [],
    modo_de_uso: ["Aplique e enxágue."],
    cuidados_e_avisos: ["Uso externo."],
    duracao_resultado: null,
    rendimento: null,
    combina_com: [],
    perguntas_frequentes: [],
    ...extra,
  };
}

export const PRODUTOS_DE_TESTE: Produto[] = [
  produtoDeTeste("PH-001", {
    nome: "Shampoo Antifrizz",
    preco: 100,
    uso: "ambos",
    estoque_teste: 12,
    indicado_para: ["cabelos com frizz"],
    combina_com: ["PH-002"],
    rendimento: "Até 25 aplicações",
    perguntas_frequentes: [{ pergunta: "Pode usar todo dia?", resposta: "Sim." }],
  }),
  produtoDeTeste("PH-002", {
    nome: "Kit Cronograma Fios Finos",
    categoria: "kit",
    preco: 200,
    preco_promocional: 150,
    uso: null,
    estoque_teste: 2,
    peso_bruto_g: 1200,
    indicado_para: ["cabelos finos e ralos"],
    combina_com: ["PH-001"],
  }),
  produtoDeTeste("PH-003", {
    nome: "Máscara Profissional",
    categoria: "mascara",
    linha: "Linha Salão",
    preco: 80,
    uso: "profissional",
    estoque_teste: 5,
    beneficios: ["Hidratação profunda"],
  }),
  produtoDeTeste("PH-004", {
    nome: "Óleo Finalizador",
    categoria: "finalizador",
    preco: 60,
    uso: "home_care",
    estoque_teste: 10,
    beneficios: ["Reduz o ressecamento das pontas"],
  }),
];

export function contextoDeTeste(produtos: Produto[] = PRODUTOS_DE_TESTE): ContextoFerramenta {
  return { catalogo: criarCatalogo(produtos), sessao: criarStoreSessoes().obterOuCriar("teste") };
}

export function chamar(
  ferramenta: Ferramenta,
  argumentos: unknown,
  ctx: ContextoFerramenta,
): ResultadoFerramenta & Record<string, any> {
  return ferramenta.executar(argumentos, ctx) as ResultadoFerramenta & Record<string, any>;
}
