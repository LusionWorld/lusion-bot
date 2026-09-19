const http = require("http");
const { fecharTicket } = require("../utils/ticket/fecharTicket");

/**
 * Servidor HTTP interno, só acessível dentro da rede privada do Railway
 * (não tem domínio público). Deixa o painel web pedir pro bot executar
 * ações que só o processo do bot consegue fazer de verdade (gerar
 * transcript, avisar o usuário por DM, apagar o canal do Discord) —
 * o painel não tem client do Discord, só o Supabase.
 *
 * Autenticado por um segredo compartilhado (INTERNAL_API_SECRET),
 * igual nos dois serviços no Railway.
 */
function startInternalApi(client) {
  const port = Number(process.env.INTERNAL_API_PORT) || 8090;
  const secret = process.env.INTERNAL_API_SECRET;

  if (!secret) {
    console.warn(
      "[internalApi] INTERNAL_API_SECRET não configurado — servidor interno desativado.",
    );
    return;
  }

  const server = http.createServer(async (req, res) => {
    const respond = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (req.headers["x-internal-secret"] !== secret) {
      return respond(401, { error: "unauthorized" });
    }

    if (req.method === "POST" && req.url === "/internal/tickets/close") {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", async () => {
        try {
          const { guildId, ticketId, motivo, staffId } = JSON.parse(raw || "{}");
          if (!guildId || !ticketId) {
            return respond(400, { error: "guildId e ticketId são obrigatórios" });
          }

          const guild = client.guilds.cache.get(guildId);
          if (!guild) return respond(404, { error: "guild não encontrada" });

          await fecharTicket(
            guild,
            ticketId,
            motivo || "Fechado pelo painel web.",
            client,
            staffId,
          );
          respond(200, { ok: true });
        } catch (err) {
          console.error("[internalApi] Erro ao fechar ticket:", err);
          respond(500, { error: err.message });
        }
      });
      return;
    }

    respond(404, { error: "not found" });
  });

  server.listen(port, () => {
    console.log(`[internalApi] Escutando na porta ${port} (rede privada)`);
  });
}

module.exports = { startInternalApi };
