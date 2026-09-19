const supabase = require("../db/supabase");

// ─── Config ──────────────────────────────────────────────────────────────────

async function getConfig(guildId) {
  const { data, error } = await supabase
    .from("invite_config")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setConfigField(guildId, patch) {
  const { error } = await supabase
    .from("invite_config")
    .upsert({ guild_id: guildId, ...patch }, { onConflict: "guild_id" });
  if (error) throw error;
}

async function setAtivo(guildId, ativo) {
  await setConfigField(guildId, { ativo: !!ativo });
}

async function setCanalLogs(guildId, canalId) {
  await setConfigField(guildId, { canal_logs: canalId });
}

async function setCanalRankingPinned(guildId, canalId) {
  await setConfigField(guildId, { canal_ranking_pinned: canalId });
}

async function setRankingMessageId(guildId, messageId) {
  await setConfigField(guildId, { ranking_message_id: messageId });
}

async function setCanalRanking(guildId, canalId) {
  await setConfigField(guildId, { canal_ranking: canalId });
}

async function setMilestoneInterval(guildId, interval) {
  await setConfigField(guildId, { milestone_interval: interval });
}

async function setMinDaysQualified(guildId, days) {
  await setConfigField(guildId, { min_days_qualified: days });
}

async function setCriteria(guildId, { minMessages, minChannels, diffDays, checkSpam }) {
  await setConfigField(guildId, {
    criteria_min_messages: minMessages ?? 5,
    criteria_min_channels: minChannels ?? 1,
    criteria_diff_days: diffDays ? 1 : 0,
    criteria_check_spam: !!checkSpam,
  });
}

// ─── Stats ───────────────────────────────────────────────────────────────────

async function getStats(guildId, userId) {
  const { data, error } = await supabase
    .from("invite_stats")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertStats(guildId, userId, data) {
  const { error } = await supabase.from("invite_stats").upsert(
    {
      guild_id: guildId,
      user_id: userId,
      total: data.total || 0,
      validos: data.validos || 0,
      saiu: data.saiu || 0,
      bonus: data.bonus || 0,
    },
    { onConflict: "guild_id, user_id" },
  );
  if (error) throw error;
}

async function addValido(guildId, userId) {
  const { error } = await supabase.rpc("incrementar_invite_stat", {
    p_guild_id: guildId,
    p_user_id: userId,
    p_coluna: "total",
    p_delta: 1,
  });
  if (error) throw error;
  const { error: error2 } = await supabase.rpc("incrementar_invite_stat", {
    p_guild_id: guildId,
    p_user_id: userId,
    p_coluna: "validos",
    p_delta: 1,
  });
  if (error2) throw error2;
}

async function decrementValido(guildId, userId) {
  const { error } = await supabase.rpc("incrementar_invite_stat", {
    p_guild_id: guildId,
    p_user_id: userId,
    p_coluna: "validos",
    p_delta: -1,
  });
  if (error) throw error;
  const { error: error2 } = await supabase.rpc("incrementar_invite_stat", {
    p_guild_id: guildId,
    p_user_id: userId,
    p_coluna: "saiu",
    p_delta: 1,
  });
  if (error2) throw error2;
}

async function getLeaderboard(guildId, limit = 10) {
  const { data, error } = await supabase
    .from("invite_stats")
    .select("*")
    .eq("guild_id", guildId);
  if (error) throw error;
  const rows = (data || []).map((row) => ({
    ...row,
    total_real: Math.max(0, row.validos + row.bonus - row.saiu),
  }));
  rows.sort((a, b) => b.total_real - a.total_real);
  return rows.slice(0, limit);
}

async function resetGuild(guildId) {
  const tables = ["invite_stats", "invite_membros", "invite_member_activity", "invite_active_rewards"];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("guild_id", guildId);
    if (error) throw error;
  }
}

async function resetUser(guildId, userId) {
  const { error } = await supabase
    .from("invite_stats")
    .delete()
    .eq("guild_id", guildId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ─── Membros ─────────────────────────────────────────────────────────────────

async function getMembro(guildId, memberId) {
  const { data, error } = await supabase
    .from("invite_membros")
    .select("*")
    .eq("guild_id", guildId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setMembro(guildId, memberId, data) {
  const { error } = await supabase.from("invite_membros").upsert(
    {
      guild_id: guildId,
      member_id: memberId,
      inviter_id: data.inviterId,
      invite_code: data.inviteCode,
      entrou: data.entrou,
      saiu: false,
      status: "pending",
      qualified_at: null,
    },
    { onConflict: "guild_id, member_id" },
  );
  if (error) throw error;
}

async function markMembroSaiu(guildId, memberId) {
  const { error } = await supabase
    .from("invite_membros")
    .update({ saiu: true })
    .eq("guild_id", guildId)
    .eq("member_id", memberId);
  if (error) throw error;
}

async function getPendingMembers(guildId) {
  const { data, error } = await supabase
    .from("invite_membros")
    .select("*")
    .eq("guild_id", guildId)
    .eq("status", "pending")
    .eq("saiu", false);
  if (error) throw error;
  return data || [];
}

async function getPendingByInviter(guildId, inviterId) {
  const { data, error } = await supabase
    .from("invite_membros")
    .select("*")
    .eq("guild_id", guildId)
    .eq("inviter_id", inviterId)
    .eq("status", "pending")
    .eq("saiu", false);
  if (error) throw error;
  return data || [];
}

/**
 * Marks member as qualified and adds +1 to inviter's valid count.
 * Returns inviter_id on success, null if already qualified or no record.
 */
async function qualifyMember(guildId, memberId) {
  const membro = await getMembro(guildId, memberId);
  if (!membro || membro.ever_qualified || membro.status !== "pending") return null;

  const now = Date.now();
  const { error } = await supabase
    .from("invite_membros")
    .update({ status: "qualified", qualified_at: now, ever_qualified: true })
    .eq("guild_id", guildId)
    .eq("member_id", memberId);
  if (error) throw error;

  await addValido(guildId, membro.inviter_id);
  return membro.inviter_id;
}

/**
 * Handles member leave. Returns { action, inviterId }.
 * action: 'skip' | 'pending_left' | 'qualified_left'
 */
async function handleMemberLeave(guildId, memberId) {
  const membro = await getMembro(guildId, memberId);
  if (!membro || membro.saiu) return { action: "skip" };

  await markMembroSaiu(guildId, memberId);

  if (membro.status === "pending") {
    return { action: "pending_left", inviterId: membro.inviter_id };
  }
  if (membro.status === "qualified") {
    return { action: "qualified_left", inviterId: membro.inviter_id };
  }
  return { action: "skip" };
}

// ─── Member Activity ──────────────────────────────────────────────────────────

async function getActivity(guildId, memberId) {
  const { data, error } = await supabase
    .from("invite_member_activity")
    .select("*")
    .eq("guild_id", guildId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    channels_used: data.channels_used || [],
    days_active: data.days_active || [],
  };
}

async function trackMessage(guildId, memberId, channelId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const existing = await getActivity(guildId, memberId);
  const channels = existing?.channels_used || [];
  const days = existing?.days_active || [];

  if (!channels.includes(channelId)) channels.push(channelId);
  if (!days.includes(today)) days.push(today);

  const { error } = await supabase.from("invite_member_activity").upsert(
    {
      guild_id: guildId,
      member_id: memberId,
      message_count: (existing?.message_count || 0) + 1,
      channels_used: channels,
      days_active: days,
    },
    { onConflict: "guild_id, member_id" },
  );
  if (error) throw error;
}

async function flagSpam(guildId, memberId, flag = true) {
  const { error } = await supabase
    .from("invite_member_activity")
    .upsert({ guild_id: guildId, member_id: memberId, flagged_spam: !!flag }, { onConflict: "guild_id, member_id" });
  if (error) throw error;
}

// ─── Reward Roles ─────────────────────────────────────────────────────────────

async function getRewardRoles(guildId) {
  const { data, error } = await supabase
    .from("invite_reward_roles")
    .select("*")
    .eq("guild_id", guildId)
    .order("min_qualified", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function addRewardRole(guildId, roleId, minQualified, permanent, durationDays) {
  const { error } = await supabase.from("invite_reward_roles").insert({
    guild_id: guildId,
    role_id: roleId,
    min_qualified: minQualified,
    permanent: !!permanent,
    duration_days: durationDays || 7,
  });
  if (error) throw error;
}

async function removeRewardRole(guildId, id) {
  const { error } = await supabase
    .from("invite_reward_roles")
    .delete()
    .eq("guild_id", guildId)
    .eq("id", id);
  if (error) throw error;
}

// ─── Active Temporary Rewards ─────────────────────────────────────────────────

async function addActiveReward(guildId, userId, roleId, expiresAt) {
  const { error } = await supabase.from("invite_active_rewards").upsert(
    { guild_id: guildId, user_id: userId, role_id: roleId, expires_at: expiresAt },
    { onConflict: "guild_id, user_id, role_id" },
  );
  if (error) throw error;
}

async function getExpiredRewards(guildId) {
  const { data, error } = await supabase
    .from("invite_active_rewards")
    .select("*")
    .eq("guild_id", guildId)
    .lte("expires_at", Date.now());
  if (error) throw error;
  return data || [];
}

async function removeActiveReward(guildId, userId, roleId) {
  const { error } = await supabase
    .from("invite_active_rewards")
    .delete()
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .eq("role_id", roleId);
  if (error) throw error;
}

module.exports = {
  // Config
  getConfig, setAtivo, setCanalLogs, setCanalRanking, setCanalRankingPinned, setRankingMessageId,
  setMilestoneInterval, setMinDaysQualified, setCriteria,
  // Stats
  getStats, upsertStats, addValido, decrementValido, getLeaderboard, resetGuild, resetUser,
  // Membros
  getMembro, setMembro, markMembroSaiu, qualifyMember, handleMemberLeave, getPendingMembers, getPendingByInviter,
  // Activity
  getActivity, trackMessage, flagSpam,
  // Reward roles
  getRewardRoles, addRewardRole, removeRewardRole,
  // Active temporary rewards
  addActiveReward, getExpiredRewards, removeActiveReward,
};
