const sqlite3 = require('sqlite3').verbose()
const path    = require('path')
const fs      = require('fs')

const pool = new Map()

function getConnection(guildId) {
  if (pool.has(guildId)) return pool.get(guildId)

  const dbPath = path.join(__dirname, `../../../banco/faq/${guildId}/faq.db`)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new sqlite3.Database(dbPath)

  function run(sql, params = []) {
    return new Promise((resolve, reject) =>
      db.run(sql, params, function (err) { if (err) reject(err); else resolve(this) })
    )
  }
  function get(sql, params = []) {
    return new Promise((resolve, reject) =>
      db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row) })
    )
  }
  function all(sql, params = []) {
    return new Promise((resolve, reject) =>
      db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows) })
    )
  }

  const ready = (async () => {
    await run(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`)
    await run(`
      CREATE TABLE IF NOT EXISTS categories (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        value    TEXT NOT NULL UNIQUE,
        label    TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS questions (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        category_value TEXT NOT NULL,
        question       TEXT NOT NULL,
        answer         TEXT NOT NULL,
        position       INTEGER NOT NULL DEFAULT 0
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS analytics (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        category_value TEXT NOT NULL,
        question_id    INTEGER NOT NULL,
        accessed_at    TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  })()

  ready.catch(err => console.error(`[FAQ] DB init error (${guildId}):`, err))

  const conn = {
    db, run, get, all, ready,

    async getConfig(key, def = null) {
      const r = await get('SELECT value FROM config WHERE key = ?', [key])
      return r ? r.value : def
    },
    async setConfig(key, val) {
      return run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, String(val)])
    },

    // ── Categories ───────────────────────────────────────────────────────────
    async getCategories() {
      return all('SELECT * FROM categories ORDER BY position ASC, id ASC')
    },
    async addCategory(value, label) {
      const r = await get('SELECT COUNT(*) as c FROM categories')
      return run(
        'INSERT OR IGNORE INTO categories (value, label, position) VALUES (?, ?, ?)',
        [value, label, r.c],
      )
    },
    async updateCategory(value, label) {
      return run('UPDATE categories SET label = ? WHERE value = ?', [label, value])
    },
    async removeCategory(value) {
      await run('DELETE FROM categories WHERE value = ?', [value])
      await run('DELETE FROM questions WHERE category_value = ?', [value])
    },

    // ── Questions ────────────────────────────────────────────────────────────
    async getQuestions(categoryValue) {
      return all(
        'SELECT * FROM questions WHERE category_value = ? ORDER BY position ASC, id ASC',
        [categoryValue],
      )
    },
    async getQuestion(id) {
      return get('SELECT * FROM questions WHERE id = ?', [id])
    },
    async getTotalQuestions() {
      const r = await get('SELECT COUNT(*) as c FROM questions')
      return r?.c ?? 0
    },
    async addQuestion(categoryValue, question, answer) {
      const r = await get('SELECT COUNT(*) as c FROM questions WHERE category_value = ?', [categoryValue])
      return run(
        'INSERT INTO questions (category_value, question, answer, position) VALUES (?, ?, ?, ?)',
        [categoryValue, question, answer, r.c],
      )
    },
    async updateQuestion(id, question, answer) {
      return run('UPDATE questions SET question = ?, answer = ? WHERE id = ?', [question, answer, id])
    },
    async removeQuestion(id) {
      return run('DELETE FROM questions WHERE id = ?', [id])
    },

    // ── Analytics ────────────────────────────────────────────────────────────
    async logAccess(categoryValue, questionId) {
      return run(
        'INSERT INTO analytics (category_value, question_id) VALUES (?, ?)',
        [categoryValue, questionId],
      ).catch(() => {})
    },
    async getAnalytics() {
      const total      = await get('SELECT COUNT(*) as total FROM analytics')
      const byCategory = await all(
        'SELECT category_value, COUNT(*) as count FROM analytics GROUP BY category_value ORDER BY count DESC LIMIT 10',
      )
      const byQuestion = await all(`
        SELECT q.question, q.category_value, COUNT(a.id) as count
        FROM analytics a LEFT JOIN questions q ON a.question_id = q.id
        GROUP BY a.question_id ORDER BY count DESC LIMIT 10
      `)
      return { total: total?.total ?? 0, byCategory, byQuestion }
    },
    async clearAnalytics() {
      return run('DELETE FROM analytics')
    },
  }

  pool.set(guildId, conn)
  return conn
}

module.exports = { getConnection }
