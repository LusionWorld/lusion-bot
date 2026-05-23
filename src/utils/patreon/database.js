const sqlite3 = require('sqlite3').verbose()
const path    = require('path')
const fs      = require('fs')

const pool = new Map()

const DEFAULT_TIERS = [
  { id: 'resident',  name: 'Resident',  price: '$5/month',  benefits: JSON.stringify(['Access to dev-log', 'Early previews', 'Support the project']),            sort_order: 1 },
  { id: 'citizen',   name: 'Citizen',   price: '$15/month', benefits: JSON.stringify(['Everything above', 'Exclusive content', 'Behind the scenes']),             sort_order: 2 },
  { id: 'visionary', name: 'Visionary', price: '$25/month', benefits: JSON.stringify(['Direct influence on development', 'Private discussions', 'Early access features']), sort_order: 3 },
]

function getConnection(guildId) {
  if (pool.has(guildId)) return pool.get(guildId)

  const dbPath = path.join(__dirname, `../../../banco/patreon/${guildId}/patreon.db`)
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
      CREATE TABLE IF NOT EXISTS tiers (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        price      TEXT NOT NULL,
        benefits   TEXT NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)

    const count = await get('SELECT COUNT(*) as c FROM tiers')
    if (!count?.c) {
      for (const t of DEFAULT_TIERS) {
        await run(
          'INSERT OR IGNORE INTO tiers (id, name, price, benefits, sort_order) VALUES (?, ?, ?, ?, ?)',
          [t.id, t.name, t.price, t.benefits, t.sort_order],
        )
      }
    }
  })()

  ready.catch(err => console.error(`[Patreon] DB init error (${guildId}):`, err))

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

    async getTiers() {
      return all('SELECT * FROM tiers ORDER BY sort_order ASC')
    },
    async getTier(id) {
      return get('SELECT * FROM tiers WHERE id = ?', [id])
    },
    async upsertTier({ id, name, price, benefits, sort_order = 0 }) {
      return run(
        'INSERT OR REPLACE INTO tiers (id, name, price, benefits, sort_order) VALUES (?, ?, ?, ?, ?)',
        [id, name, price, JSON.stringify(benefits), sort_order],
      )
    },
    async removeTier(id) {
      return run('DELETE FROM tiers WHERE id = ?', [id])
    },
  }

  pool.set(guildId, conn)
  return conn
}

module.exports = { getConnection, DEFAULT_TIERS }
