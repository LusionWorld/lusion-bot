/**
 * security-destroy.js
 *
 * Listens for channelDelete and roleDelete events.
 * When a member exceeds the configured threshold (e.g. deletes ≥3 channels
 * within 30 seconds), the bot:
 *   1. Sends an alert to the configured alert channel
 *   2. Removes the configured "action role" from the executor (if set)
 *   3. Times out the executor (if protect_action_timeout > 0)
 *
 * Two separate event exports are returned as an array so the eventsHandler
 * can register both from a single file. However, since eventsHandler reads
 * one export per file, we use a tiny shared module pattern: we register
 * both events inside module.exports and expose a single execute that checks
 * the event type passed in.
 *
 * To keep things clean we actually export two separate event modules but in
 * the same file via a multi-export approach – but since eventsHandler only
 * picks up `module.exports = { name, execute }`, we handle both in ONE
 * event name by binding to a custom internal dispatcher instead.
 *
 * Simplest approach: a helper module that holds the tracker + handler, then
 * two separate small event files require it.  We put everything here and
 * require from the two small shim files.
 */

const { AuditLogEvent } = require('discord.js')

const db = require('../../utils/moderacao/security-database')
const { sendSecurityAlert } = require('../../utils/moderacao/security-helpers')
const emojis = require('../../utils/emojis/emojis.json')

// ─── In-memory trackers ────────────────────────────────────────────────────
// destroyTracker: guildId → executorId → { channelNames: string[], roleNames: string[], firstSeen: number }
const destroyTracker = new Map()

function freshEntry() {
  return { channelNames: [], roleNames: [], firstSeen: Date.now() }
}

function getTracker(guildId, executorId) {
  if (!destroyTracker.has(guildId)) destroyTracker.set(guildId, new Map())
  const gMap = destroyTracker.get(guildId)
  if (!gMap.has(executorId)) gMap.set(executorId, freshEntry())
  return gMap.get(executorId)
}

function resetTracker(guildId, executorId) {
  destroyTracker.get(guildId)?.set(executorId, freshEntry())
}

