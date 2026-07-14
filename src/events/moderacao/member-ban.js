const { ContainerBuilder, SeparatorSpacingSize, MessageFlags, AuditLogEvent } = require('discord.js')
const db = require('../../utils/moderacao/database')
const emojis = require('../../utils/emojis/emojis.json')

module.exports = {
  name: 'guildBanAdd',

  async execute(client, ban) {
    if (!client._bannedUsers) client._bannedUsers = new Set()
    client._bannedUsers.add(`${ban.guild.id}:${ban.user.id}`)
    setTimeout(() => client._bannedUsers.delete(`${ban.guild.id}:${ban.user.id}`), 10000)

    try {
      const config = await db.getConfig(ban.guild.id)
      const canalId = config?.canal_ban
      if (!canalId) return

      const channel = await ban.guild.channels.fetch(canalId).catch(() => null)
      if (!channel?.isTextBased()) return

      const user = await ban.user.fetch(true).catch(() => ban.user)

      await new Promise(r => setTimeout(r, 1000))

      let banExecutor = null
      let banReason = ban.reason || 'Nenhum motivo informado'

      try {
        const auditLogs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 })
        const entry = auditLogs.entries.find(e =>
          e.target?.id === user.id && Date.now() - e.createdTimestamp < 8000
        )
        if (entry) {
          banExecutor = entry.executor
          if (entry.reason) banReason = entry.reason
        }
      } catch {}

      const container = new ContainerBuilder()
        .setAccentColor(0xE74C3C) // red — member banned
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.block} **Membro banido,** ${user}`)
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(
            `${emojis.user} **ID:** ${user.id}\n` +
            `${emojis.hammer} **Banido por:** ${banExecutor ?? 'Desconhecido'}\n` +
            `${emojis.warning} **Motivo:** ${banReason}`
          )
        )

      await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 })
    } catch (err) {
      console.error('[mod] Erro em guildBanAdd:', err.message)
    }
  },
}
