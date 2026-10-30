<script lang="ts">
  import type { ControleCarrinho, EstadoCarrinho } from "../lib/carrinho.js";
  import type { ControlePedido, EstadoPedido } from "../lib/pedido.js";
  import FaixaTeste from "./FaixaTeste.svelte";

  let {
    pedido,
    estadoPedido,
    carrinho,
    estadoCarrinho,
  }: {
    pedido: ControlePedido;
    estadoPedido: EstadoPedido;
    carrinho: ControleCarrinho;
    estadoCarrinho: EstadoCarrinho;
  } = $props();

  const formatarCep = (cep: string) => cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");

  let nome = $state("");
  let email = $state("");
  // Só o valor inicial importa: o campo parte do CEP que a Sofia já usou, e depois é da cliente.
  // svelte-ignore state_referenced_locally
  let cep = $state(formatarCep(estadoCarrinho.carrinho?.entrega?.cep ?? ""));
  let endereco = $state("");
  let numero = $state("");
  let complemento = $state("");
  let modalidade = $state<"economica" | "expressa">("economica");
  let erroDoCep = $state<string | null>(null);

  // Cupom: a cliente digita aqui ou a Sofia aplica na conversa, e o campo já aparece preenchido.
  const cupomAplicado = $derived(estadoCarrinho.carrinho?.cupom?.codigo ?? null);
  // svelte-ignore state_referenced_locally
  let codigoCupom = $state(estadoCarrinho.carrinho?.cupom?.codigo ?? "");
  let erroDoCupom = $state<string | null>(null);
  let aplicandoCupom = $state(false);
  $effect(() => {
    if (cupomAplicado) {
      codigoCupom = cupomAplicado;
      erroDoCupom = null;
    }
  });

  async function aplicarCupom(evento: SubmitEvent) {
    evento.preventDefault();
    if (cupomAplicado || !codigoCupom.trim() || aplicandoCupom) return;
    aplicandoCupom = true;
    const r = await carrinho.aplicarCupom(codigoCupom);
    erroDoCupom = r.ok ? null : (r.erro ?? "Não foi possível aplicar o cupom.");
    aplicandoCupom = false;
  }

  const itens = $derived(estadoCarrinho.carrinho?.itens ?? []);
  const cepLimpo = $derived(cep.replace(/\D/g, ""));
  // As opções de frete só valem se foram calculadas para o CEP que está no campo.
  const opcoes = $derived(estadoCarrinho.carrinho?.entrega?.cep === cepLimpo ? (estadoCarrinho.carrinho?.entrega?.opcoes ?? []) : []);
  const opcao = $derived(opcoes.find((o) => o.modalidade === modalidade));
  const podeEnviar = $derived(!estadoPedido.ocupado && itens.length > 0 && opcao !== undefined);

  let ultimaConsulta = "";
  $effect(() => {
    if (cepLimpo.length !== 8 || cepLimpo === ultimaConsulta) return;
    ultimaConsulta = cepLimpo;
    const alvo = cepLimpo;
    erroDoCep = null;
    void pedido.consultarFrete(alvo).then((r) => {
      if (!r.ok && cepLimpo === alvo) erroDoCep = r.erro ?? "Não foi possível calcular o frete.";
    });
  });

  async function enviar(evento: SubmitEvent) {
    evento.preventDefault();
    if (!podeEnviar) return;
    await pedido.finalizar({ nome, email, cep, endereco, numero, complemento, modalidade_frete: modalidade });
  }

  function aoTeclar(evento: KeyboardEvent) {
    if (evento.key === "Escape") pedido.fechar();
  }

  const problema = (campo: string) => estadoPedido.camposComErro[campo];
</script>

<svelte:window onkeydown={aoTeclar} />

