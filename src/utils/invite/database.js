const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

// ─── Pool de conexões por servidor ───────────────────────────────────────────

const pool = new Map()     // guildId → { db, ready, run, get, all }

function getConnection(guildId) {
  if (pool.has(guildId)) return pool.get(guildId)

  const dbPath = path.join(__dirname, `../../../banco/convite/${guildId}/invite.db`)
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

  async function addCol(table, column, definition) {
    try {
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e
    }
  }

  const ready = (async () => {
    // ── Core tables ──────────────────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS invite_config (
        guild_id              TEXT PRIMARY KEY,
        ativo                 INTEGER DEFAULT 0,
        canal_logs            TEXT,
        canal_ranking         TEXT,
        milestone_interval    INTEGER DEFAULT 10,
        min_days_qualified    INTEGER DEFAULT 7,
        criteria_min_messages INTEGER DEFAULT 5,
        criteria_min_channels INTEGER DEFAULT 1,
        criteria_diff_days    INTEGER DEFAULT 1,
        criteria_check_spam   INTEGER DEFAULT 1
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS invite_stats (
        guild_id TEXT,
        user_id  TEXT,
        total    INTEGER DEFAULT 0,
        validos  INTEGER DEFAULT 0,
        saiu     INTEGER DEFAULT 0,
        bonus    INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      )
    `)
    await run(`
      CREATE TABLE IF NOT EXISTS invite_membros (
        guild_id       TEXT,
        member_id      TEXT,
        inviter_id     TEXT,
        invite_code    TEXT,
        entrou         INTEGER,
        saiu           INTEGER DEFAULT 0,
        status         TEXT DEFAULT 'pending',
        qualified_at   INTEGER DEFAULT NULL,
        ever_qualified INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, member_id)
      )
    `)
    // ── Activity tracking ────────────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS invite_member_activity (
        guild_id      TEXT,
        member_id     TEXT,
        message_count INTEGER DEFAULT 0,
        channels_used TEXT    DEFAULT '[]',
        days_active   TEXT    DEFAULT '[]',
        flagged_spam  INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, member_id)
      )
    `)
    // ── Reward roles ─────────────────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS invite_reward_roles (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id      TEXT,
        role_id       TEXT,
        min_qualified INTEGER DEFAULT 10,
        permanent     INTEGER DEFAULT 1,
        duration_days INTEGER DEFAULT 7
      )
    `)
    // ── Active temporary reward assignments ──────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS invite_active_rewards (
        guild_id   TEXT,
        user_id    TEXT,
        role_id    TEXT,
        expires_at INTEGER,
        PRIMARY KEY (guild_id, user_id, role_id)
      )
    `)

    // ── Migrations (old columns that may not exist) ──────────────────────────
    const oldCols = [
      ['invite_config', 'qualifying_role_id',      'TEXT'],
      ['invite_config', 'canal_ranking',            'TEXT'],
      ['invite_config', 'canal_ranking_pinned',     'TEXT'],
      ['invite_config', 'ranking_message_id',       'TEXT'],
      ['invite_config', 'milestone_interval',       'INTEGER DEFAULT 10'],
      ['invite_config', 'criteria_min_messages',    'INTEGER DEFAULT 5'],
      ['invite_config', 'criteria_min_channels',    'INTEGER DEFAULT 1'],
      ['invite_config', 'criteria_diff_days',       'INTEGER DEFAULT 1'],
      ['invite_config', 'criteria_check_spam',      'INTEGER DEFAULT 1'],
      ['invite_membros', 'status',         "TEXT DEFAULT 'pending'"],
      ['invite_membros', 'qualified_at',   'INTEGER DEFAULT NULL'],
      ['invite_membros', 'ever_qualified', 'INTEGER DEFAULT 0'],
    ]
    for (const [t, c, d] of oldCols) await addCol(t, c, d)
  })()

  ready.catch(err => console.error(`❌ Erro ao inicializar banco (${guildId}):`, err))

  const conn = { db, run, get, all, ready }
  pool.set(guildId, conn)
  return conn
}

