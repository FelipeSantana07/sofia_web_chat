<script lang="ts">
  import { tick } from "svelte";
  import { get } from "svelte/store";
  import Composer from "./components/Composer.svelte";
  import Digitando from "./components/Digitando.svelte";
  import Mensagem from "./components/Mensagem.svelte";
  import PainelCarrinho from "./components/PainelCarrinho.svelte";
  import PainelDebug from "./components/PainelDebug.svelte";
  import TelaCheckout from "./components/TelaCheckout.svelte";
  import TelaPix from "./components/TelaPix.svelte";
  import { criarCarrinho } from "./lib/carrinho.js";
  import { criarChat } from "./lib/chat.js";
  import { criarPedido } from "./lib/pedido.js";

  // Carrinho e pedido precisam do id da conversa, e o chat avisa os dois do que a Sofia fez: apontam uns para os outros.
  const obterSessaoId = () => get(chat).sessaoId;
  const carrinho = criarCarrinho({ obterSessaoId });
  const pedido = criarPedido({
    obterSessaoId,
    aoMudarCarrinho: () => void carrinho.atualizar(),
    aoPagar: (fala) => chat.anunciar(fala),
  });
  const chat = criarChat({
    aoEvento: (evento) => {
      carrinho.aoEvento(evento);
      pedido.aoEvento(evento);
    },
    aoTerminar: () => void carrinho.atualizar(),
  });

  // Painel de debug: escondido por padrão; abre pelo botão do topo ou já aberto com ?debug na URL (útil para o vídeo).
  let debugAberto = $state(new URLSearchParams(location.search).has("debug"));

  function finalizarCompra() {
    carrinho.fechar();
    pedido.abrirCheckout();
  }

  const quantidadesNoCarrinho = $derived(
    Object.fromEntries(($carrinho.carrinho?.itens ?? []).map((i) => [i.id, i.quantidade])),
  );

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
    <button
      type="button"
      class="botao-debug"
      class:ativo={debugAberto}
      onclick={() => (debugAberto = !debugAberto)}
      aria-label={debugAberto ? "Fechar painel de debug" : "Abrir painel de debug"}
      aria-pressed={debugAberto}
      title="Painel de debug"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="currentColor" d="m8.6 16.6-4.6-4.6 4.6-4.6L7.2 6 1.2 12l6 6 1.4-1.4Zm6.8 0 4.6-4.6-4.6-4.6L16.8 6l6 6-6 6-1.4-1.4Z" />
      </svg>
    </button>
    <button type="button" class="botao-carrinho" onclick={carrinho.abrir} aria-label={`Abrir carrinho, ${$carrinho.quantidade} item(ns)`}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path fill="currentColor" d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM1 2v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7.4l1.1-2h7.5a2 2 0 0 0 1.7-1l3.6-6.5A1 1 0 0 0 20.4 4H5.2l-.9-2H1Z" />
      </svg>
      {#if $carrinho.quantidade > 0}<span class="contador">{$carrinho.quantidade}</span>{/if}
    </button>
  </header>

  {#if $pedido.pedido && $pedido.pedido.status === "aguardando_pagamento" && $pedido.tela === "nenhuma"}
    <div class="faixa-pedido" role="status">
      <span>Pedido <strong>{$pedido.pedido.id}</strong> aguardando pagamento</span>
      <button type="button" onclick={pedido.abrirPix}>{$pedido.pedido.pix ? "Ver PIX" : "Gerar PIX"}</button>
    </div>
  {/if}

  <main bind:this={lista} onscroll={aoRolar} class="conversa" role="log" aria-live="polite" aria-label="Conversa com a Sofia">
    {#each $chat.mensagens as mensagem (mensagem.id)}
      <Mensagem {mensagem} {quantidadesNoCarrinho} bloqueado={$chat.enviando} aoAdicionar={(id) => carrinho.adicionar(id)} />
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

{#if debugAberto}
  <PainelDebug turnos={$chat.depuracao} aoFechar={() => (debugAberto = false)} />
{/if}

<PainelCarrinho estado={$carrinho} controle={carrinho} bloqueado={$chat.enviando} aoFinalizar={finalizarCompra} />

{#if $pedido.tela === "checkout"}
  <TelaCheckout {pedido} estadoPedido={$pedido} {carrinho} estadoCarrinho={$carrinho} />
{:else if $pedido.tela === "pix"}
  <TelaPix {pedido} estado={$pedido} />
{/if}

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
  .topo > div:nth-child(2) {
    flex: 1;
  }
  .botao-debug {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
  }
  .botao-debug.ativo,
  .botao-debug:hover {
    background: rgba(255, 255, 255, 0.18);
    color: white;
  }
  .botao-carrinho {
    position: relative;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);
    color: white;
    cursor: pointer;
  }
  .contador {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: #ffd166;
    color: #3b2400;
    font-size: 0.75rem;
    font-weight: 700;
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
  .faixa-pedido {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
    background: #fff4d6;
    color: #5c4300;
    font-size: 0.85rem;
  }
  .faixa-pedido button {
    min-height: 36px;
    padding: 0 14px;
    border: 1px solid #5c4300;
    border-radius: 18px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
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
