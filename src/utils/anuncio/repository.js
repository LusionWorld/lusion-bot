const supabase = require("../db/supabase");

async function getAll(guildId) {
  const { data, error } = await supabase.from("anuncios").select("*").eq("guild_id", guildId);
  if (error) throw error;
  return (data || []).map((row) => ({ ID: row.nome, data: row.data }));
}

async function get(guildId, nome) {
  const { data, error } = await supabase
    .from("anuncios")
    .select("data")
    .eq("guild_id", guildId)
    .eq("nome", nome)
    .maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

async function set(guildId, nome, data) {
  const { error } = await supabase
    .from("anuncios")
    .upsert({ guild_id: guildId, nome, data }, { onConflict: "guild_id, nome" });
  if (error) throw error;
}

async function remove(guildId, nome) {
  const { error } = await supabase.from("anuncios").delete().eq("guild_id", guildId).eq("nome", nome);
  if (error) throw error;
}

module.exports = { getAll, get, set, remove };
