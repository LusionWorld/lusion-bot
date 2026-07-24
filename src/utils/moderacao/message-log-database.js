const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '../../../banco/moderacao/message-log.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new sqlite3.Database(DB_PATH)

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

const ready = (async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS message_log (
      message_id TEXT PRIMARY KEY,
      guild_id   TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      author_id  TEXT,
      author_tag TEXT,
      author_bot INTEGER DEFAULT 0,
      content    TEXT,
      created_at INTEGER,
      deleted_at INTEGER,
      deleted_by TEXT
    )
  `)

  await run(`CREATE INDEX IF NOT EXISTS idx_message_log_guild_created ON message_log (guild_id, created_at)`)
})()

ready.catch(err => console.error('[MessageLog] DB init error:', err))

async function saveMessage({ messageId, guildId, channelId, authorId, authorTag, authorBot, content, createdAt }) {
  await ready
  await run(
    `INSERT OR REPLACE INTO message_log
      (message_id, guild_id, channel_id, author_id, author_tag, author_bot, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [messageId, guildId, channelId, authorId ?? null, authorTag ?? null, authorBot ? 1 : 0, content ?? '', createdAt]
  )
}

async function getMessage(messageId) {
  await ready
  return get('SELECT * FROM message_log WHERE message_id = ?', [messageId])
}

async function markDeleted(messageId, deletedBy) {
  await ready
  await run(
    `UPDATE message_log SET deleted_at = ?, deleted_by = ? WHERE message_id = ?`,
    [Date.now(), deletedBy ?? null, messageId]
  )
}

async function cleanupOldMessages() {
  await ready
  const cutoff = Date.now() - RETENTION_MS
  await run('DELETE FROM message_log WHERE created_at < ?', [cutoff])
}

ready.then(() => {
  cleanupOldMessages().catch(() => {})
  setInterval(() => cleanupOldMessages().catch(() => {}), CLEANUP_INTERVAL_MS)
})

module.exports = { saveMessage, getMessage, markDeleted, cleanupOldMessages }
