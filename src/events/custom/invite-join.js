const { Events } = require('discord.js')
const db = require('../../utils/invite/database')

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(client, member) {
    const { guild } = member

    const config = await db.getConfig(guild.id)
    if (!config?.ativo) return

    try {
      if (!client.inviteCache) client.inviteCache = new Map()

      const cachedInvites = client.inviteCache.get(guild.id) || new Map()
      const currentInvites = await guild.invites.fetch().catch(() => null)
      if (!currentInvites) return

      const newCache = new Map()
      currentInvites.forEach(inv => newCache.set(inv.code, inv.uses))
      client.inviteCache.set(guild.id, newCache)

      let usedInvite = null
      for (const [, inv] of currentInvites) {
        if (inv.uses > (cachedInvites.get(inv.code) || 0)) {
          usedInvite = inv
          break
        }
      }

      if (!usedInvite?.inviter) return

      await db.setMembro(guild.id, member.id, {
        inviterId:   usedInvite.inviter.id,
        inviteCode:  usedInvite.code,
        entrou:      Date.now(),
      })
    } catch (err) {
      console.error('❌ Erro no invite tracker (join):', err)
    }
  },
}
