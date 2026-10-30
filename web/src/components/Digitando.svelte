<script lang="ts"></script>

<div class="linha sofia" role="status" aria-label="Sofia está digitando">
  <div class="bolha digitando" aria-hidden="true">
    <span></span><span></span><span></span>
  </div>
  <span class="so-leitor">Sofia está digitando…</span>
</div>

<style>
  .digitando {
    display: flex;
    gap: 5px;
    align-items: center;
    padding: 14px 16px;
  }
  .digitando span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--texto-suave);
    animation: pulo 1.2s infinite ease-in-out;
  }
  .digitando span:nth-child(2) {
    animation-delay: 0.15s;
  }
  .digitando span:nth-child(3) {
    animation-delay: 0.3s;
  }
  @keyframes pulo {
    0%,
    60%,
    100% {
      opacity: 0.35;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .digitando span {
      animation: none;
      opacity: 0.7;
    }
  }
</style>
