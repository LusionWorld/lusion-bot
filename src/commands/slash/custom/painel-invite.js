const {
  ApplicationCommandType,
  MessageFlags,
  PermissionsBitField,
  ContainerBuilder,
} = require('discord.js')

const db = require('../../../utils/invite/database')
const { getEmojis } = require('../../../utils/emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  const [, name, id] = match
  return { name, id }
}

module.exports = {
  name: 'painel-invite',
  description: 'Invite tracker management panel.',
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),

  run: async (client, interaction) => {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ Server only.',
        flags: MessageFlags.Ephemeral,
      })
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      const c = new ContainerBuilder()
        .setAccentColor(0xff0000)
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.danger} You don't have permission to use this command.`)
        )
      return interaction.reply({
        components: [c],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const { guild } = interaction
    const config         = await db.getConfig(guild.id)
    const ativo          = config?.ativo === 1
    const canalLogs      = config?.canal_logs
    const leaderboard    = await db.getLeaderboard(guild.id)
    const totalValidos   = leaderboard.reduce((a, r) => a + (r.validos || 0), 0)
    const totalInvitadores = leaderboard.length

    const { SeparatorSpacingSize, ButtonStyle } = require('discord.js')

    const container = new ContainerBuilder()
      .addTextDisplayComponents(td => td.setContent(`${emojis.invite} **Invite Tracker** | ${guild.name}`))
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td =>
        td.setContent(
          `${ativo ? emojis.success : emojis.danger} **Status:** ${ativo ? 'Active' : 'Inactive'}\n` +
          `${emojis.logs} **Logs Channel:** ${canalLogs ? `<#${canalLogs}>` : 'Not configured'}\n` +
          `${emojis.graph} **Total Qualified Invites:** ${totalValidos}\n` +
          `${emojis.users} **Active Inviters:** ${totalInvitadores}`
        )
      )
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent(`**Configure**\nEnable, disable and configure the system`))
          .setButtonAccessory(btn => btn
            .setCustomId('invite_configurar').setLabel('Configure')
            .setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary)
          )
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent(`**Qualification Criteria**\nSet the requirements for a member to qualify`))
          .setButtonAccessory(btn => btn
            .setCustomId('invite_criterios').setLabel('Criteria')
            .setEmoji(getEmoji(emojis.check)).setStyle(ButtonStyle.Secondary)
          )
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent(`**Reward Roles**\nConfigure roles given to top inviters`))
          .setButtonAccessory(btn => btn
            .setCustomId('invite_rewards').setLabel('Rewards')
            .setEmoji(getEmoji(emojis.role)).setStyle(ButtonStyle.Secondary)
          )
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent(`**Ranking**\nSee the server's top 10 inviters`))
          .setButtonAccessory(btn => btn
            .setCustomId('invite_estatisticas').setLabel('Ranking')
            .setEmoji(getEmoji(emojis.graph)).setStyle(ButtonStyle.Secondary)
          )
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent(`**Search Member**\nView a specific member's invite stats`))
          .setButtonAccessory(btn => btn
            .setCustomId('invite_buscar').setLabel('Search')
            .setEmoji(getEmoji(emojis.user)).setStyle(ButtonStyle.Secondary)
          )
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent(`**Reset Data**\nReset server statistics`))
          .setButtonAccessory(btn => btn
            .setCustomId('invite_reset_menu').setLabel('Reset')
            .setEmoji(getEmoji(emojis.trashcan)).setStyle(ButtonStyle.Secondary)
          )
      )

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    })
  },
}
