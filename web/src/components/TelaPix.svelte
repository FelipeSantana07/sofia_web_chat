<script lang="ts">
  import type { ControlePedido, EstadoPedido } from "../lib/pedido.js";
  import FaixaTeste from "./FaixaTeste.svelte";

  let { pedido, estado }: { pedido: ControlePedido; estado: EstadoPedido } = $props();

  const dados = $derived(estado.pedido);
  const pix = $derived(dados?.pix ?? null);
  const pago = $derived(dados?.status === "pago");

  // Contagem regressiva a partir do instante em que o PIX expira (calculado com o tempo restante que o servidor informou).
  let agora = $state(Date.now());
  $effect(() => {
    const t = setInterval(() => (agora = Date.now()), 1000);
    return () => clearInterval(t);
  });
  const restante = $derived(estado.limiteEm === null ? 0 : Math.max(0, Math.ceil((estado.limiteEm - agora) / 1000)));
  const expirado = $derived(!pago && pix !== null && estado.limiteEm !== null && restante === 0);
  const relogio = $derived(`${String(Math.floor(restante / 60)).padStart(2, "0")}:${String(restante % 60).padStart(2, "0")}`);

  const qrUrl = $derived(estado.qrSvg ? `data:image/svg+xml;utf8,${encodeURIComponent(estado.qrSvg)}` : null);

  let copiado = $state(false);
  let campoCopia: HTMLTextAreaElement | undefined = $state();

  async function copiar() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.copia_e_cola);
    } catch {
      // sem permissão de área de transferência (http, iframe): seleciona o texto e copia à moda antiga
      campoCopia?.select();
      document.execCommand("copy");
    }
    copiado = true;
    setTimeout(() => (copiado = false), 2000);
  }

  function aoTeclar(evento: KeyboardEvent) {
    if (evento.key === "Escape") pedido.fechar();
  }
</script>

<svelte:window onkeydown={aoTeclar} />

