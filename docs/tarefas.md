# Tarefas — Sofia Web Chat 

Backlog de desenvolvimento em ordem. Fonte da verdade para o que fazer e para o status de cada tarefa.

## Como usar

- Uma tarefa por vez, com a skill **`/tarefa T-XX`** (ex.: `/tarefa T-07`). Ela confere as dependências, mostra o plano, implementa com testes, marca `[x]`, registra decisões e sugere o commit.
- A tarefa termina quando o **critério de aceite** é cumprido e `pnpm test` passa.
- Para a T-15, use **`/cadastrar-produto <url>`** para cada produto.
- Depois do commit, preencha o hash no índice (`commit: a1b2c3d`); essa alteração entra no commit seguinte.
- Regras de negócio: `docs/especificacao.md`. Contexto e arquitetura: `docs/requisitos.md`.

## Índice e status

**Fase 0 · Setup** · branch `chore/setup`

- [x] T-01 · Estrutura do monorepo — commit: 8029c4e
- [x] T-02 · TypeScript, Vitest e scripts — commit: cdb6af2
- [x] T-03 · Contexto, README e ambiente — commit: 3298e88

**Fase 1 · Teste do Gemini** · branch `spike/gemini`

- [x] T-04 · Teste simples do Gemini — commit: c7768f1
- [x] T-05 · Teste de function calling — commit: 5fdadd6

**Fase 2 · Domínio** · branch `feat/dominio`

- [x] T-06 · Dinheiro em centavos — commit: e9b0d88
- [x] T-07 · CEP e zona — commit: 3374a3f
- [x] T-08 · Peso cobrado e faixa — commit: c62d230
- [x] T-09 · Frete Econômica e Expressa — commit: 8e2605d
- [x] T-10 · Frete grátis — commit: f22302c
- [x] T-11 · Cupom PROHALL10 — commit: a65b04f
- [x] T-12 · Carrinho e estoque — commit: 7445706
- [x] T-13 · Totais e desconto PIX — commit: 6b3fe7b

**Fase 3 · Catálogo** · branch `feat/catalogo`

- [x] T-14 · Schema do produto — commit: 8b5c532
- [x] T-15 · Cadastro dos 15 produtos — commit: e218926
- [x] T-16 · Combinações e data dos preços — commit: 4f0dd4c

**Fase 4 · Ferramentas** · branch `feat/ferramentas`

- [x] T-17 · Estado da sessão — commit: f8a4d69
- [x] T-18 · Ferramentas de catálogo e perfil — commit: 8e0db42
- [x] T-19 · Ferramentas de carrinho, cupom e frete — commit: 1add308
- [x] T-20 · Registro e despacho das ferramentas — commit: e5a081b

**Fase 5 · Agente** · branch `feat/agente`

- [x] T-21 · Prompt da Sofia — commit: 36edf0e
- [x] T-22 · Loop de function calling — commit: 9bd3aa4
- [x] T-23 · Rota /chat com streaming — commit: e190e1e
- [x] T-24 · CLI de conversa — commit: 3a70d2d

**Fase 6 · Checkout e PIX** · branch `feat/checkout-pix`

- [x] T-25 · Pedido pela conversa e pelo formulário — commit: 2fe152b
- [x] T-26 · PIX falso — commit: 2fe152b
- [x] T-27 · Simular pagamento — commit: 2fe152b

**Fase 7 · Interface** · branch `feat/web`

- [x] T-28 · Chat com streaming — commit: aacb687
- [x] T-29 · Cards de produto e carrinho — commit: eb2bc83
- [x] T-30 · Checkout e tela do PIX — commit: 5c34547
- [x] T-31 · Painel de debug — commit: 18bc434

**Fase 8 · Avaliação** · branch `test/conversas`

- [x] T-32 · Conversas-teste — commit: 0f4faf0
- [x] T-33 · Ajustes do prompt — commit: 90bf812

**Fase 9 · Entrega** · branch `docs/entrega`

- [x] T-34 · README final — commit: 74bb35f
- [x] T-35 · Vídeo de demonstração — commit: —

## Fases

