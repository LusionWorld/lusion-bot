const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js')

const db = require('../../utils/votacao/database')
const {
  buildActivePollContainer,
  buildVotedEphemeralContainer,
  buildAlreadyVotedContainer,
  schedulePoll,
  extendPoll,
  closePoll,
} = require('../../utils/votacao/manager')

// re-use helpers from the command file
const pollCommand       = require('../../commands/slash/votacao/poll')
const buildBuilderPanel = pollCommand.buildBuilderPanel
const buildChoicePanel  = pollCommand.buildChoicePanel
const buildManageList   = pollCommand.buildManageList
const buildManageDetail = pollCommand.buildManageDetail
const isValidURL        = pollCommand.isValidURL
const isValidHexColor   = pollCommand.isValidHexColor
const formatDuration    = pollCommand.formatDuration

const { getEmojis } = require('../../utils/emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  const [, name, id] = match
  return { name, id }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function parseDuration(str) {
  const match = str.trim().match(/^(\d+)(m|h|d)$/)
  if (!match) return null
  const num = parseInt(match[1])
  if (num <= 0) return null
  const ms = num * { m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]
  if (ms < 60_000 || ms > 30 * 86_400_000) return null
  return ms
}

// ─── Images panel ─────────────────────────────────────────────────────────────

function buildImagesPanel(data) {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.image} **Poll Images** (${data.imageUrls.length}/10)`),
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )

  if (data.imageUrls.length === 0) {
    container.addTextDisplayComponents(td =>
      td.setContent(`${emojis.warning} No images added yet.`),
    )
  } else {
    data.imageUrls.forEach((url, i) => {
      container.addSectionComponents(s =>
        s.addTextDisplayComponents(td =>
          td.setContent(`\`${i + 1}.\` ${url}`),
        ).setButtonAccessory(btn =>
          btn.setCustomId(`poll_edit_image_${i}`)
            .setLabel('Edit')
            .setEmoji(getEmoji(emojis.settings))
            .setStyle(ButtonStyle.Secondary),
        ),
      )
    })
  }

  container
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('poll_add_image')
          .setLabel('Add Image')
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(data.imageUrls.length >= 10),
        new ButtonBuilder()
          .setCustomId('poll_back_builder')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary),
      ),
    )

  return container
}

// ─── Options panel ────────────────────────────────────────────────────────────

function buildOptionsPanel(data) {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.selectoptions} **Poll Options** (${data.options.length}/5)`),
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )

  if (data.options.length === 0) {
    container.addTextDisplayComponents(td =>
      td.setContent(`${emojis.warning} No options added yet. Add at least 2 to send the poll.`),
    )
  } else {
    data.options.forEach((opt, i) => {
      container.addSectionComponents(s =>
        s.addTextDisplayComponents(td =>
          td.setContent(`\`${i + 1}.\` ${opt}`),
        ).setButtonAccessory(btn =>
          btn.setCustomId(`poll_edit_option_${i}`)
            .setLabel('Edit')
            .setEmoji(getEmoji(emojis.settings))
            .setStyle(ButtonStyle.Secondary),
        ),
      )
      if (i < data.options.length - 1) {
        container.addSeparatorComponents(sep =>
          sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
        )
      }
    })
  }

  container
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('poll_add_option')
          .setLabel('Add Option')
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(data.options.length >= 5),
        new ButtonBuilder()
          .setCustomId('poll_back_builder')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary),
      ),
    )

  return container
}

// ─── Session guard ────────────────────────────────────────────────────────────

function sessionExpired(interaction) {
  return interaction.reply({
    content: `${emojis.warning} Your builder session has expired. Run \`/poll\` again.`,
    flags: MessageFlags.Ephemeral,
  })
}

// ─── Main execute ─────────────────────────────────────────────────────────────

