# Sofia Web Chat — vendedora IA Prohall

Vendedora virtual em chat web (estilo Sofia) para um teste técnico da Prohall: conhece 15 produtos, recomenda pelo perfil da cliente, calcula frete por tabela fixa, monta carrinho e fecha com checkout e PIX falsos. O foco do projeto é IA aplicada a vendas (prompt, function calling, dados e limites); a interface é simples e funcional.

## Leia antes de implementar

- `docs/requisitos.md` — escopo, perfil da cliente, IA (prompt, ferramentas, guardrails), stack, arquitetura, regras gerais e entrega
- `docs/especificacao.md` — regras exatas: catálogo, frete, cupom/totais, comportamento da Sofia, checkout/PIX e interface
- As tarefas estão em `docs/tarefas.md`. Implemente só a tarefa pedida, verifique as dependências, marque-a como concluída ao terminar e não avance para a próxima sem pedido.

Em caso de conflito, `docs/especificacao.md` vale (é o enunciado do teste).

## Tarefas e skills

- O backlog e o status ficam em `docs/tarefas.md`. Implemente só a tarefa pedida e não avance sem pedido.
- Para implementar uma tarefa, use a skill `/tarefa T-XX` (`.claude/skills/tarefa/`).
- Para cadastrar produtos no catálogo, use a skill `/cadastrar-produto <url>` (`.claude/skills/cadastrar-produto/`).
- Nunca faça commit sem o usuário pedir: entregue a mensagem sugerida e deixe o commit com ele.

## Stack

Monorepo pnpm · Node + TypeScript + Fastify (`server/`) · Svelte + Vite (`web/`) · zod · Vitest · tipos compartilhados em `packages/shared/` · catálogo em `data/produtos.json` · prompt em `prompts/sofia.md`.

**IA:** somente Gemini `gemini-3.8-flash` via SDK oficial `@google/genai`. Nenhum outro modelo nem outro fornecedor na Sofia. O nome do modelo vem de `GEMINI_MODEL` (padrão `gemini-3.8-flash`) e a chave de `GEMINI_API_KEY`, ambos no `.env`.

## Regras inegociáveis

- Frete, totais, cupom, estoque e PIX são calculados **sempre no código**, nunca pela IA. A IA só chama ferramentas e comunica os resultados.
- Dinheiro sempre em **centavos (inteiros)**; formatar só na saída.
- Regras de frete, cupom, carrinho e totais em `server/src/domain/`, como funções puras com testes Vitest.
- O exemplo 6.2 da especificação precisa dar exatamente **R$ 279,40**.
- A IA nunca inventa preço, frete, prazo ou informação de produto: tudo vem das ferramentas e da ficha.
- Ferramentas validam argumentos com zod e devolvem erros amigáveis (ex.: CEP inválido, estoque insuficiente). Nomes das ferramentas: ver tabela em `docs/requisitos.md` (o fechamento é `finalizar_pedido`).
- Prompt de sistema fica em `prompts/sofia.md`, nunca embutido no código.
- PIX é obviamente falso: nada de BR Code/EMV nem chave PIX real.
- Nenhum segredo no repositório, nos logs ou no vídeo: a chave só no `.env` (o `.env.example` traz as variáveis sem valor).

## Registro de decisões

Quando algo estiver ambíguo, decida, siga em frente e **registre a decisão na seção "Decisões" do README** (uma linha: o que foi decidido e por quê). O registro faz parte da entrega.

## Entrega

Repositório Git + README (como rodar, data dos preços, justificativa de cada `combina_com`, justificativa da stack, decisões) + vídeo curto de demonstração.

## Comandos

- `pnpm install` — instala tudo
- `pnpm dev` — sobe server e web juntos
- `pnpm test` — roda os testes