| Fase | Branch | O que entra | Por que nessa ordem |
| --- | --- | --- | --- |
| 0 · Setup | `chore/setup` | Monorepo pnpm, TypeScript, Vitest, .env, README com a seção "Decisões" | Base para todo o resto |
| 1 · Teste do Gemini | `spike/gemini` | Script simples com @google/genai: uma chamada normal e uma com function calling | Maior risco técnico; confirme o modelo antes de construir em cima dele |
| 2 · Domínio | `feat/dominio` | Dinheiro em centavos → CEP/zona → peso/faixa → frete → cupom → carrinho/estoque → totais (exemplo 6.2 como teste) | Não depende de IA nem de interface; garante os cálculos certos |
| 3 · Catálogo | `feat/catalogo` | produtos.json com os 15 produtos + schema zod que valida o arquivo | Trabalho mais manual; pode correr em paralelo à fase 2 |
| 4 · Ferramentas | `feat/ferramentas` | As ferramentas com zod e o estado da sessão (perfil, carrinho, pedido) | Junta domínio e catálogo |
| 5 · Agente | `feat/agente` | prompts/sofia.md, loop de function calling, logs, rota /chat com streaming | Núcleo do projeto; já com dados e cálculos confiáveis |
| 6 · Checkout e PIX | `feat/checkout-pix` | finalizar_pedido, PIX falso, QR Code, expiração em 15 min, "Simular pagamento", consultar_pedido | Depende do pedido e dos totais |
| 7 · Interface | `feat/web` | Chat, cards de produto, carrinho, checkout, PIX, painel de debug | Por último: prioridade menor no escopo do teste |
| 8 · Avaliação | `test/conversas` | Conversas-teste (limites, injection, CEP inválido) e ajuste do prompt | Refino com tudo funcionando |
| 9 · Entrega | `docs/entrega` | README final e vídeo | Fechamento |

A fase 3 pode correr em paralelo à fase 2. A T-24 (CLI) permite conversar com a Sofia antes de existir interface.

## Detalhe das tarefas

### Fase 0 · Setup

#### T-01 · Estrutura do monorepo

- **Objetivo:** Criar o esqueleto do monorepo com pnpm workspaces.
- **Critério de aceite:** pnpm-workspace.yaml e package.json raiz; pastas server/, web/, packages/shared/, data/, prompts/, docs/; `pnpm install` roda sem erro.
- **Depende de:** —
- **Branch:** `chore/setup`
- **Commit sugerido:** `chore: estrutura do monorepo com pnpm workspaces`

#### T-02 · TypeScript, Vitest e scripts

- **Objetivo:** Configurar TS estrito, Vitest e os scripts raiz.
- **Critério de aceite:** tsconfig base compartilhado; `pnpm test` roda um teste de exemplo; `pnpm dev` sobe server e web juntos.
- **Depende de:** T-01
- **Branch:** `chore/setup`
- **Commit sugerido:** `chore: configura TypeScript, Vitest e scripts`

#### T-03 · Contexto, README e ambiente

- **Objetivo:** Versionar o contexto do projeto e o ambiente.
- **Critério de aceite:** CLAUDE.md, docs/requisitos.md, docs/especificacao.md, .gitignore e .env.example no repo; README com esqueleto e seção "Decisões".
- **Depende de:** T-01
- **Branch:** `chore/setup`
- **Commit sugerido:** `docs: contexto do projeto, README e .env.example`

### Fase 1 · Teste do Gemini

#### T-04 · Teste simples do Gemini

- **Objetivo:** Confirmar chave e modelo com @google/genai.
- **Critério de aceite:** Script em server/scripts lê GEMINI_API_KEY e GEMINI_MODEL do .env (ambos obrigatórios) e recebe uma resposta.
- **Depende de:** T-02, T-03
- **Branch:** `spike/gemini`
- **Commit sugerido:** `chore(agent): script de teste do Gemini`

#### T-05 · Teste de function calling

- **Objetivo:** Validar o formato de ferramentas do modelo.
- **Critério de aceite:** Com uma ferramenta fictícia, o modelo chama a função, recebe o resultado e responde; formato registrado em "Decisões".
- **Depende de:** T-04
- **Branch:** `spike/gemini`
- **Commit sugerido:** `chore(agent): valida function calling do gemini-3.8-flash`

### Fase 2 · Domínio

#### T-06 · Dinheiro em centavos

- **Objetivo:** Utilitários de dinheiro sem ponto flutuante.
- **Critério de aceite:** Conversão reais↔centavos, arredondamento comercial e formatação BRL, com testes.
- **Depende de:** T-02
- **Branch:** `feat/dominio`
- **Commit sugerido:** `feat(domain): utilitários de dinheiro em centavos`

#### T-07 · CEP e zona

