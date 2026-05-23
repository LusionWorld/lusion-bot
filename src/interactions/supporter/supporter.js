const { MessageFlags } = require('discord.js')
const db = require('../../utils/supporter/database')
const {
  buildConfigHub,
  buildChannelsPanel,
  buildTierRolesPanel,
  buildTierRoleSelect,
  buildDmTemplatesPanel,
  buildTemplateEditPanel,
  buildTemplateTypeList,
  buildReportPanel,
  buildSettingsPanel,
  buildDmContainer,
  buildReportContainer,
  buildAddTierNameModal,
  buildTemplateModal,
  buildImageModal,
  buildReportDayModal,
} = require('../../utils/supporter/manager')

function isStaff(interaction) {
  return !!interaction.member?.permissions?.has('ManageMessages')
}

async function loadHub(conn) {
  const [logChannelId, reportChannelId, dmEnabled, logsEnabled, reportEnabled] = await Promise.all([
    conn.getConfig('log_channel_id'),
    conn.getConfig('report_channel_id'),
    conn.getConfig('dm_enabled', 'true'),
    conn.getConfig('logs_enabled', 'true'),
    conn.getConfig('report_enabled', 'false'),
  ])
  const tiers = await conn.getTierRoles()
  return buildConfigHub({ logChannelId, reportChannelId, dmEnabled, logsEnabled, reportEnabled, tierCount: tiers.length })
}

async function resolveTemplateLabel(templateKey, tiers) {
  const parts = templateKey.split('_')
  if (templateKey === 'cancelled') return 'Access Cancelled'
  const level = parseInt(parts[parts.length - 1])
  const tier  = tiers.find(t => t.tier_level === level)
  const name  = tier?.tier_name ?? `Level ${level}`
  if (parts[0] === 'new')       return `New Supporter → ${name}`
  if (parts[0] === 'upgrade')   return `Upgrade → ${name}`
  if (parts[0] === 'downgrade') return `Downgrade → ${name}`
  return templateKey
}

