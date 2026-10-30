<script lang="ts">
  import type { ResultadoAcao } from "../lib/carrinho.js";
  import type { CardProduto } from "../lib/tipos.js";

  let {
    produto,
    noCarrinho,
    bloqueado,
    aoAdicionar,
  }: {
    produto: CardProduto;
    /** Unidades deste produto que já estão no carrinho. */
    noCarrinho: number;
    /** A Sofia está respondendo: o servidor recusaria a alteração. */
    bloqueado: boolean;
    aoAdicionar: (id: string) => Promise<ResultadoAcao>;
  } = $props();

  let adicionando = $state(false);
  let erro = $state<string | null>(null);
  let semFoto = $state(false);

  async function adicionar() {
    adicionando = true;
    erro = null;
    const r = await aoAdicionar(produto.id);
    if (!r.ok) erro = r.erro ?? "Não foi possível adicionar.";
    adicionando = false;
  }
</script>

<article class="card">
  <div class="foto">
    {#if semFoto}
      <span class="sem-foto" aria-hidden="true">Prohall</span>
    {:else}
      <img src={produto.imagem_url} alt={produto.nome} loading="lazy" onerror={() => (semFoto = true)} />
    {/if}
    {#if produto.em_promocao}<span class="selo">Promoção</span>{/if}
  </div>
  <div class="corpo">
    <h3 title={produto.nome}>{produto.nome}</h3>
    <p class="preco">
      <strong>{produto.preco.texto}</strong>
      {#if produto.preco_cheio}<s>{produto.preco_cheio.texto}</s>{/if}
    </p>
    {#if produto.estoque_baixo && !produto.esgotado}<p class="estoque">Poucas unidades</p>{/if}
    <button type="button" onclick={adicionar} disabled={adicionando || bloqueado || produto.esgotado}>
      {#if produto.esgotado}Esgotado{:else if adicionando}Adicionando…{:else}Adicionar{/if}
    </button>
    {#if noCarrinho > 0}<p class="no-carrinho">{noCarrinho} no carrinho</p>{/if}
    {#if erro}<p class="erro" role="alert">{erro}</p>{/if}
  </div>
</article>

<style>
  .card {
    flex: none;
    width: 190px;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--borda);
    border-radius: 14px;
    background: var(--fundo-painel);
    overflow: hidden;
    scroll-snap-align: start;
  }
  .foto {
    position: relative;
    aspect-ratio: 1;
    background: var(--fundo);
    display: grid;
    place-items: center;
  }
  .foto img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sem-foto {
    color: var(--texto-suave);
    font-weight: 600;
  }
  .selo {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--marca);
    color: white;
    font-size: 0.7rem;
    font-weight: 600;
  }
  .corpo {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px 12px;
  }
  h3 {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 600;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 3.9em;
  }
  p {
    margin: 0;
  }
  .preco strong {
    font-size: 1.05rem;
  }
  .preco s {
    margin-left: 6px;
    color: var(--texto-suave);
    font-size: 0.8rem;
  }
  .estoque,
  .no-carrinho {
    font-size: 0.75rem;
    color: var(--texto-suave);
  }
  .estoque {
    color: var(--aviso-texto);
  }
  .erro {
    font-size: 0.75rem;
    color: var(--aviso-texto);
  }
  button {
    margin-top: 4px;
    min-height: 40px;
    border: 0;
    border-radius: 20px;
    background: var(--marca);
    color: white;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    background: var(--borda);
    color: var(--texto-suave);
    cursor: not-allowed;
  }
</style>
