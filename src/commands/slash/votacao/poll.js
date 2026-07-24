const {
  ApplicationCommandType,
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
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

function buildBuilderPanel(data) {
  const titleVal = data.title       || '*Not set*'
  const descVal  = data.description || '*Not set*'
  const durVal   = data.durationMs  ? formatDuration(data.durationMs) : '*No time limit*'

  const headerImgVal = data.headerImageUrl || '*Not set*'

  const imgVal = data.imageUrls.length > 0
    ? data.imageUrls.map((u, i) => `\`${i + 1}.\` ${u}`).join('\n')
    : '*No images added*'

  const optVal = data.options.length > 0
    ? data.options.map((o, i) => `\`${i + 1}.\` ${o}`).join('\n')
    : '*No options added yet — add at least 2*'

  const canSend = !!data.title && data.options.length >= 2 && !!data.channelId

  const colorRaw = data.color && isValidHexColor(data.color) ? data.color : null
  const colorVal = colorRaw ?? '*Not set*'

  const container = new ContainerBuilder()
  if (colorRaw) container.setAccentColor(hexToDecimal(colorRaw))

  container
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.crown} **Poll Builder**`),
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.title} **Title**\n${titleVal}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('poll_build_title').setLabel('Change')
          .setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.description} **Description**\n${descVal}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('poll_build_description').setLabel('Change')
          .setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.thumbnail} **Header Image** *(appears above title)*\n${headerImgVal}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('poll_build_header_image').setLabel('Change')
          .setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.image} **Gallery Images** (${data.imageUrls.length}/10)\n${imgVal}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('poll_manage_images').setLabel('Manage')
          .setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(
          `${emojis.selectoptions} **Options** (${data.options.length}/5)\n${optVal}`,
        ),
      ).setButtonAccessory(btn =>
        btn.setCustomId('poll_manage_options').setLabel('Manage')
          .setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.clock} **Duration**\n${durVal}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('poll_build_duration').setLabel('Change')
          .setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.colorpicker} **Accent Color**\n${colorVal}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('poll_build_color').setLabel('Change')
          .setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('poll_channel_select')
    .setPlaceholder('Poll channel (required)')
    .setChannelTypes(ChannelType.GuildText)

  if (data.channelId) channelSelect.setDefaultChannels([data.channelId])

  const resultsChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('poll_results_channel_select')
    .setPlaceholder('Results channel — optional')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1)

  if (data.resultsChannelId) resultsChannelSelect.setDefaultChannels([data.resultsChannelId])

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('poll_role_select')
    .setPlaceholder('Role restriction — optional, leave empty for everyone')
    .setMinValues(0)
    .setMaxValues(1)

  if (data.roleId) roleSelect.setDefaultRoles([data.roleId])

  container
    .addActionRowComponents(row => row.setComponents(channelSelect))
    .addActionRowComponents(row => row.setComponents(resultsChannelSelect))
    .addActionRowComponents(row => row.setComponents(roleSelect))
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(row =>
      row.setComponents(
        buildButton('poll_send', 'Send Poll', emojis.send, ButtonStyle.Secondary, !canSend),
      ),
    )

  return container
}

function isValidHexColor(str) {
  return /^#([0-9A-F]{3}){1,2}$/i.test(str)
}

function hexToDecimal(hex) {
  return parseInt(hex.replace('#', ''), 16)
}

function buildButton(customId, label, emojiRaw, style, disabled = false) {
  const btn = require('discord.js').ButtonBuilder
  return new btn()
    .setCustomId(customId)
    .setLabel(label)
    .setEmoji(getEmoji(emojiRaw))
    .setStyle(style)
    .setDisabled(disabled)
}

function isValidURL(str) {
  try { new URL(str); return true } catch { return false }
}

function formatDuration(ms) {
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (d > 0) return `${d}d${h > 0 ? ` ${h}h` : ''}`
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`
  return `${m}m`
}

function buildChoicePanel(activePolls) {
  const hasPolls = activePolls.length > 0

  const container = new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.crown} **Poll** — What would you like to do?`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('poll_choice_create')
          .setLabel('Create Poll')
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('poll_choice_manage')
          .setLabel(`Manage Polls (${activePolls.length} active)`)
          .setEmoji(getEmoji(emojis.settings))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!hasPolls),
      ),
    )

  return container
}

function buildManageList(activePolls) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('poll_manage_select')
    .setPlaceholder('Select a poll to manage…')
    .addOptions(
      activePolls.slice(0, 25).map(p => ({
        label:       p.title.slice(0, 100),
        value:       p.id,
        description: (p.ends_at ? `Ends <t:${Math.floor(p.ends_at / 1000)}:R>` : 'No time limit').slice(0, 100),
      })),
    )

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.settings} **Manage Polls** — ${activePolls.length} active`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(select))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('poll_manage_back_choice')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary),
      ),
    )
}

function buildManageDetail(poll, totalVotes) {
  const endsLine = poll.ends_at
    ? `${emojis.clock} Ends: <t:${Math.floor(poll.ends_at / 1000)}:R> (<t:${Math.floor(poll.ends_at / 1000)}:f>)\n`
    : `${emojis.clock} No time limit\n`

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.settings} **Manage Poll**`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.crown} **${poll.title}**\n` +
        endsLine +
        `${emojis.users} Votes: **${totalVotes}**`,
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(`poll_manage_extend:${poll.id}`)
          .setLabel('Extend Time')
          .setEmoji(getEmoji(emojis.clock))
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`poll_manage_end:${poll.id}`)
          .setLabel('End Now')
          .setEmoji(getEmoji(emojis.stop))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('poll_manage_back_list')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary),
      ),
    )
}

module.exports = {
  name: 'poll',
  nameKey: 'cmd_poll_name',
  description: 'Cria ou gerencia votações.',
  descriptionKey: 'cmd_poll_desc',
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.ManageMessages.toString(),

  buildBuilderPanel,
  buildChoicePanel,
  buildManageList,
  buildManageDetail,
  isValidURL,
  isValidHexColor,
  formatDuration,

  run: async (client, interaction) => {
    const db = require('../../../utils/votacao/database')
    const activePolls = await db.getActivePolls(interaction.guild.id).catch(() => [])

    return interaction.reply({
      components: [buildChoicePanel(activePolls)],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    })
  },
}
