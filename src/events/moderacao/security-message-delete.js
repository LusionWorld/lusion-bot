const { ContainerBuilder, SeparatorSpacingSize, MessageFlags, AuditLogEvent } = require('discord.js')
const db = require('../../utils/moderacao/database')
const emojis = require('../../utils/emojis/emojis.json')

module.exports = {
  name: 'messageDelete',

  async execute(_client, message) {
    try {
      const guild = message.guild
      if (!guild) return
      if (message.author?.bot) return

      const config = await db.getConfig(guild.id)
      const canalId = config?.canal_msg_delete
      if (!canalId) return

      const channel = await guild.channels.fetch(canalId).catch(() => null)
      if (!channel?.isTextBased()) return

      const author = message.author
        ? `<@${message.author.id}> \`${message.author.id}\``
        : `${emojis.warning} Unknown (uncached)`

      const content = (message.partial || !message.content)
        ? `${emojis.warning} *Content unavailable (uncached message)*`
        : message.content.length > 500
          ? `${message.content.slice(0, 500)}...`
          : message.content

      await new Promise(r => setTimeout(r, 1000))

      // Audit logs only record an entry when someone deletes another member's message
      let deletedBy = message.author ? `<@${message.author.id}> *(self-deleted)*` : `${emojis.warning} Unknown`
      try {
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 1 })
        const entry = logs.entries.first()
        if (
          entry &&
          (Date.now() - entry.createdTimestamp) < 5_000 &&
          entry.extra?.channel?.id === message.channelId &&
          (!message.author || entry.target?.id === message.author.id)
        ) {
          deletedBy = `<@${entry.executor.id}> \`${entry.executor.id}\``
        }
      } catch {}

      const container = new ContainerBuilder()
        .setAccentColor(0x9B59B6) // purple — message deleted
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.trashcan} **Message deleted**`)
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(
            `${emojis.user} **Author:** ${author}\n` +
            `${emojis.hammer} **Deleted by:** ${deletedBy}\n` +
            `${emojis.textc} **Channel:** <#${message.channelId}>\n` +
            `${emojis.clock} **Time:** <t:${Math.floor(Date.now() / 1000)}:f>\n\n` +
            `${emojis.message} **Content:**\n${content}`
          )
        )

      await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 })
    } catch (err) {
      console.error('[Logs:messageDelete]', err.message)
    }
  },
}
