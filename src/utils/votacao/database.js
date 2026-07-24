const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

// ─── Pool de conexões por servidor ───────────────────────────────────────────

const pool = new Map()   // guildId → { db, ready, run, get, all }

function getConnection(guildId) {
  if (pool.has(guildId)) return pool.get(guildId)

  const dbPath = path.join(__dirname, `../../../banco/votacao/${guildId}/polls.db`)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new sqlite3.Database(dbPath)

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

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  const ready = (async () => {
    await run(`
      CREATE TABLE IF NOT EXISTS polls (
        id                 TEXT PRIMARY KEY,
        guild_id           TEXT NOT NULL,
        channel_id         TEXT NOT NULL,
        message_id         TEXT,
        thread_id          TEXT,
        title              TEXT NOT NULL,
        description        TEXT,
        image_url          TEXT,
        header_image_url   TEXT,
        image_urls         TEXT,
        color              TEXT,
        options            TEXT NOT NULL,
        duration_ms        INTEGER,
        role_id            TEXT,
        results_channel_id TEXT,
        created_by         TEXT NOT NULL,
        ends_at            INTEGER,
        ended              INTEGER NOT NULL DEFAULT 0,
        winner_index       INTEGER
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        poll_id      TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        option_index INTEGER NOT NULL,
        voted_at     INTEGER NOT NULL,
        PRIMARY KEY (poll_id, user_id)
      )
    `)
    // migrations for existing DBs
    await run(`ALTER TABLE polls ADD COLUMN results_channel_id TEXT`).catch(() => {})
    await run(`ALTER TABLE polls ADD COLUMN header_image_url TEXT`).catch(() => {})
    await run(`ALTER TABLE polls ADD COLUMN image_urls TEXT`).catch(() => {})

    const newColNames = ['id', 'guild_id', 'channel_id', 'message_id', 'thread_id', 'title', 'description', 'image_url', 'header_image_url', 'image_urls', 'color', 'options', 'duration_ms', 'role_id', 'results_channel_id', 'created_by', 'ends_at', 'ended', 'winner_index']

    async function mergeOldPollsTable() {
      const oldColNames = (await all(`PRAGMA table_info(polls_old)`)).map(c => c.name)
      const commonCols  = newColNames.filter(c => oldColNames.includes(c))
      await run(`INSERT INTO polls (${commonCols.join(', ')}) SELECT ${commonCols.join(', ')} FROM polls_old`)
      await run(`DROP TABLE polls_old`)
    }

    const leftoverOldTable = await get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'polls_old'`)
    if (leftoverOldTable) {
      await mergeOldPollsTable()
    }

    const cols = await all(`PRAGMA table_info(polls)`)
    const durationCol = cols.find(c => c.name === 'duration_ms')
    if (durationCol?.notnull) {
      await run(`ALTER TABLE polls RENAME TO polls_old`)
      await run(`
        CREATE TABLE polls (
          id                 TEXT PRIMARY KEY,
          guild_id           TEXT NOT NULL,
          channel_id         TEXT NOT NULL,
          message_id         TEXT,
          thread_id          TEXT,
          title              TEXT NOT NULL,
          description        TEXT,
          image_url          TEXT,
          header_image_url   TEXT,
          image_urls         TEXT,
          color              TEXT,
          options            TEXT NOT NULL,
          duration_ms        INTEGER,
          role_id            TEXT,
          results_channel_id TEXT,
          created_by         TEXT NOT NULL,
          ends_at            INTEGER,
          ended              INTEGER NOT NULL DEFAULT 0,
          winner_index       INTEGER
        )
      `)
      await mergeOldPollsTable()
    }
  })()

  ready.catch(err => console.error(`[Poll] Erro ao inicializar banco (${guildId}):`, err))

  const conn = { db, run, get, all, ready }
  pool.set(guildId, conn)
  return conn
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function r(guildId, sql, params = []) {
  const c = getConnection(guildId); await c.ready; return c.run(sql, params)
}
async function g(guildId, sql, params = []) {
  const c = getConnection(guildId); await c.ready; return c.get(sql, params)
}
async function a(guildId, sql, params = []) {
  const c = getConnection(guildId); await c.ready; return c.all(sql, params)
}

// ─── Returns all guild IDs that have a poll DB folder ────────────────────────

function getAllGuildIds() {
  const base = path.join(__dirname, '../../../banco/votacao')
  try {
    return fs.readdirSync(base).filter(name => {
      return fs.statSync(path.join(base, name)).isDirectory()
    })
  } catch {
    return []
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function createPoll(guildId, data) {
  return r(guildId,
    `INSERT INTO polls
      (id, guild_id, channel_id, message_id, thread_id, title, description, header_image_url, image_urls, color, options, duration_ms, role_id, results_channel_id, created_by, ends_at, ended)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      data.id, data.guild_id, data.channel_id,
      data.message_id ?? null, data.thread_id ?? null,
      data.title, data.description ?? null,
      data.header_image_url ?? null,
      data.image_urls?.length ? JSON.stringify(data.image_urls) : null,
      data.color ?? null, JSON.stringify(data.options), data.duration_ms,
      data.role_id ?? null, data.results_channel_id ?? null, data.created_by, data.ends_at,
    ],
  )
}

