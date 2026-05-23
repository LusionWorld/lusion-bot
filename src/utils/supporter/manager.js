const {
  ContainerBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  SeparatorSpacingSize,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js')
const { getEmojis } = require('../emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  return { name: match[1], id: match[2] }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function back(id) {
  return new ButtonBuilder()
    .setCustomId(id)
    .setLabel('Back')
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary)
}

function toggle(id, enabled) {
  return new ButtonBuilder()
    .setCustomId(id)
    .setLabel(enabled ? 'Enabled' : 'Disabled')
    .setEmoji(getEmoji(enabled ? emojis.success : emojis.cancel))
    .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Danger)
}

// ─── DM Container (sent to user) ─────────────────────────────────────────────

function buildDmContainer(template, { tierName = '', guildName = '' } = {}) {
  const channels  = Array.isArray(template.channels) ? template.channels : JSON.parse(template.channels || '[]')
  const container = new ContainerBuilder()

  if (template.image_url) {
    try {
      container.addMediaGalleryComponents(mg =>
        mg.addItems(item => item.setURL(template.image_url)),
      )
    } catch {}
  }

  if (template.header) {
    container.addTextDisplayComponents(td => td.setContent(`## ${template.header}`))
    container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  }

  if (template.body) {
    container.addTextDisplayComponents(td => td.setContent(template.body))
    container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  }

  if (channels.length) {
    const list = channels.map(c => `• ${c}`).join('\n')
    container.addTextDisplayComponents(td =>
      td.setContent(`**You now have access to:**\n${list}`),
    )
    container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  }

  if (template.start_here) {
    container.addTextDisplayComponents(td =>
      td.setContent(`**Start here:** ${template.start_here}`),
    )
    container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  }

  if (template.footer) {
    container.addTextDisplayComponents(td => td.setContent(`*${template.footer}*`))
  }

  return container
}

// ─── Log Container (staff channel) ───────────────────────────────────────────

const EVENT_LABELS = {
  new_supporter: `${emojis.fav} New Supporter`,
  upgrade:       `${emojis.up} Tier Upgrade`,
  downgrade:     `${emojis.down} Tier Downgrade`,
  cancelled:     `${emojis.cancel} Access Ended`,
  dm_failed:     `${emojis.warning} DM Failed`,
}

function buildLogContainer({ userId, eventType, oldTier, newTier, timestamp }) {
  const container = new ContainerBuilder()

  container.addTextDisplayComponents(td => td.setContent(`### ${EVENT_LABELS[eventType] ?? eventType}`))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  const lines = [`**User:** <@${userId}>`]
  if (oldTier) lines.push(`**Previous tier:** ${oldTier}`)
  if (newTier) lines.push(`**New tier:** ${newTier}`)
  if (timestamp) lines.push(`**Time:** <t:${Math.floor(new Date(timestamp).getTime() / 1000)}:F>`)

  container.addTextDisplayComponents(td => td.setContent(lines.join('\n')))
  return container
}

// ─── Monthly Report Container ─────────────────────────────────────────────────