// ─── Shared handler ────────────────────────────────────────────────────────
async function handleDestroy(client, guild, type /* 'channel' | 'role' */, targetName) {
  try {
    const cfg = await db.getConfig(guild.id)
    if (!cfg || !cfg.system_enabled || !cfg.protect_enabled) return

    // Fetch audit log to find executor
    await new Promise(r => setTimeout(r, 600))

    const auditType = type === 'channel'
      ? AuditLogEvent.ChannelDelete
      : AuditLogEvent.RoleDelete

    let executor = null
    try {
      const logs = await guild.fetchAuditLogs({ type: auditType, limit: 1 })
      const entry = logs.entries.first()
      if (entry && (Date.now() - entry.createdTimestamp) < 8_000) {
        executor = entry.executor
      }
    } catch {}

    if (!executor) return                        // can't determine who did it
    if (executor.id === client.user.id) return   // bot itself

    // ── Exempt role check (fetch fresh to avoid stale cache) ──────
    const exemptRoles = JSON.parse(cfg.protect_exempt_roles || '[]')
    if (exemptRoles.length) {
      let executorMemberCheck = null
      try { executorMemberCheck = await guild.members.fetch(executor.id) } catch {}
      if (executorMemberCheck) {
        const hasExempt = exemptRoles.some(rId => executorMemberCheck.roles.cache.has(rId))
        if (hasExempt) return
      }
    }

    const now = Date.now()
    let tracker = getTracker(guild.id, executor.id)
    const windowMs = cfg.protect_window_sec * 1_000

    // Reset if outside window
    if (now - tracker.firstSeen > windowMs) {
      resetTracker(guild.id, executor.id)
      tracker = getTracker(guild.id, executor.id)
    }

    // Record the deleted target
    if (type === 'channel') tracker.channelNames.push(targetName)
    else tracker.roleNames.push(targetName)

    const channelThreshHit = tracker.channelNames.length >= cfg.protect_channel_threshold
    const roleThreshHit    = tracker.roleNames.length    >= cfg.protect_role_threshold

    if (!channelThreshHit && !roleThreshHit) return

    // Snapshot the lists BEFORE resetting (reset replaces the object)
    const channelsDeleted = [...tracker.channelNames]
    const rolesDeleted    = [...tracker.roleNames]

    // Threshold exceeded — reset so we don't spam actions
    resetTracker(guild.id, executor.id)

    const triggeredBy = channelThreshHit
      ? `${channelsDeleted.length} channels deleted`
      : `${rolesDeleted.length} roles deleted`

    // Build a friendly list of what was deleted (cap at ~15 items to avoid bloat)
    function fmtList(arr, prefix) {
      const shown = arr.slice(0, 15).map(n => `\`${prefix}${n}\``).join(', ')
      return arr.length > 15 ? `${shown} *(+${arr.length - 15} more)*` : shown
    }

    const deletedChannelsText = channelsDeleted.length ? fmtList(channelsDeleted, '#') : null
    const deletedRolesText    = rolesDeleted.length    ? fmtList(rolesDeleted, '@')   : null

    // ── Fetch member fresh (bypass cache) ────────────────────────
    let member = null
    try {
      member = await guild.members.fetch({ user: executor.id, force: true })
    } catch {}

    const actionsApplied = []

    if (member) {
      // Ensure the bot's own member is fresh too so hierarchy is accurate
      const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null)
      const botHighest = botMember?.roles.highest

      // Remove ALL roles the bot can reach (respects role hierarchy)
      const removableRoles = member.roles.cache.filter(role =>
        role.id !== guild.id &&   // skip @everyone
        botHighest &&
        botHighest.comparePositionTo(role) > 0
      )

      if (removableRoles.size > 0) {
        try {
          // Bulk-set to only @everyone — fastest and atomic
          await member.roles.set([guild.id], 'Security: mass-destroy threshold exceeded')
          actionsApplied.push(`All ${removableRoles.size} role(s) removed`)
        } catch {
          // Fallback: remove individually so a single failure doesn't block the rest
          let removed = 0
          for (const [, role] of removableRoles) {
            try {
              await member.roles.remove(role, 'Security: mass-destroy threshold exceeded')
              removed++
            } catch {}
          }
          if (removed > 0) actionsApplied.push(`Removed ${removed}/${removableRoles.size} role(s) individually`)
        }
      }

      // Apply timeout if configured
      if (cfg.protect_action_timeout > 0 && member.moderatable) {
        try {
          const ms = cfg.protect_action_timeout * 60_000
          await member.timeout(ms, 'Security: mass-destroy threshold exceeded')
          actionsApplied.push(`Timed out for ${cfg.protect_action_timeout} minutes`)
        } catch {}
      }

      // DM the executor
      await executor.send(
        `${emojis.danger} **Automatic Action in ${guild.name}**\n` +
        `You triggered the server protection system by deleting too many ${type === 'channel' ? 'channels' : 'roles'} in a short period.\n` +
        (actionsApplied.length ? `Actions taken: ${actionsApplied.join(', ')}` : '')
      ).catch(() => {})
    }

    // ── Send alert (always HIGH priority) ─────────────────────────
    const alertFields = {
      Executor: `<@${executor.id}> \`${executor.id}\``,
      Trigger:  `${triggeredBy} within ${cfg.protect_window_sec}s`,
    }
    if (deletedChannelsText) alertFields['Channels deleted'] = deletedChannelsText
    if (deletedRolesText)    alertFields['Roles deleted']    = deletedRolesText

    await sendSecurityAlert(guild, cfg, {
      title: 'Server Protection Triggered — Mass Destroy',
      fields: alertFields,
      priority: 'high',
      footer: actionsApplied.length
        ? `${emojis.hammer} **Actions applied:** ${actionsApplied.join(' • ')}`
        : `${emojis.warning} No actions configured — configure timeout in Server Protection.`,
    })

  } catch (err) {
    console.error('[Security:destroy]', err.message)
  }
}

module.exports = { handleDestroy }
