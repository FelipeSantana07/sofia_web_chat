# Sofia Web Chat — vendedora IA Prohall

Vendedora virtual em chat web (estilo Sofia) para o teste técnico da Prohall. Ela conhece 15 produtos, recomenda pelo perfil da cliente, calcula frete por tabela fixa, monta o carrinho e fecha com checkout e PIX falsos.

O foco do projeto é IA aplicada a vendas: prompt, function calling, dados e limites. Frete, totais, cupom, estoque e PIX são calculados sempre no código; a IA só chama ferramentas e comunica os resultados.

## Como rodar

Requisitos: Node 20 ou superior e pnpm.

```bash
pnpm install
```

Copie o arquivo de ambiente e preencha a chave do Gemini (enviada separadamente; nunca commitar o `.env`):

```bash
cp .env.example .env
```

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `GEMINI_API_KEY` | Chave da API do Gemini | — |
| `GEMINI_MODEL` | Modelo usado pela Sofia (obrigatório; o `.env.example` traz `gemini-3.8-flash`) | — |
| `GEMINI_TEMPERATURE` | Opcional. Temperatura do modelo (0 a 2); o `.env.example` traz `0.3` | padrão do modelo |
| `GEMINI_THINKING_LEVEL` | Opcional. Nível de pensamento: `MINIMAL`, `LOW`, `MEDIUM` ou `HIGH`; o `.env.example` traz `LOW` | padrão do modelo |
| `PORT` | Porta do servidor | `3000` |

```bash
pnpm dev    # sobe server (3000) e web (5173) juntos; abra http://localhost:5173
pnpm test   # roda os testes (Vitest)
pnpm gemini:teste   # chamada simples ao Gemini (modo mock sem chave)
pnpm gemini:ferramentas   # spike de function calling (exige chave real)
pnpm validate:catalogo   # valida data/produtos.json contra o schema
pnpm chat   # conversa com a Sofia no terminal, mostrando as ferramentas; /pagar simula o pagamento (exige chave real)
pnpm estoque:repor [n]   # soma n unidades (padrão 10) ao estoque de todos os produtos
pnpm conversas [id...] [--vezes N]   # roda as conversas-teste contra o Gemini e grava docs/conversas-teste.md (exige chave real)
```

A interface abre em `http://localhost:5173` (com `?debug` na URL, o painel de debug das ferramentas já abre; ele também abre pelo botão `<>` do topo); o Vite encaminha `/api` para o servidor (se mudar a `PORT`, rode o web com `SERVER_PORT` igual). O servidor sobe em `http://127.0.0.1:3000` (porta de `PORT`):

- `POST /api/chat` com `{ "mensagem": "...", "sessaoId": "opcional" }` responde em Server-Sent Events: `sessao` (id da conversa, reenviado nas mensagens seguintes), `texto` (pedaços da resposta), `ferramenta` (nome, argumentos e resultado de cada chamada), `fim` (texto completo) e `erro`.
- `GET /api/saude` responde `{ "ok": true }`.
- Carrinho pela tela (os botões usam as mesmas regras das ferramentas da Sofia): `GET /api/sessoes/:sessaoId/carrinho`, `POST …/carrinho/itens` (`{ id, quantidade? }`) e `DELETE …/carrinho/itens/:produtoId?quantidade=n`. O que a cliente faz na tela chega à Sofia como um aviso na próxima mensagem.
- Frete de um CEP para o checkout: `POST /api/sessoes/:sessaoId/frete` (`{ cep }`).
- Checkout pelo formulário, o mesmo pedido que a Sofia fecha pela conversa: `POST /api/sessoes/:sessaoId/checkout` (nome, e-mail, CEP, endereço, número, complemento opcional e `modalidade_frete`), `POST /api/sessoes/:sessaoId/pedidos/:pedidoId/pix` (PIX falso com QR Code em SVG, válido por 15 minutos; só gera outro depois de expirar), `POST …/pagar` (simula o pagamento e devolve a confirmação da Sofia) e `GET …/pedidos/:pedidoId`.
- O pedido reserva o estoque de teste enquanto o PIX vale; se não for pago em 15 minutos, as unidades voltam sozinhas. O estoque alterado fica em `data/estoque.json` (fora do Git) e `pnpm estoque:repor` repõe; o servidor no ar enxerga a reposição sem reiniciar.
- Cada mensagem e cada chamada de ferramenta ficam registradas em `logs/conversas.jsonl`.

## Estrutura

```
├── data/produtos.json      # catálogo (T-14, T-15)
├── docs/                   # requisitos, especificação e tarefas
├── packages/shared/        # tipos e schemas compartilhados
├── prompts/sofia.md        # prompt de sistema
├── server/                 # Fastify (domínio, ferramentas, agente, rotas)
└── web/                    # Svelte + Vite
```

## Stack

Monorepo pnpm · Node + TypeScript + Fastify · Svelte + Vite · zod · Vitest · Gemini `gemini-3.8-flash` via `@google/genai`.

Justificativa da stack (incluindo o Svelte): a preencher na T-34.

## Preços do catálogo

Preços copiados de lojaprohall.com.br em **29/10/2026**. Os 15 preços (cheio e promocional) foram conferidos nas páginas dos produtos nessa data. Preço vigente = promocional quando existe.

