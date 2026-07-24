const { Events } = require('discord.js')
const db = require('../../utils/invite/database')

module.exports = {
  name: Events.InviteCreate,
  async execute(client, invite) {
    const guild = invite.guild
    if (!guild) return

    const config = await db.getConfig(guild.id)
    if (!config?.ativo) return

    if (!client.inviteCache) client.inviteCache = new Map()
    const cache = client.inviteCache.get(guild.id) || new Map()

    cache.set(invite.code, {
      uses: invite.uses ?? 0,
      maxUses: invite.maxUses,
      inviterId: invite.inviter?.id ?? null,
    })

    client.inviteCache.set(guild.id, cache)
  },
}