// ─── Helpers internos ────────────────────────────────────────────────────────

async function r(guildId, sql, params = []) {
  const c = getConnection(guildId); await c.ready; return c.run(sql, params)
}
async function g(guildId, sql, params = []) {
  const c = getConnection(guildId); await c.ready; return c.get(sql, params)
}
async function a(guildId, sql, params = []) {
  const c = getConnection(guildId); await c.ready; return c.all(sql, params)
}

// ─── Config ──────────────────────────────────────────────────────────────────

async function getConfig(guildId) {
  return g(guildId, 'SELECT * FROM invite_config WHERE guild_id = ?', [guildId])
}

async function setAtivo(guildId, ativo) {
  await r(guildId,
    `INSERT INTO invite_config (guild_id, ativo) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET ativo = excluded.ativo`,
    [guildId, ativo ? 1 : 0]
  )
}

async function setCanalLogs(guildId, canalId) {
  await r(guildId,
    `INSERT INTO invite_config (guild_id, canal_logs) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET canal_logs = excluded.canal_logs`,
    [guildId, canalId]
  )
}

async function setCanalRankingPinned(guildId, canalId) {
  await r(guildId,
    `INSERT INTO invite_config (guild_id, canal_ranking_pinned) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET canal_ranking_pinned = excluded.canal_ranking_pinned`,
    [guildId, canalId]
  )
}

async function setRankingMessageId(guildId, messageId) {
  await r(guildId,
    `INSERT INTO invite_config (guild_id, ranking_message_id) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET ranking_message_id = excluded.ranking_message_id`,
    [guildId, messageId]
  )
}

async function setCanalRanking(guildId, canalId) {
  await r(guildId,
    `INSERT INTO invite_config (guild_id, canal_ranking) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET canal_ranking = excluded.canal_ranking`,
    [guildId, canalId]
  )
}

async function setMilestoneInterval(guildId, interval) {
  await r(guildId,
    `INSERT INTO invite_config (guild_id, milestone_interval) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET milestone_interval = excluded.milestone_interval`,
    [guildId, interval]
  )
}

async function setMinDaysQualified(guildId, days) {
  await r(guildId,
    `INSERT INTO invite_config (guild_id, min_days_qualified) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET min_days_qualified = excluded.min_days_qualified`,
    [guildId, days]
  )
}

async function setCriteria(guildId, { minMessages, minChannels, diffDays, checkSpam }) {
  await r(guildId,
    `INSERT INTO invite_config
       (guild_id, criteria_min_messages, criteria_min_channels, criteria_diff_days, criteria_check_spam)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       criteria_min_messages = excluded.criteria_min_messages,
       criteria_min_channels = excluded.criteria_min_channels,
       criteria_diff_days    = excluded.criteria_diff_days,
       criteria_check_spam   = excluded.criteria_check_spam`,
    [guildId,
      minMessages  ?? 5,
      minChannels  ?? 1,
      diffDays     ? 1 : 0,
      checkSpam    ? 1 : 0]
  )
}

// ─── Stats ───────────────────────────────────────────────────────────────────

async function getStats(guildId, userId) {
  return g(guildId, 'SELECT * FROM invite_stats WHERE guild_id = ? AND user_id = ?', [guildId, userId])
}

async function upsertStats(guildId, userId, data) {
  await r(guildId,
    `INSERT INTO invite_stats (guild_id, user_id, total, validos, saiu, bonus) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET
       total   = excluded.total,
       validos = excluded.validos,
       saiu    = excluded.saiu,
       bonus   = excluded.bonus`,
    [guildId, userId, data.total || 0, data.validos || 0, data.saiu || 0, data.bonus || 0]
  )
}

async function addValido(guildId, userId) {
  await r(guildId,
    `INSERT INTO invite_stats (guild_id, user_id, total, validos) VALUES (?, ?, 1, 1)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET total = total + 1, validos = validos + 1`,
    [guildId, userId]
  )
}

