import { lerEventos, type EventoChat } from "./sse.js";

export interface MensagemChat {
  id: number;
  /** `aviso` é uma observação do sistema (erro de rede, resposta recusada), fora da fala da Sofia. */
  autor: "cliente" | "sofia" | "aviso";
  texto: string;
}

export interface EstadoChat {
  mensagens: MensagemChat[];
  sessaoId: string | null;
  /** Há uma resposta em andamento: o campo de envio fica bloqueado. */
  enviando: boolean;
  /** Mostra o "digitando…": da pergunta até o primeiro texto, e de novo enquanto a Sofia chama ferramentas. */
  digitando: boolean;
  /** A última mensagem da cliente não foi respondida e pode ser reenviada. */
  podeTentarDeNovo: boolean;
}

export const BOAS_VINDAS =
  "Oi! Eu sou a Sofia, assistente virtual com inteligência artificial da Prohall. Me conta: o que você está buscando para o seu cabelo?";

const MENSAGEM_REDE = "Não consegui falar com a Sofia agora. Confira sua conexão e tente de novo.";
const MENSAGEM_GENERICA = "A Sofia não conseguiu responder agora. Tente de novo em instantes.";

export interface OpcoesChat {
  /** Trocado nos testes. */
  fetch?: typeof fetch;
  url?: string;
}

export interface Chat {
  /** Contrato de store do Svelte: use `$chat` nos componentes. */
  subscribe(ouvinte: (estado: EstadoChat) => void): () => void;
  enviar(texto: string): Promise<void>;
  tentarDeNovo(): Promise<void>;
}

export function criarChat({ fetch: buscar = globalThis.fetch.bind(globalThis), url = "/api/chat" }: OpcoesChat = {}): Chat {
  let proximoId = 1;
  let ultimaDaCliente: string | null = null;
  let estado: EstadoChat = {
    mensagens: [{ id: proximoId++, autor: "sofia", texto: BOAS_VINDAS }],
    sessaoId: null,
    enviando: false,
    digitando: false,
    podeTentarDeNovo: false,
  };
  const ouvintes = new Set<(e: EstadoChat) => void>();

  function mudar(parcial: Partial<EstadoChat>): void {
    estado = { ...estado, ...parcial };
    for (const ouvinte of ouvintes) ouvinte(estado);
  }
  const adicionar = (autor: MensagemChat["autor"], texto: string): number => {
    const id = proximoId++;
    mudar({ mensagens: [...estado.mensagens, { id, autor, texto }] });
    return id;
  };
  const alterarTexto = (id: number, fazer: (atual: string) => string): void =>
    mudar({ mensagens: estado.mensagens.map((m) => (m.id === id ? { ...m, texto: fazer(m.texto) } : m)) });

  async function motivoDaRecusa(resposta: Response): Promise<string> {
    try {
      const corpo = (await resposta.json()) as { erro?: unknown };
      if (typeof corpo.erro === "string") return corpo.erro;
    } catch {
      // corpo vazio ou que não é JSON
    }
    return MENSAGEM_GENERICA;
  }

  async function responder(texto: string): Promise<void> {
    mudar({ enviando: true, digitando: true, podeTentarDeNovo: false });
    let idDaSofia: number | null = null;
    let recebeuFim = false;
    let falhou = false;

    const tratar = (evento: EventoChat): void => {
      if (evento.tipo === "sessao") {
        mudar({ sessaoId: evento.sessaoId });
      } else if (evento.tipo === "texto") {
        if (idDaSofia === null) idDaSofia = adicionar("sofia", evento.delta);
        else alterarTexto(idDaSofia, (atual) => atual + evento.delta);
        mudar({ digitando: false });
      } else if (evento.tipo === "ferramenta") {
        mudar({ digitando: true }); // o texto fica parado enquanto a ferramenta roda
      } else if (evento.tipo === "fim") {
        recebeuFim = true;
        // O texto completo vem no fim: garante que a bolha fique igual ao que o servidor guardou.
        if (idDaSofia === null && evento.texto) idDaSofia = adicionar("sofia", evento.texto);
        else if (idDaSofia !== null) alterarTexto(idDaSofia, () => evento.texto);
      } else {
        falhou = true;
        adicionar("aviso", evento.mensagem);
      }
    };

    try {
      const resposta = await buscar(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: texto, ...(estado.sessaoId ? { sessaoId: estado.sessaoId } : {}) }),
      });
      if (!resposta.ok || !resposta.body) {
        falhou = true;
        adicionar("aviso", await motivoDaRecusa(resposta));
      } else {
        for await (const evento of lerEventos(resposta.body)) tratar(evento);
        if (!recebeuFim && !falhou) {
          falhou = true;
          adicionar("aviso", MENSAGEM_GENERICA); // o stream acabou sem o evento final
        }
      }
    } catch {
      falhou = true;
      adicionar("aviso", MENSAGEM_REDE);
    } finally {
      mudar({ enviando: false, digitando: false, podeTentarDeNovo: falhou });
    }
  }

  return {
    subscribe(ouvinte) {
      ouvintes.add(ouvinte);
      ouvinte(estado);
      return () => void ouvintes.delete(ouvinte);
    },
    async enviar(texto) {
      const limpo = texto.trim();
      if (!limpo || estado.enviando) return;
      ultimaDaCliente = limpo;
      adicionar("cliente", limpo);
      await responder(limpo);
    },
    async tentarDeNovo() {
      if (!ultimaDaCliente || estado.enviando || !estado.podeTentarDeNovo) return;
      // Tira o aviso da tentativa anterior; a mensagem da cliente já está na tela.
      mudar({ mensagens: estado.mensagens.filter((m) => m.autor !== "aviso") });
      await responder(ultimaDaCliente);
    },
  };
}
