const { ContainerBuilder, SeparatorSpacingSize, MessageFlags, AuditLogEvent } = require('discord.js')
const db = require('../../utils/moderacao/database')
const messageLog = require('../../utils/moderacao/message-log-database')
const emojis = require('../../utils/emojis/emojis.json')

module.exports = {
  name: 'messageDelete',

  async execute(_client, message) {
    try {
      const guild = message.guild
      if (!guild) return

      const config = await db.getConfig(guild.id)
      const canalId = config?.canal_msg_delete
      if (!canalId) return

      const snapshot = await messageLog.getMessage(message.id)

      const authorId = snapshot?.author_id ?? message.author?.id ?? null
      const authorIsBot = snapshot ? !!snapshot.author_bot : !!message.author?.bot
      const author = authorId
        ? `<@${authorId}> \`${authorId}\``
        : `${emojis.warning} Unknown (uncached)`

      const rawContent = snapshot?.content ?? (!message.partial ? message.content : null)
      const content = rawContent
        ? (rawContent.length > 500 ? `${rawContent.slice(0, 500)}...` : rawContent)
        : `${emojis.warning} *Content unavailable (uncached message)*`

      await new Promise(r => setTimeout(r, 1000))

      let executorId = null
      try {
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 })
        const entry = logs.entries.find(e =>
          (Date.now() - e.createdTimestamp) < 10_000 &&
          e.extra?.channel?.id === message.channelId &&
          (!authorId || e.target?.id === authorId)
        )
        if (entry) executorId = entry.executor.id
      } catch {}

      if (!executorId && authorIsBot) {
        return
      }

      const deletedBy = executorId
        ? `<@${executorId}> \`${executorId}\``
        : authorId
          ? `<@${authorId}> *(self-deleted)*`
          : `${emojis.warning} Unknown`

      await messageLog.markDeleted(message.id, executorId ?? authorId ?? null)

      const channel = await guild.channels.fetch(canalId).catch(() => null)
      if (!channel?.isTextBased()) return

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
