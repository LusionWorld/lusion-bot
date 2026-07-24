const { ContainerBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js')
const db = require('../../utils/moderacao/database')
const emojis = require('../../utils/emojis/emojis.json')

function accountAge(createdAt) {
  const diff = Date.now() - createdAt.getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'less than 1 day'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 month'
  if (months < 12) return `${months} months`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 year' : `${years} years`
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

      let inviteInfo = 'Unknown'
      try {
        const inviteDb = require('../../utils/invite/database')
        let membroData = await inviteDb.getMembro(member.guild.id, user.id)
        if (!membroData?.inviter_id) {
          await new Promise(r => setTimeout(r, 2000))
          membroData = await inviteDb.getMembro(member.guild.id, user.id)
        }
        if (membroData?.inviter_id) {
          inviteInfo = `<@${membroData.inviter_id}>`
        }
      } catch {}

      const avatarURL = user.displayAvatarURL({ dynamic: true, size: 256 })

      const container = new ContainerBuilder()
        .setAccentColor(0x2ECC71)
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.bell} **New member,** ${user}`)
        )
        .addSeparatorComponents(sep =>
          sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(td =>
              td.setContent(
                `${emojis.account} **Account created** ${accountAge(user.createdAt)} ago\n` +
                `${emojis.user} **ID:** ${user.id}\n` +
                `${emojis.invite} **Invite Tracker:** ${inviteInfo}\n` +
                `${emojis.users} **Total members:** ${member.guild.memberCount}`
              )
            )
            .setThumbnailAccessory(thumb => thumb.setURL(avatarURL))
        )

      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      })
    } catch (err) {
      console.error('[mod] Error in guildMemberAdd:', err.message)
    }
  },
}
