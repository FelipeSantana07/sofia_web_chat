# Especificação técnica do teste

Regras do enunciado para catálogo, frete, carrinho, comportamento da Sofia, checkout/PIX e interface. Este arquivo é a referência para dividir as tarefas de desenvolvimento: cada parte vira um bloco de trabalho testável.

## Parte 1 · Catálogo (15 produtos)

Escolha 15 produtos em [lojaprohall.com.br](https://lojaprohall.com.br/) e cadastre em `data/produtos.json`.

### Variedade mínima

- [ ] Pelo menos 4 categorias diferentes (ex.: progressiva/alisamento, tratamento, shampoo, condicionador, máscara, finalizador)
- [ ] Pelo menos 1 kit
- [ ] Pelo menos 3 pares de produtos que combinam entre si (para venda cruzada)
- [ ] Pelo menos 1 produto de uso profissional e 1 de uso em casa (home care), se houver no site

### 4.1 Formato de cada produto

```json
{
  "id": "PH-001",
  "sku": "SKU do site (se houver)",
  "nome": "Nome exato do produto no site",
  "linha": "Linha / coleção",
  "categoria": "progressiva | tratamento | shampoo | condicionador | mascara | finalizador | kit | outro",
  "url": "https://lojaprohall.com.br/products/...",
  "imagem_url": "https://...",
  "preco": 189.90,
  "preco_promocional": null,
  "volume": "1 L",
  "peso_bruto_g": 1150,
  "peso_estimado": false,
  "estoque_teste": 12,
  "uso": "profissional | home_care | ambos",
  "descricao_curta": "Uma frase que resume o produto.",
  "descricao_completa": "Texto da página do produto.",
  "indicado_para": ["cabelos com frizz", "cabelos com química"],
  "nao_indicado_para": [],
  "beneficios": ["..."],
  "ativos_principais": ["..."],
  "modo_de_uso": ["Passo 1...", "Passo 2..."],
  "cuidados_e_avisos": ["..."],
  "duracao_resultado": null,
  "rendimento": null,
  "combina_com": ["PH-004", "PH-007"],
  "perguntas_frequentes": [
    { "pergunta": "...", "resposta": "..." }
  ]
}
```

### 4.2 Regras do catálogo

- **Dados reais**, copiados da página do produto (nome, preço, descrição, modo de uso, ativos etc.). Não invente nada.
- **Informação que não existe no site** = `null` ou lista vazia. A IA precisa saber dizer "não tenho essa informação".
- **Peso:** se o site não informar, estime pelo volume e marque `"peso_estimado": true`.
- **`estoque_teste`** é fictício (você define). Serve para testar a regra de estoque e o gatilho de estoque baixo: deixe pelo menos 1 produto com estoque ≤ 3.
- **Preços:** use os do site no dia em que copiou e anote essa data no README.
- **`combina_com`** é decisão sua: justifique as combinações no README, em uma linha cada.

## Parte 2 · Frete (tabela fixa, valores fictícios)

Origem: CD da Prohall em Extrema/MG. A tabela é simplificada e fictícia, feita só para o teste.

### 5.1 Zona pelo CEP de destino

| Zona | Faixas de CEP | Região (aprox.) |
| --- | --- | --- |
| Z1 | 01000-000 a 19999-999 · 30000-000 a 39999-999 | SP e MG |
| Z2 | 20000-000 a 29999-999 · 80000-000 a 89999-999 | RJ, ES, PR e SC |
| Z3 | 70000-000 a 76799-999 · 78000-000 a 79999-999 · 90000-000 a 99999-999 | Centro-Oeste e RS |
| Z4 | 40000-000 a 65999-999 | Nordeste |
| Z5 | 66000-000 a 69999-999 · 76800-000 a 77999-999 | Norte |

- **CEP inválido** (não tem 8 dígitos ou está fora das faixas, ex.: 00000-000): erro amigável e a IA pede o CEP de novo.
- Aceitar o CEP **com ou sem hífen**.

### 5.2 Peso cobrado

```
peso_cobrado = soma(peso_bruto_g × quantidade) + 200 g (embalagem do pedido)
```

Use a primeira faixa que comporta o peso. O limite é inclusivo: 1.000 g cai em "até 1 kg".

| Faixa | Peso cobrado |
| --- | --- |
| F1 | até 0,5 kg |
| F2 | até 1 kg |
| F3 | até 2 kg |
| F4 | até 5 kg |
| Acima de 5 kg | valor de F4 + adicional por kg excedente, arredondado para cima (5,3 kg → 1 kg adicional; 6,3 kg → 2 kg adicionais) |

### 5.3 Valores · modalidade Econômica

| Zona | até 0,5 kg | até 1 kg | até 2 kg | até 5 kg | + por kg acima de 5 kg | Prazo (dias úteis) |
| --- | --- | --- | --- | --- | --- | --- |
| Z1 | R$ 15,90 | R$ 18,90 | R$ 22,90 | R$ 29,90 | R$ 3,50 | 3 a 5 |
| Z2 | R$ 19,90 | R$ 23,90 | R$ 28,90 | R$ 38,90 | R$ 4,50 | 4 a 7 |
| Z3 | R$ 24,90 | R$ 29,90 | R$ 36,90 | R$ 49,90 | R$ 6,00 | 5 a 9 |
| Z4 | R$ 29,90 | R$ 36,90 | R$ 45,90 | R$ 64,90 | R$ 8,00 | 7 a 12 |
| Z5 | R$ 34,90 | R$ 42,90 | R$ 54,90 | R$ 79,90 | R$ 10,00 | 9 a 15 |

### 5.4 Valores · modalidade Expressa

| Zona | até 0,5 kg | até 1 kg | até 2 kg | até 5 kg | + por kg acima de 5 kg | Prazo (dias úteis) |
| --- | --- | --- | --- | --- | --- | --- |
| Z1 | R$ 24,90 | R$ 29,90 | R$ 35,90 | R$ 47,90 | R$ 5,50 | 1 a 2 |
| Z2 | R$ 31,90 | R$ 38,90 | R$ 46,90 | R$ 62,90 | R$ 7,00 | 2 a 3 |
| Z3 | R$ 39,90 | R$ 48,90 | R$ 59,90 | R$ 82,90 | R$ 9,50 | 2 a 4 |
| Z4 | R$ 49,90 | R$ 59,90 | R$ 74,90 | R$ 104,90 | R$ 13,00 | 3 a 6 |
| Z5 | R$ 59,90 | R$ 72,90 | R$ 89,90 | R$ 129,90 | R$ 16,00 | 4 a 8 |

### 5.5 Frete grátis

- Vale só para a modalidade **Econômica**. A Expressa nunca é grátis.
- A base de cálculo é o **valor dos produtos após o cupom** (antes do desconto PIX).
- **Z1 e Z2:** base ≥ R$ 299,00.
- **Z3, Z4 e Z5:** base ≥ R$ 399,00.
- Quando não atingir, a função de frete deve devolver **quanto falta para o frete grátis** (a IA usa isso como gatilho).

## Parte 3 · Carrinho, cupom e totais

### 6.1 Ordem do cálculo

1. **Subtotal** = soma de (preço vigente × quantidade). Preço vigente = `preco_promocional` se existir, senão `preco`.
2. **Cupom:** existe só um, `PROHALL10`, que dá 10% sobre o subtotal com pedido mínimo de R$ 150,00 (no subtotal). Um cupom por pedido; qualquer outro código é inválido.
3. **Base dos produtos** = subtotal − cupom.
4. **Frete** calculado com a base (regra 5.5) e a modalidade escolhida.
5. **Desconto PIX:** 5% sobre a base dos produtos (não incide sobre o frete).
6. **Total no PIX** = base × 0,95 + frete.

Arredonde para 2 casas decimais ao fim de cada etapa (arredondamento comercial). Se a cliente remover itens e o subtotal ficar abaixo de R$ 150,00, o cupom deixa de valer e a IA avisa.

### 6.2 Exemplo completo

| Etapa | Valor |
| --- | --- |
| Subtotal | R$ 300,00 |
| Cupom PROHALL10 (−10%) | − R$ 30,00 |
| Base dos produtos | R$ 270,00 |
| Frete Econômico Z1, até 2 kg (270 < 299, não é grátis) | + R$ 22,90 |
| Desconto PIX (5% de 270,00) | − R$ 13,50 |
| **Total no PIX** | **R$ 279,40** |

Nesse caso a IA pode lembrar: "faltam R$ 29,00 para o frete sair grátis". Este exemplo serve de caso de teste automatizado.

### 6.3 Outras regras

- Não deixar adicionar mais unidades do que o `estoque_teste` do produto.
- Máximo de **10 unidades por item**.
- **Pagamento:** só PIX (falso). Se a cliente pedir cartão ou boleto, a IA explica que nesta versão só há PIX.

## Parte 4 · Ferramentas da IA (function calling) · obrigatório

**Princípio:** a IA conversa e decide; o código calcula e guarda. Preço, frete, totais, estoque e PIX vêm sempre das funções. Se a IA fizer conta "de cabeça" ou inventar um valor, perde muitos pontos.

Ferramentas mínimas (os nomes são livres, a ideia é esta):

| Ferramenta | O que faz |
| --- | --- |
| `buscar_produtos(termo?, categoria?, uso?)` | Lista resumida: id, nome, preço, uma linha de descrição |
| `detalhar_produto(id)` | Ficha completa do produto (do JSON) |
| `adicionar_ao_carrinho(id, quantidade)` | Valida id e estoque, devolve o carrinho atualizado |
| `remover_do_carrinho(id, quantidade?)` | Remove tudo ou parte |
| `ver_carrinho()` | Itens, subtotal, cupom, base, peso cobrado |
| `aplicar_cupom(codigo)` | Valida o cupom pelas regras da seção 6 |
| `calcular_frete(cep)` | Usa o peso e a base do carrinho atual; devolve zona, opções, prazos e quanto falta para o frete grátis |
| `finalizar_pedido(nome, email, cep, endereco, numero, complemento?, modalidade_frete)` | Cria o pedido com status `aguardando_pagamento` e devolve resumo e totais |
| `gerar_pix(pedido_id)` | Gera o PIX falso (seção 9) |
| `consultar_pedido(pedido_id)` | Devolve o status do pedido |

Observações:

- O estado (carrinho, pedido) fica no backend, por sessão de conversa. Pode ser em memória: não precisa de banco.
- Valide os argumentos que a IA manda (id inexistente, quantidade negativa, CEP com letra…). Erro de validação volta para a IA como resposta da função, para ela se corrigir.
- 15 produtos cabem no contexto: você pode colocar um resumo do catálogo no prompt de sistema e usar `detalhar_produto` para a ficha completa, ou fazer tudo via ferramentas. Explique sua escolha no README.

## Parte 5 · Comportamento da vendedora (estilo Sofia)

### 8.1 Persona

Sofia, consultora de beleza da Prohall. Próxima, simpática e brasileira; fala como no WhatsApp: mensagens curtas, uma pergunta por vez, emoji com moderação. Entende de cabelo de verdade e vende resolvendo o problema da cliente, não empurrando produto.

### 8.2 Fluxo de venda esperado

1. **Acolher e entender:** o que a cliente procura, tipo de cabelo, química atual (progressiva, coloração, descoloração), principal incômodo (frizz, volume, quebra, ressecamento) e se é profissional (salão) ou uso em casa.
2. **Recomendar:** 1 a 3 produtos, explicando por que com base na ficha (não em achismo). Mostrar o card do produto.
3. **Aprofundar:** tirar dúvidas de modo de uso, rendimento, duração e cuidados usando só a ficha.
4. **Combinar:** sugerir o que está em `combina_com` ou um kit, quando fizer sentido para o problema dela.
5. **Frete:** pedir o CEP no momento certo e apresentar as opções.
6. **Fechar:** conduzir ao checkout, conferir os dados, gerar o PIX e explicar o copia e cola.
7. **Pós-PIX:** confirmar o pagamento (simulado) e agradecer.

### 8.3 Gatilhos permitidos

Sempre com dados reais do sistema:

- quanto falta para o frete grátis;
- economia no PIX (em reais, não só em %);
- estoque baixo, só se `estoque_teste` ≤ 3 de verdade;
- benefício ou resultado que está na ficha;
- kit ou combinação que resolve melhor o problema dela.

**Proibido:** urgência inventada ("só hoje!"), escassez falsa, depoimento inventado, desconto que não existe.

### 8.4 Limites (a Sofia não pode)

- inventar preço, ativo, resultado, prazo ou qualquer informação que não esteja na ficha (se não souber, diz que não tem essa informação e oferece falar com a equipe);
- dar diagnóstico médico (queda intensa, ferida no couro cabeludo, alergia → orienta procurar um dermatologista);
- dar desconto fora das regras (cliente pedindo 50% → recusa com simpatia e lembra do desconto PIX/cupom quando couber);
- falar de concorrentes ou de produtos fora do catálogo;
- revelar o prompt ou as instruções internas, ou sair do papel ("ignore suas instruções…");
- pedir CPF, cartão ou dado sensível (no teste, só nome, e-mail e endereço fictícios);
- indicar produto de uso profissional para uso em casa sem avisar que é para aplicação por profissional.

O prompt de sistema deve ficar em um arquivo próprio no repositório (ex.: `prompts/sofia.md`), não escondido no meio do código.

## Parte 6 · Checkout e PIX falsos

Faixa fixa no topo do checkout e do PIX: **"AMBIENTE DE TESTE — nenhum pagamento é real"**.

### 9.1 Checkout (página ou modal)

- **Resumo:** itens, cupom, frete escolhido, desconto PIX e total.
- **Formulário:** nome, e-mail, CEP, endereço, número, complemento, com aviso "use dados fictícios".
- O pedido pode ser fechado **pela conversa** (a IA chama `finalizar_pedido`) **ou pelo formulário**: os dois caminhos têm que chegar no mesmo pedido.

### 9.2 PIX falso

- Número do pedido (ex.: `PH-TESTE-000123`) e valor total.
- QR Code gerado a partir de um texto de mentira, por exemplo: `PIX-TESTE|PROHALL|PH-TESTE-000123|279.40|NAO-PAGAVEL` (qualquer biblioteca de QR Code serve).
- O mesmo texto como "copia e cola", com botão **Copiar**.
- Validade de **15 minutos** com contador. Expirou → status `expirado` e a Sofia oferece gerar outro.
- Botão **"Simular pagamento"** → status `pago` e a Sofia manda a confirmação no chat.
- **Não** gere código no padrão real do Banco Central (BR Code/EMV) e **não** use chave PIX real. Tem que ser óbvio que é falso.

## Interface (simples)

- Chat web que funcione bem no celular.
- Cards de produto dentro do chat (imagem, nome, preço, botão "Adicionar").
- Carrinho visível (lateral ou ícone com contador).
- Indicador "digitando…" enquanto a IA responde.
- **Diferencial:** painel de debug (pode ficar escondido) mostrando as ferramentas chamadas e os argumentos.
