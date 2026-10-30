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
| `GEMINI_MODEL` | Modelo usado pela Sofia | `gemini-3.8-flash` |
| `PORT` | Porta do servidor | `3000` |

```bash
pnpm dev    # sobe server e web juntos
pnpm test   # roda os testes (Vitest)
pnpm gemini:teste   # chamada simples ao Gemini (modo mock sem chave)
pnpm gemini:ferramentas   # spike de function calling (exige chave real)
```

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

Data em que os preços foram copiados de lojaprohall.com.br: a preencher na T-15.

## Combinações (`combina_com`)

Uma linha de justificativa por par de produtos: a preencher na T-16.

## Limitações conhecidas

A preencher na T-34.

## Decisões

- T-01 · Pacotes do workspace com escopo `@sofia/*` (`@sofia/server`, `@sofia/web`, `@sofia/shared`) — nome curto e import direto do `@sofia/shared` pelos dois lados.
- T-02 · `pnpm dev` usa `pnpm -r --parallel dev`, sem `concurrently` — uma dependência a menos para o mesmo resultado.
- T-02 · `web/` sobe só o Vite com um `index.html` vazio; plugin Svelte e tsconfig próprio entram na T-28 — a T-02 só precisa provar que o `dev` sobe os dois.
- T-02 · `server/src/index.ts` é um stub sem Fastify (porta de `PORT`, padrão 3000) — o Fastify entra com as rotas, nas tarefas do agente.
- T-02 · `server/tsconfig.json` declara `types: ["node"]` — o TypeScript 7 não carrega `@types/*` automaticamente.
- T-04 · `pnpm gemini:teste` roda em modo mock quando `GEMINI_API_KEY` está ausente ou vale `mock`, sem chamar a API — a chave ainda não foi enviada. Confirmado com a chave real: `gemini-3.8-flash` responde normalmente.
- T-04 · O `.env` é carregado com `--env-file-if-exists` do Node, sem `dotenv` — uma dependência a menos.
- T-05 · Formato de ferramentas validado com `gemini-3.8-flash`: declarações em `config.tools[].functionDeclarations` (parâmetros via `parametersJsonSchema`); a chamada vem em `response.functionCalls[0]` (`name` e `args`); o turno do modelo (`candidates[0].content`) vai ao histórico como veio; o resultado volta em `role: "user"` com `parts: [{ functionResponse: { name, response } }]` — confirmado por execução real em `pnpm gemini:ferramentas`.
- T-05 · O spike faz uma única rodada de ferramenta, com a função fictícia `consultar_clima` — o loop com limite de iterações e a conversão de zod para declaração ficam para T-19 e T-21.
- T-06 · Meio centavo arredonda para cima (arredondamento comercial) e o percentual é calculado em inteiros (pontos-base) — evita erro de ponto flutuante nas etapas de cupom e desconto PIX.
- T-06 · `formatarBRL` monta a string à mão, sem `Intl` — o `Intl` insere espaço não separável após "R$", e a saída precisa ser exatamente `R$ 279,40`.
- T-06 · Valores negativos ou não inteiros em centavos lançam `RangeError` — dinheiro inválido deve falhar alto, e as ferramentas convertem o erro em mensagem amigável.
- T-07 · CEP fora de todas as faixas (inclui 00000-000 a 00999-999) devolve erro amigável, sem exceção — o resultado é `{ ok, zona | erro }` para as ferramentas repassarem a mensagem à cliente.
