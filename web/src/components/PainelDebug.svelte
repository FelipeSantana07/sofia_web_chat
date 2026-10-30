<script lang="ts">
  import type { TurnoDepuracao } from "../lib/chat.js";

  let { turnos, aoFechar }: { turnos: TurnoDepuracao[]; aoFechar: () => void } = $props();

  // Mais recente primeiro: é o que se quer ver enquanto a conversa acontece.
  const recentes = $derived([...turnos].reverse());
  const totalDeChamadas = $derived(turnos.reduce((soma, t) => soma + t.ferramentas.length, 0));

  const json = (valor: unknown) => JSON.stringify(valor, null, 2);

  function aoTeclar(evento: KeyboardEvent) {
    if (evento.key === "Escape") aoFechar();
  }
</script>

<svelte:window onkeydown={aoTeclar} />

<div class="painel" role="dialog" aria-modal="false" aria-label="Painel de debug">
  <header>
    <div>
      <h2>Debug · ferramentas</h2>
      <p>{turnos.length} mensagem(ns) · {totalDeChamadas} chamada(s)</p>
    </div>
    <button type="button" class="fechar" onclick={aoFechar} aria-label="Fechar painel de debug">×</button>
  </header>

  <div class="conteudo">
    {#if recentes.length === 0}
      <p class="vazio">Converse com a Sofia: cada ferramenta que ela chamar aparece aqui, com argumentos e resultado.</p>
    {/if}

    {#each recentes as turno (turno.id)}
      <section class="turno">
        <p class="mensagem"><span>Cliente</span> {turno.mensagem}</p>
        {#if turno.ferramentas.length === 0}
          <p class="nenhuma">Nenhuma ferramenta chamada.</p>
        {:else}
          <ol>
            {#each turno.ferramentas as chamada, i (i)}
              <li>
                <details>
                  <summary>
                    <code class="nome">{chamada.nome}</code>
                    <span class="selo" class:erro={chamada.resultado.ok !== true}>{chamada.resultado.ok === true ? "ok" : "erro"}</span>
                    <span class="duracao">{chamada.duracaoMs} ms</span>
                  </summary>
                  <h3>Argumentos</h3>
                  <pre>{json(chamada.argumentos)}</pre>
                  <h3>Resultado</h3>
                  <pre>{json(chamada.resultado)}</pre>
                </details>
              </li>
            {/each}
          </ol>
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .painel {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 9;
    width: min(460px, 100vw);
    display: flex;
    flex-direction: column;
    background: #1e1a24;
    color: #ece6f2;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.25);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
    border-bottom: 1px solid #3a3242;
  }
  h2 {
    margin: 0;
    font-size: 1rem;
  }
  header p {
    margin: 2px 0 0;
    font-size: 0.75rem;
    color: #a99bb6;
  }
  .fechar {
    width: 44px;
    height: 44px;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 1.8rem;
    cursor: pointer;
  }
  .conteudo {
    flex: 1;
    overflow-y: auto;
    padding: 10px 14px calc(16px + env(safe-area-inset-bottom));
  }
  .vazio,
  .nenhuma {
    margin: 0;
    color: #a99bb6;
    font-size: 0.8rem;
  }
  .vazio {
    padding: 24px 0;
    text-align: center;
  }
  .turno {
    padding: 10px 0;
    border-bottom: 1px solid #3a3242;
  }
  .mensagem {
    margin: 0 0 6px;
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }
  .mensagem span {
    margin-right: 6px;
    padding: 1px 6px;
    border-radius: 6px;
    background: #7b3fa0;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
  }
  ol {
    margin: 0;
    padding-left: 1.4em;
  }
  li {
    margin: 4px 0;
  }
  summary {
    display: flex;
    gap: 8px;
    align-items: center;
    min-height: 32px;
    cursor: pointer;
    list-style-position: outside;
  }
  .nome {
    flex: 1;
    font-size: 0.85rem;
    color: #ffd166;
  }
  .selo {
    padding: 1px 7px;
    border-radius: 8px;
    background: #1f7a3d;
    font-size: 0.7rem;
    font-weight: 700;
  }
  .selo.erro {
    background: #a3271c;
  }
  .duracao {
    font-size: 0.75rem;
    color: #a99bb6;
    font-variant-numeric: tabular-nums;
  }
  h3 {
    margin: 8px 0 4px;
    font-size: 0.72rem;
    font-weight: 600;
    color: #a99bb6;
    text-transform: uppercase;
  }
  pre {
    margin: 0;
    max-height: 260px;
    overflow: auto;
    padding: 8px 10px;
    border-radius: 8px;
    background: #2a2431;
    font: 0.75rem/1.4 ui-monospace, Consolas, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
