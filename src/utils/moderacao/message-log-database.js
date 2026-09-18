const supabase = require("../db/supabase");

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function saveMessage({
  messageId,
  guildId,
  channelId,
  authorId,
  authorTag,
  authorBot,
  content,
  createdAt,
}) {
  const { error } = await supabase.from("message_log").upsert({
    message_id: messageId,
    guild_id: guildId,
    channel_id: channelId,
    author_id: authorId ?? null,
    author_tag: authorTag ?? null,
    author_bot: authorBot ? 1 : 0,
    content: content ?? "",
    created_at: createdAt,
  });
  if (error) throw error;
}

async function getMessage(messageId) {
  const { data, error } = await supabase
    .from("message_log")
    .select("*")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function markDeleted(messageId, deletedBy) {
  const { error } = await supabase
    .from("message_log")
    .update({ deleted_at: Date.now(), deleted_by: deletedBy ?? null })
    .eq("message_id", messageId);
  if (error) throw error;
}

async function cleanupOldMessages() {
  const cutoff = Date.now() - RETENTION_MS;
  const { error } = await supabase.from("message_log").delete().lt("created_at", cutoff);
  if (error) throw error;
}

cleanupOldMessages().catch(() => {});
setInterval(() => cleanupOldMessages().catch(() => {}), CLEANUP_INTERVAL_MS);

module.exports = { saveMessage, getMessage, markDeleted, cleanupOldMessages };
