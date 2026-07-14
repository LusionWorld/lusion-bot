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
    } catch (err) {
      console.error("[SISTEMAS] Erro ao iniciar inatividade:", err?.message);
    }

    try {
      const {
        iniciarCronOverview,
      } = require("../../interactions/ticket/painel-overview");
      iniciarCronOverview(client);
    } catch (err) {
      console.error("[SISTEMAS] Erro ao iniciar overview cron:", err?.message);
    }
  },
};