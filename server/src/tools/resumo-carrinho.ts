import { calcularSubtotal, precoVigenteCentavos } from "../domain/carrinho.js";
import { limiteFreteGratisCentavos } from "../domain/frete-gratis.js";
import { reavaliarCupom } from "../domain/cupom.js";
import type { Modalidade } from "../domain/frete.js";
import { calcularPesoCobrado } from "../domain/peso.js";
import { calcularTotais } from "../domain/totais.js";
import { dinheiro, type ContextoFerramenta } from "./base.js";

const NOMES_MODALIDADE: Record<Modalidade, string> = { economica: "Econômica", expressa: "Expressa" };
const MODALIDADES: readonly Modalidade[] = ["economica", "expressa"];

function subtotalDoCarrinho({ catalogo, sessao }: ContextoFerramenta): number {
  return calcularSubtotal(sessao.carrinho, (id) => {
    const p = catalogo.obter(id);
    return p ? catalogo.paraCarrinho(p) : undefined;
  });
}

/** Peso cobrado do carrinho (itens + 200 g de embalagem), ou null se o carrinho está vazio. */
export function pesoCobradoDoCarrinho({ catalogo, sessao }: ContextoFerramenta): number | null {
  if (sessao.carrinho.itens.length === 0) return null;
  return calcularPesoCobrado(
    sessao.carrinho.itens.map((item) => {
      const p = catalogo.obter(item.produtoId);
      if (!p) throw new Error(`Produto não encontrado no catálogo: ${item.produtoId}`);
      return { pesoBrutoG: p.peso_bruto_g, quantidade: item.quantidade };
    }),
  );
}

/**
 * Reavalia o cupom depois de uma mudança no carrinho. Se o subtotal caiu abaixo do mínimo,
 * o cupom é removido da sessão e a função devolve o aviso para a Sofia contar à cliente.
 */
export function sincronizarCupom(ctx: ContextoFerramenta): string | undefined {
  const r = reavaliarCupom(ctx.sessao.cupom, subtotalDoCarrinho(ctx));
  if (!r.perdeuValidade) return undefined;
  ctx.sessao.cupom = null;
  return "O cupom deixou de valer porque o subtotal ficou abaixo do mínimo de R$ 150,00 e foi removido do carrinho. Avise a cliente.";
}

function textoPrazo(min: number, max: number): string {
  return min === max ? `${min} dia(s) úteis` : `${min} a ${max} dias úteis`;
}

/** As duas modalidades de frete para o carrinho atual e a zona dada, com totais no PIX. */
export function montarOpcoesFrete(ctx: ContextoFerramenta, zona: NonNullable<ContextoFerramenta["sessao"]["entrega"]>["zona"]) {
  const pesoCobradoG = pesoCobradoDoCarrinho(ctx);
  if (pesoCobradoG === null) return [];
  const subtotalCentavos = subtotalDoCarrinho(ctx);

  return MODALIDADES.map((modalidade) => {
    const t = calcularTotais({
      subtotalCentavos,
      cupom: ctx.sessao.cupom,
      entrega: { zona, pesoCobradoG, modalidade },
    });
    const frete = t.frete!; // entrega informada: o frete sempre existe
    return {
      modalidade,
      nome: NOMES_MODALIDADE[modalidade],
      frete: dinheiro(frete.valorCentavos),
      frete_gratis: frete.gratis,
      // null na Expressa: ela nunca é grátis. Na Econômica, 0 quando já é grátis.
      falta_para_frete_gratis: frete.faltaParaGratisCentavos === null ? null : dinheiro(frete.faltaParaGratisCentavos),
      prazo: textoPrazo(frete.prazoMinDias, frete.prazoMaxDias),
      desconto_pix: dinheiro(t.descontoPixCentavos),
      total_no_pix: dinheiro(t.totalPixCentavos),
    };
  });
}

/** O carrinho como o modelo vê: itens, subtotal, cupom, base, peso e, com CEP informado, frete e total por modalidade. */
export function montarResumoCarrinho(ctx: ContextoFerramenta) {
  const { catalogo, sessao } = ctx;
  const itens = sessao.carrinho.itens.map((item) => {
    const p = catalogo.obter(item.produtoId);
    if (!p) throw new Error(`Produto não encontrado no catálogo: ${item.produtoId}`);
    const unitario = precoVigenteCentavos(catalogo.paraCarrinho(p));
    return {
      id: p.id,
      nome: p.nome,
      quantidade: item.quantidade,
      preco_unitario: dinheiro(unitario),
      total_do_item: dinheiro(unitario * item.quantidade),
    };
  });

  const subtotalCentavos = subtotalDoCarrinho(ctx);
  const cupom = reavaliarCupom(sessao.cupom, subtotalCentavos);
  const semFrete = calcularTotais({ subtotalCentavos, cupom: sessao.cupom, entrega: null });
  const pesoCobradoG = pesoCobradoDoCarrinho(ctx);

  return {
    itens,
    vazio: itens.length === 0,
    subtotal: dinheiro(subtotalCentavos),
    cupom: cupom.codigo === null ? null : { codigo: cupom.codigo, desconto: dinheiro(cupom.descontoCentavos) },
    base_produtos: dinheiro(semFrete.baseCentavos),
    economia_no_pix: dinheiro(semFrete.descontoPixCentavos),
    peso_cobrado_g: pesoCobradoG,
    ...(sessao.entrega
      ? {
          entrega: {
            cep: sessao.entrega.cep,
            zona: sessao.entrega.zona,
            limite_frete_gratis: dinheiro(limiteFreteGratisCentavos(sessao.entrega.zona)),
            opcoes: montarOpcoesFrete(ctx, sessao.entrega.zona),
          },
        }
      : { entrega: null, frete: "Ainda não calculado: peça o CEP e use calcular_frete." }),
  };
}
