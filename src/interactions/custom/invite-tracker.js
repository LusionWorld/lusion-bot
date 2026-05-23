const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
} = require('discord.js')

const db = require('../../utils/invite/database')
const { getEmojis } = require('../../utils/emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  const [, name, id] = match
  return { name, id }
}

// ─── Panel builders ───────────────────────────────────────────────────────────

async function buildMainPanel(guild) {
  const config = await db.getConfig(guild.id)
  const ativo          = config?.ativo === 1
  const canalLogs      = config?.canal_logs
  const leaderboard    = await db.getLeaderboard(guild.id)
  const totalValidos   = leaderboard.reduce((a, r) => a + (r.validos || 0), 0)
  const totalInvitadores = leaderboard.length

  return new ContainerBuilder()
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
}

async function buildConfigPanel(guild, extraMsg = null) {
  const config = await db.getConfig(guild.id)
  const ativo           = config?.ativo === 1
  const canalLogs       = config?.canal_logs
  const canalRanking    = config?.canal_ranking
  const milestone       = config?.milestone_interval ?? 10
  const minDays         = config?.min_days_qualified ?? 7

  const info = [
    `${ativo ? emojis.success : emojis.danger} **Status:** ${ativo ? 'Active' : 'Inactive'}`,
    `${emojis.logs} **Logs Channel:** ${canalLogs ? `<#${canalLogs}>` : 'Not configured'}`,
    `${emojis.announcementc} **Milestone Channel:** ${canalRanking ? `<#${canalRanking}>` : 'Not configured'}`,
    `${emojis.star} **Milestone Interval:** every **${milestone}** qualified invites`,
    `${emojis.clock} **Min days in server:** ${minDays} day(s)`,
    ...(extraMsg ? ['', extraMsg] : []),
  ].join('\n')

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.settings} **Settings** | ${guild.name}`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(info))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**${ativo ? 'Disable' : 'Enable'} System**`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_toggle')
          .setLabel(ativo ? 'Disable' : 'Enable')
          .setEmoji(getEmoji(ativo ? emojis.danger : emojis.success))
          .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Logs Channel**\nChannel for qualification logs`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_set_canal_logs').setLabel('Set Channel')
          .setEmoji(getEmoji(emojis.logs)).setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Milestone Channel**\nChannel for milestone announcements`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_set_canal_ranking').setLabel('Set Channel')
          .setEmoji(getEmoji(emojis.announcementc)).setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Milestone Interval**\nSend announcement every X qualified invites`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_set_milestone').setLabel('Set Interval')
          .setEmoji(getEmoji(emojis.star)).setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Min Days in Server**\nMinimum days a member must stay to qualify`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_set_min_days').setLabel('Set Days')
          .setEmoji(getEmoji(emojis.clock)).setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Add Bonus**\nManually add bonus invites to a member`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_bonus').setLabel('Add Bonus')
          .setEmoji(getEmoji(emojis.plus)).setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('invite_voltar').setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary)
      )
    )
}

async function buildCriteriaPanel(guild, extraMsg = null) {
  const config = await db.getConfig(guild.id)
  const minMessages = config?.criteria_min_messages ?? 5
  const minChannels = config?.criteria_min_channels ?? 1
  const diffDays    = (config?.criteria_diff_days ?? 1) === 1
  const checkSpam   = (config?.criteria_check_spam ?? 1) === 1

  const info = [
    `${emojis.message} **Min messages:** ${minMessages}`,
    `${emojis.textc} **Min channels:** ${minChannels}`,
    `${emojis.calendar} **Active on different days:** ${diffDays ? `${emojis.success} Enabled` : `${emojis.danger} Disabled`}`,
    `${emojis.warning} **Spam check:** ${checkSpam ? `${emojis.success} Enabled` : `${emojis.danger} Disabled`}`,
    ...(extraMsg ? ['', extraMsg] : []),
  ].join('\n')

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.check} **Qualification Criteria** | ${guild.name}`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(info))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Min Messages**\nMinimum real messages a member must send`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_set_min_messages').setLabel('Set')
          .setEmoji(getEmoji(emojis.message)).setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Min Channels**\nMinimum distinct channels a member must participate in`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_set_min_channels').setLabel('Set')
          .setEmoji(getEmoji(emojis.textc)).setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Activity on Different Days**\nMember must interact on at least 2 different days`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_toggle_diff_days')
          .setLabel(diffDays ? 'Disable' : 'Enable')
          .setEmoji(getEmoji(diffDays ? emojis.cancel : emojis.check))
          .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Spam / Suspicious Check**\nReject members flagged as spam`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_toggle_spam_check')
          .setLabel(checkSpam ? 'Disable' : 'Enable')
          .setEmoji(getEmoji(checkSpam ? emojis.cancel : emojis.check))
          .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('invite_voltar').setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary)
      )
    )
}