<div class="tela" role="dialog" aria-modal="true" aria-label="Finalizar compra">
  <FaixaTeste />
  <header>
    <h2>Finalizar compra</h2>
    <button type="button" class="fechar" onclick={pedido.fechar} aria-label="Voltar ao chat">×</button>
  </header>

  <div class="corpo">
    <section class="resumo" aria-label="Resumo do pedido">
      <h3>Resumo</h3>
      <ul>
        {#each itens as item (item.id)}
          <li><span>{item.quantidade}× {item.nome}</span><span>{item.total_do_item.texto}</span></li>
        {/each}
      </ul>
      <form class="cupom" onsubmit={aplicarCupom} novalidate>
        <label for="cupom">Cupom de desconto</label>
        <div class="linha-cupom">
          <input
            id="cupom"
            bind:value={codigoCupom}
            readonly={cupomAplicado !== null}
            placeholder="Digite o código"
            autocomplete="off"
            autocapitalize="characters"
            aria-invalid={erroDoCupom ? "true" : undefined}
          />
          <button type="submit" disabled={cupomAplicado !== null || !codigoCupom.trim() || aplicandoCupom}>
            {cupomAplicado ? "Aplicado ✓" : aplicandoCupom ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
        {#if erroDoCupom}<small class="erro" role="alert">{erroDoCupom}</small>{/if}
      </form>

      {#if estadoCarrinho.carrinho}
        {@const c = estadoCarrinho.carrinho}
        <dl>
          <div><dt>Subtotal</dt><dd>{c.subtotal.texto}</dd></div>
          {#if c.cupom}<div class="desconto"><dt>Cupom {c.cupom.codigo}</dt><dd>− {c.cupom.desconto.texto}</dd></div>{/if}
          <div class="desconto"><dt>Desconto PIX (5%)</dt><dd>− {(opcao?.desconto_pix ?? c.economia_no_pix).texto}</dd></div>
          <div>
            <dt>Frete{opcao ? ` ${opcao.nome}` : ""}</dt>
            <dd>{opcao ? (opcao.frete_gratis ? "Grátis" : opcao.frete.texto) : "informe o CEP"}</dd>
          </div>
          <div class="total"><dt>Total no PIX</dt><dd>{opcao ? opcao.total_no_pix.texto : "—"}</dd></div>
        </dl>
      {/if}
    </section>

    <form onsubmit={enviar} novalidate>
      <p class="aviso-ficticio">Use dados fictícios: este é um teste e nada é cobrado nem guardado de verdade.</p>

      <label>Nome
        <input bind:value={nome} autocomplete="off" required maxlength="100" aria-invalid={problema("nome") ? "true" : undefined} />
        {#if problema("nome")}<small class="erro">{problema("nome")}</small>{/if}
      </label>

      <label>E-mail
        <input bind:value={email} type="email" autocomplete="off" required maxlength="120" aria-invalid={problema("email") ? "true" : undefined} />
        {#if problema("email")}<small class="erro">{problema("email")}</small>{/if}
      </label>

      <label>CEP
        <input bind:value={cep} inputmode="numeric" autocomplete="off" placeholder="00000-000" maxlength="9" required aria-invalid={problema("cep") || erroDoCep ? "true" : undefined} />
        {#if erroDoCep}<small class="erro">{erroDoCep}</small>{:else if problema("cep")}<small class="erro">{problema("cep")}</small>{/if}
      </label>

      <label>Endereço
        <input bind:value={endereco} autocomplete="off" required maxlength="150" aria-invalid={problema("endereco") ? "true" : undefined} />
        {#if problema("endereco")}<small class="erro">{problema("endereco")}</small>{/if}
      </label>

      <div class="duas">
        <label>Número
          <input bind:value={numero} autocomplete="off" required maxlength="20" aria-invalid={problema("numero") ? "true" : undefined} />
          {#if problema("numero")}<small class="erro">{problema("numero")}</small>{/if}
        </label>
        <label>Complemento
          <input bind:value={complemento} autocomplete="off" maxlength="80" placeholder="opcional" />
        </label>
      </div>

      <fieldset>
        <legend>Entrega</legend>
        {#if opcoes.length === 0}
          <p class="dica">Informe o CEP para ver as opções de frete.</p>
        {:else}
          {#each opcoes as o (o.modalidade)}
            <label class="opcao" class:marcada={modalidade === o.modalidade}>
              <input type="radio" name="modalidade" value={o.modalidade} bind:group={modalidade} />
              <span><strong>{o.nome}</strong> · {o.prazo}</span>
              <span>{o.frete_gratis ? "Grátis" : o.frete.texto}</span>
            </label>
          {/each}
        {/if}
      </fieldset>

      {#if estadoPedido.erro}<p class="erro-geral" role="alert">{estadoPedido.erro}</p>{/if}

      <button type="submit" class="enviar" disabled={!podeEnviar}>
        {estadoPedido.ocupado ? "Fechando o pedido…" : "Pagar com PIX"}
      </button>
    </form>
  </div>
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
    max-width: 760px;
    width: 100%;
    margin: 0 auto;
    padding: 8px 16px;
  }
  h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 1rem;
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
    display: grid;
    grid-template-columns: minmax(0, 1fr); /* sem isso o conteúdo largo estica a coluna além da tela */
    gap: 16px;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 0 16px calc(24px + env(safe-area-inset-bottom));
  }
  @media (min-width: 760px) {
    .corpo {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .resumo,
  form {
    padding: 16px;
    border: 1px solid var(--borda);
    border-radius: 14px;
    background: var(--fundo-painel);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .resumo li span:last-child,
  dd {
    white-space: nowrap;
  }
  .resumo li,
  dl div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 0;
    font-size: 0.9rem;
  }
  .cupom {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 12px;
    padding: 0;
    border: 0;
  }
  .cupom label {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .linha-cupom {
    display: flex;
    gap: 8px;
  }
  .linha-cupom input {
    flex: 1;
    min-width: 0;
    text-transform: uppercase;
  }
  .linha-cupom input[readonly] {
    background: #eaf6ee;
    border-color: #1f7a3d;
  }
  .linha-cupom button {
    flex: none;
    min-width: 92px;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--marca);
    border-radius: 10px;
    background: transparent;
    color: var(--marca);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .linha-cupom button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  dl {
    margin: 10px 0 0;
    padding-top: 8px;
    border-top: 1px solid var(--borda);
  }
  dt,
  dd {
    margin: 0;
  }
  .desconto dd {
    color: #1f7a3d;
  }
  .total {
    margin-top: 4px;
    padding-top: 8px !important;
    border-top: 1px solid var(--borda);
    font-size: 1.05rem !important;
    font-weight: 700;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .aviso-ficticio {
    margin: 0;
    padding: 8px 12px;
    border-radius: 10px;
    background: #fff4d6;
    color: #5c4300;
    font-size: 0.85rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
    font-weight: 600;
  }
  input:not([type="radio"]) {
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--borda);
    border-radius: 10px;
    font: inherit;
    font-size: 16px; /* evita o zoom do iOS */
    font-weight: 400;
    color: inherit;
    background: var(--fundo-painel);
  }
  input[aria-invalid="true"] {
    border-color: var(--aviso-texto);
  }
  .duas {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: 12px;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  legend {
    padding: 0;
    margin-bottom: 6px;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .opcao {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 8px 12px;
    border: 1px solid var(--borda);
    border-radius: 10px;
    font-weight: 400;
    cursor: pointer;
  }
  .opcao span:nth-of-type(1) {
    flex: 1;
  }
  .opcao.marcada {
    border-color: var(--marca);
    background: #f3eaf8;
  }
  .dica {
    margin: 0;
    color: var(--texto-suave);
    font-size: 0.85rem;
  }
  .erro,
  .erro-geral {
    color: var(--aviso-texto);
    font-size: 0.8rem;
    font-weight: 400;
  }
  .erro-geral {
    margin: 0;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--aviso-fundo);
  }
  .enviar {
    min-height: 50px;
    border: 0;
    border-radius: 25px;
    background: var(--marca);
    color: white;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .enviar:disabled {
    background: var(--borda);
    color: var(--texto-suave);
    cursor: not-allowed;
  }
</style>
