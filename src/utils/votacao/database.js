const supabase = require("../db/supabase");

// ─── Returns all guild IDs that have at least one poll ───────────────────────

async function getAllGuildIds() {
  const { data, error } = await supabase.from("polls").select("guild_id");
  if (error) throw error;
  return [...new Set((data || []).map((row) => row.guild_id))];
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function createPoll(guildId, data) {
  const { error } = await supabase.from("polls").insert({
    id: data.id,
    guild_id: data.guild_id,
    channel_id: data.channel_id,
    message_id: data.message_id ?? null,
    thread_id: data.thread_id ?? null,
    title: data.title,
    description: data.description ?? null,
    header_image_url: data.header_image_url ?? null,
    image_urls: data.image_urls?.length ? data.image_urls : [],
    color: data.color ?? null,
    options: data.options,
    duration_ms: data.duration_ms,
    role_id: data.role_id ?? null,
    results_channel_id: data.results_channel_id ?? null,
    created_by: data.created_by,
    ends_at: data.ends_at,
    ended: false,
  });
  if (error) throw error;
}

async function updateMessageInfo(guildId, id, message_id, thread_id) {
  const { error } = await supabase
    .from("polls")
    .update({ message_id, thread_id: thread_id ?? null })
    .eq("id", id);
  if (error) throw error;
}

function parsePollRow(row) {
  if (!row) return row;
  // image_urls takes precedence; fall back to legacy image_url as single-item array
  row.image_urls = row.image_urls?.length
    ? row.image_urls
    : (row.image_url ? [row.image_url] : []);
  return row;
}

async function getPoll(guildId, id) {
  const { data, error } = await supabase.from("polls").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return parsePollRow(data);
}

async function getActivePolls(guildId) {
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("guild_id", guildId)
    .eq("ended", false);
  if (error) throw error;
  return (data || []).map(parsePollRow);
}

async function recordVote(guildId, poll_id, user_id, option_index) {
  const { error } = await supabase
    .from("poll_votes")
    .insert({ poll_id, user_id, option_index, voted_at: Date.now() });
  return !error;
}

async function getUserVote(guildId, poll_id, user_id) {
  const { data, error } = await supabase
    .from("poll_votes")
    .select("option_index")
    .eq("poll_id", poll_id)
    .eq("user_id", user_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getVoteCounts(guildId, poll_id) {
  const { data, error } = await supabase.from("poll_votes").select("option_index").eq("poll_id", poll_id);
  if (error) throw error;
  const map = {};
  for (const row of data || []) map[row.option_index] = (map[row.option_index] || 0) + 1;
  return map;
}

async function getTotalVotes(guildId, poll_id) {
  const { count, error } = await supabase
    .from("poll_votes")
    .select("*", { count: "exact", head: true })
    .eq("poll_id", poll_id);
  if (error) throw error;
  return count || 0;
}

async function endPoll(guildId, id, winner_index) {
  const { error } = await supabase
    .from("polls")
    .update({ ended: true, winner_index: winner_index ?? null })
    .eq("id", id);
  if (error) throw error;
}

async function updateEndsAt(guildId, id, endsAt) {
  const { error } = await supabase.from("polls").update({ ends_at: endsAt }).eq("id", id);
  if (error) throw error;
}

module.exports = {
  getAllGuildIds,
  createPoll, updateMessageInfo, getPoll, getActivePolls,
  recordVote, getUserVote, getVoteCounts, getTotalVotes, endPoll, updateEndsAt,
}