- **Objetivo:** Validar CEP e identificar a zona (5.1).
- **Critério de aceite:** Aceita com ou sem hífen; rejeita ≠ 8 dígitos e fora das faixas (00000-000); testes nos limites (19999-999/20000-000, 76799-999/76800-000).
- **Depende de:** T-02
- **Branch:** `feat/dominio`
- **Commit sugerido:** `feat(domain): valida CEP e identifica zona de frete`

#### T-08 · Peso cobrado e faixa

- **Objetivo:** Calcular peso cobrado e faixa (5.2).
- **Critério de aceite:** Soma peso × quantidade + 200 g; faixas inclusivas (1.000 g = F2); excedente acima de 5 kg arredondado para cima (5,3 kg → 1; 6,3 kg → 2).
- **Depende de:** T-02
- **Branch:** `feat/dominio`
- **Commit sugerido:** `feat(domain): calcula peso cobrado e faixa`

#### T-09 · Frete Econômica e Expressa

- **Objetivo:** Aplicar as tabelas 5.3 e 5.4.
- **Critério de aceite:** Retorna valor e prazo das duas modalidades para qualquer zona e faixa, incluindo o adicional por kg; testes por zona.
- **Depende de:** T-06, T-07, T-08
- **Branch:** `feat/dominio`
- **Commit sugerido:** `feat(domain): calcula frete por zona, faixa e modalidade`

#### T-10 · Frete grátis

- **Objetivo:** Aplicar a regra 5.5.
- **Critério de aceite:** Só na Econômica; base após cupom; Z1/Z2 ≥ R$ 299,00 e Z3–Z5 ≥ R$ 399,00; devolve quanto falta quando não atinge.
- **Depende de:** T-09
- **Branch:** `feat/dominio`
- **Commit sugerido:** `feat(domain): frete grátis e valor faltante`

#### T-11 · Cupom PROHALL10

- **Objetivo:** Validar e aplicar o único cupom.
- **Critério de aceite:** 10% sobre o subtotal com mínimo de R$ 150,00; um por pedido; qualquer outro código inválido; perde validade se o subtotal cair abaixo do mínimo.
- **Depende de:** T-06
- **Branch:** `feat/dominio`
- **Commit sugerido:** `feat(domain): cupom PROHALL10`

#### T-12 · Carrinho e estoque

- **Objetivo:** Regras do carrinho (6.3).
- **Critério de aceite:** Adicionar, remover e alterar quantidade; preço vigente = promocional se existir; bloqueia acima do estoque_teste e de 10 unidades por item.
- **Depende de:** T-06
- **Branch:** `feat/dominio`
- **Commit sugerido:** `feat(domain): carrinho com regras de estoque e limite`

#### T-13 · Totais e desconto PIX

- **Objetivo:** Ordem do cálculo 6.1.
- **Critério de aceite:** Subtotal → cupom → base → frete → desconto PIX 5% → total, arredondando a cada etapa; teste do exemplo 6.2 dá exatamente R$ 279,40.
- **Depende de:** T-10, T-11, T-12
- **Branch:** `feat/dominio`
- **Commit sugerido:** `feat(domain): totais com desconto PIX (exemplo 6.2)`

### Fase 3 · Catálogo

#### T-14 · Schema do produto

- **Objetivo:** Schema zod do formato 4.1.
- **Critério de aceite:** Schema em packages/shared; script `pnpm validate:catalogo` valida data/produtos.json e aponta erros.
- **Depende de:** T-02
- **Branch:** `feat/catalogo`
- **Commit sugerido:** `feat(shared): schema zod do produto`

#### T-15 · Cadastro dos 15 produtos

- **Objetivo:** Popular data/produtos.json com dados reais.
- **Critério de aceite:** 15 produtos; ≥ 4 categorias, ≥ 1 kit, ≥ 3 pares em combina_com, profissional e home care; ≥ 1 com estoque ≤ 3; pesos estimados marcados; ausências = null; validação passa.
- **Depende de:** T-14
- **Branch:** `feat/catalogo`
- **Commit sugerido:** `feat(data): cadastra 15 produtos Prohall`

#### T-16 · Combinações e data dos preços

- **Objetivo:** Documentar as escolhas do catálogo.
- **Critério de aceite:** README com a data em que os preços foram copiados e uma linha de justificativa por combinação.
- **Depende de:** T-15
- **Branch:** `feat/catalogo`
- **Commit sugerido:** `docs(readme): combinações e data dos preços`

