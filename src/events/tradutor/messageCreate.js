const db = require('../../utils/tradutor/database')

const GLOBE = '🌐'

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(client, message) {
    if (message.author.bot)          return
    if (!message.guild)              return
    if (!message.content?.trim())    return
    if (message.embeds.length > 0)   return
    if (message.components.length > 0) return
    if (message.system)              return

    try {
      const channelId = await db.getChannel(message.guild.id)
      if (!channelId || message.channel.id !== channelId) return

      await message.react(GLOBE).catch(() => {})
    } catch (err) {
      console.error('[AutoTranslate:messageCreate]', err.message)
    }
  },
}
