const supabase = require("../db/supabase");

async function getConfig(guildId) {
  const { data, error } = await supabase
    .from("mod_config")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setCanal(guildId, campo, canalId) {
  const { error } = await supabase
    .from("mod_config")
    .upsert({ guild_id: guildId, [campo]: canalId }, { onConflict: "guild_id" });
  if (error) throw error;
}

module.exports = { getConfig, setCanal };
