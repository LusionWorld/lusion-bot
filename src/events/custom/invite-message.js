const { Events } = require('discord.js')
const db = require('../../utils/invite/database')

module.exports = {
  name: Events.MessageCreate,

  async execute(_client, message) {
    if (!message.guild || message.author.bot) return

    const { guild, member, channelId } = message

    const config = await db.getConfig(guild.id).catch(() => null)
    if (!config?.ativo) return

    // Only track messages for pending members (not yet qualified)
    const membro = await db.getMembro(guild.id, member.id).catch(() => null)
    if (!membro || membro.status !== 'pending' || membro.saiu) return

    await db.trackMessage(guild.id, member.id, channelId).catch(() => {})
  },
}
