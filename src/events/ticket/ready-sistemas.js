module.exports = {
  name: "clientReady",
  once: true,
  execute: async (client) => {
    await new Promise((r) => setTimeout(r, 3000));

    try {
      const {
        iniciarCronInatividade,
      } = require("../../interactions/ticket/inatividade");
      iniciarCronInatividade(client);
      console.log("[SISTEMAS] ✓ Inatividade automática iniciada");
    } catch (err) {
      console.error("[SISTEMAS] Erro ao iniciar inatividade:", err?.message);
    }

    try {
      const {
        iniciarCronOverview,
      } = require("../../interactions/ticket/painel-overview");
      iniciarCronOverview(client);
      console.log("[SISTEMAS] ✓ Cron do painel de visão geral iniciado");
    } catch (err) {
      console.error("[SISTEMAS] Erro ao iniciar overview cron:", err?.message);
    }
  },
};