const { ContainerBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js')
const { MessageFlags } = require('discord.js')
const db = require('../../utils/moderacao/database')
const emojis = require('../../utils/emojis/emojis.json')

function accountAge(createdAt) {
  const diff = Date.now() - createdAt.getTime()
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
  name: 'guildMemberAdd',

  async execute(client, member) {
    try {
      const config = await db.getConfig(member.guild.id)
      const canalId = config?.canal_entrou
      if (!canalId) return

      const channel = await member.guild.channels.fetch(canalId).catch(() => null)
      if (!channel?.isTextBased()) return

      const user = await member.user.fetch(true).catch(() => member.user)

      let inviteInfo = 'Desconhecido'
      try {
        const inviteDb = require('../../utils/invite/database')
        const membroData = await inviteDb.getMembro(member.guild.id, user.id)
        if (membroData?.inviter_id) {
          inviteInfo = `<@${membroData.inviter_id}>`
        }
      } catch {}

      const bannerURL = user.bannerURL({ dynamic: true, size: 1024 }) ?? null
      const avatarURL = user.displayAvatarURL({ dynamic: true, size: 256 })

      const container = new ContainerBuilder().setAccentColor(0x2ECC71) // green — member joined

      if (bannerURL) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(bannerURL)
          )
        )
      }

      container
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.bell} **Novo membro,** ${user}`)
        )
        .addSeparatorComponents(sep =>
          sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(td =>
              td.setContent(
                `${emojis.account} **Conta criada** há ${accountAge(user.createdAt)}\n` +
                `${emojis.user} **ID:** ${user.id}\n` +
                `${emojis.invite} **Invite Tracker:** ${inviteInfo}\n` +
                `${emojis.users} **Total de membros:** ${member.guild.memberCount}`
              )
            )
            .setThumbnailAccessory(thumb => thumb.setURL(avatarURL))
        )

      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      })
    } catch (err) {
      console.error('[mod] Erro em guildMemberAdd:', err.message)
    }
  },
}
