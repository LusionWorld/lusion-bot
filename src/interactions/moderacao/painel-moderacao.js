const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  ChannelSelectMenuBuilder,
  ChannelType,
} = require('discord.js')

const db = require('../../utils/moderacao/database')
const { getEmojis } = require('../../utils/emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  const [, name, id] = match
  return { name, id }
}

function buildMainPanel(guild) {
  return new ContainerBuilder()
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
            .setEmoji(getEmoji(emojis.bell))
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
}

async function buildLogsPanel(guild, msg = null) {
  const config = await db.getConfig(guild.id)

  const canalEntrou = config?.canal_entrou
  const canalSaiu   = config?.canal_saiu
  const canalBan    = config?.canal_ban
  const canalKick   = config?.canal_kick

  const lines = [
    `${emojis.online}    **Member joined:** ${canalEntrou ? `<#${canalEntrou}>` : 'Not configured'}`,
    `${emojis.invisible} **Member left:** ${canalSaiu ? `<#${canalSaiu}>` : 'Not configured'}`,
    `${emojis.hammer}    **Member banned:** ${canalBan ? `<#${canalBan}>` : 'Not configured'}`,
    `${emojis.remove}    **Member kicked:** ${canalKick ? `<#${canalKick}>` : 'Not configured'}`,
    ...(msg ? ['', msg] : []),
  ]

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.logs} **Logs** | ${guild.name}`)
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(td =>
      td.setContent(lines.join('\n'))
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('mod_set_canal_entrou')
          .setPlaceholder('Channel for: Member joined')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(1).setMaxValues(1)
      )
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('mod_set_canal_saiu')
          .setPlaceholder('Channel for: Member left')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(1).setMaxValues(1)
      )
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('mod_set_canal_ban')
          .setPlaceholder('Channel for: Member banned')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(1).setMaxValues(1)
      )
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('mod_set_canal_kick')
          .setPlaceholder('Channel for: Member kicked')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(1).setMaxValues(1)
      )
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('mod_voltar')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

const BUTTON_IDS  = ['mod_logs', 'mod_voltar']
const SELECT_IDS  = ['mod_set_canal_entrou', 'mod_set_canal_saiu', 'mod_set_canal_ban', 'mod_set_canal_kick']

module.exports = {
  async execute(_client, interaction) {
    const isMod =
      (interaction.isButton() && BUTTON_IDS.includes(interaction.customId)) ||
      (interaction.isChannelSelectMenu() && SELECT_IDS.includes(interaction.customId))

    if (!isMod) return

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: `${emojis.danger} Only **Administrators** can use this.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    const { guild } = interaction
    const id = interaction.customId

    if (id === 'mod_voltar') {
      return interaction.update({
        components: [buildMainPanel(guild)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'mod_logs') {
      return interaction.update({
        components: [await buildLogsPanel(guild)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (interaction.isChannelSelectMenu() && SELECT_IDS.includes(id)) {
      const canalId = interaction.values[0]

      const campoMap = {
        mod_set_canal_entrou: 'canal_entrou',
        mod_set_canal_saiu:   'canal_saiu',
        mod_set_canal_ban:    'canal_ban',
        mod_set_canal_kick:   'canal_kick',
      }

      const nomesMap = {
        mod_set_canal_entrou: 'Member Joined',
        mod_set_canal_saiu:   'Member Left',
        mod_set_canal_ban:    'Member Banned',
        mod_set_canal_kick:   'Member Kicked',
      }

      await db.setCanal(guild.id, campoMap[id], canalId)

      return interaction.update({
        components: [await buildLogsPanel(guild, `${emojis.success} **${nomesMap[id]}** channel set to <#${canalId}>`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }
  },
}
