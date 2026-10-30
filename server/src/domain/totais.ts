// Ordem do cálculo (especificação, 6.1). Tudo em centavos, arredondando a cada etapa.
import type { Zona } from "./cep.js";
import { percentualDe } from "./dinheiro.js";
import { reavaliarCupom, type CupomAplicado } from "./cupom.js";
import { calcularFrete, type Modalidade } from "./frete.js";
import { aplicarFreteGratis, type FreteComRegras } from "./frete-gratis.js";

export const DESCONTO_PIX_PERCENTUAL = 5;

export interface EntregaEscolhida {
  zona: Zona;
  pesoCobradoG: number;
  modalidade: Modalidade;
}

export interface EntradaTotais {
  subtotalCentavos: number;
  /** Cupom aplicado ao carrinho (um por pedido), ou null. */
  cupom: string | null;
  /** null enquanto a cliente não informou o CEP/modalidade: o frete fica fora do total. */
  entrega: EntregaEscolhida | null;
}

export interface Totais {
  subtotalCentavos: number;
  cupom: CupomAplicado;
  baseCentavos: number;
  frete: FreteComRegras | null;
  descontoPixCentavos: number;
  totalPixCentavos: number;
}

export function calcularTotais(entrada: EntradaTotais): Totais {
  const { subtotalCentavos } = entrada;
  if (!Number.isSafeInteger(subtotalCentavos) || subtotalCentavos < 0) {
    throw new RangeError(`Subtotal inválido: ${subtotalCentavos}`);
  }

  // 1–3. subtotal → cupom → base dos produtos
  const cupom = reavaliarCupom(entrada.cupom, subtotalCentavos);
  const baseCentavos = subtotalCentavos - cupom.descontoCentavos;

  // 4. frete calculado com a base (frete grátis só na Econômica)
  const frete = entrada.entrega
    ? aplicarFreteGratis(
        entrada.entrega.zona,
        baseCentavos,
        calcularFrete(entrada.entrega.zona, entrada.entrega.pesoCobradoG, entrada.entrega.modalidade),
      )
    : null;

  // 5–6. desconto PIX só sobre a base (nunca sobre o frete) e total
  const descontoPixCentavos = percentualDe(baseCentavos, DESCONTO_PIX_PERCENTUAL);
  const totalPixCentavos = baseCentavos - descontoPixCentavos + (frete?.valorCentavos ?? 0);

  return { subtotalCentavos, cupom, baseCentavos, frete, descontoPixCentavos, totalPixCentavos };
}
