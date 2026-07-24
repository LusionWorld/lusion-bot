const {
  ApplicationCommandType,
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js')

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
  name: 'painel-moderacao',
  nameKey: 'cmd_painel_moderacao_name',
  description: 'Moderation panel.',
  descriptionKey: 'cmd_painel_moderacao_desc',
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

    const { guild } = interaction

    const container = new ContainerBuilder()
      .addTextDisplayComponents(td =>
        td.setContent(`${emojis.hammer} **Moderation Panel** | ${guild.name}`)
      )
      .addSeparatorComponents(sep =>
        sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      )
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td =>
            td.setContent(`**Logs**\nConfigure action logging channels`)
          )
          .setButtonAccessory(btn =>
            btn
              .setCustomId('mod_logs')
              .setLabel('Logs')
              .setEmoji(getEmoji(emojis.logs))
              .setStyle(ButtonStyle.Secondary)
          )
      )
      .addSeparatorComponents(sep =>
        sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
      )
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td =>
            td.setContent(`**Onboarding**\nConfigure the welcome DM for new members`)
          )
          .setButtonAccessory(btn =>
            btn
              .setCustomId('onboarding_painel')
              .setLabel('Onboarding')
              .setEmoji(getEmoji(emojis.celebration))
              .setStyle(ButtonStyle.Secondary)
          )
      )
      .addSeparatorComponents(sep =>
        sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
      )
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td =>
            td.setContent(`**Security**\nLink protection, flood detection & new member restrictions`)
          )
          .setButtonAccessory(btn =>
            btn
              .setCustomId('sec_main')
              .setLabel('Security')
              .setEmoji(getEmoji(emojis.seguranca))
              .setStyle(ButtonStyle.Secondary)
          )
      )
    await interaction.reply({
      components: [container],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    })
  },
}
