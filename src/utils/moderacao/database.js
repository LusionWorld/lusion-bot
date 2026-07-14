const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '../../../banco/moderacao/mod.db')
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
    CREATE TABLE IF NOT EXISTS mod_config (
      guild_id         TEXT PRIMARY KEY,
      canal_entrou     TEXT,
      canal_saiu       TEXT,
      canal_ban        TEXT,
      canal_kick       TEXT,
      canal_msg_delete TEXT,
      canal_msg_edit   TEXT
    )
  `)

  // Migrations for existing DBs
  await run(`ALTER TABLE mod_config ADD COLUMN canal_msg_delete TEXT`).catch(() => {})
  await run(`ALTER TABLE mod_config ADD COLUMN canal_msg_edit   TEXT`).catch(() => {})
})()

ready.catch(err => console.error('❌ Erro ao inicializar banco de moderação:', err))

async function getConfig(guildId) {
  await ready
  return get('SELECT * FROM mod_config WHERE guild_id = ?', [guildId])
}

async function setCanal(guildId, campo, canalId) {
  await ready
  await run(
    `INSERT INTO mod_config (guild_id, ${campo}) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET ${campo} = excluded.${campo}`,
    [guildId, canalId]
  )
}

module.exports = { getConfig, setCanal }
