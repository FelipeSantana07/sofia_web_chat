import { z } from "zod";
import { alterarQuantidade, removerItem, adicionarItem, type MotivoErroCarrinho } from "../domain/carrinho.js";
import { identificarZona, normalizarCep } from "../domain/cep.js";
import { CUPOM_PERCENTUAL, validarCupom } from "../domain/cupom.js";
import { limiteFreteGratisCentavos } from "../domain/frete-gratis.js";
import { acharProduto, definirFerramenta, dinheiro, falha, type Ferramenta } from "./base.js";
import {
  gatilhoFreteGratis,
  montarOpcoesFrete,
  montarResumoCarrinho,
  pesoCobradoDoCarrinho,
  sincronizarCupom,
} from "./resumo-carrinho.js";

const idProduto = z.string().min(1).describe("Id do produto no catálogo, ex.: PH-001");

const naoEncontrado = (id: string) =>
  falha(`Produto ${id.trim()} não encontrado no catálogo. Use buscar_produtos para ver os ids válidos.`, {
    motivo: "produto_nao_encontrado",
  });

function erroDeCarrinho(erro: string, motivo: MotivoErroCarrinho, disponivel?: number) {
  return falha(erro, { motivo, ...(disponivel === undefined ? {} : { pode_adicionar_ate: disponivel }) });
}

export const adicionarAoCarrinho = definirFerramenta({
  nome: "adicionar_ao_carrinho",
  descricao:
    "Adiciona um produto ao carrinho depois que a cliente confirmar. Valida o id, o estoque e o limite de 10 unidades por item, " +
    "e devolve o carrinho atualizado.",
  parametros: z.object({
    id: idProduto,
    quantidade: z.number().int().positive().describe("Quantidade a adicionar (inteiro maior que zero)"),
  }),
  executar({ id, quantidade }, ctx) {
    const produto = acharProduto(ctx.catalogo, id);
    if (!produto) return naoEncontrado(id);

    const r = adicionarItem(ctx.sessao.carrinho, ctx.catalogo.paraCarrinho(produto), quantidade);
    if (!r.ok) return erroDeCarrinho(r.erro, r.motivo, r.disponivel);

    ctx.sessao.carrinho = r.carrinho;
    const avisoCupom = sincronizarCupom(ctx);
    return {
      ok: true,
      mensagem: `Adicionado ao carrinho: ${quantidade}x ${produto.nome}.`,
      ...(avisoCupom ? { aviso_cupom: avisoCupom } : {}),
      carrinho: montarResumoCarrinho(ctx),
    };
  },
});

export const removerDoCarrinho = definirFerramenta({
  nome: "remover_do_carrinho",
  descricao:
    "Remove um produto do carrinho. Sem quantidade, tira o item inteiro; com quantidade, tira só essa parte. " +
    "Devolve o carrinho atualizado e avisa se o cupom deixou de valer.",
  parametros: z.object({
    id: idProduto,
    quantidade: z.number().int().positive().optional().describe("Quantas unidades remover; omita para remover tudo"),
  }),
  executar({ id, quantidade }, ctx) {
    const produto = acharProduto(ctx.catalogo, id);
    if (!produto) return naoEncontrado(id);

    const noCarrinho = ctx.sessao.carrinho.itens.find((i) => i.produtoId === produto.id)?.quantidade ?? 0;
    if (noCarrinho === 0) return erroDeCarrinho("Esse produto não está no carrinho.", "item_ausente");
    if (quantidade !== undefined && quantidade > noCarrinho) {
      return falha(`Só há ${noCarrinho} unidade(s) desse produto no carrinho.`, {
        motivo: "quantidade_maior_que_no_carrinho",
        no_carrinho: noCarrinho,
      });
    }

    const r =
      quantidade === undefined || quantidade === noCarrinho
        ? removerItem(ctx.sessao.carrinho, produto.id)
        : alterarQuantidade(ctx.sessao.carrinho, ctx.catalogo.paraCarrinho(produto), noCarrinho - quantidade);
    if (!r.ok) return erroDeCarrinho(r.erro, r.motivo, r.disponivel);

    ctx.sessao.carrinho = r.carrinho;
    const avisoCupom = sincronizarCupom(ctx);
    const removidas = quantidade ?? noCarrinho;
    return {
      ok: true,
      mensagem: `Removido do carrinho: ${removidas}x ${produto.nome}.`,
      ...(avisoCupom ? { aviso_cupom: avisoCupom } : {}),
      carrinho: montarResumoCarrinho(ctx),
    };
  },
});