<div class="tela" role="dialog" aria-modal="true" aria-label={pago ? "Pagamento confirmado" : "Pagamento com PIX"}>
  <FaixaTeste />
  <header>
    <h2>{pago ? "Pedido pago" : "Pague com PIX"}</h2>
    <button type="button" class="fechar" onclick={pedido.fechar} aria-label="Voltar ao chat">×</button>
  </header>

  {#if dados}
    <div class="corpo">
      <p class="numero">Pedido <strong>{dados.id}</strong></p>

      {#if pago}
        <div class="sucesso" role="status">
          <span class="check" aria-hidden="true">✓</span>
          <h3>Pagamento confirmado</h3>
          <p>Total pago no PIX: <strong>{dados.totais.total_no_pix.texto}</strong></p>
          <p>Entrega {dados.entrega.nome_modalidade} · {dados.entrega.prazo}</p>
          <p class="dica">Simulação: nenhum valor foi cobrado de verdade. A Sofia confirmou o pedido no chat.</p>
          <button type="button" class="primario" onclick={pedido.fechar}>Voltar ao chat</button>
        </div>
      {:else if !pix}
        <div class="bloco">
          <p>O pedido está criado e aguardando o PIX.</p>
          <p class="valor">{dados.totais.total_no_pix.texto}</p>
          <button type="button" class="primario" onclick={pedido.gerarPix} disabled={estado.ocupado}>
            {estado.ocupado ? "Gerando…" : "Gerar PIX"}
          </button>
        </div>
      {:else}
        <div class="bloco">
          <p class="valor">{pix.valor.texto}</p>

          {#if expirado}
            <p class="expirado" role="alert">Este PIX expirou. Gere um novo para pagar.</p>
          {:else}
            <p class="contador">Expira em <strong>{relogio}</strong></p>
          {/if}

          <div class="qr" class:apagado={expirado}>
            {#if qrUrl}
              <img src={qrUrl} alt="QR Code do PIX de teste" width="220" height="220" />
            {:else}
              <span class="dica">Carregando o QR Code…</span>
            {/if}
          </div>
          <p class="dica">QR Code de teste: não é um PIX real e não paga nada.</p>

          <label class="copia">
            Copia e cola
            <textarea bind:this={campoCopia} readonly rows="2" value={pix.copia_e_cola}></textarea>
          </label>
          <button type="button" class="secundario" onclick={copiar} disabled={expirado}>
            {copiado ? "Copiado!" : "Copiar"}
          </button>

          {#if expirado}
            <button type="button" class="primario" onclick={pedido.gerarPix} disabled={estado.ocupado}>
              {estado.ocupado ? "Gerando…" : "Gerar novo PIX"}
            </button>
          {:else}
            <button type="button" class="primario" onclick={pedido.pagar} disabled={estado.ocupado}>
              {estado.ocupado ? "Confirmando…" : "Simular pagamento"}
            </button>
          {/if}
        </div>
      {/if}

      {#if estado.erro}<p class="erro-geral" role="alert">{estado.erro}</p>{/if}

      <details class="detalhes">
        <summary>Resumo do pedido</summary>
        <ul>
          {#each dados.itens as item (item.id)}
            <li><span>{item.quantidade}× {item.nome}</span><span>{item.total_do_item.texto}</span></li>
          {/each}
        </ul>
        <dl>
          <div><dt>Subtotal</dt><dd>{dados.totais.subtotal.texto}</dd></div>
          {#if dados.cupom}<div><dt>Cupom {dados.cupom}</dt><dd>− {dados.totais.desconto_cupom.texto}</dd></div>{/if}
          <div><dt>Desconto PIX</dt><dd>− {dados.totais.desconto_pix.texto}</dd></div>
          <div><dt>Frete {dados.entrega.nome_modalidade}</dt><dd>{dados.totais.frete_gratis ? "Grátis" : dados.totais.frete.texto}</dd></div>
          <div class="total"><dt>Total no PIX</dt><dd>{dados.totais.total_no_pix.texto}</dd></div>
        </dl>
        <p class="dica">{dados.entrega.endereco}, {dados.entrega.numero}{dados.entrega.complemento ? ` — ${dados.entrega.complemento}` : ""} · CEP {dados.entrega.cep}</p>
      </details>
    </div>
  {/if}
</div>

<style>
  .tela {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    background: var(--fundo);
    overflow-y: auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 480px;
    width: 100%;
    margin: 0 auto;
    padding: 8px 16px;
  }
  h2,
  h3 {
    margin: 0;
  }
  h2 {
    font-size: 1.2rem;
  }
  .fechar {
    width: 44px;
    height: 44px;
    border: 0;
    background: transparent;
    font-size: 1.8rem;
    cursor: pointer;
    color: inherit;
  }
  .corpo {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    padding: 0 16px calc(24px + env(safe-area-inset-bottom));
  }
  .numero {
    margin: 0;
    color: var(--texto-suave);
  }
  .bloco,
  .sucesso,
  .detalhes {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 18px 16px;
    border: 1px solid var(--borda);
    border-radius: 14px;
    background: var(--fundo-painel);
    text-align: center;
  }
  .bloco p,
  .sucesso p {
    margin: 0;
  }
  .valor {
    font-size: 1.8rem;
    font-weight: 800;
  }
  .contador {
    color: var(--texto-suave);
  }
  .contador strong {
    color: var(--texto);
    font-variant-numeric: tabular-nums;
  }
  .expirado {
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    font-weight: 600;
  }
  .qr {
    padding: 10px;
    border: 1px solid var(--borda);
    border-radius: 12px;
    background: white;
  }
  .qr img {
    display: block;
    max-width: 100%;
    height: auto;
  }
  .qr.apagado {
    opacity: 0.3;
  }
  .dica {
    margin: 0;
    color: var(--texto-suave);
    font-size: 0.8rem;
  }
  .copia {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    font-size: 0.85rem;
    font-weight: 600;
    text-align: left;
  }
  textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px dashed var(--marca);
    border-radius: 10px;
    background: var(--fundo);
    font: 0.85rem ui-monospace, Consolas, monospace;
    color: inherit;
    resize: none;
    overflow-wrap: anywhere;
  }
  .primario,
  .secundario {
    width: 100%;
    min-height: 48px;
    border-radius: 24px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .primario {
    border: 0;
    background: var(--marca);
    color: white;
  }
  .secundario {
    border: 1px solid var(--marca);
    background: transparent;
    color: var(--marca);
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .check {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #1f7a3d;
    color: white;
    font-size: 1.8rem;
  }
  .erro-geral {
    margin: 0;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    font-size: 0.85rem;
  }
  .detalhes {
    align-items: stretch;
    text-align: left;
    padding: 12px 16px;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
  }
  ul {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  li,
  dl div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 3px 0;
    font-size: 0.88rem;
  }
  dl {
    margin: 8px 0;
    border-top: 1px solid var(--borda);
    padding-top: 6px;
  }
  dt,
  dd {
    margin: 0;
  }
  .total {
    font-weight: 700;
  }
</style>