function buildReportContainer(stats, month, totalNow) {
  const { new_supporter = 0, cancelled = 0, upgrade = 0, downgrade = 0 } = stats
  const net = new_supporter - cancelled
  const container = new ContainerBuilder()

  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.graph} Monthly Summary — ${month}`))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  const lines = []
  if (totalNow !== null) lines.push(`**Total Supporters:** ${totalNow}`)
  lines.push('')
  lines.push(`+${new_supporter} new supporters`)
  lines.push(`-${cancelled} cancellations`)
  lines.push(`+${upgrade} upgrades`)
  lines.push(`-${downgrade} downgrades`)
  lines.push('')
  lines.push(`**Net Growth: ${net >= 0 ? '+' : ''}${net} supporters**`)

  container.addTextDisplayComponents(td => td.setContent(lines.join('\n')))
  return container
}

// ─── Config Hub ───────────────────────────────────────────────────────────────

function buildConfigHub({ logChannelId, reportChannelId, dmEnabled, logsEnabled, reportEnabled, tierCount }) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.fav} Supporter Experience — Config`))

  const lines = [
    `**Log Channel:** ${logChannelId ? `<#${logChannelId}>` : '`not set`'}`,
    `**Report Channel:** ${reportChannelId ? `<#${reportChannelId}>` : '`not set`'}`,
    `**DM System:** ${dmEnabled === 'true' ? emojis.success : emojis.cancel}`,
    `**Event Logs:** ${logsEnabled === 'true' ? emojis.success : emojis.cancel}`,
    `**Monthly Report:** ${reportEnabled === 'true' ? emojis.success : emojis.cancel}`,
    `**Tiers configured:** ${tierCount ?? 0}`,
  ]
  container.addTextDisplayComponents(td => td.setContent(lines.join('\n')))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  container.addActionRowComponents(row =>
    row.addComponents(
      new ButtonBuilder().setCustomId('sup_nav:channels').setLabel('Channels').setEmoji(getEmoji(emojis.pin)).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('sup_nav:tiers').setLabel('Tier Roles').setEmoji(getEmoji(emojis.role)).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('sup_nav:templates').setLabel('DM Templates').setEmoji(getEmoji(emojis.message)).setStyle(ButtonStyle.Secondary),
    ),
  )
  container.addActionRowComponents(row =>
    row.addComponents(
      new ButtonBuilder().setCustomId('sup_nav:report').setLabel('Monthly Report').setEmoji(getEmoji(emojis.graph)).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('sup_nav:settings').setLabel('Settings').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
    ),
  )
  return container
}

// ─── Channels Panel ───────────────────────────────────────────────────────────

function buildChannelsPanel({ logChannelId, reportChannelId }) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.pin} Channels`))
  container.addTextDisplayComponents(td =>
    td.setContent(
      `**Log Channel:** ${logChannelId ? `<#${logChannelId}>` : '`not set`'}\n` +
      `**Report Channel:** ${reportChannelId ? `<#${reportChannelId}>` : '`not set`'}`,
    ),
  )
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  container.addTextDisplayComponents(td => td.setContent('**Set Log Channel:**'))
  container.addActionRowComponents(row =>
    row.addComponents(
      new ChannelSelectMenuBuilder().setCustomId('sup_cfg_log_channel').setPlaceholder('Log channel…'),
    ),
  )
  container.addTextDisplayComponents(td => td.setContent('**Set Report Channel:**'))
  container.addActionRowComponents(row =>
    row.addComponents(
      new ChannelSelectMenuBuilder().setCustomId('sup_cfg_report_channel').setPlaceholder('Report channel…'),
    ),
  )
  container.addActionRowComponents(row => row.addComponents(back('sup_cfg_back')))
  return container
}

// ─── Tier Roles Panel ─────────────────────────────────────────────────────────

function buildTierRolesPanel(tiers) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.role} Tier Roles`))
  container.addTextDisplayComponents(td =>
    td.setContent('Define which Discord roles represent each supporter tier, and their hierarchy level.'),
  )
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  if (tiers.length) {
    const list = tiers.map(t => `**Level ${t.tier_level}** — ${t.tier_name} (<@&${t.role_id}>)`).join('\n')
    container.addTextDisplayComponents(td => td.setContent(list))
    container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  } else {
    container.addTextDisplayComponents(td => td.setContent('*No tiers configured yet.*'))
    container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  }

  container.addActionRowComponents(row =>
    row.addComponents(
      new ButtonBuilder().setCustomId('sup_tier_add_start').setLabel('Add Tier Role').setEmoji(getEmoji(emojis.plus)).setStyle(ButtonStyle.Success),
      back('sup_cfg_back'),
    ),
  )

  if (tiers.length) {
    container.addActionRowComponents(row =>
      row.addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('sup_tier_remove')
          .setPlaceholder('Remove a tier role…')
          .addOptions(tiers.map(t =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`Remove: ${t.tier_name} (Level ${t.tier_level})`)
              .setValue(t.role_id),
          )),
      ),
    )
  }

  return container
}

// ─── Role Select for adding tier ──────────────────────────────────────────────

