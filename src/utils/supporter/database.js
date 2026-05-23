const sqlite3 = require('sqlite3').verbose()
const path    = require('path')
const fs      = require('fs')

const pool = new Map()

// Built-in fallback templates (used when no custom template exists in DB)
const DEFAULT_TEMPLATES = {
  cancelled: {
    enabled: true,
    header: 'Your supporter access has ended for now.',
    body: 'Thank you for being part of Lusion.\n\nYou\'re always welcome back.',
    channels: [],
    start_here: '',
    footer: '',
    image_url: null,
  },
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

function getConnection(guildId) {
  if (pool.has(guildId)) return pool.get(guildId)

  const dbPath = path.join(__dirname, `../../../banco/supporter/${guildId}/supporter.db`)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new sqlite3.Database(dbPath)

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) { if (err) reject(err); else resolve(this) })
    })
  }
  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row) })
    })
  }
  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows) })
    })
  }

  const ready = (async () => {
    await run(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`)
    await run(`
      CREATE TABLE IF NOT EXISTS tier_roles (
        role_id    TEXT PRIMARY KEY,
        tier_name  TEXT NOT NULL,
        tier_level INTEGER NOT NULL
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS dm_templates (
        type       TEXT PRIMARY KEY,
        enabled    INTEGER NOT NULL DEFAULT 1,
        header     TEXT NOT NULL DEFAULT '',
        body       TEXT NOT NULL DEFAULT '',
        channels   TEXT NOT NULL DEFAULT '[]',
        start_here TEXT NOT NULL DEFAULT '',
        footer     TEXT NOT NULL DEFAULT '',
        image_url  TEXT
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS events_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL,
        event_type TEXT NOT NULL,
        old_tier   TEXT,
        new_tier   TEXT,
        dm_sent    INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS monthly_stats (
        month      TEXT NOT NULL,
        event_type TEXT NOT NULL,
        count      INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (month, event_type)
      )
    `)
    // Pre-insert cancelled template fallback
    await run(`
      INSERT OR IGNORE INTO dm_templates (type, enabled, header, body, channels, start_here, footer)
      VALUES ('cancelled', 1, 'Your supporter access has ended for now.',
              'Thank you for being part of Lusion.

You''re always welcome back.', '[]', '', '')
    `)
  })()

  ready.catch(err => console.error(`[Supporter] DB init error (${guildId}):`, err))

  const conn = {
    db, run, get, all, ready,

    async getConfig(key, def = null) {
      const r = await get('SELECT value FROM config WHERE key = ?', [key])
      return r ? r.value : def
    },
    async setConfig(key, val) {
      return run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, String(val)])
    },
    async deleteConfig(key) {
      return run('DELETE FROM config WHERE key = ?', [key])
    },

    // Tier roles (in-memory cache — auto-invalidated on mutations)
    _tierRolesCache: null,
    async getTierRoles() {
      if (this._tierRolesCache) return this._tierRolesCache
      this._tierRolesCache = await all('SELECT * FROM tier_roles ORDER BY tier_level ASC')
      return this._tierRolesCache
    },
    async getTierByRoleId(roleId) {
      return get('SELECT * FROM tier_roles WHERE role_id = ?', [roleId])
    },
    async upsertTierRole(roleId, tierName, tierLevel) {
      this._tierRolesCache = null
      return run(
        'INSERT OR REPLACE INTO tier_roles (role_id, tier_name, tier_level) VALUES (?, ?, ?)',
        [roleId, tierName, parseInt(tierLevel)],
      )
    },
    async removeTierRole(roleId) {
      this._tierRolesCache = null
      return run('DELETE FROM tier_roles WHERE role_id = ?', [roleId])
    },

    // DM templates
    async getTemplate(type) {
      return get('SELECT * FROM dm_templates WHERE type = ?', [type])
    },
    async getAllTemplates() {
      return all('SELECT * FROM dm_templates ORDER BY type ASC')
    },
    async upsertTemplate(type, { header, body, channels, start_here, footer, image_url, enabled }) {
      return run(`
        INSERT OR REPLACE INTO dm_templates (type, enabled, header, body, channels, start_here, footer, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [type, enabled ?? 1, header ?? '', body ?? '', JSON.stringify(channels ?? []), start_here ?? '', footer ?? '', image_url ?? null])
    },
    async toggleTemplate(type) {
      const t = await get('SELECT enabled FROM dm_templates WHERE type = ?', [type])
      if (!t) return
      return run('UPDATE dm_templates SET enabled = ? WHERE type = ?', [t.enabled ? 0 : 1, type])
    },
    async setTemplateImage(type, imageUrl) {
      await run(`INSERT OR IGNORE INTO dm_templates (type) VALUES (?)`, [type])
      return run('UPDATE dm_templates SET image_url = ? WHERE type = ?', [imageUrl || null, type])
    },

    // Events log
    async logEvent(userId, eventType, oldTier, newTier, dmSent) {
      return run(
        'INSERT INTO events_log (user_id, event_type, old_tier, new_tier, dm_sent) VALUES (?, ?, ?, ?, ?)',
        [userId, eventType, oldTier ?? null, newTier ?? null, dmSent ? 1 : 0],
      )
    },
    async getRecentEvents(limit = 50) {
      return all('SELECT * FROM events_log ORDER BY created_at DESC LIMIT ?', [limit])
    },

    // Monthly stats
    async incrementStat(eventType) {
      const month = currentMonth()
      await run(`
        INSERT INTO monthly_stats (month, event_type, count) VALUES (?, ?, 1)
        ON CONFLICT (month, event_type) DO UPDATE SET count = count + 1
      `, [month, eventType])
    },
    async getMonthlyStats(month) {
      const rows = await all('SELECT event_type, count FROM monthly_stats WHERE month = ?', [month ?? currentMonth()])
      return Object.fromEntries(rows.map(r => [r.event_type, r.count]))
    },
    async getPreviousMonthStats() {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      return conn.getMonthlyStats(d.toISOString().slice(0, 7))
    },

    currentMonth,
  }

  pool.set(guildId, conn)
  return conn
}

module.exports = { getConnection, DEFAULT_TEMPLATES }
