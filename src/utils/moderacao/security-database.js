const supabase = require("../db/supabase");

async function getConfig(guildId) {
  const { data, error } = await supabase
    .from("security_config")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureConfig(guildId) {
  const { error: upsertError } = await supabase
    .from("security_config")
    .upsert({ guild_id: guildId }, { onConflict: "guild_id", ignoreDuplicates: true });
  if (upsertError) throw upsertError;
  return getConfig(guildId);
}

async function setField(guildId, field, value) {
  await ensureConfig(guildId);
  const { error } = await supabase
    .from("security_config")
    .update({ [field]: value })
    .eq("guild_id", guildId);
  if (error) throw error;
}

async function toggleField(guildId, field) {
  const cfg = await ensureConfig(guildId);
  const current = cfg[field];
  const next = current ? 0 : 1;
  const { error } = await supabase
    .from("security_config")
    .update({ [field]: next })
    .eq("guild_id", guildId);
  if (error) throw error;
  return next;
}

// Member trust helpers
async function getMemberTrust(guildId, userId) {
  const { data, error } = await supabase
    .from("security_member_trust")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertMemberTrust(guildId, userId, joinedAt) {
  const { error } = await supabase.rpc("incrementar_trust", {
    p_guild_id: guildId,
    p_user_id: userId,
    p_coluna: "msg_count",
    p_joined_at: joinedAt,
  });
  if (error) throw error;
}

async function flagMember(guildId, userId) {
  const { error } = await supabase.rpc("incrementar_trust", {
    p_guild_id: guildId,
    p_user_id: userId,
    p_coluna: "flags",
    p_joined_at: Date.now(),
  });
  if (error) throw error;
}

async function isTrustedMember(guildId, userId, cfg) {
  const trust = await getMemberTrust(guildId, userId);
  if (!trust) return false;
  const daysSince = (Date.now() - trust.joined_at) / 86_400_000;
  return daysSince >= cfg.trust_days && trust.msg_count >= cfg.trust_messages && trust.flags === 0;
}

module.exports = {
  getConfig,
  ensureConfig,
  setField,
  toggleField,
  getMemberTrust,
  upsertMemberTrust,
  flagMember,
  isTrustedMember,
};
