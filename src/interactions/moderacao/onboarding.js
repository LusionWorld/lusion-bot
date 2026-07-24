const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js')

const db = require('../../utils/onboarding/database')
const { buildMainPanel: buildModMainPanel } = require('./painel-moderacao')
const { getEmojis } = require('../../utils/emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  const [, name, id] = match
  return { name, id }
}

function isValidURL(str) {
  try { new URL(str); return true } catch { return false }
}

function isValidHexColor(color) {
  return /^#([0-9A-F]{3}){1,2}$/i.test(color)
}

function hexToDecimal(hex) {
  return parseInt(hex.replace('#', ''), 16)
}

// ─── Panel Builders ───────────────────────────────────────────────────────────

async function buildMainPanel(guild) {
  const config = await db.getConfig(guild.id)
  const ativo = config?.ativo === 1

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.celebration} **Onboarding System** | ${guild.name}`)
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(td =>
      td.setContent(
        `${ativo ? emojis.success : emojis.danger} **Status:** ${ativo ? 'Active' : 'Inactive'}\n` +
        `${emojis.info} When active, the bot will send a welcome DM to every new member.`
      )
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td =>
          td.setContent(`**Toggle Status**\nEnable or disable the onboarding DM`)
        )
        .setButtonAccessory(btn =>
          btn
            .setCustomId('ob_toggle')
            .setLabel(ativo ? 'Disable' : 'Enable')
            .setEmoji(getEmoji(ativo ? emojis.cancel : emojis.check))
            .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    )
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td =>
          td.setContent(`**Configure Message**\nCustomize the welcome DM content`)
        )
        .setButtonAccessory(btn =>
          btn
            .setCustomId('ob_configure')
            .setLabel('Configure')
            .setEmoji(getEmoji(emojis.settings))
            .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    )
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td =>
          td.setContent(
            `**Auto Role**\nAutomatically assign roles to new members\n` +
            `${config?.auto_roles_ativo ? emojis.success : emojis.danger} ${config?.auto_roles_ativo ? 'Active' : 'Inactive'} — ${(config?.auto_roles || []).length} role(s) configured`
          )
        )
        .setButtonAccessory(btn =>
          btn
            .setCustomId('ob_autorole')
            .setLabel('Configure')
            .setEmoji(getEmoji(emojis.settings))
            .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('ob_back_mod')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

function buildConfigPanel(data) {
  let accentColor = null
  if (data.cor && isValidHexColor(data.cor)) {
    accentColor = hexToDecimal(data.cor)
  }

  const container = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.settings} **Configure Onboarding Message**`)
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )

  // Description
  container.addSectionComponents(section =>
    section
      .addTextDisplayComponents(td =>
        td.setContent(`**Message Content**\n${data.descricao || 'Not set'}`)
      )
      .setButtonAccessory(btn =>
        btn
          .setCustomId('ob_edit_descricao')
          .setLabel('Edit')
          .setEmoji(getEmoji(emojis.settings))
          .setStyle(ButtonStyle.Secondary)
      )
  )

  container.addSeparatorComponents(sep => sep)

  // Image
  container.addSectionComponents(section =>
    section
      .addTextDisplayComponents(td =>
        td.setContent(`**Embed Image**\n${data.imagem || 'Not set'}`)
      )
      .setButtonAccessory(btn =>
        btn
          .setCustomId('ob_edit_imagem')
          .setLabel('Edit')
          .setEmoji(getEmoji(emojis.image))
          .setStyle(ButtonStyle.Secondary)
      )
  )

  if (isValidURL(data.imagem)) {
    container.addMediaGalleryComponents(gallery =>
      gallery.addItems({ description: 'Embed Image', media: { url: data.imagem } })
    )
  }

  container.addSeparatorComponents(sep => sep)

  // Thumbnail
  container.addSectionComponents(section =>
    section
      .addTextDisplayComponents(td =>
        td.setContent(`**Thumbnail**\n${data.thumbnail || 'Not set'}`)
      )
      .setButtonAccessory(btn =>
        btn
          .setCustomId('ob_edit_thumbnail')
          .setLabel('Edit')
          .setEmoji(getEmoji(emojis.thumbnail))
          .setStyle(ButtonStyle.Secondary)
      )
  )

  if (isValidURL(data.thumbnail)) {
    container.addMediaGalleryComponents(gallery =>
      gallery.addItems({ description: 'Thumbnail', media: { url: data.thumbnail } })
    )
  }

  container.addSeparatorComponents(sep => sep)

  // Footer
  container.addSectionComponents(section =>
    section
      .addTextDisplayComponents(td =>
        td.setContent(`**Footer**\n${data.footer || 'Not set'}`)
      )
      .setButtonAccessory(btn =>
        btn
          .setCustomId('ob_edit_footer')
          .setLabel('Edit')
          .setEmoji(getEmoji(emojis.footer))
          .setStyle(ButtonStyle.Secondary)
      )
  )

  container.addSeparatorComponents(sep => sep)

  // Color
  container.addSectionComponents(section =>
    section
      .addTextDisplayComponents(td =>
        td.setContent(`**Accent Color**\n${data.cor || 'Not set'}`)
      )
      .setButtonAccessory(btn =>
        btn
          .setCustomId('ob_edit_cor')
          .setLabel('Edit')
          .setEmoji(getEmoji(emojis.colorpicker))
          .setStyle(ButtonStyle.Secondary)
      )
  )

  container.addSeparatorComponents(sep => sep)

  // Links
  const linksText = data.links && data.links.length > 0
    ? data.links.map((l, i) => `**${i + 1}.** [${l.nome}](${l.url})`).join('\n')
    : 'No buttons added'

  container.addSectionComponents(section =>
    section
      .addTextDisplayComponents(td =>
        td.setContent(`**Buttons (${(data.links || []).length}/5)**\n${linksText}`)
      )
      .setButtonAccessory(btn =>
        btn
          .setCustomId('ob_add_link')
          .setLabel((data.links || []).length < 5 ? 'Add Button' : 'Max (5/5)')
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled((data.links || []).length >= 5)
      )
  )

  container.addSeparatorComponents(sep =>
    sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  )

  container.addActionRowComponents(row =>
    row.setComponents(
      new ButtonBuilder()
        .setCustomId('ob_save')
        .setLabel('Save Configuration')
        .setEmoji(getEmoji(emojis.check))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ob_back')
        .setLabel('Back')
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary)
    )
  )

  return container
}

