import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validarCatalogo, verificarVariedade } from "@sofia/shared";

// Uso: pnpm validate:catalogo [caminho]  (padrão: data/produtos.json na raiz do repositório)
const padrao = fileURLToPath(new URL("../../data/produtos.json", import.meta.url));
const arquivo = process.argv[2] ?? padrao;

let texto: string;
try {
  texto = readFileSync(arquivo, "utf8");
} catch {
  console.error(`Não consegui ler o catálogo em ${arquivo}. O arquivo existe?`);
  process.exit(1);
}

let dados: unknown;
try {
  dados = JSON.parse(texto);
} catch (erro) {
  console.error(`JSON inválido em ${arquivo}: ${erro instanceof Error ? erro.message : erro}`);
  process.exit(1);
}

const resultado = validarCatalogo(dados);
if (!resultado.ok) {
  console.error(`Catálogo inválido (${resultado.erros.length} erro(s)):`);
  for (const erro of resultado.erros) console.error(`  - ${erro}`);
  process.exit(1);
}

console.log(`Catálogo válido: ${resultado.produtos.length} produto(s) em ${arquivo}.`);

const variedade = verificarVariedade(resultado.produtos);
console.log("Variedade mínima (Parte 1):");
for (const m of variedade) {
  console.log(`  ${m.ok ? "ok  " : "FALTA"} ${m.descricao}: ${m.atual} (mínimo ${m.minimo})`);
}
if (variedade.some((m) => !m.ok)) process.exit(1);
