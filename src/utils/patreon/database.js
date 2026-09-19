const supabase = require("../db/supabase");

const DEFAULT_TIERS = [
  { id: 'resident',  name: 'Resident',  price: '$5/month',  benefits: JSON.stringify(['Access to dev-log', 'Early previews', 'Support the project']),            sort_order: 1 },
  { id: 'citizen',   name: 'Citizen',   price: '$15/month', benefits: JSON.stringify(['Everything above', 'Exclusive content', 'Behind the scenes']),             sort_order: 2 },
  { id: 'visionary', name: 'Visionary', price: '$25/month', benefits: JSON.stringify(['Direct influence on development', 'Private discussions', 'Early access features']), sort_order: 3 },
]

function getConnection(guildId) {
  const seeded = { done: false };

  async function ensureSeeded() {
    if (seeded.done) return;
    seeded.done = true;
    const { count, error } = await supabase
      .from("patreon_tiers")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId);
    if (error) throw error;
    if (!count) {
      const rows = DEFAULT_TIERS.map((t) => ({
        guild_id: guildId,
        id: t.id,
        name: t.name,
        price: t.price,
        benefits: JSON.parse(t.benefits),
        sort_order: t.sort_order,
      }));
      const { error: insertError } = await supabase.from("patreon_tiers").insert(rows);
      if (insertError) throw insertError;
    }
  }

  return {
    async getConfig(key, def = null) {
      const { data, error } = await supabase
        .from("patreon_config")
        .select("value")
        .eq("guild_id", guildId)
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data ? data.value : def;
    },
    async setConfig(key, val) {
      const { error } = await supabase
        .from("patreon_config")
        .upsert({ guild_id: guildId, key, value: String(val) }, { onConflict: "guild_id, key" });
      if (error) throw error;
    },
    async deleteConfig(key) {
      const { error } = await supabase
        .from("patreon_config")
        .delete()
        .eq("guild_id", guildId)
        .eq("key", key);
      if (error) throw error;
    },

    async getTiers() {
      await ensureSeeded();
      const { data, error } = await supabase
        .from("patreon_tiers")
        .select("*")
        .eq("guild_id", guildId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []).map((row) => ({ ...row, benefits: JSON.stringify(row.benefits || []) }));
    },
    async getTier(id) {
      await ensureSeeded();
      const { data, error } = await supabase
        .from("patreon_tiers")
        .select("*")
        .eq("guild_id", guildId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, benefits: JSON.stringify(data.benefits || []) };
    },
    async upsertTier({ id, name, price, benefits, sort_order = 0 }) {
      const { error } = await supabase.from("patreon_tiers").upsert(
        { guild_id: guildId, id, name, price, benefits, sort_order },
        { onConflict: "guild_id, id" },
      );
      if (error) throw error;
    },
    async removeTier(id) {
      const { error } = await supabase
        .from("patreon_tiers")
        .delete()
        .eq("guild_id", guildId)
        .eq("id", id);
      if (error) throw error;
    },
  }
}

module.exports = { getConnection, DEFAULT_TIERS }
