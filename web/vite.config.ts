import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Em desenvolvimento o /api vai para o Fastify (evita CORS). Troque a porta com SERVER_PORT se mudar a PORT do servidor.
const porta = process.env.SERVER_PORT ?? "3000";

export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: { "/api": { target: `http://127.0.0.1:${porta}` } },
  },
});
