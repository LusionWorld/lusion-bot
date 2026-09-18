const supabase = require("../db/supabase");

/**
 * Incrementa atomicamente uma coluna de ticket_contadores (via RPC no
 * Postgres), criando a linha da guild se ainda não existir.
 */
async function incrementarContador(guildId, coluna) {
  const { error } = await supabase.rpc("incrementar_contador", {
    p_guild_id: guildId,
    p_coluna: coluna,
  });
  if (error) throw error;
}

/** Garante que a linha de contadores da guild existe (equivalente a INSERT OR IGNORE). */
async function ensureContadores(guildId) {
  const { error } = await supabase
    .from("ticket_contadores")
    .upsert({ guild_id: guildId }, { onConflict: "guild_id", ignoreDuplicates: true });
  if (error) throw error;
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

/**
 * Cria o registro de um novo ticket e incrementa o contador de abertos.
 */
async function criarTicketDB({ guildId, ticketId, userId, categoria, motivoAbertura }) {
  const { error } = await supabase.from("tickets").insert({
    guild_id: guildId,
    ticket_id: ticketId,
    user_id: userId,
    categoria: categoria ?? null,
    criado_em: Date.now(),
    motivo_abertura: motivoAbertura ?? null,
  });
  if (error) throw error;

  await incrementarContador(guildId, "abertos");
}

/**
 * Ticket é identificado só pelo ticket_id (= id do canal do Discord, único
 * globalmente), igual o código original fazia contra o SQLite.
 */
async function getTicketByChannel(ticketId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("ticket_id", ticketId)
    .maybeSingle();
  if (error) throw error;
  return data;
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

/** Atualização genérica por ticket_id — `patch` usa os nomes de coluna reais. */
async function atualizarTicket(ticketId, patch) {
  const { error } = await supabase.from("tickets").update(patch).eq("ticket_id", ticketId);
  if (error) throw error;
}

async function listarTicketsAbertos(guildId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guildId)
    .is("fechado_em", null);
  if (error) throw error;
  return data ?? [];
}

/** Igual listarTicketsAbertos, mas ordenado por criado_em (usado no painel de visão geral). */
async function listarTicketsAbertosOrdenados(guildId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guildId)
    .is("fechado_em", null)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function contarTicketsAbertos(guildId) {
  const { count, error } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .is("fechado_em", null);
  if (error) throw error;
  return count ?? 0;
}

async function contarTicketsAssumidos(guildId) {
  const { count, error } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .is("fechado_em", null)
    .not("assumido_em", "is", null);
  if (error) throw error;
  return count ?? 0;
}

async function contarTicketsSemStaff(guildId) {
  const { count, error } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .is("fechado_em", null)
    .is("assumido_em", null);
  if (error) throw error;
  return count ?? 0;
}

/** Todos os tickets (histórico completo) de uma guild — usado pelos relatórios administrativos. */
async function listarTodosTickets(guildId) {
  const { data, error } = await supabase.from("tickets").select("*").eq("guild_id", guildId);
  if (error) throw error;
  return data ?? [];
}

async function distinctCategorias(guildId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("categoria")
    .eq("guild_id", guildId)
    .not("categoria", "is", null);
  if (error) throw error;
  const set = new Set((data ?? []).map((r) => r.categoria));
  return [...set].map((categoria) => ({ categoria }));
}

async function ticketsPorCategoria(guildId, categoriaIds) {
  const { data, error } = await supabase
    .from("tickets")
    .select("criado_em, assumido_em, fechado_em, primeira_resposta_em")
    .eq("guild_id", guildId)
    .in("categoria", categoriaIds);
  if (error) throw error;
  return data ?? [];
}

/** Contagem de tickets assumidos/fechados/respondidos por um usuário específico. */
async function contarTicketsPorUsuario(guildId, userId) {
  const [assumidos, fechados, respondidos] = await Promise.all([
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .eq("staff_id", userId),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .eq("fechado_id", userId),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .eq("respondido_id", userId),
  ]);
  if (assumidos.error) throw assumidos.error;
  if (fechados.error) throw fechados.error;
  if (respondidos.error) throw respondidos.error;
  return {
    assumidos: assumidos.count ?? 0,
    fechados: fechados.count ?? 0,
    respondidos: respondidos.count ?? 0,
  };
}

/** Últimos tickets fechados de um usuário que tinham motivo de abertura preenchido. */
async function listarTicketsFechadosComMotivo(guildId, userId, limit = 5) {
  const { data, error } = await supabase
    .from("tickets")
    .select("ticket_id, motivo_abertura, criado_em")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .not("fechado_em", "is", null)
    .not("motivo_abertura", "is", null)
    .order("criado_em", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * Marca um ticket como fechado e incrementa o contador de fechados da guild.
 */
async function fecharTicketDB(guildId, ticketId, fechadoId) {
  const { error: updateError } = await supabase
    .from("tickets")
    .update({ fechado_em: Date.now(), fechado_id: fechadoId })
    .eq("guild_id", guildId)
    .eq("ticket_id", ticketId);
  if (updateError) throw updateError;

  await incrementarContador(guildId, "fechados");
}

/** Estatísticas agregadas de uma estação (categoria) de ticket, via função Postgres. */
async function estatisticasEstacao(guildId, nomeCategoria) {
  const { data, error } = await supabase.rpc("estatisticas_estacao", {
    p_guild_id: guildId,
    p_nome_categoria: nomeCategoria,
  });
  if (error) throw error;
  return data;
}

async function inserirAvaliacao({ ticketId, userId, estrelas, comentario, avaliadoEm }) {
  const { error } = await supabase.from("ticket_avaliacoes").insert({
    ticket_id: ticketId,
    user_id: userId,
    estrelas,
    comentario: comentario ?? null,
    avaliado_em: avaliadoEm ?? Date.now(),
  });
  if (error) throw error;
}

async function inserirAvaliacaoCriterios({
  ticketId,
  userId,
  staffId,
  notaVelocidade,
  notaQualidade,
  notaSimpatia,
  media,
  comentario,
  avaliadoEm,
}) {
  const { error } = await supabase.from("ticket_avaliacoes_criterios").insert({
    ticket_id: ticketId,
    user_id: userId,
    staff_id: staffId,
    nota_velocidade: notaVelocidade,
    nota_qualidade: notaQualidade,
    nota_simpatia: notaSimpatia,
    media,
    comentario: comentario ?? null,
    avaliado_em: avaliadoEm ?? Date.now(),
  });
  if (error) throw error;
}

async function rankingStaffCriterios(guildId) {
  const { data, error } = await supabase.rpc("ranking_staff_criterios", {
    p_guild_id: guildId,
  });
  if (error) throw error;
  return data ?? [];
}

async function rankingSemanalFechados(guildId, inicioSemana) {
  const { data, error } = await supabase.rpc("ranking_semanal_fechados", {
    p_guild_id: guildId,
    p_inicio_semana: inicioSemana,
  });
  if (error) throw error;
  return data ?? [];
}

module.exports = {
  incrementarContador,
  ensureContadores,
  getContadores,
  criarTicketDB,
  getTicketByChannel,
  getTicket,
  atualizarTicket,
  listarTicketsAbertos,
  listarTicketsAbertosOrdenados,
  listarTodosTickets,
  distinctCategorias,
  ticketsPorCategoria,
  contarTicketsPorUsuario,
  contarTicketsAbertos,
  contarTicketsAssumidos,
  contarTicketsSemStaff,
  listarTicketsFechadosComMotivo,
  estatisticasEstacao,
  fecharTicketDB,
  inserirAvaliacao,
  inserirAvaliacaoCriterios,
  rankingStaffCriterios,
  rankingSemanalFechados,
};
