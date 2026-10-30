# sofia_web_chat
Teste Prohall - Web chat de vendas

## Decisões

- T-01 · Pacotes do workspace com escopo `@sofia/*` (`@sofia/server`, `@sofia/web`, `@sofia/shared`) — nome curto e import direto do `@sofia/shared` pelos dois lados.
- T-02 · `pnpm dev` usa `pnpm -r --parallel dev`, sem `concurrently` — uma dependência a menos para o mesmo resultado.
- T-02 · `web/` sobe só o Vite com um `index.html` vazio; plugin Svelte e tsconfig próprio entram na T-28 — a T-02 só precisa provar que o `dev` sobe os dois.
- T-02 · `server/src/index.ts` é um stub sem Fastify (porta de `PORT`, padrão 3000) — o Fastify entra com as rotas, nas tarefas do agente.
- T-02 · `server/tsconfig.json` declara `types: ["node"]` — o TypeScript 7 não carrega `@types/*` automaticamente.