## Combinações (`combina_com`)

Seis pares, nos dois sentidos em `data/produtos.json`, escolhidos por serem os que mais fazem sentido na ficha dos produtos:

- PH-001 + PH-002 · O tônico Force Hair cuida do couro cabeludo (queda, fios fracos) e o kit Encorpax repõe massa no comprimento de fios finos e ralos: raiz e fio no mesmo problema.
- PH-004 + PH-013 · Mesma linha Secar Sem Frizz: o sérum sela as cutículas antes de secar e o óleo de blindagem é a última etapa do protocolo, contra a umidade.
- PH-006 + PH-008 · O fluido Pro.R reconstrói fios fragilizados e o óleo Ambar finaliza selando a cutícula e dando brilho.
- PH-007 + PH-015 · O modo de uso do pó descolorante pede a mistura com Água Oxigenada Prohall; a OX 30 volumes é essa loção.
- PH-009 + PH-010 · Mesma linha Bruma Ametista: a ficha do shampoo indica usar o condicionador da linha em seguida.
- PH-011 + PH-012 · Mesma linha Aura Radiante: a ficha do shampoo indica usar o condicionador da linha em seguida.

## Limitações conhecidas

A preencher na T-34.

## Decisões

**Como organizei o trabalho**

- **Documentos antes do código.** Separei o contexto em três arquivos: `docs/especificacao.md` (o enunciado, sem alterações, vale em caso de conflito), `docs/requisitos.md` (escopo, arquitetura e stack) e `docs/tarefas.md` (backlog). O `CLAUDE.md` resume as regras inegociáveis para o assistente de IA que usei no desenvolvimento.
- **35 tarefas em 10 fases**, na ordem de prioridade e dependência: setup, teste do Gemini, domínio, catálogo, ferramentas, agente, checkout e PIX, interface, avaliação e entrega. Cada tarefa tem objetivo, critério de aceite, dependências e mensagem de commit sugerida. Prevejo uma branch por fase; na prática consolidei em `feature/setup-webchat` e `feature/desenvolvimento-webchat`.
- **Prioridade pelo núcleo, interface por último.** O Gemini foi testado (chamada simples e function calling) antes de construir qualquer coisa em cima dele. A interface fica no fim porque o foco do teste é a IA aplicada a vendas.
- **Cálculo antes da IA.** Dinheiro, CEP, frete, cupom, carrinho e totais são funções puras com testes (o exemplo 6.2, R$ 279,40, é um deles) e ficaram prontos antes do prompt e das ferramentas. A IA só chama ferramentas e comunica o resultado.
- **Uma tarefa por vez, um commit por tarefa.** Uso a skill `/tarefa T-XX`: confere dependências, propõe o plano, implementa com testes, marca `[x]` no índice e entrega o resumo. O commit só sai depois da minha revisão, e o hash volta para o índice.
- **A CLI veio antes da interface.** O `pnpm chat` (T-24) me permitiu conversar com a Sofia e ver cada ferramenta chamada sem esperar o front, e serve para rodar roteiros de teste.
- **Validação contra a API real.** Além dos testes com modelo roteirizado, conferi o function calling, o streaming e uma conversa completa com o Gemini de verdade.

**Decisões de stack**

- **Node + TypeScript + Fastify** no back: SDK do Gemini de primeira linha em TS, tipos compartilhados com o front e validação por schema embutida no Fastify. Considerei Express (tipagem fraca), Hono (comunidade menor) e Python + FastAPI (duas linguagens, sem compartilhar tipos).
- **Svelte + Vite** no front, fora das sugestões do enunciado (HTML/JS ou React): a interface é pequena e Svelte resolve o estado do chat, do carrinho e do PIX com pouco código. Descartei SvelteKit fullstack (mistura a lógica de IA com o framework), Next.js (mais pesado que o escopo) e HTML puro (estado à mão).
- **Monorepo com pnpm workspaces** e um pacote `@sofia/shared`: um clone, um README, tipos e schemas usados pelos dois lados, mudanças atômicas.
- **zod** como fonte única: o mesmo schema valida os argumentos de cada ferramenta e gera o JSON Schema do function calling.
- **Loop de function calling escrito à mão** com o SDK oficial `@google/genai`, sem Vercel AI SDK: a abstração esconderia justamente o loop que o teste quer ver.
- **Vitest** para as regras de frete, cupom e totais, que rodam como funções puras, sem Fastify nem Svelte.
- **Dinheiro em centavos inteiros**, formatado só na saída: o `number` do JS é ponto flutuante e o exemplo 6.2 precisa dar exatamente R$ 279,40.

**Escolhas de configuração e de processo**

- **Ambiguidade: decidir, seguir e registrar.** As decisões pontuais de cada tarefa ficam no histórico de commits, e aqui só entram as que mudam a forma de trabalhar.
- **Sem padrões escondidos.** `GEMINI_API_KEY` e `GEMINI_MODEL` são obrigatórios no `.env` e lidos num único lugar (`server/src/config.ts`); sem eles tudo para com uma mensagem clara.
- **Poucas dependências.** `.env` carregado pelo Node (sem `dotenv`), `pnpm -r --parallel` em vez de `concurrently`, formatação de reais feita à mão.
