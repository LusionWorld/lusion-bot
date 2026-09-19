const supabase = require("../db/supabase");

async function getConfig(guildId) {
  const { data, error } = await supabase
    .from("pix_config")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setConfig(guildId, patch) {
  const { error } = await supabase
    .from("pix_config")
    .upsert({ guild_id: guildId, ...patch }, { onConflict: "guild_id" });
  if (error) throw error;
}

async function ensureConfig(guildId) {
  const existing = await getConfig(guildId);
  if (existing) return existing;

  const initial = {
    chave: "",
    nome: "",
    cidade: "SAO PAULO",
    valor: null,
    descricao: "",
    txid: "",
    imagem_qrcode: "",
    titulo: "PIX gerado com sucesso",
    cor: "",
  };
  await setConfig(guildId, initial);
  return { guild_id: guildId, ...initial };
}

module.exports = { getConfig, setConfig, ensureConfig };