module.exports = {
  async execute(client, interaction) {
    if (!interaction.guild) return
    if (!interaction.customId) return
    if (!isStaff(interaction)) return

    const id   = interaction.customId
    const conn = db.getConnection(interaction.guild.id)
    await conn.ready

    // ── Back to hub ───────────────────────────────────────────────────────
    if (interaction.isButton() && id === 'sup_cfg_back') {
      return interaction.update({
        components: [await loadHub(conn)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Navigate ──────────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('sup_nav:')) {
      const panel = id.split(':')[1]

      if (panel === 'channels') {
        const [logChannelId, reportChannelId] = await Promise.all([
          conn.getConfig('log_channel_id'),
          conn.getConfig('report_channel_id'),
        ])
        return interaction.update({
          components: [buildChannelsPanel({ logChannelId, reportChannelId })],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'tiers') {
        const tiers = await conn.getTierRoles()
        return interaction.update({
          components: [buildTierRolesPanel(tiers)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'templates') {
        const [templates, tiers] = await Promise.all([conn.getAllTemplates(), conn.getTierRoles()])
        return interaction.update({
          components: [buildDmTemplatesPanel(templates, tiers)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'report') {
        const [reportEnabled, reportDay, reportChannelId] = await Promise.all([
          conn.getConfig('report_enabled', 'false'),
          conn.getConfig('report_day', '1'),
          conn.getConfig('report_channel_id'),
        ])
        return interaction.update({
          components: [buildReportPanel({ reportEnabled, reportDay, reportChannelId })],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'settings') {
        const [dmEnabled, logsEnabled] = await Promise.all([
          conn.getConfig('dm_enabled', 'true'),
          conn.getConfig('logs_enabled', 'true'),
        ])
        return interaction.update({
          components: [buildSettingsPanel({ dmEnabled, logsEnabled })],
          flags: [MessageFlags.IsComponentsV2],
        })
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // CHANNELS
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isChannelSelectMenu() && id === 'sup_cfg_log_channel') {
      await conn.setConfig('log_channel_id', interaction.values[0])
      const reportChannelId = await conn.getConfig('report_channel_id')
      return interaction.update({
        components: [buildChannelsPanel({ logChannelId: interaction.values[0], reportChannelId })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isChannelSelectMenu() && id === 'sup_cfg_report_channel') {
      await conn.setConfig('report_channel_id', interaction.values[0])
      const logChannelId = await conn.getConfig('log_channel_id')
      return interaction.update({
        components: [buildChannelsPanel({ logChannelId, reportChannelId: interaction.values[0] })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // TIER ROLES
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id === 'sup_tier_add_start') {
      return interaction.update({
        components: [buildTierRoleSelect()],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isRoleSelectMenu() && id === 'sup_tier_role_selected') {
      const roleId = interaction.values[0]
      if (!client.supporterCfg) client.supporterCfg = {}
      if (!client.supporterCfg[interaction.guild.id]) client.supporterCfg[interaction.guild.id] = {}
      client.supporterCfg[interaction.guild.id].pendingTierRole = roleId
      return interaction.showModal(buildAddTierNameModal(roleId))
    }

    if (interaction.isModalSubmit() && id.startsWith('modal_sup_tier_name:')) {
      const roleId   = id.split(':')[1]
      const name     = interaction.fields.getTextInputValue('tier_name').trim()
      const levelRaw = interaction.fields.getTextInputValue('tier_level').trim()
      const level    = parseInt(levelRaw)

      if (!name || isNaN(level) || level < 1) {
        return interaction.reply({ content: '❌ Invalid name or level.', flags: MessageFlags.Ephemeral })
      }

      await conn.upsertTierRole(roleId, name, level)
      const tiers = await conn.getTierRoles()
      return interaction.update({
        components: [buildTierRolesPanel(tiers)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isStringSelectMenu() && id === 'sup_tier_remove') {
      const roleId = interaction.values[0]
      await conn.removeTierRole(roleId)
      const tiers = await conn.getTierRoles()
      return interaction.update({
        components: [buildTierRolesPanel(tiers)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // DM TEMPLATES
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isStringSelectMenu() && id === 'sup_template_select') {
      const templateKey = interaction.values[0]
      const tiers       = await conn.getTierRoles()
      const template    = await conn.getTemplate(templateKey)
      const label       = await resolveTemplateLabel(templateKey, tiers)
      return interaction.update({
        components: [buildTemplateEditPanel(templateKey, template, label)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id.startsWith('sup_template_toggle:')) {
      const templateKey = id.split(':')[1]
      const tiers       = await conn.getTierRoles()
      const existing    = await conn.getTemplate(templateKey)

      if (!existing) {
        // Create with defaults first, then toggle
        await conn.upsertTemplate(templateKey, { enabled: 0 })
      } else {
        await conn.toggleTemplate(templateKey)
      }
      const updated = await conn.getTemplate(templateKey)
      const label   = await resolveTemplateLabel(templateKey, tiers)
      return interaction.update({
        components: [buildTemplateEditPanel(templateKey, updated, label)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id.startsWith('sup_template_edit:')) {
      const templateKey = id.split(':')[1]
      const template    = await conn.getTemplate(templateKey)
      return interaction.showModal(buildTemplateModal(templateKey, template))
    }

    if (interaction.isModalSubmit() && id.startsWith('modal_sup_template:')) {
      const templateKey = id.split(':')[1]
      const header      = interaction.fields.getTextInputValue('tmpl_header').trim()
      const body        = interaction.fields.getTextInputValue('tmpl_body').trim()
      const rawChannels = interaction.fields.getTextInputValue('tmpl_channels').trim()
      const start_here  = interaction.fields.getTextInputValue('tmpl_start_here').trim()
      const footer      = interaction.fields.getTextInputValue('tmpl_footer').trim()
      const channels    = rawChannels ? rawChannels.split('\n').map(l => l.trim()).filter(Boolean) : []

      const existing = await conn.getTemplate(templateKey)
      await conn.upsertTemplate(templateKey, {
        header, body, channels, start_here, footer,
        image_url: existing?.image_url ?? null,
        enabled: existing?.enabled ?? 1,
      })

      const tiers   = await conn.getTierRoles()
      const updated = await conn.getTemplate(templateKey)
      const label   = await resolveTemplateLabel(templateKey, tiers)
      return interaction.update({
        components: [buildTemplateEditPanel(templateKey, updated, label)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id.startsWith('sup_template_image:')) {
      const templateKey = id.split(':')[1]
      const template    = await conn.getTemplate(templateKey)
      return interaction.showModal(buildImageModal(templateKey, template?.image_url))
    }

    if (interaction.isModalSubmit() && id.startsWith('modal_sup_image:')) {
      const templateKey = id.split(':')[1]
      const imageUrl    = interaction.fields.getTextInputValue('image_url').trim()
      await conn.setTemplateImage(templateKey, imageUrl)

      const tiers   = await conn.getTierRoles()
      const updated = await conn.getTemplate(templateKey)
      const label   = await resolveTemplateLabel(templateKey, tiers)
      return interaction.update({
        components: [buildTemplateEditPanel(templateKey, updated, label)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ─── Preview DM template ──────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('sup_template_preview:')) {
      const templateKey = id.split(':')[1]
      const template    = await conn.getTemplate(templateKey)
      if (!template) return interaction.reply({ content: '❌ Template not set.', flags: MessageFlags.Ephemeral })
      return interaction.reply({
        components: [buildDmContainer(template, { tierName: templateKey, guildName: interaction.guild.name })],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // SETTINGS
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id.startsWith('sup_toggle:')) {
      const key     = id.split(':')[1]
      const current = await conn.getConfig(key, 'true')
      const next    = current === 'true' ? 'false' : 'true'
      await conn.setConfig(key, next)
      const [dmEnabled, logsEnabled] = await Promise.all([
        conn.getConfig('dm_enabled', 'true'),
        conn.getConfig('logs_enabled', 'true'),
      ])
      return interaction.update({
        components: [buildSettingsPanel({ dmEnabled, logsEnabled })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // MONTHLY REPORT
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id === 'sup_report_toggle') {
      const current = await conn.getConfig('report_enabled', 'false')
      const next    = current === 'true' ? 'false' : 'true'
      await conn.setConfig('report_enabled', next)
      const [reportDay, reportChannelId] = await Promise.all([
        conn.getConfig('report_day', '1'),
        conn.getConfig('report_channel_id'),
      ])
      return interaction.update({
        components: [buildReportPanel({ reportEnabled: next, reportDay, reportChannelId })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'sup_report_day') {
      const current = await conn.getConfig('report_day', '1')
      return interaction.showModal(buildReportDayModal(current))
    }

    if (interaction.isModalSubmit() && id === 'modal_sup_report_day') {
      const val = parseInt(interaction.fields.getTextInputValue('report_day'))
      if (isNaN(val) || val < 1 || val > 28) {
        return interaction.reply({ content: '❌ Enter a day between 1 and 28.', flags: MessageFlags.Ephemeral })
      }
      await conn.setConfig('report_day', val)
      const [reportEnabled, reportChannelId] = await Promise.all([
        conn.getConfig('report_enabled', 'false'),
        conn.getConfig('report_channel_id'),
      ])
      return interaction.update({
        components: [buildReportPanel({ reportEnabled, reportDay: String(val), reportChannelId })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'sup_report_preview') {
      const stats = await conn.getMonthlyStats(conn.currentMonth())
      return interaction.reply({
        components: [buildReportContainer(stats, conn.currentMonth(), null)],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }
  },
}
