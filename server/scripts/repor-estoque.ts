// Soma unidades ao estoque de teste de todos os produtos, para repor depois de pedidos e facilitar os testes.
// Uso: pnpm estoque:repor [quantidade]   (padrão: 10)
// O estoque fica em data/estoque.json (fora do Git); o servidor no ar enxerga a reposição sem reiniciar.
import { carregarCatalogo } from "../src/catalogo/catalogo.js";
import { CAMINHO_ESTOQUE } from "../src/catalogo/estoque.js";

const QUANTIDADE_PADRAO = 10;

const bruto = process.argv[2];
const quantidade = bruto === undefined ? QUANTIDADE_PADRAO : Number(bruto);
if (!Number.isInteger(quantidade) || quantidade <= 0) {
  console.error(`Informe uma quantidade inteira maior que zero (recebi "${bruto}"). Ex.: pnpm estoque:repor 10`);
  process.exit(1);
}

const catalogo = carregarCatalogo();
const antes = new Map(catalogo.produtos.map((p) => [p.id, p.estoque_teste]));
catalogo.reporEstoque(quantidade);

console.log(`+${quantidade} unidade(s) em cada produto:\n`);
for (const p of catalogo.produtos) {
  console.log(`  ${p.id}  ${String(antes.get(p.id)).padStart(3)} → ${String(p.estoque_teste).padStart(3)}  ${p.nome.slice(0, 60)}`);
}
console.log(`\nEstoque gravado em ${CAMINHO_ESTOQUE}`);
