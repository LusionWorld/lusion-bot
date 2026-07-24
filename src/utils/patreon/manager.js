const {
  ContainerBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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

function back(customId) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel('Back')
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary)
}

// ─── Public Panel ─────────────────────────────────────────────────────────────

function buildMainPanel({ patreonUrl, supporterCount, milestone, showCount, countThreshold, mainTitle, mainDescription } = {}) {
  const threshold = parseInt(countThreshold) || 20
  const container = new ContainerBuilder()

  const title = mainTitle || 'Support Us'
  const desc  = mainDescription || 'Help us build the future of social worlds.\nBy supporting, you become part of the creation.'

  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.fav} ${title}`))
  container.addTextDisplayComponents(td => td.setContent(desc))

  if (showCount === 'true' && parseInt(supporterCount) >= threshold) {
    container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
    const extra = milestone ? `\n**Next milestone:** ${milestone} supporters` : ''
    container.addTextDisplayComponents(td =>
      td.setContent(`${emojis.sparks} **Current supporters:** ${supporterCount}${extra}`),
    )
  }

  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  const buttons = [
    new ButtonBuilder()
      .setCustomId('patreon_view_tiers')
      .setLabel('View Tiers')
      .setEmoji(getEmoji(emojis.unlock))
      .setStyle(ButtonStyle.Secondary),
  ]

  if (patreonUrl) {
    buttons.push(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(patreonUrl)
        .setLabel('Join Patreon')
        .setEmoji(getEmoji(emojis.lightning)),
    )
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('patreon_no_url')
        .setLabel('Join Patreon')
        .setEmoji(getEmoji(emojis.lightning))
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
    )
  }

  container.addActionRowComponents(row => row.addComponents(...buttons))
  return container
}

// ─── Tiers ephemeral panel ────────────────────────────────────────────────────

function buildTiersPanel(tiers, patreonUrl, tiersTitle, tiersFooter) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${tiersTitle || 'Our Support Tiers'}`))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  for (const tier of tiers) {
    const benefits = JSON.parse(tier.benefits || '[]')
    const lines    = benefits.map(b => `• ${b}`).join('\n')
    container.addTextDisplayComponents(td =>
      td.setContent(`### ${emojis.fav} ${tier.name} — ${tier.price}\n${lines}`),
    )
    container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  }

  container.addTextDisplayComponents(td => td.setContent(`**${emojis.sparks} ${tiersFooter || 'Ready to join?'}**`))

  if (patreonUrl) {
    container.addActionRowComponents(row =>
      row.addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL(patreonUrl)
          .setLabel('Join Patreon')
          .setEmoji(getEmoji(emojis.lightning)),
      ),
    )
  }

  return container
}

// ─── Config Hub ───────────────────────────────────────────────────────────────

function buildConfigHub({ panelChannelId, patreonUrl, supporterCount } = {}) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.fav} Patreon — Config`))

  const lines = [
    `**Channel:** ${panelChannelId ? `<#${panelChannelId}>` : '`not set`'}`,
    `**Patreon URL:** ${patreonUrl || '`not set`'}`,
    `**Cached Supporters:** ${supporterCount || '0'}`,
  ]
  container.addTextDisplayComponents(td => td.setContent(lines.join('\n')))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  container.addActionRowComponents(row =>
    row.addComponents(
      new ButtonBuilder().setCustomId('patreon_nav:panel').setLabel('Post Panel').setEmoji(getEmoji(emojis.pin)).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('patreon_nav:tiers').setLabel('Edit Tiers').setEmoji(getEmoji(emojis.role)).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('patreon_nav:settings').setLabel('Settings').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
    ),
  )

  return container
}

// ─── Post Panel sub-panel ─────────────────────────────────────────────────────

function buildPostPanelSubpanel(channelId) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.pin} Post Panel\nSelect the channel where the Patreon panel will be posted (or refreshed).`))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  container.addActionRowComponents(row =>
    row.addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('patreon_cfg_channel')
        .setPlaceholder('Select channel…'),
    ),
  )
  if (channelId) {
    container.addTextDisplayComponents(td => td.setContent(`Current: <#${channelId}>`))
    container.addActionRowComponents(row =>
      row.addComponents(
        new ButtonBuilder().setCustomId('patreon_post_confirm').setLabel('Post / Refresh').setEmoji(getEmoji(emojis.pin)).setStyle(ButtonStyle.Primary),
        back('patreon_cfg_back'),
      ),
    )
  } else {
    container.addActionRowComponents(row => row.addComponents(back('patreon_cfg_back')))
  }
  return container
}