async function decrementValido(guildId, userId) {
  await r(guildId,
    `UPDATE invite_stats SET
       validos = MAX(0, validos - 1),
       saiu    = saiu + 1
     WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId]
  )
}

async function getLeaderboard(guildId, limit = 10) {
  return a(guildId,
    `SELECT *, MAX(0, validos + bonus - saiu) AS total_real
     FROM invite_stats
     WHERE guild_id = ?
     ORDER BY (validos + bonus - saiu) DESC
     LIMIT ?`,
    [guildId, limit]
  )
}

async function resetGuild(guildId) {
  await r(guildId, 'DELETE FROM invite_stats          WHERE guild_id = ?', [guildId])
  await r(guildId, 'DELETE FROM invite_membros        WHERE guild_id = ?', [guildId])
  await r(guildId, 'DELETE FROM invite_member_activity WHERE guild_id = ?', [guildId])
  await r(guildId, 'DELETE FROM invite_active_rewards  WHERE guild_id = ?', [guildId])
}

async function resetUser(guildId, userId) {
  await r(guildId, 'DELETE FROM invite_stats WHERE guild_id = ? AND user_id = ?', [guildId, userId])
}

// ─── Membros ─────────────────────────────────────────────────────────────────

async function getMembro(guildId, memberId) {
  return g(guildId, 'SELECT * FROM invite_membros WHERE guild_id = ? AND member_id = ?', [guildId, memberId])
}

async function setMembro(guildId, memberId, data) {
  await r(guildId,
    `INSERT INTO invite_membros (guild_id, member_id, inviter_id, invite_code, entrou, saiu, status, qualified_at, ever_qualified)
     VALUES (?, ?, ?, ?, ?, 0, 'pending', NULL, 0)
     ON CONFLICT(guild_id, member_id) DO UPDATE SET
       inviter_id   = excluded.inviter_id,
       invite_code  = excluded.invite_code,
       entrou       = excluded.entrou,
       saiu         = 0,
       status       = 'pending',
       qualified_at = NULL`,
    [guildId, memberId, data.inviterId, data.inviteCode, data.entrou]
  )
}

async function markMembroSaiu(guildId, memberId) {
  await r(guildId,
    'UPDATE invite_membros SET saiu = 1 WHERE guild_id = ? AND member_id = ?',
    [guildId, memberId]
  )
}

async function getPendingMembers(guildId) {
  return a(guildId,
    `SELECT * FROM invite_membros WHERE guild_id = ? AND status = 'pending' AND saiu = 0`,
    [guildId]
  )
}

async function getPendingByInviter(guildId, inviterId) {
  return a(guildId,
    `SELECT * FROM invite_membros WHERE guild_id = ? AND inviter_id = ? AND status = 'pending' AND saiu = 0`,
    [guildId, inviterId]
  )
}

/**
 * Marks member as qualified and adds +1 to inviter's valid count.
 * Returns inviter_id on success, null if already qualified or no record.
 */
async function qualifyMember(guildId, memberId) {
  const membro = await getMembro(guildId, memberId)
  if (!membro || membro.ever_qualified || membro.status !== 'pending') return null

  const now = Date.now()
  await r(guildId,
    `UPDATE invite_membros SET status = 'qualified', qualified_at = ?, ever_qualified = 1
     WHERE guild_id = ? AND member_id = ?`,
    [now, guildId, memberId]
  )
  await addValido(guildId, membro.inviter_id)
  return membro.inviter_id
}

/**
 * Handles member leave. Returns { action, inviterId }.
 * action: 'skip' | 'pending_left' | 'qualified_left'
 */
async function handleMemberLeave(guildId, memberId) {
  const membro = await getMembro(guildId, memberId)
  if (!membro || membro.saiu) return { action: 'skip' }

  await markMembroSaiu(guildId, memberId)

  if (membro.status === 'pending') {
    return { action: 'pending_left', inviterId: membro.inviter_id }
  }
  if (membro.status === 'qualified') {
    return { action: 'qualified_left', inviterId: membro.inviter_id }
  }
  return { action: 'skip' }
}

// ─── Member Activity ──────────────────────────────────────────────────────────

async function getActivity(guildId, memberId) {
  const row = await g(guildId,
    'SELECT * FROM invite_member_activity WHERE guild_id = ? AND member_id = ?',
    [guildId, memberId]
  )
  if (!row) return null
  return {
    ...row,
    channels_used: JSON.parse(row.channels_used || '[]'),
    days_active:   JSON.parse(row.days_active   || '[]'),
  }
}

async function trackMessage(guildId, memberId, channelId) {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const existing = await getActivity(guildId, memberId)
  const channels = existing?.channels_used || []
  const days     = existing?.days_active   || []

  if (!channels.includes(channelId)) channels.push(channelId)
  if (!days.includes(today))         days.push(today)

  await r(guildId,
    `INSERT INTO invite_member_activity (guild_id, member_id, message_count, channels_used, days_active)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(guild_id, member_id) DO UPDATE SET
       message_count = message_count + 1,
       channels_used = excluded.channels_used,
       days_active   = excluded.days_active`,
    [guildId, memberId, JSON.stringify(channels), JSON.stringify(days)]
  )
}

async function flagSpam(guildId, memberId, flag = 1) {
  await r(guildId,
    `INSERT INTO invite_member_activity (guild_id, member_id, flagged_spam)
     VALUES (?, ?, ?)
     ON CONFLICT(guild_id, member_id) DO UPDATE SET flagged_spam = excluded.flagged_spam`,
    [guildId, memberId, flag]
  )
}

// ─── Reward Roles ─────────────────────────────────────────────────────────────

async function getRewardRoles(guildId) {
  return a(guildId,
    'SELECT * FROM invite_reward_roles WHERE guild_id = ? ORDER BY min_qualified ASC',
    [guildId]
  )
}

async function addRewardRole(guildId, roleId, minQualified, permanent, durationDays) {
  await r(guildId,
    `INSERT INTO invite_reward_roles (guild_id, role_id, min_qualified, permanent, duration_days)
     VALUES (?, ?, ?, ?, ?)`,
    [guildId, roleId, minQualified, permanent ? 1 : 0, durationDays || 7]
  )
}

async function removeRewardRole(guildId, id) {
  await r(guildId,
    'DELETE FROM invite_reward_roles WHERE guild_id = ? AND id = ?',
    [guildId, id]
  )
}

// ─── Active Temporary Rewards ─────────────────────────────────────────────────

async function addActiveReward(guildId, userId, roleId, expiresAt) {
  await r(guildId,
    `INSERT INTO invite_active_rewards (guild_id, user_id, role_id, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id, role_id) DO UPDATE SET expires_at = excluded.expires_at`,
    [guildId, userId, roleId, expiresAt]
  )
}

async function getExpiredRewards(guildId) {
  return a(guildId,
    'SELECT * FROM invite_active_rewards WHERE guild_id = ? AND expires_at <= ?',
    [guildId, Date.now()]
  )
}

async function removeActiveReward(guildId, userId, roleId) {
  await r(guildId,
    'DELETE FROM invite_active_rewards WHERE guild_id = ? AND user_id = ? AND role_id = ?',
    [guildId, userId, roleId]
  )
}

module.exports = {
  // Config
  getConfig, setAtivo, setCanalLogs, setCanalRanking, setCanalRankingPinned, setRankingMessageId,
  setMilestoneInterval, setMinDaysQualified, setCriteria,
  // Stats
  getStats, upsertStats, addValido, decrementValido, getLeaderboard, resetGuild, resetUser,
  // Membros
  getMembro, setMembro, markMembroSaiu, qualifyMember, handleMemberLeave, getPendingMembers, getPendingByInviter,
  // Activity
  getActivity, trackMessage, flagSpam,
  // Reward roles
  getRewardRoles, addRewardRole, removeRewardRole,
  // Active temporary rewards
  addActiveReward, getExpiredRewards, removeActiveReward,
}