export const aplicarCupom = definirFerramenta({
  nome: "aplicar_cupom",
  descricao:
    "Valida e aplica um cupom ao carrinho quando a cliente informar um código. Só existe o PROHALL10 " +
    "(10% sobre o subtotal, pedido mínimo de R$ 150,00 em produtos, um por pedido). Nunca ofereça outro desconto.",
  parametros: z.object({ codigo: z.string().min(1).describe("Código do cupom, como a cliente digitou") }),
  executar({ codigo }, ctx) {
    const subtotal = montarResumoCarrinho(ctx).subtotal.centavos;
    const r = validarCupom(codigo, subtotal);
    if (!r.ok) {
      return falha(r.erro, {
        motivo: r.motivo,
        ...(r.faltaParaMinimoCentavos === undefined ? {} : { falta_para_o_minimo: dinheiro(r.faltaParaMinimoCentavos) }),
      });
    }

    const jaAplicado = ctx.sessao.cupom === r.codigo;
    ctx.sessao.cupom = r.codigo;
    return {
      ok: true,
      mensagem: jaAplicado ? "Esse cupom já estava aplicado ao carrinho." : "Cupom aplicado.",
      cupom: { codigo: r.codigo, percentual: CUPOM_PERCENTUAL, desconto: dinheiro(r.descontoCentavos) },
      carrinho: montarResumoCarrinho(ctx),
    };
  },
});

export const verCarrinho = definirFerramenta({
  nome: "ver_carrinho",
  descricao:
    "Mostra o carrinho: itens, subtotal, cupom, base dos produtos, peso cobrado e, se o CEP já foi informado, " +
    "o frete e o total no PIX de cada modalidade. Chame antes do checkout. Use sempre estes valores; nunca faça contas.",
  parametros: z.object({}),
  executar(_args, ctx) {
    return { ok: true, carrinho: montarResumoCarrinho(ctx) };
  },
});

export const calcularFrete = definirFerramenta({
  nome: "calcular_frete",
  descricao:
    "Calcula o frete do carrinho atual para um CEP: devolve a zona, as modalidades Econômica e Expressa com valor e prazo, " +
    "e quanto falta para o frete grátis (só Econômica). Chame quando a cliente informar o CEP ou antes do checkout.",
  parametros: z.object({ cep: z.string().min(1).describe("CEP de destino, com ou sem hífen, ex.: 01310-100") }),
  executar({ cep }, ctx) {
    const zona = identificarZona(cep);
    if (!zona.ok) return falha(zona.erro, { motivo: "cep_invalido" });

    const pesoCobradoG = pesoCobradoDoCarrinho(ctx);
    if (pesoCobradoG === null) {
      return falha("O carrinho está vazio. Adicione ao menos um produto antes de calcular o frete.", {
        motivo: "carrinho_vazio",
      });
    }

    const limpo = normalizarCep(cep)!; // identificarZona já validou o formato
    ctx.sessao.entrega = { cep: limpo, zona: zona.zona };
    const resumo = montarResumoCarrinho(ctx);
    const opcoes = montarOpcoesFrete(ctx, zona.zona);
    const gatilho = gatilhoFreteGratis(opcoes);
    return {
      ok: true,
      cep: `${limpo.slice(0, 5)}-${limpo.slice(5)}`,
      zona: zona.zona,
      peso_cobrado_g: pesoCobradoG,
      base_produtos: resumo.base_produtos,
      limite_frete_gratis: dinheiro(limiteFreteGratisCentavos(zona.zona)),
      opcoes,
      ...(gatilho ? { gatilho_frete_gratis: gatilho } : {}),
    };
  },
});

export const ferramentasCarrinhoFrete: Ferramenta[] = [
  adicionarAoCarrinho,
  removerDoCarrinho,
  aplicarCupom,
  verCarrinho,
  calcularFrete,
];