function buildAutoRolePanel(guild, config) {
  const ativo = config?.auto_roles_ativo === 1
  const roles = config?.auto_roles || []

  const roleSel = new RoleSelectMenuBuilder()
    .setCustomId('ob_autorole_select')
    .setPlaceholder(roles.length ? 'Update auto-assigned roles (reselect to keep)…' : 'Select one or more roles…')
    .setMinValues(0)
    .setMaxValues(10)
  if (roles.length) roleSel.setDefaultRoles(roles)

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.role} **Auto Role** | ${guild.name}`)
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `${ativo ? emojis.success : emojis.danger} **Status:** ${ativo ? 'Active' : 'Inactive'}\n` +
        `${emojis.info} Roles below are automatically given to every new member as soon as they join.\n\n` +
        `**Selected roles:** ${roles.length ? roles.map(id => `<@&${id}>`).join(', ') : 'None'}`
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(roleSel))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('ob_autorole_toggle')
          .setLabel(ativo ? 'Disable' : 'Enable')
          .setEmoji(getEmoji(ativo ? emojis.cancel : emojis.check))
          .setStyle(ativo ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ob_back')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

// ─── Interaction IDs ──────────────────────────────────────────────────────────

const BUTTON_IDS = [
  'onboarding_painel',
  'ob_toggle',
  'ob_configure',
  'ob_back',
  'ob_back_mod',
  'ob_save',
  'ob_edit_descricao',
  'ob_edit_imagem',
  'ob_edit_thumbnail',
  'ob_edit_footer',
  'ob_edit_cor',
  'ob_add_link',
  'ob_autorole',
  'ob_autorole_toggle',
]

const MODAL_IDS = [
  'modal_ob_descricao',
  'modal_ob_imagem',
  'modal_ob_thumbnail',
  'modal_ob_footer',
  'modal_ob_cor',
  'modal_ob_link',
]

const ROLE_SELECT_IDS = ['ob_autorole_select']

module.exports = {
  async execute(client, interaction) {
    const isOnboarding =
      (interaction.isButton() && BUTTON_IDS.includes(interaction.customId)) ||
      (interaction.isModalSubmit() && MODAL_IDS.includes(interaction.customId)) ||
      (interaction.isRoleSelectMenu() && ROLE_SELECT_IDS.includes(interaction.customId))

    if (!isOnboarding) return

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const c = new ContainerBuilder()
        .setAccentColor(0xff0000)
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.danger} Only **Administrators** can use this.`)
        )
      return interaction.reply({
        components: [c],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    const { guild } = interaction
    const guildId = guild.id

    // Lazy init editing state per guild
    if (!client.onboardingData) client.onboardingData = {}

    async function ensureData() {
      if (!client.onboardingData[guildId]) {
        const saved = await db.getConfig(guildId)
        client.onboardingData[guildId] = {
          descricao: saved?.descricao || '',
          imagem: saved?.imagem || '',
          thumbnail: saved?.thumbnail || '',
          footer: saved?.footer || '',
          cor: saved?.cor || '',
          links: saved?.links || [],
        }
      }
      return client.onboardingData[guildId]
    }

    // ─── Buttons ─────────────────────────────────────────────────────────────

    if (interaction.isButton()) {
      const id = interaction.customId

      if (id === 'onboarding_painel') {
        return interaction.update({
          components: [await buildMainPanel(guild)],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      if (id === 'ob_back_mod') {
        return interaction.update({
          components: [buildModMainPanel(guild)],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      if (id === 'ob_toggle') {
        const nowActive = await db.toggleAtivo(guildId)
        return interaction.update({
          components: [await buildMainPanel(guild)],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      if (id === 'ob_autorole') {
        const config = await db.getConfig(guildId)
        return interaction.update({
          components: [buildAutoRolePanel(guild, config)],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      if (id === 'ob_autorole_toggle') {
        await db.toggleAutoRoles(guildId)
        const config = await db.getConfig(guildId)
        return interaction.update({
          components: [buildAutoRolePanel(guild, config)],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      if (id === 'ob_configure') {
        const data = await ensureData()
        return interaction.update({
          components: [buildConfigPanel(data)],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      if (id === 'ob_back') {
        return interaction.update({
          components: [await buildMainPanel(guild)],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      if (id === 'ob_save') {
        const data = await ensureData()
        const config = await db.getConfig(guildId)
        await db.saveConfig(guildId, {
          ativo: config?.ativo === 1,
          descricao: data.descricao,
          imagem: data.imagem,
          thumbnail: data.thumbnail,
          footer: data.footer,
          cor: data.cor,
          links: data.links,
        })

        const successContainer = new ContainerBuilder()
          .setAccentColor(0x57f287)
          .addTextDisplayComponents(td =>
            td.setContent(`${emojis.success} **Configuration saved!** The onboarding message has been updated.`)
          )
          .addSeparatorComponents(sep =>
            sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
          )
          .addActionRowComponents(row =>
            row.setComponents(
              new ButtonBuilder()
                .setCustomId('ob_configure')
                .setLabel('Back to Editor')
                .setEmoji(getEmoji(emojis.arrowl))
                .setStyle(ButtonStyle.Secondary)
            )
          )

        return interaction.update({
          components: [successContainer],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      // Edit field buttons — open modals
      const modalMap = {
        ob_edit_descricao: {
          id: 'modal_ob_descricao',
          title: 'Edit Message Content',
          label: 'Content',
          field: 'descricao',
          style: TextInputStyle.Paragraph,
          placeholder: 'Welcome to the server! We are glad to have you here.',
          max: 2000,
        },
        ob_edit_imagem: {
          id: 'modal_ob_imagem',
          title: 'Edit Embed Image',
          label: 'Image URL',
          field: 'imagem',
          style: TextInputStyle.Short,
          placeholder: 'https://example.com/image.png',
          max: 500,
        },
        ob_edit_thumbnail: {
          id: 'modal_ob_thumbnail',
          title: 'Edit Thumbnail',
          label: 'Thumbnail URL',
          field: 'thumbnail',
          style: TextInputStyle.Short,
          placeholder: 'https://example.com/thumbnail.png',
          max: 500,
        },
        ob_edit_footer: {
          id: 'modal_ob_footer',
          title: 'Edit Footer',
          label: 'Footer Text',
          field: 'footer',
          style: TextInputStyle.Short,
          placeholder: 'Thank you for joining!',
          max: 256,
        },
        ob_edit_cor: {
          id: 'modal_ob_cor',
          title: 'Edit Accent Color',
          label: 'Hex Color (e.g. #5865F2)',
          field: 'cor',
          style: TextInputStyle.Short,
          placeholder: '#5865F2',
          max: 7,
        },
      }

      if (modalMap[id]) {
        const def = modalMap[id]
        const data = await ensureData()

        const modal = new ModalBuilder()
          .setCustomId(def.id)
          .setTitle(def.title)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('value')
                .setLabel(def.label)
                .setStyle(def.style)
                .setPlaceholder(def.placeholder)
                .setValue(data[def.field] || '')
                .setMaxLength(def.max)
                .setRequired(false)
            )
          )

        return interaction.showModal(modal)
      }

      if (id === 'ob_add_link') {
        const data = await ensureData()
        if (data.links.length >= 5) {
          return interaction.reply({
            content: `${emojis.danger} Maximum of 5 buttons reached.`,
            flags: MessageFlags.Ephemeral,
          })
        }

        const modal = new ModalBuilder()
          .setCustomId('modal_ob_link')
          .setTitle('Add Button Link')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('nome')
                .setLabel('Button Label')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Click here!')
                .setMaxLength(80)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('url')
                .setLabel('Button URL')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('https://example.com')
                .setMaxLength(500)
                .setRequired(true)
            )
          )

        return interaction.showModal(modal)
      }
    }

    if (interaction.isRoleSelectMenu() && interaction.customId === 'ob_autorole_select') {
      await db.setAutoRoles(guildId, interaction.values)
      const config = await db.getConfig(guildId)
      return interaction.update({
        components: [buildAutoRolePanel(guild, config)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ─── Modals ───────────────────────────────────────────────────────────────

    if (interaction.isModalSubmit()) {
      const id = interaction.customId
      const data = await ensureData()

      const fieldMap = {
        modal_ob_descricao: 'descricao',
        modal_ob_imagem: 'imagem',
        modal_ob_thumbnail: 'thumbnail',
        modal_ob_footer: 'footer',
        modal_ob_cor: 'cor',
      }

      if (fieldMap[id]) {
        const field = fieldMap[id]
        const value = interaction.fields.getTextInputValue('value').trim()

        if (field === 'cor' && value && !isValidHexColor(value)) {
          return interaction.reply({
            content: `${emojis.danger} Invalid hex color. Use format **#RRGGBB** (e.g. \`#5865F2\`).`,
            flags: MessageFlags.Ephemeral,
          })
        }

        if ((field === 'imagem' || field === 'thumbnail') && value && !isValidURL(value)) {
          return interaction.reply({
            content: `${emojis.danger} Invalid URL. Make sure it starts with \`https://\`.`,
            flags: MessageFlags.Ephemeral,
          })
        }

        data[field] = value

        return interaction.update({
          components: [buildConfigPanel(data)],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      if (id === 'modal_ob_link') {
        const nome = interaction.fields.getTextInputValue('nome').trim()
        const url = interaction.fields.getTextInputValue('url').trim()

        if (!isValidURL(url)) {
          return interaction.reply({
            content: `${emojis.danger} Invalid URL. Make sure it starts with \`https://\`.`,
            flags: MessageFlags.Ephemeral,
          })
        }

        data.links.push({ nome, url })

        return interaction.update({
          components: [buildConfigPanel(data)],
          flags: MessageFlags.IsComponentsV2,
        })
      }
    }
  },
}