module.exports = {
  async execute(client, interaction) {
    const id      = interaction.customId
    const guildId = interaction.guild?.id

    // ── Vote buttons (poll_vote:pollId:optionIndex) ───────────────────────
    if (interaction.isButton() && id?.startsWith('poll_vote:')) {
      const parts = id.split(':')
      if (parts.length !== 3) return

      const pollId      = parts[1]
      const optionIndex = parseInt(parts[2])

      await interaction.deferReply({ flags: MessageFlags.Ephemeral })

      try {
        const poll = await db.getPoll(guildId, pollId)

        if (!poll) {
          return interaction.editReply({ content: `${emojis.danger} This poll no longer exists.` })
        }

        if (poll.ended || (poll.ends_at && Date.now() > poll.ends_at)) {
          return interaction.editReply({ content: `${emojis.danger} This poll has already ended.` })
        }

        if (poll.role_id && !interaction.member.roles.cache.has(poll.role_id)) {
          return interaction.editReply({
            content: `${emojis.lock} You need the <@&${poll.role_id}> role to vote in this poll.`,
          })
        }

        // Check existing vote — immutable once cast
        const existing = await db.getUserVote(guildId, pollId, interaction.user.id)
        if (existing !== undefined && existing !== null) {
          const [voteCounts, total] = await Promise.all([
            db.getVoteCounts(guildId, pollId),
            db.getTotalVotes(guildId, pollId),
          ])
          return interaction.editReply({
            components: [buildAlreadyVotedContainer(poll, voteCounts, total, existing.option_index)],
            flags: [MessageFlags.IsComponentsV2],
          })
        }

        // Register vote
        const success = await db.recordVote(guildId, pollId, interaction.user.id, optionIndex)
        if (!success) {
          const afterRace = await db.getUserVote(guildId, pollId, interaction.user.id)
          const [voteCounts, total] = await Promise.all([
            db.getVoteCounts(guildId, pollId),
            db.getTotalVotes(guildId, pollId),
          ])
          return interaction.editReply({
            components: [buildAlreadyVotedContainer(poll, voteCounts, total, afterRace?.option_index ?? optionIndex)],
            flags: [MessageFlags.IsComponentsV2],
          })
        }

        const [voteCounts, total] = await Promise.all([
          db.getVoteCounts(guildId, pollId),
          db.getTotalVotes(guildId, pollId),
        ])
        return interaction.editReply({
          components: [buildVotedEphemeralContainer(poll, voteCounts, total, optionIndex)],
          flags: [MessageFlags.IsComponentsV2],
        })

      } catch (err) {
        console.error('[Poll:vote]', err.message)
        return interaction.editReply({
          content: `${emojis.danger} An error occurred while registering your vote.`,
        })
      }
    }

    // ── Categorize remaining interactions ─────────────────────────────────
    const isChoiceBtn = interaction.isButton() && (
      id === 'poll_choice_create' || id === 'poll_choice_manage'
    )
    const isManageInteraction = (
      (interaction.isStringSelectMenu() && id === 'poll_manage_select') ||
      (interaction.isButton() && (
        id === 'poll_manage_back'        ||
        id === 'poll_manage_back_choice' ||
        id === 'poll_manage_back_list'   ||
        id?.startsWith('poll_manage_extend:') ||
        id?.startsWith('poll_manage_end:')
      )) ||
      (interaction.isModalSubmit() && id?.startsWith('modal_poll_manage_extend:'))
    )
    const isBuilderBtn = interaction.isButton() && (
      id?.startsWith('poll_build_')       ||
      id?.startsWith('poll_edit_option_') ||
      id?.startsWith('poll_edit_image_')  ||
      ['poll_manage_images', 'poll_manage_options',
       'poll_add_option', 'poll_add_image', 'poll_back_builder', 'poll_send'].includes(id)
    )
    const isBuilderModal         = interaction.isModalSubmit()       && id?.startsWith('modal_poll_') && !id?.startsWith('modal_poll_manage_')
    const isChannelSelect        = interaction.isChannelSelectMenu() && id === 'poll_channel_select'
    const isResultsChannelSelect = interaction.isChannelSelectMenu() && id === 'poll_results_channel_select'
    const isRoleSelect           = interaction.isRoleSelectMenu()    && id === 'poll_role_select'

    if (!isChoiceBtn && !isManageInteraction && !isBuilderBtn && !isBuilderModal &&
        !isChannelSelect && !isResultsChannelSelect && !isRoleSelect) return

    if (!client.pollData) client.pollData = {}
    const userId = interaction.user.id

    // ═════════════════════════════════════════════════════════════════════
    // CHOICE PANEL
    // ═════════════════════════════════════════════════════════════════════

    if (isChoiceBtn) {
      if (id === 'poll_choice_create') {
        client.pollData[userId] = {
          title: null, description: null, headerImageUrl: null,
          imageUrls: [], color: null, options: [], durationMs: null,
          channelId: null, resultsChannelId: null, roleId: null,
        }
        return interaction.update({
          components: [buildBuilderPanel(client.pollData[userId])],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id === 'poll_choice_manage') {
        const polls = await db.getActivePolls(guildId).catch(() => [])
        return interaction.update({
          components: [buildManageList(polls)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // POLL MANAGE
    // ═════════════════════════════════════════════════════════════════════

    if (isManageInteraction) {
      // ── Select poll to manage ─────────────────────────────────────────
      if (interaction.isStringSelectMenu() && id === 'poll_manage_select') {
        const pollId = interaction.values[0]
        const poll   = await db.getPoll(guildId, pollId)
        if (!poll || poll.ended) {
          return interaction.update({
            components: [new ContainerBuilder().addTextDisplayComponents(td =>
              td.setContent(`${emojis.danger} This poll is no longer active.`),
            )],
            flags: [MessageFlags.IsComponentsV2],
          })
        }
        const total = await db.getTotalVotes(guildId, pollId)
        return interaction.update({
          components: [buildManageDetail(poll, total)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      // ── Back to choice panel ──────────────────────────────────────────
      if (interaction.isButton() && id === 'poll_manage_back_choice') {
        const polls = await db.getActivePolls(guildId).catch(() => [])
        return interaction.update({
          components: [buildChoicePanel(polls)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      // ── Back to manage list (from detail) ─────────────────────────────
      if (interaction.isButton() && (id === 'poll_manage_back' || id === 'poll_manage_back_list')) {
        const polls = await db.getActivePolls(guildId).catch(() => [])
        return interaction.update({
          components: [buildManageList(polls)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      // ── Extend button → modal ─────────────────────────────────────────
      if (interaction.isButton() && id.startsWith('poll_manage_extend:')) {
        const pollId = id.split(':')[1]
        return interaction.showModal(
          new ModalBuilder()
            .setCustomId(`modal_poll_manage_extend:${pollId}`)
            .setTitle('Extend Poll Duration')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('extend_duration')
                  .setLabel('Time to add (ex: 30m, 2h, 1d)')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('30m')
                  .setMinLength(2)
                  .setMaxLength(10)
                  .setRequired(true),
              ),
            ),
        )
      }

      // ── Extend modal submit ───────────────────────────────────────────
      if (interaction.isModalSubmit() && id.startsWith('modal_poll_manage_extend:')) {
        const pollId = id.split(':')[1]
        const input  = interaction.fields.getTextInputValue('extend_duration')
        const addMs  = parseDuration(input)

        if (!addMs) {
          return interaction.reply({
            content: `${emojis.danger} Invalid duration. Use formats like \`30m\`, \`2h\`, \`1d\`.`,
            flags: MessageFlags.Ephemeral,
          })
        }

        const newEndsAt = await extendPoll(client, guildId, pollId, addMs)
        if (!newEndsAt) {
          return interaction.reply({
            content: `${emojis.danger} Poll not found or already ended.`,
            flags: MessageFlags.Ephemeral,
          })
        }

        const poll  = await db.getPoll(guildId, pollId)
        const total = await db.getTotalVotes(guildId, pollId)

        return interaction.update({
          components: [buildManageDetail({ ...poll, ends_at: newEndsAt }, total)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      // ── End Now button ────────────────────────────────────────────────
      if (interaction.isButton() && id.startsWith('poll_manage_end:')) {
        const pollId = id.split(':')[1]
        const poll   = await db.getPoll(guildId, pollId)
        if (!poll || poll.ended) {
          return interaction.update({
            components: [new ContainerBuilder().addTextDisplayComponents(td =>
              td.setContent(`${emojis.danger} This poll is no longer active.`),
            )],
            flags: [MessageFlags.IsComponentsV2],
          })
        }

        await interaction.update({
          components: [new ContainerBuilder().addTextDisplayComponents(td =>
            td.setContent(`${emojis.refresh} Closing poll **${poll.title}**…`),
          )],
          flags: [MessageFlags.IsComponentsV2],
        })

        await closePoll(client, guildId, pollId)

        await interaction.editReply({
          components: [new ContainerBuilder().addTextDisplayComponents(td =>
            td.setContent(`${emojis.check} Poll **${poll.title}** has been closed.`),
          )],
          flags: [MessageFlags.IsComponentsV2],
        }).catch(() => {})
      }

      return
    }

    // ═════════════════════════════════════════════════════════════════════
    // BUILDER
    // ═════════════════════════════════════════════════════════════════════

    // ── BUTTONS ───────────────────────────────────────────────────────────
    if (isBuilderBtn) {
      if (!client.pollData[userId]) return sessionExpired(interaction)
      const data = client.pollData[userId]

      // ── Open modals ───────────────────────────────────────────────────

      if (id === 'poll_build_title') {
        const modal = new ModalBuilder().setCustomId('modal_poll_title').setTitle('Poll Title')
        const input = new TextInputBuilder()
          .setCustomId('value').setLabel('Title').setStyle(TextInputStyle.Short)
          .setMaxLength(100).setRequired(false)
        if (data.title) input.setValue(data.title)
        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(input)))
      }

      if (id === 'poll_build_description') {
        const modal = new ModalBuilder().setCustomId('modal_poll_description').setTitle('Poll Description')
        const input = new TextInputBuilder()
          .setCustomId('value').setLabel('Description').setStyle(TextInputStyle.Paragraph)
          .setMaxLength(300).setRequired(false)
        if (data.description) input.setValue(data.description)
        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(input)))
      }

      if (id === 'poll_build_header_image') {
        const modal = new ModalBuilder().setCustomId('modal_poll_header_image').setTitle('Header Image')
        const input = new TextInputBuilder()
          .setCustomId('value').setLabel('Image URL (leave empty to remove)')
          .setStyle(TextInputStyle.Short).setMaxLength(500).setRequired(false)
        if (data.headerImageUrl) input.setValue(data.headerImageUrl)
        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(input)))
      }

      if (id === 'poll_build_duration') {
        const modal = new ModalBuilder().setCustomId('modal_poll_duration').setTitle('Poll Duration')
        const input = new TextInputBuilder()
          .setCustomId('value').setLabel('Duration (e.g. 30m, 2h, 1d)')
          .setPlaceholder('Min: 1m — Max: 30d').setStyle(TextInputStyle.Short)
          .setMaxLength(10).setRequired(true)
        if (data.durationMs) input.setValue(formatDuration(data.durationMs))
        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(input)))
      }

      if (id === 'poll_build_color') {
        const modal = new ModalBuilder().setCustomId('modal_poll_color').setTitle('Accent Color')
        const input = new TextInputBuilder()
          .setCustomId('value').setLabel('Hex color (leave empty to reset)')
          .setPlaceholder('#5865F2').setStyle(TextInputStyle.Short)
          .setMaxLength(7).setRequired(false)
        if (data.color) input.setValue(data.color)
        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(input)))
      }

      // ── Images panel ──────────────────────────────────────────────────

      if (id === 'poll_manage_images') {
        return interaction.update({
          components: [buildImagesPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id === 'poll_add_image') {
        if (data.imageUrls.length >= 10) {
          return interaction.reply({
            content: `${emojis.danger} Maximum of 10 images reached.`,
            flags: MessageFlags.Ephemeral,
          })
        }
        const modal = new ModalBuilder().setCustomId('modal_poll_image_add').setTitle('Add Image')
        const input = new TextInputBuilder()
          .setCustomId('value').setLabel('Image URL').setStyle(TextInputStyle.Short)
          .setMaxLength(500).setRequired(true)
        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(input)))
      }

      if (id.startsWith('poll_edit_image_')) {
        const index   = parseInt(id.replace('poll_edit_image_', ''))
        const current = data.imageUrls[index]
        if (current === undefined) {
          return interaction.reply({ content: `${emojis.danger} Image not found.`, flags: MessageFlags.Ephemeral })
        }
        const modal = new ModalBuilder()
          .setCustomId(`modal_poll_image_edit_${index}`).setTitle('Edit Image')
        const input = new TextInputBuilder()
          .setCustomId('value').setLabel('Image URL (leave empty to remove)')
          .setStyle(TextInputStyle.Short).setValue(current).setMaxLength(500).setRequired(false)
        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(input)))
      }

      // ── Options panel ─────────────────────────────────────────────────

      if (id === 'poll_manage_options') {
        return interaction.update({
          components: [buildOptionsPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id === 'poll_add_option') {
        if (data.options.length >= 5) {
          return interaction.reply({
            content: `${emojis.danger} Maximum of 5 options reached.`,
            flags: MessageFlags.Ephemeral,
          })
        }
        const modal = new ModalBuilder().setCustomId('modal_poll_option_add').setTitle('Add Option')
        const input = new TextInputBuilder()
          .setCustomId('value').setLabel('Option text').setStyle(TextInputStyle.Short)
          .setMaxLength(80).setRequired(true)
        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(input)))
      }

      if (id.startsWith('poll_edit_option_')) {
        const index   = parseInt(id.replace('poll_edit_option_', ''))
        const current = data.options[index]
        if (current === undefined) {
          return interaction.reply({ content: `${emojis.danger} Option not found.`, flags: MessageFlags.Ephemeral })
        }
        const modal = new ModalBuilder()
          .setCustomId(`modal_poll_option_edit_${index}`).setTitle('Edit Option')
        const input = new TextInputBuilder()
          .setCustomId('value').setLabel('Option text (leave empty to remove)')
          .setStyle(TextInputStyle.Short).setValue(current).setMaxLength(80).setRequired(false)
        return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(input)))
      }

      if (id === 'poll_back_builder') {
        return interaction.update({
          components: [buildBuilderPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      // ── Send poll ─────────────────────────────────────────────────────

      if (id === 'poll_send') {
        // Validation
        const errors = []
        if (!data.title)              errors.push('• Title is required')
        if (data.options.length < 2)  errors.push('• Add at least 2 options')
        if (!data.channelId)          errors.push('• Select a channel')

        if (errors.length) {
          return interaction.reply({
            content: `${emojis.danger} **Cannot send the poll:**\n${errors.join('\n')}`,
            flags: MessageFlags.Ephemeral,
          })
        }

        const channel = interaction.guild.channels.cache.get(data.channelId)
        if (!channel) {
          return interaction.reply({
            content: `${emojis.danger} Channel not found. Please select a different channel.`,
            flags: MessageFlags.Ephemeral,
          })
        }

        const botMember = interaction.guild.members.me
        if (!channel.permissionsFor(botMember).has(PermissionsBitField.Flags.SendMessages)) {
          return interaction.reply({
            content: `${emojis.danger} I don't have permission to send messages in ${channel}.`,
            flags: MessageFlags.Ephemeral,
          })
        }

        const pollId = generateId()
        const endsAt = data.durationMs ? Date.now() + data.durationMs : null

        const pollData = {
          id:                 pollId,
          guild_id:           interaction.guild.id,
          channel_id:         data.channelId,
          title:              data.title,
          description:        data.description ?? null,
          header_image_url:   data.headerImageUrl ?? null,
          image_urls:         data.imageUrls,
          color:              data.color ?? null,
          options:            data.options,
          duration_ms:        data.durationMs,
          role_id:            data.roleId ?? null,
          results_channel_id: data.resultsChannelId ?? null,
          created_by:         userId,
          ends_at:            endsAt,
        }

        await db.createPoll(interaction.guild.id, pollData)

        const pollContainer = buildActivePollContainer({ ...pollData, ended: 0 })
        const message = await channel.send({
          components: [pollContainer],
          flags: [MessageFlags.IsComponentsV2],
        })

        let thread = null
        try {
          thread = await message.startThread({
            name: data.title.substring(0, 92),
            autoArchiveDuration: 1440,
          })
          await thread.send(
            `${emojis.users} Discussion thread for **${data.title}**.\n` +
            (endsAt
              ? `${emojis.clock} Poll closes <t:${Math.floor(endsAt / 1000)}:R>`
              : `${emojis.clock} No time limit set`),
          )
        } catch {}

        await db.updateMessageInfo(interaction.guild.id, pollId, message.id, thread?.id ?? null)
        schedulePoll(client, interaction.guild.id, pollId, data.durationMs)
        delete client.pollData[userId]

        const confirmContainer = new ContainerBuilder()
          .setAccentColor(0x57F287)
          .addTextDisplayComponents(td =>
            td.setContent(`${emojis.check} **Poll sent successfully!**`),
          )
          .addSeparatorComponents(sep =>
            sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
          )
          .addTextDisplayComponents(td =>
            td.setContent(
              `${emojis.crown} **${data.title}**\n` +
              `${emojis.announcementc} ${channel}\n` +
              `${emojis.clock} Closes <t:${endTs}:R>` +
              (data.roleId ? `\n${emojis.lock} Restricted to <@&${data.roleId}>` : '') +
              (data.resultsChannelId ? `\n${emojis.chart} Results → <#${data.resultsChannelId}>` : ''),
            ),
          )

        return interaction.update({
          components: [confirmContainer],
          flags: [MessageFlags.IsComponentsV2],
        })
      }
    }

    // ── MODALS ────────────────────────────────────────────────────────────
    if (isBuilderModal) {
      if (!client.pollData[userId]) return sessionExpired(interaction)
      const data  = client.pollData[userId]
      const value = interaction.fields.getTextInputValue('value').trim()
      const id    = interaction.customId

      if (id === 'modal_poll_title') {
        data.title = value || null
        return interaction.update({
          components: [buildBuilderPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id === 'modal_poll_description') {
        data.description = value || null
        return interaction.update({
          components: [buildBuilderPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id === 'modal_poll_header_image') {
        if (value && !isValidURL(value)) {
          return interaction.reply({
            content: `${emojis.danger} The provided URL is not valid.`,
            flags: MessageFlags.Ephemeral,
          })
        }
        data.headerImageUrl = value || null
        return interaction.update({
          components: [buildBuilderPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id === 'modal_poll_image_add') {
        if (!isValidURL(value)) {
          return interaction.reply({
            content: `${emojis.danger} The provided URL is not valid.`,
            flags: MessageFlags.Ephemeral,
          })
        }
        data.imageUrls.push(value)
        return interaction.update({
          components: [buildImagesPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id.startsWith('modal_poll_image_edit_')) {
        const index = parseInt(id.replace('modal_poll_image_edit_', ''))
        if (!value) {
          data.imageUrls.splice(index, 1)
        } else {
          if (!isValidURL(value)) {
            return interaction.reply({
              content: `${emojis.danger} The provided URL is not valid.`,
              flags: MessageFlags.Ephemeral,
            })
          }
          data.imageUrls[index] = value
        }
        return interaction.update({
          components: [buildImagesPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id === 'modal_poll_duration') {
        const ms = parseDuration(value)
        if (!ms) {
          return interaction.reply({
            content: `${emojis.danger} Invalid duration. Use formats like \`30m\`, \`2h\`, \`1d\`. Min: 1m — Max: 30d.`,
            flags: MessageFlags.Ephemeral,
          })
        }
        data.durationMs = ms
        return interaction.update({
          components: [buildBuilderPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id === 'modal_poll_color') {
        if (value && !isValidHexColor(value)) {
          return interaction.reply({
            content: `${emojis.danger} Invalid color. Use hex format, e.g. \`#5865F2\`.`,
            flags: MessageFlags.Ephemeral,
          })
        }
        data.color = value || null
        return interaction.update({
          components: [buildBuilderPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id === 'modal_poll_option_add') {
        if (!value) {
          return interaction.reply({
            content: `${emojis.danger} Option text cannot be empty.`,
            flags: MessageFlags.Ephemeral,
          })
        }
        data.options.push(value)
        return interaction.update({
          components: [buildOptionsPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (id.startsWith('modal_poll_option_edit_')) {
        const index = parseInt(id.replace('modal_poll_option_edit_', ''))
        if (!value) {
          data.options.splice(index, 1)
        } else {
          data.options[index] = value
        }
        return interaction.update({
          components: [buildOptionsPanel(data)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }
    }

    // ── CHANNEL SELECT ────────────────────────────────────────────────────
    if (isChannelSelect) {
      if (!client.pollData[userId]) return sessionExpired(interaction)
      client.pollData[userId].channelId = interaction.channels.first()?.id ?? null
      return interaction.update({
        components: [buildBuilderPanel(client.pollData[userId])],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── RESULTS CHANNEL SELECT ────────────────────────────────────────────
    if (isResultsChannelSelect) {
      if (!client.pollData[userId]) return sessionExpired(interaction)
      client.pollData[userId].resultsChannelId = interaction.channels.first()?.id ?? null
      return interaction.update({
        components: [buildBuilderPanel(client.pollData[userId])],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── ROLE SELECT ───────────────────────────────────────────────────────
    if (isRoleSelect) {
      if (!client.pollData[userId]) return sessionExpired(interaction)
      client.pollData[userId].roleId = interaction.roles.first()?.id ?? null
      return interaction.update({
        components: [buildBuilderPanel(client.pollData[userId])],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

  },
}
