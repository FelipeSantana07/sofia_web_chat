---
name: cadastrar-produto
description: Cadastra produtos da Prohall em data/produtos.json a partir da página do produto em lojaprohall.com.br, seguindo o formato 4.1 e as regras 4.2 da especificação. Use quando o usuário pedir para cadastrar, adicionar ou atualizar um produto do catálogo, por exemplo "/cadastrar-produto <url>".
---

# Cadastrar um produto no catálogo

O argumento é uma ou mais URLs de produto em `https://lojaprohall.com.br/`. Antes de começar, leia a Parte 1 de `docs/especificacao.md` (formato 4.1 e regras 4.2).

## Regra de ouro

**Nada inventado.** Todo dado vem da página do produto. O que a página não informa vira `null` (campos simples) ou `[]` (listas). A Sofia depende disso para saber dizer "não tenho essa informação".

## 1. Ler a página

- Abra a URL e extraia o conteúdo da página do produto.
- Se não conseguir acessar a página, **pare** e peça ao usuário que cole o texto da página (nome, preço, descrição, modo de uso, ativos, volume). Não preencha nada de memória.

## 2. Preencher os campos (formato 4.1)

| Campo | Como preencher |
| --- | --- |
| `id` | Próximo ID livre no arquivo: `PH-001`, `PH-002`… (zero à esquerda, 3 dígitos) |
| `sku` | SKU da página; `null` se não houver |
| `nome` | Nome **exato** da página |
| `linha` | Linha ou coleção da página; `null` se não houver |
| `categoria` | Uma de: `progressiva`, `tratamento`, `shampoo`, `condicionador`, `mascara`, `finalizador`, `kit`, `outro` |
| `url` | URL canônica da página |
| `imagem_url` | URL da imagem principal do produto |
| `preco` | Preço cheio da página, número com ponto decimal (ex.: `189.90`) |
| `preco_promocional` | Preço promocional se a página mostrar; senão `null` |
| `volume` | Como na página (ex.: `"1 L"`, `"300 ml"`, `"kit 2 x 1 L"`) |
| `peso_bruto_g` | Peso da página em gramas. Se não houver, estime (ver passo 3) |
| `peso_estimado` | `true` se o peso foi estimado; `false` se veio da página |
| `estoque_teste` | Fictício, definido por você (ver passo 4) |
| `uso` | `profissional`, `home_care` ou `ambos`, conforme a página indicar |
| `descricao_curta` | Uma frase fiel à página (pode resumir, sem acrescentar promessas) |
| `descricao_completa` | Texto da página do produto |
| `indicado_para`, `nao_indicado_para`, `beneficios`, `ativos_principais`, `modo_de_uso`, `cuidados_e_avisos` | Listas com o que a página diz; `[]` se não disser |
| `duracao_resultado`, `rendimento` | Só se a página informar; senão `null` |
| `combina_com` | IDs de produtos **já cadastrados** que combinam (ver passo 5) |
| `perguntas_frequentes` | Só perguntas e respostas que existem na página; senão `[]` |

## 3. Estimar o peso (quando a página não informa)

- Use a mesma regra para todos os produtos: peso do conteúdo pelo volume (1 ml ≈ 1 g) mais a embalagem estimada.
- Marque `"peso_estimado": true`.
- Se a regra de estimativa ainda não estiver registrada na seção "Decisões" do README, registre-a uma vez, com a fórmula usada.

## 4. Definir o estoque de teste

- Valores entre 4 e 20 na maioria dos produtos.
- Garanta que **pelo menos 1 produto** do catálogo tenha `estoque_teste` ≤ 3 (gatilho de estoque baixo).

## 5. Definir as combinações

- Só use IDs que já existem no arquivo. Combinações com produtos ainda não cadastrados ficam para depois (avise o usuário).
- Prefira combinações recíprocas (se A combina com B, B combina com A).
- Para cada nova combinação, adicione no README uma linha de justificativa: `- PH-001 + PH-004 · <por que combinam>`.

## 6. Validar e conferir

1. Salve em `data/produtos.json` mantendo a ordem por `id` e a formatação existente (2 espaços).
2. Rode a validação do catálogo (`pnpm validate:catalogo`, criada na T-14) e corrija até passar.
3. Ao fim, mostre ao usuário o andamento da **variedade mínima** do catálogo:
   - total de produtos (meta: 15);
   - categorias diferentes (meta: ≥ 4);
   - kits (meta: ≥ 1);
   - pares em `combina_com` (meta: ≥ 3);
   - produtos profissionais e home care (meta: ≥ 1 de cada, se houver no site);
   - produtos com estoque ≤ 3 (meta: ≥ 1).

## 7. Entregar

Liste os produtos cadastrados (id, nome, preço, peso estimado ou não) e o que ficou `null` por falta de informação na página. Lembre o usuário de registrar no README a **data em que os preços foram copiados**, caso ainda não esteja lá. Não faça commit.
