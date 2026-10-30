// Roda as conversas-teste contra o Gemini real e grava o relatório em docs/conversas-teste.md.
// Uso: pnpm conversas [id...] [--vezes N]   (sem ids, roda todos os roteiros)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { montarSofia } from "../src/agent/montar.js";
import { criarRegistroArquivo } from "../src/agent/registro-log.js";
import { avaliar } from "../src/avaliacao/avaliador.js";
import { gerarRelatorio, type ResultadoRoteiro } from "../src/avaliacao/relatorio.js";
import { ROTEIROS } from "../src/avaliacao/roteiros.js";
import type { Roteiro, TurnoRegistrado } from "../src/avaliacao/tipos.js";
import { carregarCatalogo } from "../src/catalogo/catalogo.js";
import { lerConfigGemini, ouEncerrar } from "../src/config.js";
import { criarStoreSessoes } from "../src/sessao/store.js";
import { criarDespachante } from "../src/tools/registro.js";

const CAMINHO_RELATORIO = fileURLToPath(new URL("../../docs/conversas-teste.md", import.meta.url));

const { apiKey, modelo } = ouEncerrar(() => lerConfigGemini());

const args = process.argv.slice(2);
const iVezes = args.indexOf("--vezes");
const vezes = iVezes >= 0 ? Number(args[iVezes + 1]) : 1;
const ids = args.filter((a, i) => !a.startsWith("--") && i !== iVezes + 1);
if (!Number.isInteger(vezes) || vezes < 1) {
  console.error("Use --vezes com um inteiro maior que zero. Ex.: pnpm conversas --vezes 3");
  process.exit(1);
}
const desconhecidos = ids.filter((id) => !ROTEIROS.some((r) => r.id === id));
if (desconhecidos.length > 0) {
  console.error(`Roteiro(s) desconhecido(s): ${desconhecidos.join(", ")}. Existentes: ${ROTEIROS.map((r) => r.id).join(", ")}`);
  process.exit(1);
}
// Regras que o modelo recebe nas descrições das ferramentas (ex.: mínimo do cupom): citá-las não é inventar valor.
const regrasFixas = criarDespachante().declaracoes.map((d) => d.description ?? "");

const escolhidos = ids.length > 0 ? ROTEIROS.filter((r) => ids.includes(r.id)) : ROTEIROS;

async function rodar(roteiro: Roteiro): Promise<TurnoRegistrado[]> {
  // Catálogo novo e só em memória: cada roteiro parte do estoque inicial e não mexe no data/estoque.json.
  const catalogo = carregarCatalogo(undefined, null);
  const agente = montarSofia({ apiKey, modelo, catalogo, registro: criarRegistroArquivo() });
  const sessao = criarStoreSessoes().obterOuCriar();
  const turnos: TurnoRegistrado[] = [];

  for (const mensagem of roteiro.mensagens) {
    const inicio = Date.now();
    const turno: TurnoRegistrado = { cliente: mensagem, sofia: "", ferramentas: [], duracaoMs: 0 };
    for await (const evento of agente.responder(sessao, mensagem)) {
      if (evento.tipo === "ferramenta") {
        const { nome, argumentos, resultado, duracaoMs } = evento;
        turno.ferramentas.push({ nome, argumentos, resultado, duracaoMs });
      } else if (evento.tipo === "fim") {
        turno.sofia = evento.texto;
      } else if (evento.tipo === "erro") {
        turno.erro = evento.mensagem;
        turno.sofia ||= evento.mensagem;
      }
    }
    turno.duracaoMs = Date.now() - inicio;
    turnos.push(turno);
  }
  return turnos;
}

const resultados: ResultadoRoteiro[] = [];
console.log(`Rodando ${escolhidos.length} roteiro(s) × ${vezes} com ${modelo}…\n`);
for (const roteiro of escolhidos) {
  for (let execucao = 1; execucao <= vezes; execucao++) {
    process.stdout.write(`  ${roteiro.id}${vezes > 1 ? ` (${execucao})` : ""}… `);
    const conversa = { roteiro, turnos: await rodar(roteiro) };
    const verificacoes = avaliar(conversa, regrasFixas);
    const falhas = verificacoes.filter((v) => !v.ok);
    console.log(falhas.length === 0 ? "ok" : `FALHOU: ${falhas.map((v) => v.descricao).join("; ")}`);
    resultados.push({ conversa, verificacoes, execucao });
  }
}

const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
writeFileSync(CAMINHO_RELATORIO, gerarRelatorio({ modelo, quando, resultados }));
const aprovados = resultados.filter((r) => r.verificacoes.every((v) => v.ok)).length;
console.log(`\n${aprovados} de ${resultados.length} ok. Relatório: ${CAMINHO_RELATORIO}`);
