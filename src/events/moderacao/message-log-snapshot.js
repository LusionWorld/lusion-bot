const modDb = require('../../utils/moderacao/database')
const messageLog = require('../../utils/moderacao/message-log-database')

module.exports = {
  name: 'messageCreate',

  async execute(_client, message) {
    try {
      const guild = message.guild
      if (!guild) return

      const config = await modDb.getConfig(guild.id)
      if (!config?.canal_msg_delete) return

      await messageLog.saveMessage({
        messageId: message.id,
        guildId: guild.id,
        channelId: message.channelId,
        authorId: message.author?.id,
        authorTag: message.author?.tag,
        authorBot: message.author?.bot,
        content: message.content,
        createdAt: message.createdTimestamp,
      })
    } catch (err) {
      console.error('[Logs:messageCreate snapshot]', err.message)
    }
  },
}
