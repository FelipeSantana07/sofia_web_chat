import { describe, expect, it } from "vitest";
import { markdownParaHtml } from "./markdown.js";

describe("markdownParaHtml", () => {
  it("texto simples vira parágrafo; quebra de linha vira <br>", () => {
    expect(markdownParaHtml("Oi!")).toBe("<p>Oi!</p>");
    expect(markdownParaHtml("linha 1\nlinha 2")).toBe("<p>linha 1<br>linha 2</p>");
  });

  it("linha em branco separa parágrafos", () => {
    expect(markdownParaHtml("um\n\ndois")).toBe("<p>um</p><p>dois</p>");
  });

  it("negrito, itálico e código", () => {
    expect(markdownParaHtml("**R$ 279,40** e *leve* com `PROHALL10`")).toBe(
      "<p><strong>R$ 279,40</strong> e <em>leve</em> com <code>PROHALL10</code></p>",
    );
  });

  it("listas com marcadores e numeradas", () => {
    expect(markdownParaHtml("- um\n- **dois**")).toBe("<ul><li>um</li><li><strong>dois</strong></li></ul>");
    expect(markdownParaHtml("* a\n* b")).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(markdownParaHtml("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("texto, lista e texto de novo", () => {
    expect(markdownParaHtml("Duas opções:\n- Econômica\n- Expressa\nQual prefere?")).toBe(
      "<p>Duas opções:</p><ul><li>Econômica</li><li>Expressa</li></ul><p>Qual prefere?</p>",
    );
  });

  it("deixa um negrito ainda aberto (stream em andamento) como texto", () => {
    expect(markdownParaHtml("Total: **R$ 27")).toBe("<p>Total: **R$ 27</p>");
  });

  it("escapa HTML, então não executa nada vindo do texto", () => {
    expect(markdownParaHtml('<img src=x onerror="alert(1)"> & <b>oi</b>')).toBe(
      "<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &lt;b&gt;oi&lt;/b&gt;</p>",
    );
    expect(markdownParaHtml("**<script>x</script>**")).not.toContain("<script>");
  });

  it("texto vazio não gera nada", () => {
    expect(markdownParaHtml("")).toBe("");
  });
});
