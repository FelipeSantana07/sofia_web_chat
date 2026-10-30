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