function buildTierRoleSelect() {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.plus} Add Tier Role\nSelect the Discord role for this tier:`))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  container.addActionRowComponents(row =>
    row.addComponents(
      new RoleSelectMenuBuilder().setCustomId('sup_tier_role_selected').setPlaceholder('Select role…'),
    ),
  )
  container.addActionRowComponents(row => row.addComponents(back('sup_nav:tiers')))
  return container
}

// ─── DM Templates Panel ───────────────────────────────────────────────────────

function buildDmTemplatesPanel(templates, tiers) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.message} DM Templates`))
  container.addTextDisplayComponents(td =>
    td.setContent('Select a template to edit. Templates control the DM sent to users on tier changes.'),
  )
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  const templateMap = Object.fromEntries(templates.map(t => [t.type, t]))
  const allTypes = buildTemplateTypeList(tiers)
  const options = allTypes.slice(0, 25).map(({ key, label }) => {
    const t = templateMap[key]
    const status = t ? (t.enabled ? emojis.success : emojis.cancel) : emojis.settings
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${label}`)
      .setDescription(t?.enabled ? 'Enabled' : 'Disabled / Default')
      .setValue(key)
  })

  if (options.length) {
    container.addActionRowComponents(row =>
      row.addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('sup_template_select')
          .setPlaceholder('Select template to edit…')
          .addOptions(options),
      ),
    )
  } else {
    container.addTextDisplayComponents(td => td.setContent('*Configure tier roles first to see templates.*'))
  }

  container.addActionRowComponents(row => row.addComponents(back('sup_cfg_back')))
  return container
}

function buildTemplateTypeList(tiers) {
  const types = []
  for (const tier of tiers) {
    types.push({ key: `new_${tier.tier_level}`,      label: `New → ${tier.tier_name}` })
  }
  for (const tier of tiers.filter(t => t.tier_level > Math.min(...tiers.map(x => x.tier_level)))) {
    types.push({ key: `upgrade_${tier.tier_level}`,  label: `Upgrade → ${tier.tier_name}` })
  }
  for (const tier of tiers.filter(t => t.tier_level < Math.max(...tiers.map(x => x.tier_level)))) {
    types.push({ key: `downgrade_${tier.tier_level}`, label: `Downgrade → ${tier.tier_name}` })
  }
  types.push({ key: 'cancelled', label: 'Access Cancelled' })
  return types
}

// ─── Template Edit Panel ──────────────────────────────────────────────────────

function buildTemplateEditPanel(templateKey, template, label) {
  const channels = Array.isArray(template?.channels)
    ? template.channels
    : JSON.parse(template?.channels || '[]')
  const enabled = template?.enabled ?? 1
  const container = new ContainerBuilder()

  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.message} Edit: ${label}`))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  const lines = [
    `**Enabled:** ${enabled ? emojis.success : emojis.cancel}`,
    `**Header:** ${template?.header || '*not set*'}`,
    `**Body:** ${template?.body ? template.body.slice(0, 80) + (template.body.length > 80 ? '…' : '') : '*not set*'}`,
    `**Channels:** ${channels.length ? channels.join(', ') : '*none*'}`,
    `**Start here:** ${template?.start_here || '*not set*'}`,
    `**Footer:** ${template?.footer || '*not set*'}`,
    `**Image:** ${template?.image_url ? emojis.success + ' Set' : '*none*'}`,
  ]
  container.addTextDisplayComponents(td => td.setContent(lines.join('\n')))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  container.addActionRowComponents(row =>
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`sup_template_toggle:${templateKey}`)
        .setLabel(enabled ? 'Disable' : 'Enable')
        .setEmoji(getEmoji(enabled ? emojis.cancel : emojis.success))
        .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`sup_template_edit:${templateKey}`)
        .setLabel('Edit Text')
        .setEmoji(getEmoji(emojis.brush))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`sup_template_image:${templateKey}`)
        .setLabel('Set Image')
        .setEmoji(getEmoji(emojis.image))
        .setStyle(ButtonStyle.Secondary),
    ),
  )
  container.addActionRowComponents(row => row.addComponents(back('sup_nav:templates')))
  return container
}

// ─── Monthly Report Config Panel ──────────────────────────────────────────────