// ─── Settings sub-panel ───────────────────────────────────────────────────────

function buildSettingsPanel({ patreonUrl, showCount, countThreshold, milestone, mainTitle, mainDescription } = {}) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.settings} Settings`))

  const lines = [
    `**Main Title:** ${mainTitle || '`not set (default: Support Us)`'}`,
    `**Main Description:** ${mainDescription || '`not set (default)`'}`,
    `**Patreon URL:** ${patreonUrl || '`not set`'}`,
    `**Show Supporter Count:** ${showCount === 'true' ? emojis.success : emojis.cancel}`,
    `**Minimum to show count:** ${countThreshold || '20'}`,
    `**Milestone target:** ${milestone || '`not set`'}`,
  ]
  container.addTextDisplayComponents(td => td.setContent(lines.join('\n')))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  container.addActionRowComponents(row =>
    row.addComponents(
      new ButtonBuilder().setCustomId('patreon_set_message').setLabel('Edit Main Message').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('patreon_set_url').setLabel('Set URL').setEmoji(getEmoji(emojis.url)).setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('patreon_toggle_count')
        .setLabel(showCount === 'true' ? 'Hide Count' : 'Show Count')
        .setEmoji(getEmoji(showCount === 'true' ? emojis.cancel : emojis.success))
        .setStyle(showCount === 'true' ? ButtonStyle.Danger : ButtonStyle.Success),
    ),
  )
  container.addActionRowComponents(row =>
    row.addComponents(
      new ButtonBuilder().setCustomId('patreon_set_threshold').setLabel('Set Min Count').setEmoji(getEmoji(emojis.graph)).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('patreon_set_milestone').setLabel('Set Milestone').setEmoji(getEmoji(emojis.location)).setStyle(ButtonStyle.Secondary),
      back('patreon_cfg_back'),
    ),
  )

  return container
}

// ─── Edit Tiers sub-panel ─────────────────────────────────────────────────────

function buildEditTiersPanel(tiers, tiersTitle, tiersFooter) {
  const container = new ContainerBuilder()
  container.addTextDisplayComponents(td => td.setContent(`## ${emojis.role} Edit Display Tiers\nThese are shown in the public "View Tiers" panel.`))
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  container.addTextDisplayComponents(td =>
    td.setContent(
      `**Panel Title:** ${tiersTitle || '`not set (default: Our Support Tiers)`'}\n` +
      `**Panel Footer:** ${tiersFooter || '`not set (default: Ready to join?)`'}`,
    ),
  )
  container.addActionRowComponents(row =>
    row.addComponents(
      new ButtonBuilder().setCustomId('patreon_tier_text').setLabel('Edit Title & Footer').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
    ),
  )
  container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))

  if (tiers.length) {
    const list = tiers.map((t, i) => `**${i + 1}.** ${emojis.fav} ${t.name} — ${t.price}`).join('\n')
    container.addTextDisplayComponents(td => td.setContent(list))
    container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  } else {
    container.addTextDisplayComponents(td => td.setContent('*No tiers configured.*'))
    container.addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
  }

  const row1 = [
    new ButtonBuilder().setCustomId('patreon_tier_add').setLabel('Add').setEmoji(getEmoji(emojis.plus)).setStyle(ButtonStyle.Success),
  ]
  if (tiers.length) {
    row1.push(new ButtonBuilder().setCustomId('patreon_tier_reset').setLabel('Reset Defaults').setEmoji(getEmoji(emojis.reload)).setStyle(ButtonStyle.Danger))
  }
  row1.push(back('patreon_cfg_back'))
  container.addActionRowComponents(row => row.addComponents(...row1))

  if (tiers.length) {
    container.addActionRowComponents(row =>
      row.addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('patreon_tier_edit_select')
          .setPlaceholder('Select a tier to edit…')
          .addOptions(tiers.map(t =>
            new StringSelectMenuOptionBuilder().setLabel(`Edit: ${t.name}`).setValue(t.id),
          )),
      ),
    )
    container.addActionRowComponents(row =>
      row.addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('patreon_tier_remove_select')
          .setPlaceholder('Select a tier to remove…')
          .addOptions(tiers.map(t =>
            new StringSelectMenuOptionBuilder().setLabel(`Remove: ${t.name}`).setValue(t.id),
          )),
      ),
    )
  }

  return container
}

