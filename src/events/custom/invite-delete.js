const { Events } = require('discord.js')
const db = require('../../utils/invite/database')

module.exports = {
  name: Events.InviteDelete,
  async execute(client, invite) {
    const guild = invite.guild
    if (!guild) return

    const config = await db.getConfig(guild.id)
    if (!config?.ativo) return

    if (!client.inviteCache) return

    setTimeout(() => {
      const cache = client.inviteCache.get(guild.id)
      if (!cache) return
      cache.delete(invite.code)
    }, 10000)
  },
}
