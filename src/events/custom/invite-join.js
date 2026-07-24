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
      currentInvites.forEach(inv => newCache.set(inv.code, {
        uses: inv.uses,
        maxUses: inv.maxUses,
        inviterId: inv.inviter?.id ?? null,
      }))

      let usedInvite = null

      for (const [code, inv] of currentInvites) {
        const prevUses = cachedInvites.get(code)?.uses ?? 0
        if (inv.uses > prevUses) {
          usedInvite = { code, inviterId: inv.inviter?.id ?? null }
          break
        }
      }

      if (!usedInvite) {
        for (const [code, cached] of cachedInvites) {
          if (currentInvites.has(code)) continue
          if (cached.maxUses && cached.uses === cached.maxUses - 1) {
            usedInvite = { code, inviterId: cached.inviterId }
            break
          }
        }
      }

      client.inviteCache.set(guild.id, newCache)

      if (!usedInvite?.inviterId) return

      await db.setMembro(guild.id, member.id, {
        inviterId:   usedInvite.inviterId,
        inviteCode:  usedInvite.code,
        entrou:      Date.now(),
      })
    } catch (err) {
      console.error('❌ Erro no invite tracker (join):', err)
    }
  },
}