async function buildRewardsPanel(guild, extraMsg = null) {
  const roles = await db.getRewardRoles(guild.id)

  const rolesText = roles.length === 0
    ? `${emojis.info} No reward roles configured yet.`
    : roles.map(r =>
        `${emojis.role} <@&${r.role_id}> — **${r.min_qualified}** qualified invites — ` +
        (r.permanent ? `${emojis.star} Permanent` : `${emojis.clock} ${r.duration_days} day(s)`) +
        ` \`[ID: ${r.id}]\``
      ).join('\n')

  const container = new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.role} **Reward Roles** | ${guild.name}`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(rolesText))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))

  if (extraMsg) {
    container.addTextDisplayComponents(td => td.setContent(extraMsg))
    container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
  }

  container
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Add Reward Role**\nGrant a role when an inviter reaches a milestone`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_add_reward').setLabel('Add Role')
          .setEmoji(getEmoji(emojis.plus)).setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`**Remove Reward Role**\nRemove a configured reward role by its ID`))
        .setButtonAccessory(btn => btn
          .setCustomId('invite_remove_reward').setLabel('Remove Role')
          .setEmoji(getEmoji(emojis.remove)).setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('invite_voltar').setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary)
      )
    )

  return container
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = {
  async execute(_client, interaction) {
    const BUTTON_IDS = [
      'invite_configurar', 'invite_toggle', 'invite_voltar',
      'invite_set_canal_logs', 'invite_set_canal_ranking',
      'invite_set_milestone', 'invite_set_min_days',
      'invite_bonus',
      'invite_criterios', 'invite_set_min_messages', 'invite_set_min_channels',
      'invite_toggle_diff_days', 'invite_toggle_spam_check',
      'invite_rewards', 'invite_add_reward', 'invite_remove_reward',
      'invite_estatisticas', 'invite_set_ranking_pinned', 'invite_buscar',
      'invite_reset_menu', 'invite_reset_all_confirm', 'invite_reset_all', 'invite_reset_user',
    ]
    const MODAL_IDS = [
      'invite_canal_modal', 'invite_canal_ranking_modal',
      'invite_milestone_modal', 'invite_min_days_modal',
      'invite_bonus_modal', 'invite_buscar_modal',
      'invite_reset_user_modal',
      'invite_min_messages_modal', 'invite_min_channels_modal',
      'invite_add_reward_modal', 'invite_remove_reward_modal',
      'invite_ranking_pinned_modal',
    ]

    const isInvite =
      (interaction.isButton() && BUTTON_IDS.includes(interaction.customId)) ||
      (interaction.isModalSubmit() && MODAL_IDS.includes(interaction.customId))

    if (!isInvite) return

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: `${emojis.danger} Only **Administrators** can use this.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    const { guild } = interaction
    const id = interaction.customId

    // ── Back ──────────────────────────────────────────────────────────────────
    if (id === 'invite_voltar') {
      return interaction.update({
        components: [await buildMainPanel(guild)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Configure ─────────────────────────────────────────────────────────────
    if (id === 'invite_configurar') {
      return interaction.update({
        components: [await buildConfigPanel(guild)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Toggle ────────────────────────────────────────────────────────────────
    if (id === 'invite_toggle') {
      const config = await db.getConfig(guild.id)
      await db.setAtivo(guild.id, !(config?.ativo === 1))
      return interaction.update({
        components: [await buildConfigPanel(guild)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Logs channel ──────────────────────────────────────────────────────────
    if (id === 'invite_set_canal_logs') {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('invite_canal_select')
        .setPlaceholder('Select the logs channel')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1).setMaxValues(1)
      const label = new LabelBuilder()
        .setLabel('Logs Channel')
        .setDescription('Channel where qualification logs will be sent')
        .setChannelSelectMenuComponent(channelSelect)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_canal_modal').setTitle('Set Logs Channel').addLabelComponents(label)
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_canal_modal') {
      const canalId = interaction.fields.getField('invite_canal_select').values?.[0]
      await db.setCanalLogs(guild.id, canalId)
      return interaction.update({
        components: [await buildConfigPanel(guild, `${emojis.success} Logs channel set to <#${canalId}>!`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Milestone channel ─────────────────────────────────────────────────────
    if (id === 'invite_set_canal_ranking') {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('invite_canal_ranking_select')
        .setPlaceholder('Select the milestone announcement channel')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1).setMaxValues(1)
      const label = new LabelBuilder()
        .setLabel('Milestone Channel')
        .setDescription('Channel where milestone announcements will be sent')
        .setChannelSelectMenuComponent(channelSelect)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_canal_ranking_modal').setTitle('Set Milestone Channel').addLabelComponents(label)
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_canal_ranking_modal') {
      const canalId = interaction.fields.getField('invite_canal_ranking_select').values?.[0]
      await db.setCanalRanking(guild.id, canalId)
      return interaction.update({
        components: [await buildConfigPanel(guild, `${emojis.success} Milestone channel set to <#${canalId}>!`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Milestone interval ────────────────────────────────────────────────────
    if (id === 'invite_set_milestone') {
      const input = new TextInputBuilder()
        .setCustomId('invite_milestone_input')
        .setLabel('Milestone interval')
        .setPlaceholder('e.g. 10, 20, 50')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_milestone_modal').setTitle('Set Milestone Interval')
          .addComponents(new ActionRowBuilder().addComponents(input))
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_milestone_modal') {
      const val = parseInt(interaction.fields.getTextInputValue('invite_milestone_input').trim())
      if (isNaN(val) || val <= 0) {
        return interaction.update({
          components: [await buildConfigPanel(guild, `${emojis.danger} Invalid value. Enter a positive number.`)],
          flags: MessageFlags.IsComponentsV2,
        })
      }
      await db.setMilestoneInterval(guild.id, val)
      return interaction.update({
        components: [await buildConfigPanel(guild, `${emojis.success} Milestone interval set to every **${val}** qualified invites!`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Min days ──────────────────────────────────────────────────────────────
    if (id === 'invite_set_min_days') {
      const input = new TextInputBuilder()
        .setCustomId('invite_min_days_input')
        .setLabel('Minimum days in server')
        .setPlaceholder('e.g. 7')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_min_days_modal').setTitle('Set Minimum Days')
          .addComponents(new ActionRowBuilder().addComponents(input))
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_min_days_modal') {
      const days = parseInt(interaction.fields.getTextInputValue('invite_min_days_input').trim())
      if (isNaN(days) || days < 0) {
        return interaction.update({
          components: [await buildConfigPanel(guild, `${emojis.danger} Invalid value. Enter a number ≥ 0.`)],
          flags: MessageFlags.IsComponentsV2,
        })
      }
      await db.setMinDaysQualified(guild.id, days)
      return interaction.update({
        components: [await buildConfigPanel(guild, `${emojis.success} Minimum days set to **${days}** day(s)!`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Criteria panel ────────────────────────────────────────────────────────
    if (id === 'invite_criterios') {
      return interaction.update({
        components: [await buildCriteriaPanel(guild)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'invite_set_min_messages') {
      const input = new TextInputBuilder()
        .setCustomId('invite_min_messages_input')
        .setLabel('Minimum messages')
        .setPlaceholder('e.g. 5')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_min_messages_modal').setTitle('Set Minimum Messages')
          .addComponents(new ActionRowBuilder().addComponents(input))
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_min_messages_modal') {
      const val = parseInt(interaction.fields.getTextInputValue('invite_min_messages_input').trim())
      if (isNaN(val) || val < 0) {
        return interaction.update({
          components: [await buildCriteriaPanel(guild, `${emojis.danger} Invalid value.`)],
          flags: MessageFlags.IsComponentsV2,
        })
      }
      const config = await db.getConfig(guild.id)
      await db.setCriteria(guild.id, {
        minMessages: val,
        minChannels: config?.criteria_min_channels ?? 1,
        diffDays:    (config?.criteria_diff_days ?? 1) === 1,
        checkSpam:   (config?.criteria_check_spam ?? 1) === 1,
      })
      return interaction.update({
        components: [await buildCriteriaPanel(guild, `${emojis.success} Minimum messages set to **${val}**!`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'invite_set_min_channels') {
      const input = new TextInputBuilder()
        .setCustomId('invite_min_channels_input')
        .setLabel('Minimum channels')
        .setPlaceholder('e.g. 1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_min_channels_modal').setTitle('Set Minimum Channels')
          .addComponents(new ActionRowBuilder().addComponents(input))
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_min_channels_modal') {
      const val = parseInt(interaction.fields.getTextInputValue('invite_min_channels_input').trim())
      if (isNaN(val) || val < 0) {
        return interaction.update({
          components: [await buildCriteriaPanel(guild, `${emojis.danger} Invalid value.`)],
          flags: MessageFlags.IsComponentsV2,
        })
      }
      const config = await db.getConfig(guild.id)
      await db.setCriteria(guild.id, {
        minMessages: config?.criteria_min_messages ?? 5,
        minChannels: val,
        diffDays:    (config?.criteria_diff_days ?? 1) === 1,
        checkSpam:   (config?.criteria_check_spam ?? 1) === 1,
      })
      return interaction.update({
        components: [await buildCriteriaPanel(guild, `${emojis.success} Minimum channels set to **${val}**!`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'invite_toggle_diff_days') {
      const config = await db.getConfig(guild.id)
      const current = (config?.criteria_diff_days ?? 1) === 1
      await db.setCriteria(guild.id, {
        minMessages: config?.criteria_min_messages ?? 5,
        minChannels: config?.criteria_min_channels ?? 1,
        diffDays:    !current,
        checkSpam:   (config?.criteria_check_spam ?? 1) === 1,
      })
      return interaction.update({
        components: [await buildCriteriaPanel(guild, `${emojis.success} Activity on different days **${!current ? 'enabled' : 'disabled'}**!`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'invite_toggle_spam_check') {
      const config = await db.getConfig(guild.id)
      const current = (config?.criteria_check_spam ?? 1) === 1
      await db.setCriteria(guild.id, {
        minMessages: config?.criteria_min_messages ?? 5,
        minChannels: config?.criteria_min_channels ?? 1,
        diffDays:    (config?.criteria_diff_days ?? 1) === 1,
        checkSpam:   !current,
      })
      return interaction.update({
        components: [await buildCriteriaPanel(guild, `${emojis.success} Spam check **${!current ? 'enabled' : 'disabled'}**!`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Rewards panel ─────────────────────────────────────────────────────────
    if (id === 'invite_rewards') {
      return interaction.update({
        components: [await buildRewardsPanel(guild)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'invite_add_reward') {
      const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('invite_add_reward_role_select')
        .setPlaceholder('Select the role')
        .setMinValues(1).setMaxValues(1)
      const roleLabel = new LabelBuilder()
        .setLabel('Role').setDescription('Role to grant')
        .setRoleSelectMenuComponent(roleSelect)

      const minInput = new TextInputBuilder()
        .setCustomId('invite_add_reward_min')
        .setPlaceholder('e.g. 10')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
      const minLabel = new LabelBuilder()
        .setLabel('Min Invites').setDescription('How many qualified invites needed')
        .setTextInputComponent(minInput)

      const permInput = new TextInputBuilder()
        .setCustomId('invite_add_reward_perm')
        .setPlaceholder('yes')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
      const permLabel = new LabelBuilder()
        .setLabel('Permanent').setDescription('Is the role permanent? (yes / no)')
        .setTextInputComponent(permInput)

      const daysInput = new TextInputBuilder()
        .setCustomId('invite_add_reward_days')
        .setPlaceholder('e.g. 7')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
      const daysLabel = new LabelBuilder()
        .setLabel('Duration').setDescription('Days the role lasts if not permanent')
        .setTextInputComponent(daysInput)

      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_add_reward_modal').setTitle('Add Reward Role')
          .addLabelComponents(roleLabel, minLabel, permLabel, daysLabel)
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_add_reward_modal') {
      const roleId   = interaction.fields.getField('invite_add_reward_role_select').values?.[0]
      const minVal   = parseInt(interaction.fields.getTextInputValue('invite_add_reward_min').trim())
      const permStr  = interaction.fields.getTextInputValue('invite_add_reward_perm').trim().toLowerCase()
      const daysStr  = interaction.fields.getTextInputValue('invite_add_reward_days').trim()

      const permanent   = permStr === 'yes' || permStr === 'sim'
      const durationDays = permanent ? 7 : (parseInt(daysStr) || 7)

      if (!roleId || isNaN(minVal) || minVal <= 0) {
        return interaction.update({
          components: [await buildRewardsPanel(guild, `${emojis.danger} Invalid data. Check the role and minimum invites.`)],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      await db.addRewardRole(guild.id, roleId, minVal, permanent, durationDays)
      return interaction.update({
        components: [await buildRewardsPanel(guild, `${emojis.success} Reward role <@&${roleId}> added! Required: **${minVal}** qualified invites. ${permanent ? `${emojis.star} Permanent` : `${emojis.clock} ${durationDays} day(s)`}`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'invite_remove_reward') {
      const input = new TextInputBuilder()
        .setCustomId('invite_remove_reward_id')
        .setLabel('Reward Role ID (shown in brackets)')
        .setPlaceholder('e.g. 3')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_remove_reward_modal').setTitle('Remove Reward Role')
          .addComponents(new ActionRowBuilder().addComponents(input))
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_remove_reward_modal') {
      const rewardId = parseInt(interaction.fields.getTextInputValue('invite_remove_reward_id').trim())
      if (isNaN(rewardId)) {
        return interaction.update({
          components: [await buildRewardsPanel(guild, `${emojis.danger} Invalid ID.`)],
          flags: MessageFlags.IsComponentsV2,
        })
      }
      await db.removeRewardRole(guild.id, rewardId)
      return interaction.update({
        components: [await buildRewardsPanel(guild, `${emojis.success} Reward role **#${rewardId}** removed!`)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Ranking (top 10) ──────────────────────────────────────────────────────
    if (id === 'invite_estatisticas') {
      const rows   = await db.getLeaderboard(guild.id, 10)
      const config = await db.getConfig(guild.id)
      const medals = [emojis.gold, emojis.star, emojis.achievement]

      const texto = rows.length === 0
        ? `${emojis.info} No invites recorded yet.`
        : rows.map((r, i) => {
            const m     = medals[i] ? `${medals[i]}` : `**${i + 1}.**`
            const bonus = r.bonus > 0 ? ` *(+${r.bonus} bonus)*` : ''
            return `${m} <@${r.user_id}> — **${r.total_real}** qualified invites${bonus}\n-# ${emojis.check} ${r.validos} qualified  ${emojis.cancel} ${r.saiu} removed`
          }).join('\n\n')

      const pinnedCanal = config?.canal_ranking_pinned
      const pinnedMsg   = config?.ranking_message_id

      const container = new ContainerBuilder()
        .addTextDisplayComponents(td => td.setContent(`${emojis.graph} **Top 10 Inviters** | ${guild.name}`))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(texto))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(
            `${emojis.pin} **Pinned Ranking Channel:** ${pinnedCanal ? `<#${pinnedCanal}>` : 'Not configured'}\n` +
            `-# ${pinnedMsg ? `Message ID: \`${pinnedMsg}\`` : 'No message pinned yet'}`
          )
        )
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent(`**Set Pinned Channel**\nSend the ranking to a channel and keep it auto-updated`))
            .setButtonAccessory(btn => btn
              .setCustomId('invite_set_ranking_pinned').setLabel('Set Channel')
              .setEmoji(getEmoji(emojis.pin)).setStyle(ButtonStyle.Secondary)
            )
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(row =>
          row.setComponents(
            new ButtonBuilder()
              .setCustomId('invite_voltar').setLabel('Back')
              .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary)
          )
        )

      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 })
    }

    // ── Set pinned ranking channel ────────────────────────────────────────────
    if (id === 'invite_set_ranking_pinned') {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('invite_ranking_pinned_select')
        .setPlaceholder('Select the channel for the pinned ranking')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1).setMaxValues(1)
      const label = new LabelBuilder()
        .setLabel('Pinned Ranking Channel')
        .setDescription('The ranking will be sent here and auto-updated every 30 minutes')
        .setChannelSelectMenuComponent(channelSelect)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_ranking_pinned_modal').setTitle('Set Pinned Ranking Channel').addLabelComponents(label)
      )
    }

    if (interaction.isModalSubmit() && id === 'invite_ranking_pinned_modal') {
      const canalId = interaction.fields.getField('invite_ranking_pinned_select').values?.[0]
      const canal   = await guild.channels.fetch(canalId).catch(() => null)
      if (!canal) {
        return interaction.update({
          components: [await buildMainPanel(guild)],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      await db.setCanalRankingPinned(guild.id, canalId)

      // Send initial ranking message
      const rows   = await db.getLeaderboard(guild.id, 10)
      const medals = [emojis.gold, emojis.star, emojis.achievement]
      const texto  = rows.length === 0
        ? `${emojis.info} No invites recorded yet.`
        : rows.map((r, i) => {
            const m     = medals[i] ? `${medals[i]}` : `**${i + 1}.**`
            const bonus = r.bonus > 0 ? ` *(+${r.bonus} bonus)*` : ''
            return `${m} <@${r.user_id}> — **${r.total_real}** qualified invites${bonus}\n-# ${emojis.check} ${r.validos} qualified  ${emojis.cancel} ${r.saiu} removed`
          }).join('\n\n')

      const rankingContainer = new ContainerBuilder()
        .addTextDisplayComponents(td => td.setContent(`${emojis.graph} **Top 10 Inviters** | ${guild.name}`))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(texto))
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# ${emojis.refresh} Updated <t:${Math.floor(Date.now() / 1000)}:R>`))

      const sent = await canal.send({ components: [rankingContainer], flags: MessageFlags.IsComponentsV2 })
      await db.setRankingMessageId(guild.id, sent.id)

      return interaction.update({
        components: [await buildMainPanel(guild)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Search member ─────────────────────────────────────────────────────────
    if (id === 'invite_buscar') {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('invite_buscar_user')
        .setPlaceholder('Select the member')
        .setMinValues(1).setMaxValues(1)
      const label = new LabelBuilder()
        .setLabel('Member').setDescription('Member whose invite stats you want to view')
        .setUserSelectMenuComponent(userSelect)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_buscar_modal').setTitle('Search Member').addLabelComponents(label)
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_buscar_modal') {
      const userId = interaction.fields.getField('invite_buscar_user').values?.[0]
      const [stats, membroInfo, pending] = await Promise.all([
        db.getStats(guild.id, userId),
        db.getMembro(guild.id, userId),
        db.getPendingByInviter(guild.id, userId),
      ])
      const total        = Math.max(0, (stats?.validos || 0) + (stats?.bonus || 0) - (stats?.saiu || 0))
      const pendingCount = pending?.length || 0
      const convidadoPor = membroInfo?.inviter_id ? `<@${membroInfo.inviter_id}>` : 'Unknown'
      const entrou       = membroInfo?.entrou ? `<t:${Math.floor(membroInfo.entrou / 1000)}:R>` : 'Unknown'
      const status       = membroInfo?.status ?? 'unknown'

      const container = new ContainerBuilder()
        .addTextDisplayComponents(td => td.setContent(`${emojis.user} **Stats of <@${userId}>**`))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(
            `${emojis.invite} **Total qualified invites:** ${total}\n` +
            `${emojis.check} **Qualified:** ${stats?.validos || 0}\n` +
            `${emojis.clock} **Pending:** ${pendingCount}\n` +
            `${emojis.cancel} **Removed:** ${stats?.saiu || 0}\n` +
            `${emojis.plus} **Bonus:** ${stats?.bonus || 0}\n` +
            `${emojis.users} **Was invited by:** ${convidadoPor}\n` +
            `${emojis.calendar} **Joined:** ${entrou}\n` +
            `${emojis.info} **Status:** ${status}`
          )
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(row =>
          row.setComponents(
            new ButtonBuilder()
              .setCustomId('invite_voltar').setLabel('Back')
              .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary)
          )
        )

      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 })
    }

    // ── Reset menu ────────────────────────────────────────────────────────────
    if (id === 'invite_reset_menu') {
      const container = new ContainerBuilder()
        .addTextDisplayComponents(td => td.setContent(`${emojis.trashcan} **Reset Data** | ${guild.name}`))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`${emojis.warning} Choose what to reset:`))
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent(`**Reset Server**\nDeletes **all** invite data for this server`))
            .setButtonAccessory(btn => btn
              .setCustomId('invite_reset_all_confirm').setLabel('Reset All')
              .setEmoji(getEmoji(emojis.trashcan)).setStyle(ButtonStyle.Secondary)
            )
        )
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent(`**Reset Member**\nDeletes a specific member's data`))
            .setButtonAccessory(btn => btn
              .setCustomId('invite_reset_user').setLabel('Reset Member')
              .setEmoji(getEmoji(emojis.remove)).setStyle(ButtonStyle.Secondary)
            )
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(row =>
          row.setComponents(
            new ButtonBuilder()
              .setCustomId('invite_voltar').setLabel('Back')
              .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary)
          )
        )
      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 })
    }

    if (id === 'invite_reset_all_confirm') {
      const container = new ContainerBuilder()
        .addTextDisplayComponents(td => td.setContent(`${emojis.danger} **Confirm Full Reset**`))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.warning} Are you sure? All data will be **permanently deleted**.`)
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(row =>
          row.setComponents(
            new ButtonBuilder()
              .setCustomId('invite_reset_all').setLabel('Confirm')
              .setEmoji(getEmoji(emojis.trashcan)).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('invite_voltar').setLabel('Cancel')
              .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
          )
        )
      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 })
    }

    if (id === 'invite_reset_all') {
      await db.resetGuild(guild.id)
      return interaction.update({
        components: [await buildMainPanel(guild)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'invite_reset_user') {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('invite_reset_user_select')
        .setPlaceholder('Select the member')
        .setMinValues(1).setMaxValues(1)
      const label = new LabelBuilder()
        .setLabel('Member').setDescription('Member whose invite data will be deleted')
        .setUserSelectMenuComponent(userSelect)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_reset_user_modal').setTitle('Reset Member').addLabelComponents(label)
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_reset_user_modal') {
      const userId = interaction.fields.getField('invite_reset_user_select').values?.[0]
      await db.resetUser(guild.id, userId)
      const container = new ContainerBuilder()
        .addTextDisplayComponents(td => td.setContent(`${emojis.success} **Data reset!**`))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`${emojis.user} Data for <@${userId}> has been deleted.`))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(row =>
          row.setComponents(
            new ButtonBuilder()
              .setCustomId('invite_voltar').setLabel('Back')
              .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary)
          )
        )
      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 })
    }

    // ── Bonus ─────────────────────────────────────────────────────────────────
    if (id === 'invite_bonus') {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('invite_bonus_user')
        .setPlaceholder('Select the member')
        .setMinValues(1).setMaxValues(1)
      const userLabel = new LabelBuilder()
        .setLabel('Member').setDescription('Member who will receive the bonus invites')
        .setUserSelectMenuComponent(userSelect)
      const qtdInput = new TextInputBuilder()
        .setCustomId('invite_bonus_qtd')
        .setPlaceholder('e.g. 5 or -3')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
      const qtdLabel = new LabelBuilder()
        .setLabel('Bonus Amount').setDescription('Positive to add, negative to remove')
        .setTextInputComponent(qtdInput)
      return interaction.showModal(
        new ModalBuilder().setCustomId('invite_bonus_modal').setTitle('Add Invite Bonus')
          .addLabelComponents(userLabel, qtdLabel)
      )
    }
    if (interaction.isModalSubmit() && id === 'invite_bonus_modal') {
      const userId = interaction.fields.getField('invite_bonus_user').values?.[0]
      const qtd    = parseInt(interaction.fields.getTextInputValue('invite_bonus_qtd').trim())
      if (isNaN(qtd)) {
        return interaction.update({
          components: [await buildConfigPanel(guild, `${emojis.danger} Invalid amount.`)],
          flags: MessageFlags.IsComponentsV2,
        })
      }
      const stats    = await db.getStats(guild.id, userId) || { validos: 0, saiu: 0, bonus: 0, total: 0 }
      const novoBonus = Math.max(0, (stats.bonus || 0) + qtd)
      await db.upsertStats(guild.id, userId, { ...stats, bonus: novoBonus })
      const total = Math.max(0, (stats.validos || 0) + novoBonus - (stats.saiu || 0))
      const container = new ContainerBuilder()
        .addTextDisplayComponents(td => td.setContent(`${emojis.success} **Bonus Updated!**`))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(
            `${emojis.user} **Member:** <@${userId}>\n` +
            `${emojis.plus} **Adjustment:** ${qtd >= 0 ? `+${qtd}` : qtd} bonus\n` +
            `${emojis.plus} **Total Bonus:** ${novoBonus}\n` +
            `${emojis.graph} **Total Qualified:** ${total}`
          )
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(row =>
          row.setComponents(
            new ButtonBuilder()
              .setCustomId('invite_voltar').setLabel('Back')
              .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary)
          )
        )
      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 })
    }
  },
}
