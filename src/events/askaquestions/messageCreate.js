const db = require('../../utils/askaquestions/database')

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(client, message) {
    if (message.author.bot) return
    if (!message.guild)     return

    try {
      const conn         = db.getConnection(message.guild.id)
      const askChannelId = conn.getConfig('ask_channel_id')
      if (!askChannelId || message.channel.id !== askChannelId) return

      await message.delete().catch(() => {})
    } catch {}
  },
}
