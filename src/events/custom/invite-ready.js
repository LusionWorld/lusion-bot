const { Events } = require('discord.js')

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    if (!client.inviteCache) client.inviteCache = new Map()

    for (const [, guild] of client.guilds.cache) {
      try {
        const invites = await guild.invites.fetch()
        const cache = new Map()
        invites.forEach(inv => cache.set(inv.code, inv.uses))
        client.inviteCache.set(guild.id, cache)
      } catch { }
    }

    console.log(`✅ Cache de convites carregado para ${client.inviteCache.size} servidor(es)`)
  },
}
