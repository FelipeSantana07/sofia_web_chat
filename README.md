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
