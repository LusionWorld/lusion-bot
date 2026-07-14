const { ContainerBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, AuditLogEvent } = require('discord.js')
const db = require('../../utils/moderacao/database')
const emojis = require('../../utils/emojis/emojis.json')

function timeAgo(ms) {
  const diff = Date.now() - ms
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'menos de 1 dia'
  if (days === 1) return '1 dia'
  if (days < 30) return `${days} dias`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 mês'
  if (months < 12) return `${months} meses`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 ano' : `${years} anos`
}

module.exports = {
  name: 'guildMemberRemove',

  async execute(client, member) {
    try {
      const key = `${member.guild.id}:${member.user.id}`
      if (client._bannedUsers?.has(key)) return

      const config = await db.getConfig(member.guild.id)
      if (!config) return

      const user = await member.user.fetch(true).catch(() => member.user)

      await new Promise(r => setTimeout(r, 1500))

      if (client._bannedUsers?.has(key)) return

      let wasKicked = false
      let kickExecutor = null
      let kickReason = 'Nenhum motivo informado'

      try {
        const auditLogs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 })
        const entry = auditLogs.entries.find(e =>
          e.target?.id === user.id && Date.now() - e.createdTimestamp < 5000
        )
        if (entry) {
          wasKicked = true
          kickExecutor = entry.executor
          kickReason = entry.reason || 'Nenhum motivo informado'
        }
      } catch {}

      if (wasKicked) {
        const canalId = config.canal_kick
        if (!canalId) return

        const channel = await member.guild.channels.fetch(canalId).catch(() => null)
        if (!channel?.isTextBased()) return

        const container = new ContainerBuilder()
          .setAccentColor(0xE67E22) // orange — member kicked
          .addTextDisplayComponents(td =>
            td.setContent(`${emojis.hammer} **Membro expulso,** ${member}`)
          )
          .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(td =>
            td.setContent(
              `${emojis.user} **ID:** ${user.id}\n` +
              `${emojis.account} **Expulso por:** ${kickExecutor ?? 'Desconhecido'}\n` +
              `${emojis.warning} **Motivo:** ${kickReason}`
            )
          )

        await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 })

      } else {
        const canalId = config.canal_saiu
        if (!canalId) return

        const channel = await member.guild.channels.fetch(canalId).catch(() => null)
        if (!channel?.isTextBased()) return

        const bannerURL = user.bannerURL({ dynamic: true, size: 1024 }) ?? null
        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 256 })
        const joinedAgo = member.joinedTimestamp ? timeAgo(member.joinedTimestamp) : null

        const container = new ContainerBuilder().setAccentColor(0x95A5A6) // gray — member left

        if (bannerURL) {
          container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
              new MediaGalleryItemBuilder().setURL(bannerURL)
            )
          )
        }

        container
          .addTextDisplayComponents(td =>
            td.setContent(`${emojis.cancel} **Membro saiu,** ${member}`)
          )
          .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addSectionComponents(section =>
            section
              .addTextDisplayComponents(td =>
                td.setContent(
                  `${emojis.user} **ID:** ${user.id}\n` +
                  (joinedAgo ? `${emojis.clock} **Entrou** há ${joinedAgo}\n` : '') +
                  `${emojis.users} **Total de membros:** ${member.guild.memberCount}`
                )
              )
              .setThumbnailAccessory(thumb => thumb.setURL(avatarURL))
          )

        await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 })
      }
    } catch (err) {
      console.error('[mod] Erro em guildMemberRemove:', err.message)
    }
  },
}
