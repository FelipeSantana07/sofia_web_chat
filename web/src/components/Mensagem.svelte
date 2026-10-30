<script lang="ts">
  import type { MensagemChat } from "../lib/chat.js";
  import type { ResultadoAcao } from "../lib/carrinho.js";
  import { markdownParaHtml } from "../lib/markdown.js";
  import CardProduto from "./CardProduto.svelte";

  let {
    mensagem,
    quantidadesNoCarrinho,
    bloqueado,
    aoAdicionar,
  }: {
    mensagem: MensagemChat;
    /** Unidades no carrinho por id de produto, para os cards. */
    quantidadesNoCarrinho: Record<string, number>;
    bloqueado: boolean;
    aoAdicionar: (id: string) => Promise<ResultadoAcao>;
  } = $props();
</script>

{#if mensagem.autor === "aviso"}
  <div class="linha aviso" role="alert">
    <div class="bolha-aviso">{mensagem.texto}</div>
  </div>
{:else if mensagem.autor === "cliente"}
  <div class="linha cliente">
    <div class="bolha texto-puro">{mensagem.texto}</div>
  </div>
{:else if mensagem.autor === "cards"}
  <div class="cards" role="list" aria-label="Produtos recomendados">
    {#each mensagem.produtos as produto (produto.id)}
      <div role="listitem">
        <CardProduto {produto} noCarrinho={quantidadesNoCarrinho[produto.id] ?? 0} {bloqueado} {aoAdicionar} />
      </div>
    {/each}
  </div>
{:else}
  <div class="linha sofia">
    <div class="avatar" aria-hidden="true">S</div>
    <div class="bolha conteudo">{@html markdownParaHtml(mensagem.texto)}</div>
  </div>
{/if}

<style>
  .texto-puro {
    white-space: pre-wrap;
  }
  .bolha-aviso {
    margin: 0 auto;
    max-width: 90%;
    padding: 8px 14px;
    border-radius: 12px;
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    font-size: 0.9rem;
    text-align: center;
  }
  .aviso {
    justify-content: center;
  }
  .cards {
    flex: none; /* com overflow o flex encolheria os cards a quase nada */
    display: flex;
    gap: 10px;
    margin-left: 40px; /* alinha com a bolha da Sofia, depois do avatar */
    padding: 2px 2px 6px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }
  .avatar {
    flex: none;
    align-self: flex-end;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--marca);
    color: white;
    font-weight: 700;
  }
  .conteudo :global(p) {
    margin: 0;
  }
  .conteudo :global(p + p),
  .conteudo :global(p + ul),
  .conteudo :global(p + ol),
  .conteudo :global(ul + p),
  .conteudo :global(ol + p) {
    margin-top: 0.6em;
  }
  .conteudo :global(ul),
  .conteudo :global(ol) {
    margin: 0;
    padding-left: 1.3em;
  }
  .conteudo :global(code) {
    padding: 1px 5px;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.07);
    font-size: 0.9em;
    overflow-wrap: anywhere;
  }
</style>
