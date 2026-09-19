const supabase = require("../db/supabase");

async function setChannel(guildId, channelId) {
  const { error } = await supabase
    .from("translate_config")
    .upsert({ guild_id: guildId, channel_id: channelId }, { onConflict: "guild_id" });
  if (error) throw error;
}

async function getChannel(guildId) {
  const { data, error } = await supabase
    .from("translate_config")
    .select("channel_id")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw error;
  return data?.channel_id ?? null;
}

async function removeChannel(guildId) {
  const { error } = await supabase
    .from("translate_config")
    .update({ channel_id: null })
    .eq("guild_id", guildId);
  if (error) throw error;
}

async function setUserLang(guildId, userId, lang) {
  const { error } = await supabase
    .from("user_lang_prefs")
    .upsert({ user_id: userId, lang }, { onConflict: "user_id" });
  if (error) throw error;
}

async function getUserLang(guildId, userId) {
  const { data, error } = await supabase
    .from("user_lang_prefs")
    .select("lang")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.lang ?? null;
}

const LANGUAGES = {
  en: { label: 'English',    flag: '🇺🇸', description: 'Translate to English' },
  pt: { label: 'Português',  flag: '🇧🇷', description: 'Traduzir para Português' },
  es: { label: 'Español',    flag: '🇪🇸', description: 'Traducir al Español' },
  fr: { label: 'Français',   flag: '🇫🇷', description: 'Traduire en Français' },
  nl: { label: 'Nederlands', flag: '🇳🇱', description: 'Vertalen naar Nederlands' },
  de: { label: 'Deutsch',    flag: '🇩🇪', description: 'Auf Deutsch übersetzen' },
  it: { label: 'Italiano',   flag: '🇮🇹', description: 'Tradurre in Italiano' },
  ko: { label: '한국어',      flag: '🇰🇷', description: '한국어로 번역' },
  ja: { label: '日本語',      flag: '🇯🇵', description: '日本語に翻訳' },
  th: { label: 'ภาษาไทย',    flag: '🇹🇭', description: 'แปลเป็นภาษาไทย' },
}

function prettyLang(code) {
  const l = LANGUAGES[code]
  return l ? `${l.flag} ${l.label}` : `\`${code}\``
}

module.exports = {
  setChannel, getChannel, removeChannel,
  setUserLang, getUserLang,
  LANGUAGES, prettyLang,
}