### Fase 4 · Ferramentas

#### T-17 · Estado da sessão

- **Objetivo:** Guardar perfil, carrinho e pedido por sessão.
- **Critério de aceite:** Store em memória por id de sessão, com tipos em packages/shared e testes.
- **Depende de:** T-12
- **Branch:** `feat/ferramentas`
- **Commit sugerido:** `feat(server): estado da sessão`

#### T-18 · Ferramentas de catálogo e perfil

- **Objetivo:** buscar_produtos, detalhar_produto, produtos_complementares, atualizar_perfil.
- **Critério de aceite:** Argumentos validados com zod; buscar_produtos filtra por termo, categoria e uso e devolve lista resumida (id, nome, preço, uma linha de descrição); campos null retornam sinal explícito de "sem informação"; testes.
- **Depende de:** T-15, T-17
- **Branch:** `feat/ferramentas`
- **Commit sugerido:** `feat(tools): ferramentas de catálogo e perfil`

#### T-19 · Ferramentas de carrinho, cupom e frete

- **Objetivo:** adicionar/remover_do_carrinho, aplicar_cupom, ver_carrinho, calcular_frete.
- **Critério de aceite:** Chamam só o domínio; erros amigáveis (CEP inválido, estoque insuficiente, cupom inválido); adicionar e remover devolvem o carrinho atualizado, e remover aceita quantidade parcial; ver_carrinho inclui base e peso cobrado; calcular_frete recebe só o CEP, usa o carrinho da sessão e devolve zona, as duas modalidades com prazos e quanto falta para o grátis.
- **Depende de:** T-13, T-17
- **Branch:** `feat/ferramentas`
- **Commit sugerido:** `feat(tools): ferramentas de carrinho, cupom e frete`

#### T-20 · Registro e despacho das ferramentas

- **Objetivo:** Ligar as ferramentas ao formato do Gemini.
- **Critério de aceite:** Cada schema zod vira a declaração de função do Gemini; dispatcher executa pelo nome; erro de validação volta à IA como resposta da função, sem exceção; testes do despacho.
- **Depende de:** T-05, T-18, T-19
- **Branch:** `feat/ferramentas`
- **Commit sugerido:** `feat(tools): registro e despacho das ferramentas`

### Fase 5 · Agente

#### T-21 · Prompt da Sofia

- **Objetivo:** Escrever prompts/sofia.md.
- **Critério de aceite:** Blocos de persona, fluxo de venda, gatilhos permitidos, limites e regras de uso das ferramentas, conforme a Parte 5; resumo do catálogo sem preço e sem estoque gerado do produtos.json e injetado no prompt; escolha explicada no README.
- **Depende de:** T-20
- **Branch:** `feat/agente`
- **Commit sugerido:** `feat(agent): prompt de sistema da Sofia`

#### T-22 · Loop de function calling

- **Objetivo:** Loop manual do agente com logs.
- **Critério de aceite:** Envia histórico + ferramentas, executa chamadas até a resposta final, limite de iterações, log de cada chamada (argumentos e resultado).
- **Depende de:** T-20, T-21
- **Branch:** `feat/agente`
- **Commit sugerido:** `feat(agent): loop de function calling com logs`

#### T-23 · Rota /chat com streaming

- **Objetivo:** Expor o agente via SSE.
- **Critério de aceite:** POST /api/chat transmite a resposta e emite eventos das ferramentas chamadas (para o painel de debug).
- **Depende de:** T-22
- **Branch:** `feat/agente`
- **Commit sugerido:** `feat(server): rota /chat com streaming`

#### T-24 · CLI de conversa

- **Objetivo:** Conversar com a Sofia no terminal.
- **Critério de aceite:** `pnpm chat` abre uma conversa completa no terminal, mostrando as ferramentas chamadas.
- **Depende de:** T-22
- **Branch:** `feat/agente`
- **Commit sugerido:** `chore(agent): CLI para conversar com a Sofia`

### Fase 6 · Checkout e PIX

#### T-25 · Pedido pela conversa e pelo formulário

- **Objetivo:** finalizar_pedido e rota do checkout.
- **Critério de aceite:** finalizar_pedido(nome, email, cep, endereco, numero, complemento?, modalidade_frete) cria o pedido com status aguardando_pagamento e devolve resumo e totais; os dois caminhos geram o mesmo pedido (ex.: PH-TESTE-000123) com itens, cupom, frete, desconto PIX e total.
- **Depende de:** T-19, T-23
- **Branch:** `feat/checkout-pix`
- **Commit sugerido:** `feat(checkout): pedido pela conversa e pelo formulário`

