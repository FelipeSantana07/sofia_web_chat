import type { Expectativas } from "./tipos.js";

/**
 * Três vendas completas, da descoberta ao PIX pago, com perfis de cliente bem diferentes. São exportadas como
 * texto (`pnpm conversas:exportar`) e as mensagens de cada uma servem de roteiro para gravar o vídeo.
 */
export interface Perfil {
  id: string;
  /** Nome do arquivo em docs/conversas/. */
  arquivo: string;
  titulo: string;
  /** Quem é a cliente e o que ela busca. */
  descricao: string;
  /** O que esta conversa mostra do sistema (usado no cabeçalho do arquivo e no roteiro do vídeo). */
  mostra: string[];
  mensagens: string[];
  espera: Expectativas;
}

const VENDA_COMPLETA = ["atualizar_perfil", "buscar_produtos", "adicionar_ao_carrinho", "calcular_frete", "finalizar_pedido", "gerar_pix"];

export const PERFIS: Perfil[] = [
  {
    id: "ana",
    arquivo: "01-ana-fios-finos-queda.md",
    titulo: "Ana — fios finos, sem volume e com queda (uso em casa)",
    descricao: "Cliente de uso em casa, sem química, que quer resolver queda e falta de volume. Tem o cupom PROHALL10.",
    mostra: [
      "recomendação com cards e justificativa da ficha",
      "combinação (tônico + kit Encorpax) e aviso de queda intensa (dermatologista)",
      "cupom PROHALL10 aplicado pelo código",
      "frete Econômica para São Paulo (Z1) e quanto falta para o frete grátis",
      "pedido e PIX falso, com o pagamento simulado",
    ],
    mensagens: [
      "Oi! Me chamo Ana. Meu cabelo é fino, sem volume e está caindo bastante. Não faço química e uso em casa. O que você me indica?",
      "Adorei! Quero levar o tônico Force Hair e o kit Encorpax, 1 unidade de cada. Pode adicionar ao carrinho?",
      "Tenho o cupom PROHALL10, pode aplicar?",
      "Meu CEP é 01310-100.",
      "Prefiro a Econômica. Para fechar: Ana Souza, ana@exemplo.com, Av. Paulista, número 1000, apto 12.",
      "Está tudo certo, pode fechar o pedido e gerar o PIX!",
    ],
    espera: { chama: [...VENDA_COMPLETA, "aplicar_cupom"], textoContem: [/frete gr[áa]tis/i] },
  },
  {
    id: "carla",
    arquivo: "02-carla-cacheada-frizz.md",
    titulo: "Carla — cacheada com frizz e umidade, em Manaus (uso em casa)",
    descricao: "Cliente de uso em casa, cabelo cacheado que vira \"nuvem de frizz\", mora longe e tem pressa.",
    mostra: [
      "linha Secar Sem Frizz recomendada pela ficha, sem inventar o que o site não informa",
      "frete para a região mais distante (Z5) e a modalidade Expressa",
      "carrinho montado pela conversa e checkout por ela mesma",
      "pedido e PIX falso, com o pagamento simulado",
    ],
    mensagens: [
      "Oi, sou a Carla! Meu cabelo é cacheado e vira uma nuvem de frizz com a umidade. Uso em casa e não faço química. Preciso de ajuda!",
      "Quero o óleo de blindagem antiumidade, o sérum de vitrificação e a máscara de blindagem antifrizz, 1 de cada. Pode adicionar ao carrinho?",
      "Moro em Manaus, o CEP é 69000-000. Quais as opções de frete?",
      "Como preciso rápido, vou de Expressa. Carla Mendes, carla@exemplo.com, Rua das Palmeiras, número 45, bloco B.",
      "Pode fechar o pedido e gerar o PIX, está tudo certo!",
    ],
    espera: { chama: VENDA_COMPLETA },
  },
  {
    id: "juliana",
    arquivo: "03-juliana-cabeleireira-descoloracao.md",
    titulo: "Juliana — cabeleireira que descolore no salão (uso profissional)",
    descricao: "Profissional que repõe o estoque do salão: pó descolorante, oxigenada e reconstrução para fios fragilizados.",
    mostra: [
      "produtos de uso profissional, tratados como tal (a cliente é a profissional)",
      "combinação do pó descolorante com a água oxigenada e reconstrução depois da química",
      "pedido maior, que passa do valor mínimo: a Sofia oferece o frete grátis na Econômica",
      "pedido e PIX falso, com o pagamento simulado",
    ],
    mensagens: [
      "Oi! Sou a Juliana, cabeleireira. No salão faço muita descoloração e minhas clientes estão com os fios fragilizados. Preciso repor pó descolorante, oxigenada e algo para reconstruir. O que você tem?",
      "Perfeito. Pode adicionar 2 unidades do pó descolorante, 2 da água oxigenada OX 30 volumes e 1 do fluido de reconstrução Pro.R?",
      "Meu CEP é 80010-000, em Curitiba. Quais as opções de frete?",
      "Pode ser a Econômica com o frete grátis. Juliana Prado, juliana@exemplo.com, Rua XV de Novembro, número 300, sala 2.",
      "Confirmo tudo, pode fechar o pedido e gerar o PIX.",
    ],
    // A cliente já é a profissional: a Sofia não precisa avisar que o produto é de uso profissional, mas fala do salão.
    espera: { chama: VENDA_COMPLETA, textoContem: [/frete gr[áa]tis/i, /sal[ãa]o/i] },
  },
];
