// Conversa com a Sofia no terminal, mostrando as ferramentas chamadas. Uso: pnpm chat
// Também aceita um roteiro por pipe (uma mensagem por linha), útil para testar conversas inteiras.
import { createInterface } from "node:readline";
import type { EventoAgente } from "../src/agent/agente.js";
import { lerConfigGemini, montarSofia } from "../src/agent/montar.js";
import { criarRegistroArquivo } from "../src/agent/registro-log.js";
import { carregarCatalogo } from "../src/catalogo/catalogo.js";
import { criarStoreSessoes } from "../src/sessao/store.js";
import { criarDespachante } from "../src/tools/registro.js";

const interativo = Boolean(process.stdin.isTTY);
const comCor = Boolean(process.stdout.isTTY);
const pintar = (codigo: string) => (texto: string) => (comCor ? `\x1b[${codigo}m${texto}\x1b[0m` : texto);
const cinza = pintar("90");
const rosa = pintar("35");
const vermelho = pintar("31");
const negrito = pintar("1");

const { apiKey, modelo } = lerConfigGemini();
const catalogo = carregarCatalogo();
const agente = montarSofia({ apiKey, modelo, catalogo, registro: criarRegistroArquivo() });
const store = criarStoreSessoes();
const despachante = criarDespachante();
let sessao = store.obterOuCriar();

const resumir = (valor: unknown, max = 160) => {
  const texto = JSON.stringify(valor) ?? "";
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
};

function linhaDaFerramenta(e: Extract<EventoAgente, { tipo: "ferramenta" }>): string {
  const desfecho = e.resultado.ok ? "ok" : vermelho(`erro: ${String(e.resultado.erro)}`);
  return cinza(`  ⚙ ${e.nome}(${resumir(e.argumentos)}) → `) + desfecho + cinza(` · ${e.duracaoMs} ms`);
}

function mostrarCarrinho(): void {
  const r = despachante.executar("ver_carrinho", {}, { catalogo, sessao }) as { carrinho?: Record<string, any> };
  const c = r.carrinho;
  if (!c || c.vazio) return console.log(cinza("  (carrinho vazio)\n"));
  for (const i of c.itens) console.log(cinza(`  ${i.quantidade}x ${i.nome} · ${i.total_do_item.texto}`));
  console.log(cinza(`  subtotal ${c.subtotal.texto} · cupom ${c.cupom ? c.cupom.codigo : "—"} · base ${c.base_produtos.texto}`));
  for (const o of c.entrega?.opcoes ?? []) {
    console.log(cinza(`  ${o.nome}: frete ${o.frete.texto} · ${o.prazo} · total no PIX ${o.total_no_pix.texto}`));
  }
  console.log();
}

console.log(negrito(`Sofia · ${modelo} · ${catalogo.produtos.length} produtos`));
console.log(cinza("Comandos: /carrinho mostra o carrinho · /nova começa outra conversa · /sair encerra\n"));

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: interativo });
rl.setPrompt(rosa("você › "));
const perguntar = () => {
  if (interativo) rl.prompt();
};
perguntar();

for await (const linha of rl) {
  const mensagem = linha.trim();
  if (!interativo && mensagem) console.log(`${rosa("você ›")} ${mensagem}`);

  if (mensagem === "") {
    perguntar();
    continue;
  }
  if (mensagem === "/sair") break;
  if (mensagem === "/nova") {
    sessao = store.obterOuCriar();
    console.log(cinza("  (nova conversa)\n"));
    perguntar();
    continue;
  }
  if (mensagem === "/carrinho") {
    mostrarCarrinho();
    perguntar();
    continue;
  }

  let noMeioDoTexto = false;
  for await (const evento of agente.responder(sessao, mensagem)) {
    if (evento.tipo === "texto") {
      if (!noMeioDoTexto) process.stdout.write(rosa("sofia › "));
      noMeioDoTexto = true;
      process.stdout.write(evento.delta);
    } else if (evento.tipo === "ferramenta") {
      if (noMeioDoTexto) process.stdout.write("\n");
      noMeioDoTexto = false;
      console.log(linhaDaFerramenta(evento));
    } else if (evento.tipo === "erro") {
      if (noMeioDoTexto) process.stdout.write("\n");
      noMeioDoTexto = false;
      console.log(vermelho(`sofia › ${evento.mensagem}`));
    }
  }
  process.stdout.write(noMeioDoTexto ? "\n\n" : "\n");
  perguntar();
}

rl.close();
