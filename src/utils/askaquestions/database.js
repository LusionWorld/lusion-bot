const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

const pool = new Map()

function extractKeywords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
}

function getConnection(guildId) {
  if (pool.has(guildId)) return pool.get(guildId)

  const dbPath = path.join(__dirname, `../../../banco/askaquestions/${guildId}/questions.db`)
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
  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err); else resolve(rows)
      })
    })
  }

  const ready = (async () => {
    await run(`
      CREATE TABLE IF NOT EXISTS config (
        key   TEXT PRIMARY KEY,
        value TEXT
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS questions (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id     TEXT,
        review_msg_id  TEXT,
        thread_id      TEXT,
        author_id      TEXT NOT NULL,
        content        TEXT NOT NULL,
        category       TEXT NOT NULL,
        anonymous      INTEGER NOT NULL DEFAULT 0,
        status         TEXT NOT NULL DEFAULT 'pending',
        assigned_to    TEXT,
        answer         TEXT,
        answer_by      TEXT,
        answer_at      TEXT,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS follows (
        question_id INTEGER NOT NULL,
        user_id     TEXT NOT NULL,
        PRIMARY KEY (question_id, user_id)
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS votes (
        question_id INTEGER NOT NULL,
        user_id     TEXT NOT NULL,
        value       INTEGER NOT NULL,
        PRIMARY KEY (question_id, user_id)
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS faq_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL UNIQUE,
        ignored     INTEGER NOT NULL DEFAULT 0
      )
    `)
  })()

  ready.catch(err => console.error(`[AAQ] DB init error (${guildId}):`, err))

  const conn = {
    db, run, get, all, ready,

    // Config
    async getConfig(key, def = null) {
      const r = await get('SELECT value FROM config WHERE key = ?', [key])
      return r ? r.value : def
    },
    async setConfig(key, val) {
      return run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, String(val)])
    },

    // Questions
    async createQuestion({ authorId, content, category, anonymous }) {
      const r = await run(
        'INSERT INTO questions (author_id, content, category, anonymous) VALUES (?, ?, ?, ?)',
        [authorId, content, category, anonymous ? 1 : 0],
      )
      return r.lastID
    },
    async getQuestion(id) {
      return get('SELECT * FROM questions WHERE id = ?', [id])
    },
    async getActiveQuestions() {
      return all(`SELECT * FROM questions WHERE status NOT IN ('rejected','archived') ORDER BY created_at DESC`)
    },
    async updateQuestion(id, fields) {
      const entries = Object.entries(fields)
      const set = entries.map(([k]) => `${k} = ?`).join(', ')
      return run(`UPDATE questions SET ${set} WHERE id = ?`, [...entries.map(([, v]) => v), id])
    },
    async deleteQuestion(id) {
      await run('DELETE FROM questions WHERE id = ?', [id])
      await run('DELETE FROM follows WHERE question_id = ?', [id])
      await run('DELETE FROM votes WHERE question_id = ?', [id])
    },
    async searchQuestions(term) {
      return all(
        `SELECT * FROM questions WHERE content LIKE ? AND status NOT IN ('rejected','archived') ORDER BY created_at DESC LIMIT 8`,
        [`%${term}%`],
      )
    },
    async findSimilar(content, limit = 3) {
      const rows = await all(`SELECT * FROM questions WHERE status NOT IN ('rejected','archived')`)
      const normalised = content.toLowerCase().trim()
      const words = extractKeywords(content)

      return rows
        .map(q => {
          // Always flag exact content match
          if (q.content.toLowerCase().trim() === normalised) return { q, score: 1 }
          if (!words.length) return { q, score: 0 }
          const qw = extractKeywords(q.content)
          const overlap = words.filter(w => qw.includes(w)).length
          return { q, score: overlap / Math.max(words.length, qw.length, 1) }
        })
        .filter(({ score }) => score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ q }) => q)
    },

    // Follows
    async toggleFollow(questionId, userId) {
      const has = await get('SELECT 1 FROM follows WHERE question_id = ? AND user_id = ?', [questionId, userId])
      if (has) {
        await run('DELETE FROM follows WHERE question_id = ? AND user_id = ?', [questionId, userId])
        return false
      }
      await run('INSERT INTO follows (question_id, user_id) VALUES (?, ?)', [questionId, userId])
      return true
    },
    async isFollowing(questionId, userId) {
      return !!(await get('SELECT 1 FROM follows WHERE question_id = ? AND user_id = ?', [questionId, userId]))
    },
    async getFollowers(questionId) {
      const rows = await all('SELECT user_id FROM follows WHERE question_id = ?', [questionId])
      return rows.map(r => r.user_id)
    },
    async getFollowCount(questionId) {
      const r = await get('SELECT COUNT(*) as c FROM follows WHERE question_id = ?', [questionId])
      return r?.c ?? 0
    },

    // Votes
    async vote(questionId, userId, value) {
      const ex = await get('SELECT value FROM votes WHERE question_id = ? AND user_id = ?', [questionId, userId])
      if (ex) {
        if (ex.value === value) {
          await run('DELETE FROM votes WHERE question_id = ? AND user_id = ?', [questionId, userId])
          return null
        }
        await run('UPDATE votes SET value = ? WHERE question_id = ? AND user_id = ?', [value, questionId, userId])
      } else {
        await run('INSERT INTO votes (question_id, user_id, value) VALUES (?, ?, ?)', [questionId, userId, value])
      }
      return value
    },
    async getVotes(questionId) {
      const rows = await all('SELECT value FROM votes WHERE question_id = ?', [questionId])
      return {
        up:   rows.filter(r => r.value === 1).length,
        down: rows.filter(r => r.value === -1).length,
      }
    },

    // FAQ
    async checkFaqThreshold(content, threshold) {
      const words = extractKeywords(content)
      if (!words.length) return 0
      const rows = await all('SELECT content FROM questions')
      const count = rows.filter(q => {
        const qw = extractKeywords(q.content)
        return words.filter(w => qw.includes(w)).length >= Math.ceil(words.length * 0.5)
      }).length
      return count >= threshold ? count : 0
    },
    async getFaqLog(questionId) {
      return get('SELECT * FROM faq_log WHERE question_id = ?', [questionId])
    },
    async createFaqLog(questionId) {
      return run('INSERT OR IGNORE INTO faq_log (question_id) VALUES (?)', [questionId]).catch(() => {})
    },
    async updateFaqLog(questionId, fields) {
      const entries = Object.entries(fields)
      const set = entries.map(([k]) => `${k} = ?`).join(', ')
      return run(`UPDATE faq_log SET ${set} WHERE question_id = ?`, [...entries.map(([, v]) => v), questionId])
    },
  }

  pool.set(guildId, conn)
  return conn
}

module.exports = { getConnection, extractKeywords }
