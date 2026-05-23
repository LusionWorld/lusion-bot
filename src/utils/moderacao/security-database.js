const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '../../../banco/moderacao/security.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new sqlite3.Database(DB_PATH)

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
    CREATE TABLE IF NOT EXISTS security_config (
      guild_id TEXT PRIMARY KEY,

      -- Global
      system_enabled           INTEGER DEFAULT 1,
      alert_channel            TEXT,

      -- Link Security
      link_enabled             INTEGER DEFAULT 1,
      link_block_invites       INTEGER DEFAULT 1,
      link_block_shorteners    INTEGER DEFAULT 1,
      link_block_repeat        INTEGER DEFAULT 1,
      link_repeat_count        INTEGER DEFAULT 3,
      link_repeat_window_sec   INTEGER DEFAULT 60,
      link_newmember_days      INTEGER DEFAULT 3,
      link_whitelist_channels  TEXT    DEFAULT '[]',
      link_exempt_roles        TEXT    DEFAULT '[]',

      -- Flood Detection
      flood_enabled            INTEGER DEFAULT 1,
      flood_msg_count          INTEGER DEFAULT 5,
      flood_msg_window_sec     INTEGER DEFAULT 5,
      flood_duplicate_enabled  INTEGER DEFAULT 1,
      flood_mention_limit      INTEGER DEFAULT 5,
      flood_emoji_limit        INTEGER DEFAULT 15,
      flood_crosspost_enabled  INTEGER DEFAULT 1,
      flood_timeout_minutes       INTEGER DEFAULT 5,
      flood_exempt_roles          TEXT    DEFAULT '[]',
      flood_escalation_window_sec INTEGER DEFAULT 900,
      flood_timeout_level_1       INTEGER DEFAULT 5,
      flood_timeout_level_2       INTEGER DEFAULT 15,
      flood_timeout_level_3       INTEGER DEFAULT 60,

      -- New Member Trust
      trust_enabled            INTEGER DEFAULT 1,
      trust_days               INTEGER DEFAULT 3,
      trust_messages           INTEGER DEFAULT 20,

      -- Custom blocked domains/patterns
      link_block_custom        TEXT    DEFAULT '[]',

      -- Server Protection (channel/role mass-delete)
      protect_enabled           INTEGER DEFAULT 1,
      protect_channel_threshold INTEGER DEFAULT 3,
      protect_role_threshold    INTEGER DEFAULT 3,
      protect_window_sec        INTEGER DEFAULT 30,
      protect_action_timeout    INTEGER DEFAULT 0,
      protect_exempt_roles      TEXT    DEFAULT '[]',

      -- Alert Toggles
      notify_join_spike        INTEGER DEFAULT 1,
      notify_suspicious_link   INTEGER DEFAULT 1,
      notify_flood             INTEGER DEFAULT 1,
      notify_new_account_link  INTEGER DEFAULT 1,
      notify_mass_delete       INTEGER DEFAULT 1,
      notify_external_invite   INTEGER DEFAULT 1
    )
  `)

  // Migrations for existing DBs
  await run(`ALTER TABLE security_config ADD COLUMN link_block_custom        TEXT    DEFAULT '[]'`).catch(() => {})
  await run(`ALTER TABLE security_config ADD COLUMN protect_enabled           INTEGER DEFAULT 1`).catch(() => {})
  await run(`ALTER TABLE security_config ADD COLUMN protect_channel_threshold INTEGER DEFAULT 3`).catch(() => {})
  await run(`ALTER TABLE security_config ADD COLUMN protect_role_threshold    INTEGER DEFAULT 3`).catch(() => {})
  await run(`ALTER TABLE security_config ADD COLUMN protect_window_sec        INTEGER DEFAULT 30`).catch(() => {})
  await run(`ALTER TABLE security_config ADD COLUMN protect_action_timeout    INTEGER DEFAULT 0`).catch(() => {})
  await run(`ALTER TABLE security_config ADD COLUMN protect_exempt_roles        TEXT    DEFAULT '[]'`).catch(() => {})
  await run(`ALTER TABLE security_config ADD COLUMN flood_escalation_window_sec INTEGER DEFAULT 900`).catch(() => {})
  await run(`ALTER TABLE security_config ADD COLUMN flood_timeout_level_1       INTEGER DEFAULT 5`).catch(() => {})
  await run(`ALTER TABLE security_config ADD COLUMN flood_timeout_level_2       INTEGER DEFAULT 15`).catch(() => {})
  await run(`ALTER TABLE security_config ADD COLUMN flood_timeout_level_3       INTEGER DEFAULT 60`).catch(() => {})

  await run(`
    CREATE TABLE IF NOT EXISTS security_member_trust (
      guild_id    TEXT,
      user_id     TEXT,
      msg_count   INTEGER DEFAULT 0,
      flags       INTEGER DEFAULT 0,
      joined_at   INTEGER,
      PRIMARY KEY (guild_id, user_id)
    )
  `)
})()

ready.catch(err => console.error('[Security] DB init error:', err))

async function getConfig(guildId) {
  await ready
  return get('SELECT * FROM security_config WHERE guild_id = ?', [guildId])
}

async function ensureConfig(guildId) {
  await ready
  await run(
    `INSERT OR IGNORE INTO security_config (guild_id) VALUES (?)`,
    [guildId]
  )
  return get('SELECT * FROM security_config WHERE guild_id = ?', [guildId])
}

async function setField(guildId, field, value) {
  await ensureConfig(guildId)
  await run(
    `UPDATE security_config SET ${field} = ? WHERE guild_id = ?`,
    [value, guildId]
  )
}

async function toggleField(guildId, field) {
  const cfg = await ensureConfig(guildId)
  const current = cfg[field]
  const next = current ? 0 : 1
  await run(
    `UPDATE security_config SET ${field} = ? WHERE guild_id = ?`,
    [next, guildId]
  )
  return next
}

// Member trust helpers
async function getMemberTrust(guildId, userId) {
  await ready
  return get(
    'SELECT * FROM security_member_trust WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  )
}

async function upsertMemberTrust(guildId, userId, joinedAt) {
  await ready
  await run(
    `INSERT OR IGNORE INTO security_member_trust (guild_id, user_id, joined_at) VALUES (?, ?, ?)`,
    [guildId, userId, joinedAt]
  )
  await run(
    `UPDATE security_member_trust SET msg_count = msg_count + 1 WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId]
  )
}

async function flagMember(guildId, userId) {
  await ready
  await run(
    `INSERT OR IGNORE INTO security_member_trust (guild_id, user_id, joined_at) VALUES (?, ?, ?)`,
    [guildId, userId, Date.now()]
  )
  await run(
    `UPDATE security_member_trust SET flags = flags + 1 WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId]
  )
}

async function isTrustedMember(guildId, userId, cfg) {
  const trust = await getMemberTrust(guildId, userId)
  if (!trust) return false
  const daysSince = (Date.now() - trust.joined_at) / 86_400_000
  return daysSince >= cfg.trust_days && trust.msg_count >= cfg.trust_messages && trust.flags === 0
}

module.exports = {
  getConfig,
  ensureConfig,
  setField,
  toggleField,
  getMemberTrust,
  upsertMemberTrust,
  flagMember,
  isTrustedMember,
}
