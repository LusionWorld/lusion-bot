const { ContainerBuilder, SeparatorSpacingSize, MessageFlags, AuditLogEvent } = require('discord.js')
const db = require('../../utils/moderacao/database')
const emojis = require('../../utils/emojis/emojis.json')

module.exports = {
  name: 'guildMemberUpdate',

  async execute(client, oldMember, newMember) {
    try {
      const oldUntil = oldMember.communicationDisabledUntilTimestamp
      const newUntil = newMember.communicationDisabledUntilTimestamp

      const wasTimedOut = oldUntil && oldUntil > Date.now()
      const isTimedOut = newUntil && newUntil > Date.now()

      if (wasTimedOut || !isTimedOut) return

      const config = await db.getConfig(newMember.guild.id)
      const canalId = config?.canal_timeout
      if (!canalId) return

      const channel = await newMember.guild.channels.fetch(canalId).catch(() => null)
      if (!channel?.isTextBased()) return

      await new Promise(r => setTimeout(r, 1000))

      let executor = null
      let reason = 'No reason provided'

      try {
        const auditLogs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 5 })
        const entry = auditLogs.entries.find(e =>
          e.target?.id === newMember.id &&
          Date.now() - e.createdTimestamp < 8000 &&
          e.changes?.some(c => c.key === 'communication_disabled_until')
        )
        if (entry) {
          executor = entry.executor
          if (entry.reason) reason = entry.reason
        }
      } catch {}

      const container = new ContainerBuilder()
        .setAccentColor(0xF1C40F)
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.timedout} **Member timed out,** ${newMember}`)
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(
            `${emojis.user} **ID:** ${newMember.id}\n` +
            `${emojis.hammer} **Timed out by:** ${executor ?? 'Unknown'}\n` +
            `${emojis.clock} **Until:** <t:${Math.floor(newUntil / 1000)}:f>\n` +
            `${emojis.warning} **Reason:** ${reason}`
          )
        )

      await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 })
    } catch (err) {
      console.error('[mod] Error in guildMemberUpdate (timeout):', err.message)
    }
  },
}
