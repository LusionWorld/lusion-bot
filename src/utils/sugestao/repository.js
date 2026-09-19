const supabase = require("../db/supabase");

async function getConfig(guildId) {
  const { data, error } = await supabase
    .from("sugestao_config")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setConfig(guildId, patch) {
  const { error } = await supabase
    .from("sugestao_config")
    .upsert({ guild_id: guildId, ...patch }, { onConflict: "guild_id" });
  if (error) throw error;
}

async function getSugestao(sugestaoId) {
  const { data, error } = await supabase
    .from("sugestoes")
    .select("*")
    .eq("id", sugestaoId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    autorId: data.autor_id,
    autorNome: data.autor_nome,
    conteudo: data.conteudo,
    hasImages: data.has_images,
    imageUrls: data.image_urls || [],
    mensagemId: data.mensagem_id,
    threadId: data.thread_id,
    upvotes: data.upvotes || [],
    downvotes: data.downvotes || [],
    status: data.status,
    criadaEm: data.criada_em,
  };
}

async function createSugestao(guildId, sugestaoId, dados) {
  const { error } = await supabase.from("sugestoes").insert({
    id: sugestaoId,
    guild_id: guildId,
    autor_id: dados.autorId,
    autor_nome: dados.autorNome,
    conteudo: dados.conteudo,
    has_images: dados.hasImages,
    image_urls: dados.imageUrls || [],
    mensagem_id: dados.mensagemId,
    thread_id: dados.threadId,
    upvotes: dados.upvotes || [],
    downvotes: dados.downvotes || [],
    status: dados.status || "pendente",
    criada_em: dados.criadaEm,
  });
  if (error) throw error;
}

async function setStatus(sugestaoId, status) {
  const { error } = await supabase.from("sugestoes").update({ status }).eq("id", sugestaoId);
  if (error) throw error;
}

module.exports = { getConfig, setConfig, getSugestao, createSugestao, setStatus };
