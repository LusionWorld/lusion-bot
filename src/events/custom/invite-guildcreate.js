const { Events } = require('discord.js')

module.exports = {
  name: Events.GuildCreate,
  async execute(client, guild) {
    if (!client.inviteCache) client.inviteCache = new Map()
    try {
      const invites = await guild.invites.fetch()
      const cache = new Map()
      invites.forEach(inv => cache.set(inv.code, inv.uses))
      client.inviteCache.set(guild.id, cache)
    } catch { }
  },
}
