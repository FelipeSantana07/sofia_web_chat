---
name: tarefa
description: Executa uma tarefa do backlog em docs/tarefas.md seguindo o ciclo do projeto (dependências, plano, testes, status, decisões, commit sugerido). Use quando o usuário pedir para implementar, fazer ou continuar uma tarefa T-XX, por exemplo "/tarefa T-07".
---

# Executar uma tarefa do backlog

O argumento é o ID da tarefa (ex.: `T-07`). Se não vier ID, pergunte qual tarefa fazer e sugira a primeira não concluída do índice de `docs/tarefas.md` cujas dependências estejam todas concluídas.

## 1. Entender a tarefa

1. Leia a seção da tarefa em `docs/tarefas.md`: objetivo, critério de aceite, dependências, branch e commit sugerido.
2. Leia as regras relacionadas em `docs/especificacao.md` (frete, cupom, totais, comportamento da Sofia, checkout/PIX, interface) e, se for preciso, a arquitetura em `docs/requisitos.md`.
3. Leia o código já existente que a tarefa vai tocar.

## 2. Checar pré-condições

- Todas as tarefas em **Depende de** precisam estar marcadas `[x]` no índice. Se alguma não estiver, **pare**: diga quais faltam e não implemente.
- Confira a branch atual (`git branch --show-current`). Se não for a branch da fase, avise e sugira `git checkout -b <branch>` (ou a troca para ela). Não troque de branch sem confirmação.
- Se a árvore de trabalho tiver alterações não commitadas de outra tarefa, avise antes de continuar.

## 3. Mostrar o plano e esperar aprovação

Apresente um plano curto, **sem escrever código ainda**:

- arquivos que vai criar ou alterar;
- testes que vai escrever (liste os casos, citando os exemplos da especificação quando houver);
- decisões ou ambiguidades encontradas, cada uma com a opção que você recomenda.

Espere o usuário aprovar ou ajustar o plano.

## 4. Implementar

- **Só esta tarefa.** Nada de adiantar trabalho de outras tarefas, mesmo que pareça óbvio.
- **Domínio (`server/src/domain/`):** testes primeiro (TDD), funções puras, dinheiro em centavos inteiros, sem depender de Fastify ou Svelte.
- **Ferramentas:** argumentos validados com zod, chamam só o domínio, erros amigáveis em JSON.
- **IA:** nenhum cálculo de valor pela IA; prompt só em `prompts/sofia.md`; modelo lido de `GEMINI_MODEL`.
- Nunca escreva a chave do Gemini nem dados reais de clientes em código, testes, logs ou fixtures.

## 5. Verificar

1. Rode `pnpm test` (e `pnpm typecheck` ou `pnpm build`, se existirem). Corrija até passar.
2. Confira item por item o **critério de aceite** da tarefa. Se algum não puder ser cumprido, diga qual e por quê, sem marcar a tarefa como concluída.

## 6. Fechar a tarefa

1. Marque a tarefa como `[x]` no índice de `docs/tarefas.md`.
2. Se a tarefa trouxe uma decisão sobre a forma de trabalhar (processo, organização, configuração), ajuste a seção **"Decisões"** do `README.md`, que é curta. Decisões de implementação ou regras do enunciado não entram lá: descreva-as no resumo ao usuário e no commit.
3. Se a tarefa anterior tem o hash do commit vazio no índice e o usuário informou o hash, preencha-o.

## 7. Entregar ao usuário

Termine com:

- um resumo curto do que mudou (arquivos e testes);
- o resultado dos testes;
- as decisões registradas, se houver;
- o comando de commit pronto, com a mensagem sugerida na tarefa:

```bash
git add -A
git commit -m "<commit sugerido>"
```

**Não faça o commit.** O usuário revisa o diff e commita. Não comece a próxima tarefa sem pedido.
