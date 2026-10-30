<script lang="ts">
  import type { ControleCarrinho, EstadoCarrinho } from "../lib/carrinho.js";

  let {
    estado,
    controle,
    bloqueado,
  }: {
    estado: EstadoCarrinho;
    controle: ControleCarrinho;
    /** A Sofia está respondendo: o servidor recusaria a alteração. */
    bloqueado: boolean;
  } = $props();

  const carrinho = $derived(estado.carrinho);
  const economica = $derived(carrinho?.entrega?.opcoes.find((o) => o.modalidade === "economica"));
  const faltaParaGratis = $derived(economica && !economica.frete_gratis ? economica.falta_para_frete_gratis : null);
  const desabilitado = $derived(estado.ocupado || bloqueado);

  function aoTeclar(evento: KeyboardEvent) {
    if (evento.key === "Escape") controle.fechar();
  }
</script>

<svelte:window onkeydown={estado.aberto ? aoTeclar : null} />

{#if estado.aberto}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="fundo" onclick={controle.fechar}></div>
  <div class="painel" role="dialog" aria-modal="true" aria-label="Seu carrinho">
    <header>
      <h2>Seu carrinho</h2>
      <button type="button" class="fechar" onclick={controle.fechar} aria-label="Fechar carrinho">×</button>
    </header>

    <div class="conteudo">
      {#if !carrinho || carrinho.vazio}
        <p class="vazio">Seu carrinho está vazio. Peça uma recomendação à Sofia e toque em "Adicionar".</p>
      {:else}
        <ul class="itens">
          {#each carrinho.itens as item (item.id)}
            <li>
              <div class="item-topo">
                <span class="nome">{item.nome}</span>
                <button type="button" class="remover" onclick={() => controle.remover(item.id)} disabled={desabilitado} aria-label={`Remover ${item.nome}`}>
                  Remover
                </button>
              </div>
              <div class="item-base">
                <div class="quantidade" role="group" aria-label={`Quantidade de ${item.nome}`}>
                  <button type="button" onclick={() => controle.remover(item.id, 1)} disabled={desabilitado} aria-label="Diminuir">−</button>
                  <span aria-live="polite">{item.quantidade}</span>
                  <button type="button" onclick={() => controle.adicionar(item.id)} disabled={desabilitado} aria-label="Aumentar">+</button>
                </div>
                <span class="unitario">{item.preco_unitario.texto} cada</span>
                <strong>{item.total_do_item.texto}</strong>
              </div>
            </li>
          {/each}
        </ul>

        <dl class="totais">
          <div><dt>Subtotal</dt><dd>{carrinho.subtotal.texto}</dd></div>
          {#if carrinho.cupom}
            <div class="desconto"><dt>Cupom {carrinho.cupom.codigo}</dt><dd>− {carrinho.cupom.desconto.texto}</dd></div>
          {/if}
          <div><dt>Produtos com desconto</dt><dd>{carrinho.base_produtos.texto}</dd></div>
          <div class="desconto"><dt>Economia pagando no PIX (5%)</dt><dd>{carrinho.economia_no_pix.texto}</dd></div>
        </dl>

        <section class="frete" aria-label="Frete">
          <h3>Frete</h3>
          {#if carrinho.entrega}
            <p class="cep">CEP {carrinho.entrega.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}</p>
            <ul>
              {#each carrinho.entrega.opcoes as opcao (opcao.modalidade)}
                <li>
                  <span>{opcao.nome} · {opcao.prazo}</span>
                  <span>{opcao.frete_gratis ? "Grátis" : opcao.frete.texto}</span>
                  <small>Total no PIX: {opcao.total_no_pix.texto}</small>
                </li>
              {/each}
            </ul>
            {#if faltaParaGratis}
              <p class="dica">Faltam {faltaParaGratis.texto} para o frete grátis na Econômica.</p>
            {/if}
          {:else}
            <p class="dica">Informe o CEP à Sofia para calcular o frete.</p>
          {/if}
        </section>
      {/if}

      {#if estado.erro}<p class="erro" role="alert">{estado.erro}</p>{/if}
      {#if bloqueado}<p class="dica">A Sofia está respondendo; aguarde para alterar o carrinho.</p>{/if}
    </div>
  </div>
{/if}

<style>
  .fundo {
    position: fixed;
    inset: 0;
    background: rgba(30, 20, 40, 0.45);
    z-index: 10;
  }
  .painel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 11;
    width: min(420px, 100vw);
    display: flex;
    flex-direction: column;
    background: var(--fundo-painel);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
    border-bottom: 1px solid var(--borda);
  }
  h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 0.95rem;
  }
  .fechar {
    width: 44px;
    height: 44px;
    border: 0;
    background: transparent;
    font-size: 1.8rem;
    line-height: 1;
    cursor: pointer;
    color: inherit;
  }
  .conteudo {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .itens > li {
    padding: 12px 0;
    border-bottom: 1px solid var(--borda);
  }
  .item-topo,
  .item-base {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .nome {
    font-size: 0.9rem;
    font-weight: 600;
  }
  .remover {
    flex: none;
    min-height: 36px;
    padding: 0 6px;
    border: 0;
    background: transparent;
    color: var(--aviso-texto);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .item-base {
    margin-top: 8px;
  }
  .unitario {
    flex: 1;
    color: var(--texto-suave);
    font-size: 0.8rem;
  }
  .quantidade {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--borda);
    border-radius: 20px;
  }
  .quantidade button {
    width: 40px;
    height: 40px;
    border: 0;
    background: transparent;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--marca);
  }
  .quantidade span {
    min-width: 24px;
    text-align: center;
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .totais {
    margin: 12px 0;
  }
  .totais div {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 0.9rem;
  }
  .totais dt,
  .totais dd {
    margin: 0;
  }
  .desconto dd {
    color: #1f7a3d;
  }
  .frete {
    padding: 12px;
    border-radius: 12px;
    background: var(--fundo);
  }
  .frete li {
    display: grid;
    grid-template-columns: 1fr auto;
    padding: 6px 0;
    font-size: 0.9rem;
  }
  .frete small {
    grid-column: 1 / -1;
    color: var(--texto-suave);
  }
  .cep,
  .dica,
  .vazio {
    margin: 0 0 6px;
    color: var(--texto-suave);
    font-size: 0.85rem;
  }
  .vazio {
    padding: 24px 0;
    text-align: center;
  }
  .erro {
    margin: 10px 0 0;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    font-size: 0.85rem;
  }
</style>