#### T-26 · PIX falso

- **Objetivo:** gerar_pix(pedido_id) com QR Code e copia e cola.
- **Critério de aceite:** Texto tipo PIX-TESTE|PROHALL|<pedido>|<valor>|NAO-PAGAVEL; nunca BR Code/EMV; validade de 15 min; status expirado e possibilidade de gerar outro.
- **Depende de:** T-25
- **Branch:** `feat/checkout-pix`
- **Commit sugerido:** `feat(pix): PIX falso com QR Code e expiração`

#### T-27 · Simular pagamento

- **Objetivo:** Fechar o ciclo do pedido, com consultar_pedido.
- **Critério de aceite:** Rota muda o status para pago e a Sofia envia a confirmação no chat; consultar_pedido(pedido_id) devolve o status do pedido e do PIX.
- **Depende de:** T-26
- **Branch:** `feat/checkout-pix`
- **Commit sugerido:** `feat(pix): simulação de pagamento`

### Fase 7 · Interface

#### T-28 · Chat com streaming

- **Objetivo:** Tela de chat responsiva.
- **Critério de aceite:** Funciona bem no celular; mensagens em streaming; indicador "digitando…".
- **Depende de:** T-23
- **Branch:** `feat/web`
- **Commit sugerido:** `feat(web): chat com streaming`

#### T-29 · Cards de produto e carrinho

- **Objetivo:** Mostrar produtos e carrinho na interface.
- **Critério de aceite:** Cards no chat (imagem, nome, preço, Adicionar); carrinho lateral ou ícone com contador, sincronizado com o servidor.
- **Depende de:** T-28
- **Branch:** `feat/web`
- **Commit sugerido:** `feat(web): cards de produto e carrinho`

#### T-30 · Checkout e tela do PIX

- **Objetivo:** Telas de checkout e PIX.
- **Critério de aceite:** Faixa "AMBIENTE DE TESTE"; resumo e formulário com aviso de dados fictícios; QR, copia e cola com botão Copiar, contador e Simular pagamento.
- **Depende de:** T-27, T-29
- **Branch:** `feat/web`
- **Commit sugerido:** `feat(web): checkout e tela do PIX`

#### T-31 · Painel de debug

- **Objetivo:** Painel opcional de diagnóstico.
- **Critério de aceite:** Painel escondível listando ferramentas chamadas, argumentos e resultados por mensagem.
- **Depende de:** T-28
- **Branch:** `feat/web`
- **Commit sugerido:** `feat(web): painel de debug das ferramentas`

### Fase 8 · Avaliação

#### T-32 · Conversas-teste

- **Objetivo:** Roteiros que exercitam limites e fluxo.
- **Critério de aceite:** 10 a 20 roteiros: cliente indecisa, fora do catálogo, pedido de 50%, CEP inválido, injection, cartão/boleto, saúde, estoque baixo, profissional em casa.
- **Depende de:** T-24
- **Branch:** `test/conversas`
- **Commit sugerido:** `test(agent): roteiros de conversas-teste`

#### T-33 · Ajustes do prompt

- **Objetivo:** Corrigir o que os roteiros revelarem.
- **Critério de aceite:** Todos os roteiros com comportamento esperado; mudanças relevantes registradas em "Decisões".
- **Depende de:** T-32
- **Branch:** `test/conversas`
- **Commit sugerido:** `fix(agent): ajustes de prompt a partir dos testes`

### Fase 9 · Entrega

#### T-34 · README final

- **Objetivo:** Documentação de entrega.
- **Critério de aceite:** Como rodar, justificativa da stack (Svelte), data dos preços, combinações, decisões e limitações conhecidas.
- **Depende de:** T-33
- **Branch:** `docs/entrega`
- **Commit sugerido:** `docs(readme): versão final`

#### T-35 · Vídeo de demonstração

- **Objetivo:** Gravar a demo.
- **Critério de aceite:** Conversa completa (descoberta → PIX pago) + 1 caso de limite + painel de debug; nenhuma chave visível; link no README. Também: 3 conversas exportadas em texto com perfis de cliente diferentes (`docs/conversas/`) .
- **Depende de:** T-34
- **Branch:** `docs/entrega`
- **Commit sugerido:** `docs: link do vídeo de demonstração`