<script lang="ts">
  import type { MensagemChat } from "../lib/chat.js";
  import { markdownParaHtml } from "../lib/markdown.js";

  let { mensagem }: { mensagem: MensagemChat } = $props();
</script>

{#if mensagem.autor === "aviso"}
  <div class="linha aviso" role="alert">
    <div class="bolha-aviso">{mensagem.texto}</div>
  </div>
{:else if mensagem.autor === "cliente"}
  <div class="linha cliente">
    <div class="bolha texto-puro">{mensagem.texto}</div>
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
