import type { Pedido } from "@sofia/shared";
import { describe, expect, it } from "vitest";
import { formatarConversaExportada, type DadosExportacao } from "./exportar.js";
import { PERFIS } from "./perfis.js";
import { ROTEIROS } from "./roteiros.js";

const pedido: Pedido = {
  id: "PH-TESTE-000001",
  status: "pago",
  criadoEm: 1000,
  pagoEm: 2000,
  cliente: { nome: "Ana Souza", email: "ana@exemplo.com" },
  entrega: { cep: "01310100", endereco: "Av. Paulista", numero: "1000", complemento: "apto 12", zona: "Z1", modalidade: "economica", prazoMinDias: 3, prazoMaxDias: 5 },
  itens: [{ produtoId: "PH-001", nome: "Tônico Force Hair", quantidade: 1, precoUnitarioCentavos: 2490, totalCentavos: 2490 }],
  cupom: null,
  totais: { subtotalCentavos: 2490, descontoCupomCentavos: 0, baseCentavos: 2490, freteCentavos: 1590, freteGratis: false, descontoPixCentavos: 125, totalPixCentavos: 3955 },
  pix: { texto: "PIX-TESTE|PROHALL|PH-TESTE-000001|39.55|NAO-PAGAVEL", valorCentavos: 3955, geradoEm: 1500, expiraEm: 901500 },
};

function dados(extra: Partial<DadosExportacao> = {}): DadosExportacao {
  return {
    numero: 1,
    perfil: PERFIS[0]!,
    turnos: [
      {
        cliente: "Oi! Quero algo para queda.",
        sofia: "Oi, Ana!\n\nIndico o tônico.",
        ferramentas: [
          { nome: "buscar_produtos", argumentos: {}, resultado: { ok: true }, duracaoMs: 3 },
          { nome: "mostrar_produtos", argumentos: {}, resultado: { ok: true }, duracaoMs: 1 },
        ],
        primeiroTextoMs: 1000,
        duracaoMs: 2000,
      },
    ],
    pedido,
    confirmacaoDoPagamento: "Pagamento confirmado, Ana!",
    verificacoes: [{ descricao: "a venda chegou ao pedido pago", ok: true }],
    modelo: "gemini-teste",
    configuracao: "temperatura 0.3, pensamento LOW",
    quando: "30/10/2026 10:00",
    tentativa: 2,
    ...extra,
  };
}

describe("formatarConversaExportada", () => {
  const md = formatarConversaExportada(dados());

  it("traz título, perfil, resultado do pedido e a origem da conversa", () => {
    expect(md).toContain("# Conversa 1 · Ana — fios finos, sem volume e com queda (uso em casa)");
    expect(md).toContain("**Resultado:** pedido PH-TESTE-000001 pago · total no PIX R$ 39,55 · entrega Econômica (3 a 5 dias úteis)");
    expect(md).toContain("com o Gemini real (gemini-teste: temperatura 0.3, pensamento LOW). Tentativa 2; as falas da Sofia não foram editadas.");
  });

  it("mostra as falas na ordem, com as ferramentas de cada resposta", () => {
    expect(md).toContain("**Cliente:** Oi! Quero algo para queda.\n\n**Sofia:**\n\n> Oi, Ana!\n>\n> Indico o tônico.");
    expect(md).toContain("_Ferramentas: `buscar_produtos` → `mostrar_produtos`_");
  });

  it("termina com o pagamento simulado e a confirmação da Sofia", () => {
    expect(md).toContain('**Cliente:** _(toca em "Simular pagamento" na tela do PIX)_');
    expect(md).toContain("> Pagamento confirmado, Ana!");
  });

  it("resume o pedido e o PIX falso, sem nenhuma chave", () => {
    expect(md).toContain("- 1× Tônico Force Hair — R$ 24,90");
    expect(md).toContain("- **Total no PIX: R$ 39,55**");
    expect(md).toContain("`PIX-TESTE|PROHALL|PH-TESTE-000001|39.55|NAO-PAGAVEL`");
    expect(md).not.toMatch(/GEMINI_API_KEY|AIza/);
  });

  it("lista as ferramentas usadas e as verificações", () => {
    expect(md).toContain("## Ferramentas usadas\n\n`buscar_produtos`, `mostrar_produtos`");
    expect(md).toContain("- ✅ a venda chegou ao pedido pago");
  });

  it("avisa quando a conversa não fechou pedido ou tem verificação falhando", () => {
    const sem = formatarConversaExportada(dados({ pedido: null, confirmacaoDoPagamento: null, verificacoes: [{ descricao: "x", ok: false, detalhe: "faltou" }] }));
    expect(sem).toContain("**Resultado:** a conversa não chegou a fechar um pedido");
    expect(sem).not.toContain("Simular pagamento");
    expect(sem).toContain("- ❌ x — faltou");
    expect(sem).toContain("não deve ser usada como evidência");
  });
});

describe("perfis", () => {
  it("são 3, com ids e arquivos únicos e roteiro de venda até o PIX", () => {
    expect(PERFIS).toHaveLength(3);
    expect(new Set(PERFIS.map((p) => p.id)).size).toBe(3);
    expect(new Set(PERFIS.map((p) => p.arquivo)).size).toBe(3);
    for (const p of PERFIS) {
      expect(p.mensagens.length).toBeGreaterThanOrEqual(5);
      expect(p.espera.chama).toEqual(expect.arrayContaining(["finalizar_pedido", "gerar_pix"]));
      expect(p.mostra.length).toBeGreaterThan(0);
    }
  });

  it("não repetem os ids dos roteiros de limites", () => {
    const ids = new Set(ROTEIROS.map((r) => r.id));
    expect(PERFIS.filter((p) => ids.has(p.id))).toEqual([]);
  });
});