async function updateMessageInfo(guildId, id, message_id, thread_id) {
  return r(guildId,
    'UPDATE polls SET message_id = ?, thread_id = ? WHERE id = ?',
    [message_id, thread_id ?? null, id],
  )
}

function parsePollRow(row) {
  row.options    = JSON.parse(row.options)
  // image_urls takes precedence; fall back to legacy image_url as single-item array
  row.image_urls = row.image_urls
    ? JSON.parse(row.image_urls)
    : (row.image_url ? [row.image_url] : [])
  return row
}

async function getPoll(guildId, id) {
  const row = await g(guildId, 'SELECT * FROM polls WHERE id = ?', [id])
  if (!row) return null
  return parsePollRow(row)
}

async function getActivePolls(guildId) {
  const rows = await a(guildId, 'SELECT * FROM polls WHERE ended = 0')
  return rows.map(parsePollRow)
}

async function recordVote(guildId, poll_id, user_id, option_index) {
  try {
    await r(guildId,
      'INSERT INTO poll_votes (poll_id, user_id, option_index, voted_at) VALUES (?, ?, ?, ?)',
      [poll_id, user_id, option_index, Date.now()],
    )
    return true
  } catch {
    return false
  }
}

async function getUserVote(guildId, poll_id, user_id) {
  return g(guildId,
    'SELECT option_index FROM poll_votes WHERE poll_id = ? AND user_id = ?',
    [poll_id, user_id],
  )
}

async function getVoteCounts(guildId, poll_id) {
  const rows = await a(guildId,
    'SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index',
    [poll_id],
  )
  const map = {}
  for (const row of rows) map[row.option_index] = row.count
  return map
}

async function getTotalVotes(guildId, poll_id) {
  const row = await g(guildId,
    'SELECT COUNT(*) as total FROM poll_votes WHERE poll_id = ?',
    [poll_id],
  )
  return row?.total ?? 0
}

async function endPoll(guildId, id, winner_index) {
  return r(guildId,
    'UPDATE polls SET ended = 1, winner_index = ? WHERE id = ?',
    [winner_index ?? null, id],
  )
}

async function updateEndsAt(guildId, id, endsAt) {
  return r(guildId,
    'UPDATE polls SET ends_at = ? WHERE id = ?',
    [endsAt, id],
  )
}

module.exports = {
  getConnection, getAllGuildIds,
  createPoll, updateMessageInfo, getPoll, getActivePolls,
  recordVote, getUserVote, getVoteCounts, getTotalVotes, endPoll, updateEndsAt,
}
