<script lang="ts">
  import { tick } from "svelte";
  import Composer from "./components/Composer.svelte";
  import Digitando from "./components/Digitando.svelte";
  import Mensagem from "./components/Mensagem.svelte";
  import { criarChat } from "./lib/chat.js";

  const chat = criarChat();

  let lista: HTMLElement;
  // Só acompanha o fim da conversa se a cliente não tiver rolado para cima para reler algo.
  let noFim = true;

  function aoRolar() {
    noFim = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
  }

  $effect(() => {
    void $chat.mensagens;
    void $chat.digitando;
    void $chat.podeTentarDeNovo;
    if (noFim) tick().then(() => lista.scrollTo({ top: lista.scrollHeight }));
  });

  function aoEnviar(texto: string) {
    noFim = true; // quem acabou de enviar quer ver a resposta chegando
    void chat.enviar(texto);
  }
</script>

<div class="app">
  <header class="topo">
    <div class="avatar-topo" aria-hidden="true">S</div>
    <div>
      <h1>Sofia</h1>
      <p>Assistente virtual da Prohall · IA</p>
    </div>
  </header>

  <main bind:this={lista} onscroll={aoRolar} class="conversa" role="log" aria-live="polite" aria-label="Conversa com a Sofia">
    {#each $chat.mensagens as mensagem (mensagem.id)}
      <Mensagem {mensagem} />
    {/each}
    {#if $chat.digitando}
      <Digitando />
    {/if}
    {#if $chat.podeTentarDeNovo}
      <div class="linha aviso">
        <button class="tentar" onclick={() => chat.tentarDeNovo()}>Tentar de novo</button>
      </div>
    {/if}
  </main>

  <Composer enviando={$chat.enviando} {aoEnviar} />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 760px;
    margin: 0 auto;
    background: var(--fundo-painel);
    box-shadow: 0 0 0 1px var(--borda);
  }
  .topo {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
    background: var(--marca);
    color: white;
  }
  .avatar-topo {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    font-weight: 700;
    font-size: 1.1rem;
  }
  h1 {
    margin: 0;
    font-size: 1.05rem;
  }
  .topo p {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.85;
  }
  .conversa {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 12px;
    background: var(--fundo);
    overscroll-behavior: contain;
  }
  .tentar {
    padding: 10px 18px;
    min-height: 44px;
    border: 1px solid var(--marca);
    border-radius: 22px;
    background: transparent;
    color: var(--marca);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
