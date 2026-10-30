// Markdown mínimo para as respostas da Sofia: **negrito**, *itálico*, `código`, listas e parágrafos.
// Escapa o HTML antes de tudo, então o resultado é seguro para {@html}.

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

function emLinha(texto: string): string {
  return texto
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
}

const ITEM_LISTA = /^\s*[-*•]\s+(.*)$/;
const ITEM_NUMERADO = /^\s*\d+[.)]\s+(.*)$/;

export function markdownParaHtml(texto: string): string {
  const linhas = escapar(texto.replace(/\r\n/g, "\n")).split("\n");
  const saida: string[] = [];
  let paragrafo: string[] = [];
  let lista: { tag: "ul" | "ol"; itens: string[] } | null = null;

  const fecharParagrafo = () => {
    if (paragrafo.length > 0) saida.push(`<p>${paragrafo.map(emLinha).join("<br>")}</p>`);
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista) saida.push(`<${lista.tag}>${lista.itens.map((i) => `<li>${emLinha(i)}</li>`).join("")}</${lista.tag}>`);
    lista = null;
  };

  for (const linha of linhas) {
    const item = ITEM_LISTA.exec(linha);
    const numerado = ITEM_NUMERADO.exec(linha);
    const marcador = item ?? numerado;
    if (marcador) {
      const tag = item ? "ul" : "ol";
      fecharParagrafo();
      if (lista && lista.tag !== tag) fecharLista();
      lista ??= { tag, itens: [] };
      lista.itens.push(marcador[1]!);
    } else if (linha.trim() === "") {
      fecharParagrafo();
      fecharLista();
    } else {
      fecharLista();
      paragrafo.push(linha);
    }
  }
  fecharParagrafo();
  fecharLista();
  return saida.join("");
}
