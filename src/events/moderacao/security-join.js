const db = require('../../utils/moderacao/security-database')
const { sendSecurityAlert } = require('../../utils/moderacao/security-helpers')
const emojis = require('../../utils/emojis/emojis.json')

// In-memory join spike tracker: guildId → [timestamps]
const joinTracker = new Map()

const SPIKE_THRESHOLD = 10      // joins
const SPIKE_WINDOW_MS = 60_000  // within 1 minute

module.exports = {
  name: 'guildMemberAdd',

  async execute(_client, member) {
    try {
      const { guild } = member
      const cfg = await db.getConfig(guild.id)
      if (!cfg || !cfg.system_enabled) return

      const now = Date.now()
      if (!joinTracker.has(guild.id)) joinTracker.set(guild.id, [])

      const times = joinTracker.get(guild.id).filter(t => now - t < SPIKE_WINDOW_MS)
      times.push(now)
      joinTracker.set(guild.id, times)

      if (cfg.notify_join_spike && times.length >= SPIKE_THRESHOLD) {
        joinTracker.set(guild.id, []) // reset to avoid alert spam

        await sendSecurityAlert(guild, cfg, {
          title: 'Join Spike — Possible Raid',
          fields: {
            'Joins (60s)':    `**${times.length}** members`,
            'Total members':  guild.memberCount,
            'Latest join':    `<@${member.id}> \`${member.id}\``,
          },
          priority: 'high',
          footer: `${emojis.info} Consider enabling slow-mode or temporarily restricting new member permissions.`,
        })
      }

      if (cfg.trust_enabled) {
        const joinedAt = member.joinedTimestamp || Date.now()
        await db.upsertMemberTrust(guild.id, member.id, joinedAt).catch(() => {})
      }
    } catch (err) {
      console.error('[Security:guildMemberAdd]', err.message)
    }
  },
}