// ─── Modals ────────────────────────────────────────────────────────────────────

function buildAddTierModal() {
  return new ModalBuilder()
    .setCustomId('modal_patreon_tier_add')
    .setTitle('Add Display Tier')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tier_name').setLabel('Tier name (e.g. Resident)').setStyle(TextInputStyle.Short).setMaxLength(50).setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tier_price').setLabel('Price (e.g. $5/month)').setStyle(TextInputStyle.Short).setMaxLength(30).setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tier_benefits').setLabel('Benefits (one per line)').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)
          .setPlaceholder('Access to dev-log\nEarly previews\nSupport the project'),
      ),
    )
}

function buildEditTierModal(tier) {
  const benefits = JSON.parse(tier.benefits || '[]').join('\n')
  return new ModalBuilder()
    .setCustomId(`modal_patreon_tier_edit:${tier.id}`)
    .setTitle(`Edit Tier: ${tier.name}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tier_name').setLabel('Name').setStyle(TextInputStyle.Short).setMaxLength(50).setRequired(true).setValue(tier.name),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tier_price').setLabel('Price').setStyle(TextInputStyle.Short).setMaxLength(30).setRequired(true).setValue(tier.price),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tier_benefits').setLabel('Benefits (one per line)').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true).setValue(benefits),
      ),
    )
}

function buildMessageModal(currentTitle, currentDescription) {
  return new ModalBuilder()
    .setCustomId('modal_patreon_set_message')
    .setTitle('Main Message')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('main_title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(false)
          .setValue(currentTitle || '')
          .setPlaceholder('Support Us'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('main_description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(false)
          .setValue(currentDescription || '')
          .setPlaceholder('Help us build the future of social worlds.'),
      ),
    )
}

function buildTiersTextModal(currentTitle, currentFooter) {
  return new ModalBuilder()
    .setCustomId('modal_patreon_tier_text')
    .setTitle('Tiers Panel Text')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tiers_title')
          .setLabel('Panel Title')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(false)
          .setValue(currentTitle || '')
          .setPlaceholder('Our Support Tiers'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tiers_footer')
          .setLabel('Panel Footer')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(false)
          .setValue(currentFooter || '')
          .setPlaceholder('Ready to join?'),
      ),
    )
}

function buildUrlModal(current) {
  return new ModalBuilder()
    .setCustomId('modal_patreon_set_url')
    .setTitle('Patreon URL')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('patreon_url')
          .setLabel('Your Patreon page URL')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(200)
          .setRequired(true)
          .setPlaceholder('https://www.patreon.com/yourpage')
          .setValue(current || ''),
      ),
    )
}

function buildThresholdModal(current) {
  return new ModalBuilder()
    .setCustomId('modal_patreon_threshold')
    .setTitle('Minimum Supporter Count')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('threshold_value')
          .setLabel('Show count when supporters reach:')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(6)
          .setRequired(true)
          .setValue(current || '20'),
      ),
    )
}

function buildMilestoneModal(current) {
  return new ModalBuilder()
    .setCustomId('modal_patreon_milestone')
    .setTitle('Milestone Target')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('milestone_value')
          .setLabel('Next milestone (number of supporters)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(6)
          .setRequired(false)
          .setValue(current || '')
          .setPlaceholder('e.g. 200 — leave blank to hide'),
      ),
    )
}

module.exports = {
  buildMainPanel,
  buildTiersPanel,
  buildConfigHub,
  buildPostPanelSubpanel,
  buildSettingsPanel,
  buildEditTiersPanel,
  buildAddTierModal,
  buildEditTierModal,
  buildUrlModal,
  buildThresholdModal,
  buildMilestoneModal,
  buildMessageModal,
  buildTiersTextModal,
}
