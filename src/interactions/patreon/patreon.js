const { MessageFlags, ContainerBuilder } = require('discord.js')
const db  = require('../../utils/patreon/database')
const {
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
} = require('../../utils/patreon/manager')
const { DEFAULT_TIERS } = require('../../utils/patreon/database')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isStaff(interaction) {
  return !!interaction.member?.permissions?.has('ManageMessages')
}

async function loadTiersText(conn) {
  const [tiersTitle, tiersFooter] = await Promise.all([
    conn.getConfig('tiers_title'),
    conn.getConfig('tiers_footer'),
  ])
  return { tiersTitle, tiersFooter }
}

async function loadHub(conn) {
  const [patreonUrl, panelChannelId, supporterCount] = await Promise.all([
    conn.getConfig('patreon_url'),
    conn.getConfig('panel_channel_id'),
    conn.getConfig('supporter_count', '0'),
  ])
  return buildConfigHub({ patreonUrl, panelChannelId, supporterCount })
}

async function postOrRefreshPanel(guild, conn) {
  const channelId = await conn.getConfig('panel_channel_id')
  if (!channelId) return false

  const ch = guild.channels.cache.get(channelId)
  if (!ch) return false

  const [patreonUrl, showCount, countThreshold, milestone, supporterCount, mainTitle, mainDescription] = await Promise.all([
    conn.getConfig('patreon_url'),
    conn.getConfig('show_count', 'false'),
    conn.getConfig('count_threshold', '20'),
    conn.getConfig('milestone'),
    conn.getConfig('supporter_count', '0'),
    conn.getConfig('main_title'),
    conn.getConfig('main_description'),
  ])

  const payload = {
    components: [buildMainPanel({ patreonUrl, supporterCount, milestone, showCount, countThreshold, mainTitle, mainDescription })],
    flags: [MessageFlags.IsComponentsV2],
  }

  const existingMsgId = await conn.getConfig('panel_message_id')
  if (existingMsgId) {
    const msg = await ch.messages.fetch(existingMsgId).catch(() => null)
    if (msg) {
      await msg.edit(payload).catch(() => {})
      return true
    }
  }

  const msg = await ch.send(payload).catch(() => null)
  if (msg) {
    await conn.setConfig('panel_message_id', msg.id)
    return true
  }
  return false
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = {
  async execute(client, interaction) {
    if (!interaction.guild) return
    if (!interaction.customId) return

    const id   = interaction.customId
    const conn = db.getConnection(interaction.guild.id)
    await conn.ready

    // ── Public: View Tiers ────────────────────────────────────────────────
    if (interaction.isButton() && id === 'patreon_view_tiers') {
      const [tiers, patreonUrl, tiersTitle, tiersFooter] = await Promise.all([
        conn.getTiers(),
        conn.getConfig('patreon_url'),
        conn.getConfig('tiers_title'),
        conn.getConfig('tiers_footer'),
      ])
      return interaction.reply({
        components: [buildTiersPanel(tiers, patreonUrl, tiersTitle, tiersFooter)],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // ─── All config interactions require staff ────────────────────────────
    if (!isStaff(interaction)) return

    // ── Back to hub ───────────────────────────────────────────────────────
    if (interaction.isButton() && id === 'patreon_cfg_back') {
      return interaction.update({
        components: [await loadHub(conn)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Navigate ──────────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('patreon_nav:')) {
      const panel = id.split(':')[1]

      if (panel === 'panel') {
        const channelId = await conn.getConfig('panel_channel_id')
        return interaction.update({
          components: [buildPostPanelSubpanel(channelId)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'tiers') {
        const tiers = await conn.getTiers()
        const { tiersTitle, tiersFooter } = await loadTiersText(conn)
        return interaction.update({
          components: [buildEditTiersPanel(tiers, tiersTitle, tiersFooter)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'settings') {
        const [patreonUrl, showCount, countThreshold, milestone, mainTitle, mainDescription] = await Promise.all([
          conn.getConfig('patreon_url'),
          conn.getConfig('show_count', 'false'),
          conn.getConfig('count_threshold', '20'),
          conn.getConfig('milestone'),
          conn.getConfig('main_title'),
          conn.getConfig('main_description'),
        ])
        return interaction.update({
          components: [buildSettingsPanel({ patreonUrl, showCount, countThreshold, milestone, mainTitle, mainDescription })],
          flags: [MessageFlags.IsComponentsV2],
        })
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // POST PANEL
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isChannelSelectMenu() && id === 'patreon_cfg_channel') {
      const channelId = interaction.values[0]
      await conn.setConfig('panel_channel_id', channelId)
      return interaction.update({
        components: [buildPostPanelSubpanel(channelId)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'patreon_post_confirm') {
      const posted = await postOrRefreshPanel(interaction.guild, conn)
      if (!posted) {
        return interaction.reply({ content: '❌ Could not post the panel. Make sure the channel is selected.', flags: MessageFlags.Ephemeral })
      }
      return interaction.update({
        components: [await loadHub(conn)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // SETTINGS
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id === 'patreon_set_message') {
      const [currentTitle, currentDescription] = await Promise.all([
        conn.getConfig('main_title', ''),
        conn.getConfig('main_description', ''),
      ])
      return interaction.showModal(buildMessageModal(currentTitle, currentDescription))
    }

    if (interaction.isModalSubmit() && id === 'modal_patreon_set_message') {
      const title       = interaction.fields.getTextInputValue('main_title').trim()
      const description = interaction.fields.getTextInputValue('main_description').trim()

      title ? await conn.setConfig('main_title', title) : await conn.deleteConfig('main_title')
      description ? await conn.setConfig('main_description', description) : await conn.deleteConfig('main_description')

      await postOrRefreshPanel(interaction.guild, conn)
      const [patreonUrl, showCount, countThreshold, milestone] = await Promise.all([
        conn.getConfig('patreon_url'),
        conn.getConfig('show_count', 'false'),
        conn.getConfig('count_threshold', '20'),
        conn.getConfig('milestone'),
      ])
      return interaction.update({
        components: [buildSettingsPanel({ patreonUrl, showCount, countThreshold, milestone, mainTitle: title, mainDescription: description })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'patreon_set_url') {
      const current = await conn.getConfig('patreon_url', '')
      return interaction.showModal(buildUrlModal(current))
    }

    if (interaction.isModalSubmit() && id === 'modal_patreon_set_url') {
      const url = interaction.fields.getTextInputValue('patreon_url').trim()
      await conn.setConfig('patreon_url', url)
      await postOrRefreshPanel(interaction.guild, conn)
      const [showCount, countThreshold, milestone] = await Promise.all([
        conn.getConfig('show_count', 'false'),
        conn.getConfig('count_threshold', '20'),
        conn.getConfig('milestone'),
      ])
      return interaction.update({
        components: [buildSettingsPanel({ patreonUrl: url, showCount, countThreshold, milestone })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'patreon_toggle_count') {
      const current = await conn.getConfig('show_count', 'false')
      const next    = current === 'true' ? 'false' : 'true'
      await conn.setConfig('show_count', next)
      await postOrRefreshPanel(interaction.guild, conn)
      const [patreonUrl, countThreshold, milestone] = await Promise.all([
        conn.getConfig('patreon_url'),
        conn.getConfig('count_threshold', '20'),
        conn.getConfig('milestone'),
      ])
      return interaction.update({
        components: [buildSettingsPanel({ patreonUrl, showCount: next, countThreshold, milestone })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'patreon_set_threshold') {
      const current = await conn.getConfig('count_threshold', '20')
      return interaction.showModal(buildThresholdModal(current))
    }

    if (interaction.isModalSubmit() && id === 'modal_patreon_threshold') {
      const val = parseInt(interaction.fields.getTextInputValue('threshold_value'))
      if (isNaN(val) || val < 1) {
        return interaction.reply({ content: '❌ Enter a valid positive number.', flags: MessageFlags.Ephemeral })
      }
      await conn.setConfig('count_threshold', val)
      await postOrRefreshPanel(interaction.guild, conn)
      const [patreonUrl, showCount, milestone] = await Promise.all([
        conn.getConfig('patreon_url'),
        conn.getConfig('show_count', 'false'),
        conn.getConfig('milestone'),
      ])
      return interaction.update({
        components: [buildSettingsPanel({ patreonUrl, showCount, countThreshold: String(val), milestone })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'patreon_set_milestone') {
      const current = await conn.getConfig('milestone', '')
      return interaction.showModal(buildMilestoneModal(current))
    }

    if (interaction.isModalSubmit() && id === 'modal_patreon_milestone') {
      const raw = interaction.fields.getTextInputValue('milestone_value').trim()
      if (raw) {
        const val = parseInt(raw)
        if (isNaN(val) || val < 1) {
          return interaction.reply({ content: '❌ Enter a valid number, or leave blank to remove.', flags: MessageFlags.Ephemeral })
        }
        await conn.setConfig('milestone', val)
      } else {
        await conn.deleteConfig('milestone')
      }
      await postOrRefreshPanel(interaction.guild, conn)
      const [patreonUrl, showCount, countThreshold] = await Promise.all([
        conn.getConfig('patreon_url'),
        conn.getConfig('show_count', 'false'),
        conn.getConfig('count_threshold', '20'),
      ])
      return interaction.update({
        components: [buildSettingsPanel({ patreonUrl, showCount, countThreshold, milestone: raw || null })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // EDIT TIERS
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id === 'patreon_tier_text') {
      const { tiersTitle, tiersFooter } = await loadTiersText(conn)
      return interaction.showModal(buildTiersTextModal(tiersTitle, tiersFooter))
    }

    if (interaction.isModalSubmit() && id === 'modal_patreon_tier_text') {
      const title  = interaction.fields.getTextInputValue('tiers_title').trim()
      const footer = interaction.fields.getTextInputValue('tiers_footer').trim()

      title ? await conn.setConfig('tiers_title', title) : await conn.deleteConfig('tiers_title')
      footer ? await conn.setConfig('tiers_footer', footer) : await conn.deleteConfig('tiers_footer')

      const updated = await conn.getTiers()
      return interaction.update({
        components: [buildEditTiersPanel(updated, title, footer)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'patreon_tier_add') {
      return interaction.showModal(buildAddTierModal())
    }

    if (interaction.isModalSubmit() && id === 'modal_patreon_tier_add') {
      const name     = interaction.fields.getTextInputValue('tier_name').trim()
      const price    = interaction.fields.getTextInputValue('tier_price').trim()
      const rawBen   = interaction.fields.getTextInputValue('tier_benefits').trim()
      const benefits = rawBen.split('\n').map(l => l.trim()).filter(Boolean)

      const tiers     = await conn.getTiers()
      const sortOrder = tiers.length ? Math.max(...tiers.map(t => t.sort_order)) + 1 : 0
      const tierId    = name.toLowerCase().replace(/[^a-z0-9]/g, '_')

      await conn.upsertTier({ id: tierId, name, price, benefits, sort_order: sortOrder })
      await postOrRefreshPanel(interaction.guild, conn)
      const updated = await conn.getTiers()
      const { tiersTitle, tiersFooter } = await loadTiersText(conn)
      return interaction.update({
        components: [buildEditTiersPanel(updated, tiersTitle, tiersFooter)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isStringSelectMenu() && id === 'patreon_tier_edit_select') {
      const tierId = interaction.values[0]
      const tier   = await conn.getTier(tierId)
      if (!tier) return interaction.reply({ content: '❌ Tier not found.', flags: MessageFlags.Ephemeral })
      return interaction.showModal(buildEditTierModal(tier))
    }

    if (interaction.isModalSubmit() && id.startsWith('modal_patreon_tier_edit:')) {
      const tierId   = id.split(':')[1]
      const existing = await conn.getTier(tierId)
      if (!existing) return interaction.reply({ content: '❌ Tier not found.', flags: MessageFlags.Ephemeral })

      const name     = interaction.fields.getTextInputValue('tier_name').trim()
      const price    = interaction.fields.getTextInputValue('tier_price').trim()
      const rawBen   = interaction.fields.getTextInputValue('tier_benefits').trim()
      const benefits = rawBen.split('\n').map(l => l.trim()).filter(Boolean)

      await conn.upsertTier({ id: tierId, name, price, benefits, sort_order: existing.sort_order })
      await postOrRefreshPanel(interaction.guild, conn)
      const updated = await conn.getTiers()
      const { tiersTitle, tiersFooter } = await loadTiersText(conn)
      return interaction.update({
        components: [buildEditTiersPanel(updated, tiersTitle, tiersFooter)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isStringSelectMenu() && id === 'patreon_tier_remove_select') {
      const tierId = interaction.values[0]
      await conn.removeTier(tierId)
      await postOrRefreshPanel(interaction.guild, conn)
      const updated = await conn.getTiers()
      const { tiersTitle, tiersFooter } = await loadTiersText(conn)
      return interaction.update({
        components: [buildEditTiersPanel(updated, tiersTitle, tiersFooter)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'patreon_tier_reset') {
      for (const t of DEFAULT_TIERS) {
        await conn.upsertTier({ id: t.id, name: t.name, price: t.price, benefits: JSON.parse(t.benefits), sort_order: t.sort_order })
      }
      await postOrRefreshPanel(interaction.guild, conn)
      const updated = await conn.getTiers()
      const { tiersTitle, tiersFooter } = await loadTiersText(conn)
      return interaction.update({
        components: [buildEditTiersPanel(updated, tiersTitle, tiersFooter)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }
  },
}
