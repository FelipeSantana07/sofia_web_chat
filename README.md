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
pnpm validate:catalogo   # valida data/produtos.json contra o schema
```

O servidor sobe em `http://127.0.0.1:3000` (porta de `PORT`):

- `POST /api/chat` com `{ "mensagem": "...", "sessaoId": "opcional" }` responde em Server-Sent Events: `sessao` (id da conversa, reenviado nas mensagens seguintes), `texto` (pedaços da resposta), `ferramenta` (nome, argumentos e resultado de cada chamada), `fim` (texto completo) e `erro`.
- `GET /api/saude` responde `{ "ok": true }`.
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

Cada par aparece nos dois sentidos em `data/produtos.json` (14 pares). A justificativa vem da ficha dos produtos:

- PH-001 + PH-002 · O tônico Force Hair cuida do couro cabeludo (queda, fios fracos) e o kit Encorpax repõe massa no comprimento de fios finos e ralos: raiz e fio no mesmo problema.
- PH-001 + PH-012 · O shampoo Aura Radiante limpa e dá corpo a fios finos, e o tônico Force Hair entra depois, como leave-in no couro cabeludo, contra queda e quebra.
- PH-002 + PH-012 · Os dois são para fios finos e sem corpo: o Encorpax é o cronograma em 4 etapas e o shampoo Aura Radiante serve para as lavagens do dia a dia.
- PH-003 + PH-005 · Rotina de segundo dia sem lavar: o ativador Day After reativa a definição dos cachos entre as lavagens e o Doce Mistério renova o perfume entre as lavagens.
- PH-004 + PH-013 · Mesma linha Secar Sem Frizz: o sérum sela as cutículas antes de secar e o óleo de blindagem é a última etapa do protocolo, contra a umidade.
- PH-004 + PH-014 · Mesma linha Secar Sem Frizz: a máscara hidrata e alinha na lavagem e o óleo de blindagem finaliza, protegendo contra a umidade.
- PH-013 + PH-014 · Mesma linha Secar Sem Frizz: a máscara trata os fios porosos na lavagem e o sérum sela as cutículas para secar sem frizz.
- PH-006 + PH-008 · O fluido Pro.R reconstrói fios fragilizados e o óleo Ambar finaliza selando a cutícula e dando brilho.
- PH-007 + PH-015 · O modo de uso do pó descolorante pede a mistura com Água Oxigenada Prohall; a OX 30 volumes é essa loção.
- PH-007 + PH-008 · A descoloração fragiliza o fio, e o Pro.R é indicado para danos severos por química e fios elásticos.
- PH-008 + PH-015 · Clareamento com OX também sensibiliza o fio, e o Pro.R é indicado para danos por química.
- PH-008 + PH-010 · Depois da reconstrução com o Pro.R, o condicionador Bruma Ametista mantém o fortalecimento e a elasticidade no uso diário.
- PH-009 + PH-010 · Mesma linha Bruma Ametista: a ficha do shampoo indica usar o condicionador da linha em seguida.
- PH-011 + PH-012 · Mesma linha Aura Radiante: a ficha do shampoo indica usar o condicionador da linha em seguida.

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
- T-05 · O spike faz uma única rodada de ferramenta, com a função fictícia `consultar_clima` — o loop com limite de iterações e a conversão de zod para declaração ficam para T-20 e T-22.
- T-06 · Meio centavo arredonda para cima (arredondamento comercial) e o percentual é calculado em inteiros (pontos-base) — evita erro de ponto flutuante nas etapas de cupom e desconto PIX.
- T-06 · `formatarBRL` monta a string à mão, sem `Intl` — o `Intl` insere espaço não separável após "R$", e a saída precisa ser exatamente `R$ 279,40`.
- T-06 · Valores negativos ou não inteiros em centavos lançam `RangeError` — dinheiro inválido deve falhar alto, e as ferramentas convertem o erro em mensagem amigável.
- T-07 · CEP fora de todas as faixas (inclui 00000-000 a 00999-999) devolve erro amigável, sem exceção — o resultado é `{ ok, zona | erro }` para as ferramentas repassarem a mensagem à cliente.
- T-08 · Acima de 5 kg a faixa é `F4` com `kgExcedentes` (em vez de uma faixa "F5") — o frete é F4 + adicional por kg, então o excedente fica explícito para a T-09.
- T-09 · Tabelas 5.3 e 5.4 ficam como constantes em centavos em `frete.ts`, com prazo em dias úteis (mín/máx) — a tabela é fixa por enunciado e não precisa de arquivo externo; `calcularFrete` não aplica frete grátis (T-10).
- T-10 · `faltaParaGratisCentavos` é `null` na Expressa e `0` quando o frete já é grátis — a Expressa nunca é grátis, então não existe "quanto falta"; assim a IA não oferece um gatilho que não existe.
- T-11 · O código do cupom aceita qualquer caixa e espaços nas pontas (`prohall10` vale) — a regra diz "PROHALL10" e a cliente digita no chat; qualquer outro código segue inválido.
- T-11 · "Um cupom por pedido" é garantido por o carrinho guardar um único código (`CupomAplicado`); `reavaliarCupom` é chamada a cada mudança no carrinho e sinaliza `perdeuValidade` para a IA avisar.
- T-12 · Carrinho imutável: cada operação devolve um novo carrinho ou um erro tipado (`motivo` + mensagem + `disponivel`) — as ferramentas repassam o erro à cliente sem tratar exceções, e o carrinho original nunca é alterado por uma operação que falha.
- T-12 · `alterarQuantidade(…, 0)` remove o item, e o limite efetivo por item é o menor entre `estoque_teste` e 10 — a regra 6.3 pede os dois bloqueios; zero como remoção evita um segundo caminho para o mesmo efeito.
- T-12 · O domínio usa o tipo mínimo `ProdutoCarrinho` (id, preço e promocional em centavos, estoque), sem depender do schema do produto — o schema completo vem na T-14 e o catálogo converte reais em centavos ao carregar.
- T-13 · `calcularTotais` aceita `entrega: null` (CEP ainda não informado) e devolve `frete: null`, com o total sem frete — a Sofia mostra o carrinho antes do CEP sem inventar um frete.
- T-13 · O exemplo 6.2 é teste automatizado (subtotal R$ 300,00 → cupom −R$ 30,00 → base R$ 270,00 → frete R$ 22,90 → PIX −R$ 13,50 → total exatamente R$ 279,40, faltando R$ 29,00 para o frete grátis).
- T-14 · O schema (`packages/shared/src/produto.ts`) é estrito: campo desconhecido é erro, e texto vazio deve ser `null` — a regra 4.2 diz "ausente = `null` ou lista vazia", e aceitar `""` esconderia o que a Sofia precisa saber dizer que não tem.
- T-14 · O schema também valida coerência: ids únicos, `combina_com` só para ids existentes (sem repetição nem o próprio produto), promocional menor que o preço e preço com até 2 casas — são erros de digitação comuns ao copiar 15 produtos à mão.
- T-14 · A variedade mínima (≥ 4 categorias, ≥ 1 kit, ≥ 3 pares, estoque ≤ 3 etc.) fica fora do schema e é conferida na T-15 — ela depende do conjunto dos 15 produtos, não de cada produto; `pnpm validate:catalogo [caminho]` falha com erro claro enquanto `data/produtos.json` não existir.
- Escopo · Parte 4 da especificação (ferramentas mínimas) incorporada a `docs/requisitos.md` e aos critérios das T-18, T-19, T-20, T-21, T-25, T-26 e T-27 — o enunciado define argumentos e retornos que ainda não estavam no backlog, como `consultar_pedido` e a remoção parcial.
- Escopo · Ferramenta da ficha renomeada de `detalhes_produto` para `detalhar_produto`; `produtos_complementares` e `atualizar_perfil` ficam como extras — os nomes são livres, mas seguir os do enunciado facilita a leitura; os extras atendem às etapas de entender a cliente e de combinar produtos.
- Escopo · Pedido tem status `aguardando_pagamento` ou `pago`, e o PIX tem `ativo` ou `expirado`; `consultar_pedido` devolve os dois — a especificação diz que o PIX expira e a Sofia oferece gerar outro, então o pedido continua aguardando pagamento.
- Escopo · Resumo do catálogo sem preço e sem estoque (id, nome, categoria, uso e para quem é indicado), gerado do `produtos.json`, entra no prompt; preço, estoque e ficha só por ferramenta — 15 produtos cabem no contexto e o resumo poupa chamadas de busca, sem que o modelo veja um preço fora das funções.
- T-15 · `volume` e `uso` aceitam `null` no schema — vários produtos não informam volume, e a regra 4.2 manda `null` para o que o site não diz; o schema da T-14 exigia texto.
- T-15 · Na variedade mínima, `uso: "ambos"` conta como profissional e como home care; nenhum produto está marcado só como `home_care` — "ambos" inclui o uso em casa, que é o que a regra pede.
- T-15 · `pnpm validate:catalogo` também confere a variedade mínima da Parte 1 e falha se alguma meta não for atingida — assim o critério da T-15 fica verificável por comando.
- T-15 · PH-005 corrigido a partir da página: modo de uso em 3 passos, Óleo de Tâmara nos ativos e rendimento "Até 10 aplicações" — o JSON inicial trazia um texto genérico no modo de uso e `null` no rendimento.
- T-15 · `uso` segue a classificação por produto do JSON, não o bloco "USO PROFISSIONAL" das páginas — o bloco aparece até em produto de uso em casa (perfume capilar PH-003), então é genérico.
- T-15 · Nomes mantidos exatamente como no site, inclusive "para o dia a diah" (PH-003) e "Sequei Sem Frizz" (PH-004) — conferidos na página em 29/10/2026; a regra 4.1 pede o nome exato.
- T-16 · Preços conferidos no site em 29/10/2026 e quatro promocionais atualizados (PH-002 R$ 197,90 → R$ 139,90; PH-004 R$ 80,90 → R$ 34,90; PH-005 R$ 42,90 → R$ 44,90; PH-013 R$ 89,90 → R$ 54,90) — a regra pede os preços do dia da cópia com a data anotada, e os do JSON inicial já não batiam com o site.
- T-17 · Os tipos que atravessam server e web (`PerfilCliente`, `Pedido`, `StatusPedido`) ficam em `packages/shared`; o `EstadoSessao` fica no server porque guarda o `Carrinho` do domínio — o web não precisa do carrinho cru, só de uma visão dele, que vem nas respostas.
- T-17 · `Pedido` tem só `id` e `status` por ora — itens, entrega e totais entram na T-25, que estende o tipo, para não definir duas vezes o formato do pedido.
- T-17 · As sessões ficam em memória, sem expiração, e o id é validado (`[A-Za-z0-9_-]`, até 100 caracteres) porque vem do cliente — é um teste local sem banco, conforme a Parte 4; o reinício do servidor zera as conversas.
- T-18 · A busca por `termo` ignora acentos, caixa e palavras genéricas (de, para, cabelo…), compara pelo radical de 6 letras e ordena por quantas palavras casam — assim "cabelo ressecado" acha "ressecamento" sem um motor de busca para 15 produtos.
- T-18 · Filtro `uso` inclui os produtos de uso `ambos` e deixa de fora os de `uso: null`, avisando quantos ficaram de fora — a ficha não informa o uso deles e a Sofia não deve afirmar.
- T-18 · Campo `null` da ficha volta como "sem informação", listado em `campos_sem_informacao`; produto profissional ou de uso desconhecido traz `aviso_uso` — o sinal explícito evita que o modelo preencha a lacuna, e cobre a regra 8.4 de avisar sobre uso profissional.
- T-18 · O peso do produto não é exposto ao modelo — é dado interno do cálculo de frete, e a Sofia não deve falar em peso estimado.
- T-18/T-19 · Valores monetários voltam como `{ centavos, texto }` (ex.: `R$ 279,40`) — o modelo copia o texto pronto e não formata nem soma.
- T-18/T-19 · Erros de validação dos argumentos voltam como `{ ok: false, erro, campos }` em português, com mensagens próprias em vez do locale `pt` do zod ("Demasiado pequeno" é português de Portugal) — a Sofia se corrige na chamada seguinte.
- T-19 · `ver_carrinho` e `calcular_frete` mostram as duas modalidades, cada uma com frete, quanto falta para o grátis e total no PIX — a ferramenta não recebe a modalidade e a escolha só acontece no `finalizar_pedido`; o CEP e a zona ficam na sessão e o frete é recalculado a cada mudança no carrinho.
- T-19 · Quando uma remoção derruba o subtotal abaixo de R$ 150,00, o cupom sai do carrinho e a resposta traz `aviso_cupom` — regra 6.1; reaplicar exige chamar `aplicar_cupom` de novo.
- T-19 · Adicionar ao carrinho não baixa o `estoque_teste`: ele só limita a quantidade. Se o pedido deve descontar do estoque, a decisão é da T-25.
- T-20 · As declarações do Gemini saem do mesmo schema zod que valida os argumentos (`z.toJSONSchema` → `parametersJsonSchema`, sem a chave `$schema`) — uma única fonte para validação e contrato; as 9 declarações foram aceitas pela API real do `gemini-3.8-flash`.
- T-20 · O despachante nunca lança: nome desconhecido, argumento inválido ou exceção dentro da ferramenta voltam como `{ ok: false, erro }` na resposta da função — o modelo se corrige e a conversa não cai; a exceção vai em `detalhe_interno` para o log.
- T-21 · Catálogo no prompt: um resumo de uma linha por produto (id, nome, categoria, linha, uso e indicações), sem preço e sem estoque, gerado do `data/produtos.json` ao montar o prompt e injetado no marcador `{{CATALOGO}}` de `prompts/sofia.md` — com 15 produtos o resumo cabe no contexto e a Sofia sabe o que existe sem chamar `buscar_produtos` a cada mensagem; preço, estoque e ficha completa continuam só nas ferramentas, então o modelo nunca lê um preço fora delas. Um teste garante que nenhum preço do catálogo aparece no prompt.
- T-21 · O prompt cita `finalizar_pedido`, `gerar_pix` e `consultar_pedido` e manda dizer que o fechamento ainda não está disponível enquanto essas ferramentas não existirem — o texto já fica completo para as T-25 a T-27, e o modelo só consegue chamar o que está declarado.
- T-22 · Loop de function calling escrito à mão sobre `generateContentStream`: cada rodada transmite o texto, executa todas as chamadas da resposta na ordem (o modelo pede várias de uma vez), devolve as respostas juntas e chama o modelo de novo, até a resposta final ou o limite de 8 rodadas por mensagem — o limite encerra com uma mensagem honesta em vez de inventar resultado.
- T-22 · As partes do modelo entram no histórico exatamente como vieram, inclusive pensamentos e assinaturas (`thoughtSignature`), e os pensamentos não são mostrados à cliente — o Gemini exige as assinaturas de volta nas rodadas com ferramentas; validado numa conversa real de duas mensagens e quatro ferramentas.
- T-22 · O histórico fica na sessão e o turno só é gravado quando termina: se o modelo falhar no meio, a cliente recebe um erro amigável e o histórico não fica pela metade (as mudanças que as ferramentas já fizeram no carrinho continuam valendo e aparecem no próximo `ver_carrinho`).
- T-22 · Log em JSON Lines (`logs/conversas.jsonl`, ignorado pelo Git): mensagem da cliente, cada chamada de ferramenta com argumentos, resultado e duração, a resposta da Sofia e erros — mostra o raciocínio da venda sem depender de banco.
- T-22 · O agente depende de uma interface mínima de modelo (`ModeloChat`), com o adaptador do Gemini à parte — os testes rodam o loop inteiro com um modelo roteirizado, sem chamar a API.
- T-23 · `POST /api/chat` responde em Server-Sent Events sobre o próprio POST (`text/event-stream`), com um evento por acontecimento do agente — o front lê com `fetch` e um leitor de stream; um `EventSource` exigiria GET e a mensagem na URL.
- T-23 · Uma resposta por vez por sessão (a segunda mensagem simultânea recebe 409) e o turno vai até o fim mesmo se a cliente fechar a conexão — duas respostas paralelas embaralhariam histórico e carrinho, e um turno cortado deixaria o carrinho alterado sem registro no histórico.
- T-23 · O servidor escuta só em `127.0.0.1` e encerra no start se `GEMINI_API_KEY` faltar — é um teste local, e falhar cedo é mais claro que falhar na primeira mensagem.
