const { Events } = require('discord.js')
const db = require('../../utils/invite/database')

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(_client, member) {
    const { guild } = member

    const config = await db.getConfig(guild.id)
    if (!config?.ativo) return

    try {
      await db.handleMemberLeave(guild.id, member.id)
    } catch (err) {
      console.error('❌ Erro no invite tracker (remove):', err)
    }
  },
}
