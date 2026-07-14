const { ContainerBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js')
const db = require('../../utils/moderacao/database')
const emojis = require('../../utils/emojis/emojis.json')

module.exports = {
  name: 'messageUpdate',

  async execute(_client, oldMessage, newMessage) {
    try {
      const guild = newMessage.guild
      if (!guild) return
      if (newMessage.author?.bot) return
      if (oldMessage.content === newMessage.content) return // embed/link preview refresh, not a real edit

      const config = await db.getConfig(guild.id)
      const canalId = config?.canal_msg_edit
      if (!canalId) return

      const channel = await guild.channels.fetch(canalId).catch(() => null)
      if (!channel?.isTextBased()) return

      const author = newMessage.author
        ? `<@${newMessage.author.id}> \`${newMessage.author.id}\``
        : `${emojis.warning} Unknown (uncached)`

      const before = (oldMessage.partial || !oldMessage.content)
        ? `${emojis.warning} *Unavailable (uncached message)*`
        : oldMessage.content.length > 500
          ? `${oldMessage.content.slice(0, 500)}...`
          : oldMessage.content

      const after = newMessage.content
        ? (newMessage.content.length > 500 ? `${newMessage.content.slice(0, 500)}...` : newMessage.content)
        : `${emojis.warning} *Empty*`

      const container = new ContainerBuilder()
        .setAccentColor(0xF1C40F) // yellow — message edited
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.brush} **Message edited**`)
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(
            `${emojis.user} **Author:** ${author}\n` +
            `${emojis.textc} **Channel:** <#${newMessage.channelId}>\n` +
            `${emojis.clock} **Time:** <t:${Math.floor(Date.now() / 1000)}:f>\n\n` +
            `${emojis.trashcan} **Before:**\n${before}\n\n` +
            `${emojis.success} **After:**\n${after}` +
            (newMessage.url ? `\n\n[Jump to message](${newMessage.url})` : '')
          )
        )

      await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 })
    } catch (err) {
      console.error('[Logs:messageUpdate]', err.message)
    }
  },
}
