const { ContainerBuilder, SeparatorSpacingSize, MessageFlags, AuditLogEvent } = require('discord.js')
const db = require('../../utils/moderacao/database')
const emojis = require('../../utils/emojis/emojis.json')

function timeAgo(ms) {
  const diff = Date.now() - ms
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'less than 1 day'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 month'
  if (months < 12) return `${months} months`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 year' : `${years} years`
}

module.exports = {
  name: 'guildMemberRemove',

  async execute(client, member) {
    try {
      const key = `${member.guild.id}:${member.user.id}`
      if (client._bannedUsers?.has(key)) return

      const config = await db.getConfig(member.guild.id)
      if (!config) return

      const user = await member.user.fetch(true).catch(() => member.user)

      await new Promise(r => setTimeout(r, 1500))

      if (client._bannedUsers?.has(key)) return

      let wasKicked = false
      let kickExecutor = null
      let kickReason = 'No reason provided'

      try {
        const auditLogs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 })
        const entry = auditLogs.entries.find(e =>
          e.target?.id === user.id && Date.now() - e.createdTimestamp < 5000
        )
        if (entry) {
          wasKicked = true
          kickExecutor = entry.executor
          kickReason = entry.reason || 'No reason provided'
        }
      } catch {}

      if (wasKicked) {
        const canalId = config.canal_kick
        if (!canalId) return

        const channel = await member.guild.channels.fetch(canalId).catch(() => null)
        if (!channel?.isTextBased()) return

        const container = new ContainerBuilder()
          .setAccentColor(0xE67E22)
          .addTextDisplayComponents(td =>
            td.setContent(`${emojis.hammer} **Member kicked,** ${member}`)
          )
          .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(td =>
            td.setContent(
              `${emojis.user} **ID:** ${user.id}\n` +
              `${emojis.account} **Kicked by:** ${kickExecutor ?? 'Unknown'}\n` +
              `${emojis.warning} **Reason:** ${kickReason}`
            )
          )

        await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 })

      } else {
        const canalId = config.canal_saiu
        if (!canalId) return

        const channel = await member.guild.channels.fetch(canalId).catch(() => null)
        if (!channel?.isTextBased()) return

        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 256 })
        const joinedAgo = member.joinedTimestamp ? timeAgo(member.joinedTimestamp) : null

        const container = new ContainerBuilder()
          .setAccentColor(0x95A5A6)
          .addTextDisplayComponents(td =>
            td.setContent(`${emojis.cancel} **Member left,** ${member}`)
          )
          .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addSectionComponents(section =>
            section
              .addTextDisplayComponents(td =>
                td.setContent(
                  `${emojis.user} **ID:** ${user.id}\n` +
                  (joinedAgo ? `${emojis.clock} **Joined** ${joinedAgo} ago\n` : '') +
                  `${emojis.users} **Total members:** ${member.guild.memberCount}`
                )
              )
              .setThumbnailAccessory(thumb => thumb.setURL(avatarURL))
          )

        await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 })
      }
    } catch (err) {
      console.error('[mod] Error in guildMemberRemove:', err.message)
    }
  },
}
