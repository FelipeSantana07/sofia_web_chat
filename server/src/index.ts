const porta = Number(process.env.PORT ?? 3000);

console.log(`[server] stub ativo (porta ${porta}); Fastify entra nas tarefas do agente`);

// Mantém o processo vivo para o `pnpm dev` (substituído pelo Fastify depois).
setInterval(() => {}, 1 << 30);
