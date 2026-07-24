const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '../../../banco/onboarding/onboarding.db')
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
    CREATE TABLE IF NOT EXISTS onboarding_config (
      guild_id         TEXT PRIMARY KEY,
      ativo            INTEGER DEFAULT 0,
      descricao        TEXT,
      imagem           TEXT,
      thumbnail        TEXT,
      footer           TEXT,
      cor              TEXT,
      links            TEXT DEFAULT '[]',
      auto_roles_ativo INTEGER DEFAULT 0,
      auto_roles       TEXT DEFAULT '[]'
    )
  `)

  // Migrations for existing DBs
  await run(`ALTER TABLE onboarding_config ADD COLUMN auto_roles_ativo INTEGER DEFAULT 0`).catch(() => {})
  await run(`ALTER TABLE onboarding_config ADD COLUMN auto_roles       TEXT    DEFAULT '[]'`).catch(() => {})
})()

ready.catch(err => console.error('❌ Error initializing onboarding database:', err))

async function getConfig(guildId) {
  await ready
  const row = await get('SELECT * FROM onboarding_config WHERE guild_id = ?', [guildId])
  if (!row) return null
  return {
    ...row,
    links: row.links ? JSON.parse(row.links) : [],
    auto_roles: row.auto_roles ? JSON.parse(row.auto_roles) : [],
  }
}

async function saveConfig(guildId, data) {
  await ready
  const links = JSON.stringify(data.links || [])
  await run(
    `INSERT INTO onboarding_config (guild_id, ativo, descricao, imagem, thumbnail, footer, cor, links)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       ativo = excluded.ativo,
       descricao = excluded.descricao,
       imagem = excluded.imagem,
       thumbnail = excluded.thumbnail,
       footer = excluded.footer,
       cor = excluded.cor,
       links = excluded.links`,
    [guildId, data.ativo ? 1 : 0, data.descricao, data.imagem, data.thumbnail, data.footer, data.cor, links]
  )
}

async function toggleAtivo(guildId) {
  await ready
  const config = await getConfig(guildId)
  const novoAtivo = config?.ativo ? 0 : 1
  await run(
    `INSERT INTO onboarding_config (guild_id, ativo) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET ativo = excluded.ativo`,
    [guildId, novoAtivo]
  )
  return novoAtivo === 1
}

async function toggleAutoRoles(guildId) {
  await ready
  const config = await getConfig(guildId)
  const novoAtivo = config?.auto_roles_ativo ? 0 : 1
  await run(
    `INSERT INTO onboarding_config (guild_id, auto_roles_ativo) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET auto_roles_ativo = excluded.auto_roles_ativo`,
    [guildId, novoAtivo]
  )
  return novoAtivo === 1
}

async function setAutoRoles(guildId, roleIds) {
  await ready
  const value = JSON.stringify(roleIds || [])
  await run(
    `INSERT INTO onboarding_config (guild_id, auto_roles) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET auto_roles = excluded.auto_roles`,
    [guildId, value]
  )
}

module.exports = { getConfig, saveConfig, toggleAtivo, toggleAutoRoles, setAutoRoles }
