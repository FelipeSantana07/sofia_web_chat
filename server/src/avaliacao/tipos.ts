// Conversas-teste (T-32): um roteiro é uma sequência de mensagens da cliente e o que se espera da Sofia.

export interface Expectativas {
  /** Ferramentas que precisam ser chamadas em algum momento da conversa. */
  chama?: string[];
  /** Ferramentas que não podem ser chamadas. */
  naoChama?: string[];
  /** Ferramentas que precisam ter sido chamadas e devolvido `ok: false` (ex.: CEP inválido). */
  erroEm?: string[];
  /** Cada padrão precisa aparecer em alguma fala da Sofia. */
  textoContem?: RegExp[];
  /** Nenhum padrão pode aparecer nas falas da Sofia. */
  textoNaoContem?: RegExp[];
}

export interface Roteiro {
  id: string;
  titulo: string;
  objetivo: string;
  mensagens: string[];
  espera: Expectativas;
}

export interface ChamadaRegistrada {
  nome: string;
  argumentos: unknown;
  resultado: Record<string, unknown>;
  duracaoMs: number;
}

export interface TurnoRegistrado {
  cliente: string;
  sofia: string;
  ferramentas: ChamadaRegistrada[];
  /** Mensagem do evento de erro, se o turno falhou. */
  erro?: string;
  /** Da mensagem da cliente até o primeiro pedaço de texto da Sofia (o que ela sente com streaming); null se não veio texto. */
  primeiroTextoMs: number | null;
  /** Da mensagem da cliente até o fim da resposta. */
  duracaoMs: number;
}

export interface ConversaRegistrada {
  roteiro: Roteiro;
  turnos: TurnoRegistrado[];
}

export interface Verificacao {
  descricao: string;
  ok: boolean;
  /** O que deu errado, para o relatório. */
  detalhe?: string;
}
