const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

const pool = new Map()

function getConnection(guildId) {
  if (pool.has(guildId)) return pool.get(guildId)

  const dbPath = path.join(__dirname, `../../../banco/tradutor/${guildId}/translate.db`)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new sqlite3.Database(dbPath)

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err); else resolve(this)
      })
    })
  }
  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err); else resolve(row)
      })
    })
  }

  const ready = (async () => {
    await run(`
      CREATE TABLE IF NOT EXISTS translate_config (
        guild_id   TEXT PRIMARY KEY,
        channel_id TEXT
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS user_lang_prefs (
        user_id TEXT PRIMARY KEY,
        lang    TEXT NOT NULL
      )
    `)
  })()

  ready.catch(err => console.error(`[Translate] DB init error (${guildId}):`, err))

  const conn = { db, run, get, ready }
  pool.set(guildId, conn)
  return conn
}

async function r(guildId, sql, params = []) {
  const c = getConnection(guildId); await c.ready; return c.run(sql, params)
}
async function g(guildId, sql, params = []) {
  const c = getConnection(guildId); await c.ready; return c.get(sql, params)
}

async function setChannel(guildId, channelId) {
  return r(guildId,
    `INSERT INTO translate_config (guild_id, channel_id) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id`,
    [guildId, channelId],
  )
}

async function getChannel(guildId) {
  const row = await g(guildId, 'SELECT channel_id FROM translate_config WHERE guild_id = ?', [guildId])
  return row?.channel_id ?? null
}

async function removeChannel(guildId) {
  return r(guildId, 'UPDATE translate_config SET channel_id = NULL WHERE guild_id = ?', [guildId])
}

async function setUserLang(guildId, userId, lang) {
  return r(guildId,
    `INSERT INTO user_lang_prefs (user_id, lang) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET lang = excluded.lang`,
    [userId, lang],
  )
}

async function getUserLang(guildId, userId) {
  const row = await g(guildId, 'SELECT lang FROM user_lang_prefs WHERE user_id = ?', [userId])
  return row?.lang ?? null
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
  getConnection,
  setChannel, getChannel, removeChannel,
  setUserLang, getUserLang,
  LANGUAGES, prettyLang,
}