function buildReportPanel({ reportEnabled, reportDay, reportChannelId }) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.graph} Monthly Report`))

  const lines = [
    `**Enabled:** ${reportEnabled === 'true' ? emojis.success : emojis.cancel}`,
    `**Send on day:** ${reportDay || '1'} of each month`,
    `**Channel:** ${reportChannelId ? `<#${reportChannelId}>` : '`not set`'}`,
  ]
  container.addTextDisplayComponents(td => td.setContent(lines.join('\n')))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  container.addActionRowComponents(row =>
    row.addComponents(
      toggle('sup_report_toggle', reportEnabled === 'true'),
      new ButtonBuilder().setCustomId('sup_report_day').setLabel('Set Day').setEmoji(getEmoji(emojis.calendar)).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('sup_report_preview').setLabel('Preview').setEmoji(getEmoji(emojis.visible)).setStyle(ButtonStyle.Secondary),
      back('sup_cfg_back'),
    ),
  )
  return container
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function buildSettingsPanel({ dmEnabled, logsEnabled }) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.settings} Settings`))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  container.addTextDisplayComponents(td =>
    td.setContent(
      `**DM System** — Send DMs on tier changes\nCurrently: ${dmEnabled === 'true' ? emojis.success + ' Enabled' : emojis.cancel + ' Disabled'}\n\n` +
      `**Event Logs** — Post logs to staff channel\nCurrently: ${logsEnabled === 'true' ? emojis.success + ' Enabled' : emojis.cancel + ' Disabled'}`,
    ),
  )
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  container.addActionRowComponents(row =>
    row.addComponents(
      toggle('sup_toggle:dm_enabled', dmEnabled === 'true'),
      toggle('sup_toggle:logs_enabled', logsEnabled === 'true'),
      back('sup_cfg_back'),
    ),
  )
  return container
}

// ─── Modals ────────────────────────────────────────────────────────────────────

function buildAddTierNameModal(roleId) {
  return new ModalBuilder()
    .setCustomId(`modal_sup_tier_name:${roleId}`)
    .setTitle('Configure Tier')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tier_name')
          .setLabel('Tier name (e.g. Resident, Citizen)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(50)
          .setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tier_level')
          .setLabel('Level (higher = more access, e.g. 1, 2, 3)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(3)
          .setRequired(true)
          .setPlaceholder('1'),
      ),
    )
}

function buildTemplateModal(templateKey, template) {
  const channels = Array.isArray(template?.channels)
    ? template.channels.join('\n')
    : JSON.parse(template?.channels || '[]').join('\n')

  return new ModalBuilder()
    .setCustomId(`modal_sup_template:${templateKey}`)
    .setTitle('Edit DM Template')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tmpl_header')
          .setLabel('Header (title line)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(false)
          .setValue(template?.header || ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tmpl_body')
          .setLabel('Body text')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(800)
          .setRequired(false)
          .setValue(template?.body || ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tmpl_channels')
          .setLabel('Channels (one per line, e.g. <#123> or #name)')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(false)
          .setValue(channels),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tmpl_start_here')
          .setLabel('Start here channel')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(false)
          .setValue(template?.start_here || ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tmpl_footer')
          .setLabel('Footer text')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(200)
          .setRequired(false)
          .setValue(template?.footer || ''),
      ),
    )
}

function buildImageModal(templateKey, currentUrl) {
  return new ModalBuilder()
    .setCustomId(`modal_sup_image:${templateKey}`)
    .setTitle('Set Template Image')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('image_url')
          .setLabel('Image URL (leave blank to remove)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(300)
          .setRequired(false)
          .setValue(currentUrl || '')
          .setPlaceholder('https://example.com/image.png'),
      ),
    )
}

function buildReportDayModal(current) {
  return new ModalBuilder()
    .setCustomId('modal_sup_report_day')
    .setTitle('Report Day')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('report_day')
          .setLabel('Day of month to send report (1–28)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(2)
          .setRequired(true)
          .setValue(current || '1'),
      ),
    )
}

module.exports = {
  buildDmContainer,
  buildLogContainer,
  buildReportContainer,
  buildConfigHub,
  buildChannelsPanel,
  buildTierRolesPanel,
  buildTierRoleSelect,
  buildDmTemplatesPanel,
  buildTemplateEditPanel,
  buildTemplateTypeList,
  buildReportPanel,
  buildSettingsPanel,
  buildAddTierNameModal,
  buildTemplateModal,
  buildImageModal,
  buildReportDayModal,
}
