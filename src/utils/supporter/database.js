const supabase = require("../db/supabase");

// Built-in fallback templates (used when no custom template exists in DB)
const DEFAULT_TEMPLATES = {
  cancelled: {
    enabled: true,
    header: 'Your supporter access has ended for now.',
    body: 'Thank you for being part of Lusion.\n\nYou\'re always welcome back.',
    channels: [],
    start_here: '',
    footer: '',
    image_url: null,
  },
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

function getConnection(guildId) {
  let tierRolesCache = null;

  async function ensureCancelledTemplate() {
    const { data, error } = await supabase
      .from("supporter_dm_templates")
      .select("type")
      .eq("guild_id", guildId)
      .eq("type", "cancelled")
      .maybeSingle();
    if (error) throw error;
    if (data) return;
    const { error: insertError } = await supabase.from("supporter_dm_templates").insert({
      guild_id: guildId,
      type: "cancelled",
      enabled: true,
      header: DEFAULT_TEMPLATES.cancelled.header,
      body: DEFAULT_TEMPLATES.cancelled.body,
      channels: [],
      start_here: "",
      footer: "",
    });
    if (insertError) throw insertError;
  }

  return {
    async getConfig(key, def = null) {
      const { data, error } = await supabase
        .from("supporter_config")
        .select("value")
        .eq("guild_id", guildId)
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data ? data.value : def;
    },
    async setConfig(key, val) {
      const { error } = await supabase
        .from("supporter_config")
        .upsert({ guild_id: guildId, key, value: String(val) }, { onConflict: "guild_id, key" });
      if (error) throw error;
    },
    async deleteConfig(key) {
      const { error } = await supabase
        .from("supporter_config")
        .delete()
        .eq("guild_id", guildId)
        .eq("key", key);
      if (error) throw error;
    },

    // Tier roles (in-memory cache — auto-invalidated on mutations)
    async getTierRoles() {
      if (tierRolesCache) return tierRolesCache;
      const { data, error } = await supabase
        .from("supporter_tier_roles")
        .select("*")
        .eq("guild_id", guildId)
        .order("tier_level", { ascending: true });
      if (error) throw error;
      tierRolesCache = data || [];
      return tierRolesCache;
    },
    async getTierByRoleId(roleId) {
      const { data, error } = await supabase
        .from("supporter_tier_roles")
        .select("*")
        .eq("guild_id", guildId)
        .eq("role_id", roleId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async upsertTierRole(roleId, tierName, tierLevel) {
      tierRolesCache = null;
      const { error } = await supabase.from("supporter_tier_roles").upsert(
        { guild_id: guildId, role_id: roleId, tier_name: tierName, tier_level: parseInt(tierLevel) },
        { onConflict: "guild_id, role_id" },
      );
      if (error) throw error;
    },
    async removeTierRole(roleId) {
      tierRolesCache = null;
      const { error } = await supabase
        .from("supporter_tier_roles")
        .delete()
        .eq("guild_id", guildId)
        .eq("role_id", roleId);
      if (error) throw error;
    },

    // DM templates
    async getTemplate(type) {
      await ensureCancelledTemplate();
      const { data, error } = await supabase
        .from("supporter_dm_templates")
        .select("*")
        .eq("guild_id", guildId)
        .eq("type", type)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async getAllTemplates() {
      await ensureCancelledTemplate();
      const { data, error } = await supabase
        .from("supporter_dm_templates")
        .select("*")
        .eq("guild_id", guildId)
        .order("type", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    async upsertTemplate(type, { header, body, channels, start_here, footer, image_url, enabled }) {
      const { error } = await supabase.from("supporter_dm_templates").upsert(
        {
          guild_id: guildId,
          type,
          enabled: enabled == null ? true : !!enabled,
          header: header ?? '',
          body: body ?? '',
          channels: channels ?? [],
          start_here: start_here ?? '',
          footer: footer ?? '',
          image_url: image_url ?? null,
        },
        { onConflict: "guild_id, type" },
      );
      if (error) throw error;
    },
    async toggleTemplate(type) {
      const { data: t, error: getError } = await supabase
        .from("supporter_dm_templates")
        .select("enabled")
        .eq("guild_id", guildId)
        .eq("type", type)
        .maybeSingle();
      if (getError) throw getError;
      if (!t) return;
      const { error } = await supabase
        .from("supporter_dm_templates")
        .update({ enabled: !t.enabled })
        .eq("guild_id", guildId)
        .eq("type", type);
      if (error) throw error;
    },
    async setTemplateImage(type, imageUrl) {
      const { error } = await supabase
        .from("supporter_dm_templates")
        .upsert({ guild_id: guildId, type, image_url: imageUrl || null }, { onConflict: "guild_id, type" });
      if (error) throw error;
    },

    // Events log
    async logEvent(userId, eventType, oldTier, newTier, dmSent) {
      const { error } = await supabase.from("supporter_events_log").insert({
        guild_id: guildId,
        user_id: userId,
        event_type: eventType,
        old_tier: oldTier ?? null,
        new_tier: newTier ?? null,
        dm_sent: !!dmSent,
        created_at: Date.now(),
      });
      if (error) throw error;
    },
    async getRecentEvents(limit = 50) {
      const { data, error } = await supabase
        .from("supporter_events_log")
        .select("*")
        .eq("guild_id", guildId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },

    // Monthly stats
    async incrementStat(eventType) {
      const month = currentMonth();
      const { error } = await supabase.rpc("incrementar_supporter_stat", {
        p_guild_id: guildId,
        p_month: month,
        p_event_type: eventType,
      });
      if (error) throw error;
    },
    async getMonthlyStats(month) {
      const { data, error } = await supabase
        .from("supporter_monthly_stats")
        .select("event_type, count")
        .eq("guild_id", guildId)
        .eq("month", month ?? currentMonth());
      if (error) throw error;
      return Object.fromEntries((data || []).map(r => [r.event_type, r.count]));
    },
    async getPreviousMonthStats() {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      return this.getMonthlyStats(d.toISOString().slice(0, 7))
    },

    currentMonth,
  }
}

module.exports = { getConnection, DEFAULT_TEMPLATES }
