const supabase = require("../db/supabase");

/**
 * Marca um ticket como fechado e incrementa o contador de fechados da guild.
 * Substitui o antigo par de queries SQLite (UPDATE tickets + UPSERT contadores).
 *
 * @param {string} guildId
 * @param {string} ticketId - ID do canal do ticket (coluna ticket_id)
 * @param {string} fechadoId - ID de quem fechou
 */
async function fecharTicketDB(guildId, ticketId, fechadoId) {
  const { error: updateError } = await supabase
    .from("tickets")
    .update({ fechado_em: new Date().toISOString(), fechado_id: fechadoId })
    .eq("guild_id", guildId)
    .eq("ticket_id", ticketId);
  if (updateError) throw updateError;

  const { error: rpcError } = await supabase.rpc("incrementar_contador", {
    p_guild_id: guildId,
    p_coluna: "fechados",
  });
  if (rpcError) throw rpcError;
}

/**
 * Cria o registro de um novo ticket e incrementa o contador de abertos.
 */
async function criarTicketDB({
  guildId,
  ticketId,
  userId,
  categoria,
  nomeCategoria,
  motivoAbertura,
  messageId,
}) {
  const { error: insertError } = await supabase.from("tickets").insert({
    guild_id: guildId,
    ticket_id: ticketId,
    user_id: userId,
    categoria: categoria ?? null,
    nome_categoria: nomeCategoria ?? null,
    motivo_abertura: motivoAbertura ?? null,
    message_id: messageId ?? null,
  });
  if (insertError) throw insertError;

  const { error: rpcError } = await supabase.rpc("incrementar_contador", {
    p_guild_id: guildId,
    p_coluna: "abertos",
  });
  if (rpcError) throw rpcError;
}

async function getContadores(guildId) {
  const { data, error } = await supabase
    .from("ticket_contadores")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { guild_id: guildId, abertos: 0, assumidos: 0, fechados: 0 };
}

async function getTicket(guildId, ticketId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guildId)
    .eq("ticket_id", ticketId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { fecharTicketDB, criarTicketDB, getContadores, getTicket };
