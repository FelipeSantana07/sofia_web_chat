// Roda os 3 perfis de cliente (vendas completas) contra o Gemini real, simula o pagamento e exporta cada conversa
// em docs/conversas/. Uso: pnpm conversas:exportar [ana|carla|juliana ...] [--tentativas N]
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { avaliar } from "../src/avaliacao/avaliador.js";
import { executarRoteiro } from "../src/avaliacao/executar.js";
import { formatarConversaExportada } from "../src/avaliacao/exportar.js";
import { PERFIS } from "../src/avaliacao/perfis.js";
import type { Verificacao } from "../src/avaliacao/tipos.js";
import { descreverAjustes, lerConfigGemini, ouEncerrar } from "../src/config.js";
import { pagarPedido } from "../src/pedidos/servico.js";
import { criarDespachante } from "../src/tools/registro.js";

const PASTA = fileURLToPath(new URL("../../docs/conversas/", import.meta.url));

const config = ouEncerrar(() => lerConfigGemini());
const args = process.argv.slice(2);
const iTentativas = args.indexOf("--tentativas");
const maxTentativas = iTentativas >= 0 ? Number(args[iTentativas + 1]) : 3;
const ids = args.filter((a, i) => !a.startsWith("--") && (iTentativas < 0 || i !== iTentativas + 1));
if (!Number.isInteger(maxTentativas) || maxTentativas < 1) {
  console.error("Use --tentativas com um inteiro maior que zero. Ex.: pnpm conversas:exportar --tentativas 3");
  process.exit(1);
}
const desconhecidos = ids.filter((id) => !PERFIS.some((p) => p.id === id));
if (desconhecidos.length > 0) {
  console.error(`Perfil(is) desconhecido(s): ${desconhecidos.join(", ")}. Existentes: ${PERFIS.map((p) => p.id).join(", ")}`);
  process.exit(1);
}
const escolhidos = ids.length > 0 ? PERFIS.filter((p) => ids.includes(p.id)) : PERFIS;
const regrasFixas = criarDespachante().declaracoes.map((d) => d.description ?? "");

mkdirSync(PASTA, { recursive: true });
console.log(`Exportando ${escolhidos.length} perfil(is) com ${config.modelo} (${descreverAjustes(config)})…\n`);

for (const perfil of escolhidos) {
  const numero = PERFIS.indexOf(perfil) + 1;
  let melhor: { texto: string; falhas: Verificacao[]; tentativa: number } | null = null;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    process.stdout.write(`  ${perfil.id} (tentativa ${tentativa})… `);
    const { turnos, catalogo, sessao } = await executarRoteiro(config, perfil);
    const pedido = sessao.pedidos.at(-1) ?? null;

    // O pagamento é feito pela cliente na tela ("Simular pagamento"); aqui o roteiro faz o mesmo pela mesma regra.
    let confirmacao: string | null = null;
    if (pedido?.pix) {
      const pago = pagarPedido({ catalogo, sessao }, pedido.id, Date.now());
      if (pago.ok) confirmacao = pago.mensagem;
    }

    const conversa = {
      roteiro: { id: perfil.id, titulo: perfil.titulo, objetivo: perfil.descricao, mensagens: perfil.mensagens, espera: perfil.espera },
      turnos,
    };
    const verificacoes: Verificacao[] = [
      ...avaliar(conversa, regrasFixas),
      {
        descricao: "a venda chegou ao pedido pago",
        ok: pedido?.status === "pago",
        ...(pedido?.status === "pago" ? {} : { detalhe: pedido ? `pedido ${pedido.id} ficou ${pedido.status}` : "nenhum pedido foi criado" }),
      },
    ];
    const falhas = verificacoes.filter((v) => !v.ok);
    console.log(falhas.length === 0 ? "ok" : `falhou: ${falhas.map((v) => v.descricao).join("; ")}`);

    const texto = formatarConversaExportada({
      numero,
      perfil,
      turnos,
      pedido,
      confirmacaoDoPagamento: confirmacao,
      verificacoes,
      modelo: config.modelo,
      configuracao: descreverAjustes(config),
      quando: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      tentativa,
    });
    if (!melhor || falhas.length < melhor.falhas.length) melhor = { texto, falhas, tentativa };
    if (falhas.length === 0) break;
  }

  writeFileSync(`${PASTA}${perfil.arquivo}`, melhor!.texto);
  console.log(`  → docs/conversas/${perfil.arquivo}${melhor!.falhas.length ? " (COM FALHAS)" : ""}\n`);
}
