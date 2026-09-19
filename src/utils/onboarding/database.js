const supabase = require("../db/supabase");

async function getConfig(guildId) {
  const { data, error } = await supabase
    .from("onboarding_config")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    links: data.links || [],
    auto_roles: data.auto_roles || [],
  };
}

async function saveConfig(guildId, data) {
  const { error } = await supabase.from("onboarding_config").upsert(
    {
      guild_id: guildId,
      ativo: !!data.ativo,
      descricao: data.descricao,
      imagem: data.imagem,
      thumbnail: data.thumbnail,
      footer: data.footer,
      cor: data.cor,
      links: data.links || [],
    },
    { onConflict: "guild_id" },
  );
  if (error) throw error;
}

async function toggleAtivo(guildId) {
  const config = await getConfig(guildId);
  const novoAtivo = !config?.ativo;
  const { error } = await supabase
    .from("onboarding_config")
    .upsert({ guild_id: guildId, ativo: novoAtivo }, { onConflict: "guild_id" });
  if (error) throw error;
  return novoAtivo;
}

async function toggleAutoRoles(guildId) {
  const config = await getConfig(guildId);
  const novoAtivo = !config?.auto_roles_ativo;
  const { error } = await supabase
    .from("onboarding_config")
    .upsert({ guild_id: guildId, auto_roles_ativo: novoAtivo }, { onConflict: "guild_id" });
  if (error) throw error;
  return novoAtivo;
}

async function setAutoRoles(guildId, roleIds) {
  const { error } = await supabase
    .from("onboarding_config")
    .upsert({ guild_id: guildId, auto_roles: roleIds || [] }, { onConflict: "guild_id" });
  if (error) throw error;
}

module.exports = { getConfig, saveConfig, toggleAtivo, toggleAutoRoles, setAutoRoles };
