const { MessageFlags } = require('discord.js')
const cron = require('node-cron')
const db   = require('../../utils/supporter/database')
const {
  buildDmContainer,
  buildLogContainer,
  buildReportContainer,
  buildTemplateTypeList,
} = require('../../utils/supporter/manager')
const { DEFAULT_TEMPLATES } = require('../../utils/supporter/database')

// ─── Debounce map: prevents duplicate events on rapid role changes ────────────
const debounceMap = new Map()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHighestTier(memberRoles, tierRoles) {
  const matching = tierRoles.filter(t => memberRoles.cache.has(t.role_id))
  if (!matching.length) return null
  return matching.sort((a, b) => b.tier_level - a.tier_level)[0]
}

function getTemplateKey(eventType, newTier) {
  if (eventType === 'cancelled') return 'cancelled'
  const prefix = eventType === 'new_supporter' ? 'new' : eventType
  return `${prefix}_${newTier.tier_level}`
}

async function getEffectiveTemplate(conn, templateKey) {
  const stored = await conn.getTemplate(templateKey)
  if (stored) return stored
  return DEFAULT_TEMPLATES[templateKey] ?? null
}

async function sendLog(client, guild, conn, { userId, eventType, oldTier, newTier, dmSent }) {
  const logsEnabled = await conn.getConfig('logs_enabled', 'true')
  if (logsEnabled !== 'true') return

  const logChannelId = await conn.getConfig('log_channel_id')
  if (!logChannelId) return

  const ch = guild.channels.cache.get(logChannelId)
  if (!ch) return

  await ch.send({
    components: [buildLogContainer({
      userId,
      eventType,
      oldTier:   oldTier?.tier_name ?? null,
      newTier:   newTier?.tier_name ?? null,
      timestamp: new Date().toISOString(),
    })],
    flags: [MessageFlags.IsComponentsV2],
  }).catch(err => console.error('[Supporter] Failed to send log:', err.message))
}

async function processRoleChange(client, originalOldMember, newMember) {
  const guild = newMember.guild
  const conn  = db.getConnection(guild.id)
  await conn.ready

  const tierRoles = await conn.getTierRoles()
  if (!tierRoles.length) return

  const oldHighest = getHighestTier(originalOldMember.roles, tierRoles)
  const newHighest = getHighestTier(newMember.roles, tierRoles)

  if (oldHighest?.role_id === newHighest?.role_id) return

  // Determine event type
  let eventType
  if (!oldHighest && newHighest)  eventType = 'new_supporter'
  else if (oldHighest && !newHighest) eventType = 'cancelled'
  else if (newHighest.tier_level > oldHighest.tier_level) eventType = 'upgrade'
  else eventType = 'downgrade'

  // Update monthly stats
  const statKey = eventType === 'new_supporter' ? 'new_supporter' : eventType
  await conn.incrementStat(statKey).catch(() => {})

  // Send DM
  const dmEnabled = await conn.getConfig('dm_enabled', 'true')
  let dmSent = false

  if (dmEnabled === 'true') {
    const templateKey = getTemplateKey(eventType, newHighest)
    const template    = await getEffectiveTemplate(conn, templateKey)

    if (template && template.enabled !== 0 && template.enabled !== false) {
      const container = buildDmContainer(template, {
        tierName:  newHighest?.tier_name ?? '',
        guildName: guild.name,
      })

      try {
        const user = await client.users.fetch(newMember.id)
        await user.send({
          components: [container],
          flags: [MessageFlags.IsComponentsV2],
        })
        dmSent = true
        console.log(`[Supporter] DM sent to ${newMember.user.tag} (${eventType})`)
      } catch (err) {
        console.warn(`[Supporter] Could not DM ${newMember.user.tag}: ${err.message}`)
        // Log DM failure
        await sendLog(client, guild, conn, {
          userId:    newMember.id,
          eventType: 'dm_failed',
          oldTier:   oldHighest,
          newTier:   newHighest,
          dmSent:    false,
        })
      }
    }
  }

  // Log event
  await conn.logEvent(newMember.id, eventType, oldHighest?.tier_name ?? null, newHighest?.tier_name ?? null, dmSent)
    .catch(() => {})
  await sendLog(client, guild, conn, {
    userId:    newMember.id,
    eventType,
    oldTier:   oldHighest,
    newTier:   newHighest,
    dmSent,
  })
}

// ─── Monthly report sender ────────────────────────────────────────────────────

async function sendMonthlyReport(client) {
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const conn = db.getConnection(guildId)
      await conn.ready

      const reportEnabled = await conn.getConfig('report_enabled', 'false')
      if (reportEnabled !== 'true') continue

      const reportChannelId = await conn.getConfig('report_channel_id')
      if (!reportChannelId) continue

      const ch = guild.channels.cache.get(reportChannelId)
      if (!ch) continue

      // Get last month's stats
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      const lastMonth = d.toISOString().slice(0, 7)
      const monthLabel = d.toLocaleString('en-US', { month: 'long', year: 'numeric' })

      const stats = await conn.getMonthlyStats(lastMonth)

      // Count current supporters in guild (members with any tier role)
      const tierRoles = await conn.getTierRoles()
      let totalNow = 0
      try {
        await guild.members.fetch()
        for (const [, member] of guild.members.cache) {
          if (tierRoles.some(t => member.roles.cache.has(t.role_id))) totalNow++
        }
      } catch {}

      await ch.send({
        components: [buildReportContainer(stats, monthLabel, totalNow)],
        flags: [MessageFlags.IsComponentsV2],
      }).catch(err => console.error(`[Supporter] Report send failed (${guildId}):`, err.message))

      console.log(`[Supporter] Monthly report sent for ${guild.name}`)
    } catch (err) {
      console.error(`[Supporter] Report error (${guildId}):`, err.message)
    }
  }
}

// ─── Event export ─────────────────────────────────────────────────────────────

module.exports = {
  name: 'guildMemberUpdate',
  once: false,
  async execute(client, oldMember, newMember) {
    if (newMember.user.bot) return

    const key = `${newMember.guild.id}_${newMember.id}`

    // Capture the EARLIEST "before" state across rapid changes
    const existing    = debounceMap.get(key)
    const originalOld = existing?.originalOld ?? oldMember

    if (existing) clearTimeout(existing.timer)

    const timer = setTimeout(async () => {
      debounceMap.delete(key)
      await processRoleChange(client, originalOld, newMember).catch(err =>
        console.error('[Supporter] processRoleChange error:', err.message),
      )
    }, 1_000)

    debounceMap.set(key, { timer, originalOld })
  },
}
