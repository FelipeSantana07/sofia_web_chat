<script lang="ts">
  let { enviando, aoEnviar }: { enviando: boolean; aoEnviar: (texto: string) => void } = $props();

  let texto = $state("");
  let campo: HTMLTextAreaElement;

  const podeEnviar = $derived(texto.trim() !== "" && !enviando);

  function ajustarAltura() {
    campo.style.height = "auto";
    const bordas = campo.offsetHeight - campo.clientHeight; // box-sizing: border-box conta as bordas
    campo.style.height = `${Math.min(campo.scrollHeight + bordas, 140)}px`;
  }

  function enviar() {
    if (!podeEnviar) return;
    aoEnviar(texto);
    texto = "";
    queueMicrotask(ajustarAltura);
    campo.focus();
  }

  function aoTeclar(evento: KeyboardEvent) {
    // Enter envia; Shift+Enter quebra a linha. Durante a composição (acentos, teclado de celular) não envia.
    if (evento.key === "Enter" && !evento.shiftKey && !evento.isComposing) {
      evento.preventDefault();
      enviar();
    }
  }
</script>

<form class="composer" onsubmit={(e) => (e.preventDefault(), enviar())}>
  <textarea
    bind:this={campo}
    bind:value={texto}
    oninput={ajustarAltura}
    onkeydown={aoTeclar}
    rows="1"
    maxlength="2000"
    placeholder="Escreva sua mensagem…"
    aria-label="Mensagem para a Sofia"
    enterkeyhint="send"
  ></textarea>
  <button type="submit" disabled={!podeEnviar} aria-label="Enviar mensagem">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" /></svg>
  </button>
</form>

<style>
  .composer {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: var(--fundo-painel);
    border-top: 1px solid var(--borda);
  }
  textarea {
    flex: 1;
    min-width: 0;
    resize: none;
    padding: 11px 14px;
    border: 1px solid var(--borda);
    border-radius: 22px;
    background: var(--fundo);
    font: inherit;
    font-size: 16px; /* 16px evita o zoom automático do iOS ao focar */
    line-height: 1.35;
    color: inherit;
  }
  textarea:focus {
    outline: 2px solid var(--marca);
    outline-offset: -1px;
  }
  button {
    flex: none;
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: var(--marca);
    color: white;
    cursor: pointer;
  }
  button:disabled {
    background: var(--borda);
    cursor: not-allowed;
  }
</style>
