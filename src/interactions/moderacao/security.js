const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js')

const db = require('../../utils/moderacao/security-database')
const { getEmojis } = require('../../utils/emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  const [, name, id] = match
  return { name, id }
}

function onOff(val) {
  return val ? `${emojis.success} **Enabled**` : `${emojis.danger} **Disabled**`
}

function toggleStyle(val) {
  return val ? ButtonStyle.Success : ButtonStyle.Danger
}

function toggleLabel(val, label) {
  return val ? `Disable ${label}` : `Enable ${label}`
}

function parseJson(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

// ─── Main Security Panel ───────────────────────────────────────────────────
async function buildMainPanel(guild) {
  const cfg = await db.ensureConfig(guild.id)

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.seguranca} **Security** | ${guild.name}`)
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `> System: ${onOff(cfg.system_enabled)}\n` +
        `> Alert channel: ${cfg.alert_channel ? `<#${cfg.alert_channel}>` : `${emojis.warning} Not configured`}`
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.lock} **Link Control**\nBlock invites, shorteners, custom domains & repeated links`)
      ).setButtonAccessory(btn =>
        btn.setCustomId('sec_link').setLabel('Configure').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary)
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.lightning} **Flood Detection**\nDetect spam, mass mentions & message floods`)
      ).setButtonAccessory(btn =>
        btn.setCustomId('sec_flood').setLabel('Configure').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary)
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.users} **New Member Restrictions**\nControl what new members can do until trusted`)
      ).setButtonAccessory(btn =>
        btn.setCustomId('sec_newmember').setLabel('Configure').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary)
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.activity} **Alerts & Notifications**\nChoose what events trigger staff alerts`)
      ).setButtonAccessory(btn =>
        btn.setCustomId('sec_alerts').setLabel('Configure').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary)
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.danger} **Server Protection**\nAuto-punish members who mass-delete channels or roles`)
      ).setButtonAccessory(btn =>
        btn.setCustomId('sec_protect').setLabel('Configure').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary)
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_toggle_system')
          .setLabel(toggleLabel(cfg.system_enabled, 'System'))
          .setEmoji(getEmoji(emojis.settings))
          .setStyle(toggleStyle(cfg.system_enabled)),
        new ButtonBuilder()
          .setCustomId('sec_set_alert_channel_main')
          .setLabel('Set Alert Channel')
          .setEmoji(getEmoji(emojis.announcementc))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_check_member')
          .setLabel('Check Member')
          .setEmoji(getEmoji(emojis.account))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('mod_voltar')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

// ─── Alert Channel Selector (main → sec_main) ─────────────────────────────
function buildAlertChannelSelector(guild, backId, currentChannelId = null) {
  const sel = new ChannelSelectMenuBuilder()
    .setCustomId(`sec_do_set_alert:${backId}`)
    .setPlaceholder('Select alert channel…')
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1).setMaxValues(1)

  if (currentChannelId) sel.setDefaultChannels([currentChannelId])

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.announcementc} **Set Alert Channel** | ${guild.name}\n` +
        `Current: ${currentChannelId ? `<#${currentChannelId}>` : 'None'}\n\n` +
        `Select a new channel below.`
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(sel))
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(backId)
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

// ─── Member Check Panel ────────────────────────────────────────────────────
function buildMemberCheckSelector(guild) {
  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.account} **Check Member** | ${guild.name}\n\n` +
        `Select a member to view their trust status, flags, and restriction level.`
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new UserSelectMenuBuilder()
          .setCustomId('sec_do_check_member')
          .setPlaceholder('Select a member to inspect…')
          .setMinValues(1).setMaxValues(1)
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_main')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

async function buildMemberStatusPanel(guild, userId, cfg) {
  const trust = await db.getMemberTrust(guild.id, userId)

  let member = null
  try { member = await guild.members.fetch(userId) } catch {}

  const user = member?.user || { tag: `Unknown (${userId})`, id: userId, createdTimestamp: null }
  const joinedAt     = member?.joinedTimestamp ?? trust?.joined_at ?? null
  const daysSince    = joinedAt ? (Date.now() - joinedAt) / 86_400_000 : null
  const accountAgeDays = user.createdTimestamp
    ? Math.floor((Date.now() - user.createdTimestamp) / 86_400_000)
    : null

  const msgCount = trust?.msg_count ?? 0
  const flags    = trust?.flags ?? 0

  // Determine status
  const daysOk = daysSince !== null && daysSince >= cfg.trust_days
  const msgsOk = msgCount >= cfg.trust_messages
  const noFlags = flags === 0

  let statusEmoji, statusLabel
  if (!trust) {
    statusEmoji = emojis.warning
    statusLabel = 'Not tracked yet'
  } else if (flags > 0) {
    statusEmoji = emojis.danger
    statusLabel = '🚩 Suspicious — has spam flags'
  } else if (!daysOk || !msgsOk) {
    statusEmoji = emojis.timedout
    statusLabel = '🔒 Restricted — new member'
  } else {
    statusEmoji = emojis.success
    statusLabel = '✅ Trusted — full access'
  }

  const daysDisplay  = daysSince !== null ? `${Math.floor(daysSince)}d` : 'Unknown'
  const daysNeeded   = cfg.trust_days
  const msgsNeeded   = cfg.trust_messages

  const lines = [
    `${emojis.account} **Member Status** | ${guild.name}`,
    '',
    `**User:** ${user.tag ?? user.id} \`(${userId})\``,
    `**Status:** ${statusEmoji} ${statusLabel}`,
    '',
    `${emojis.calendar} **Time in server:** ${daysDisplay} *(need: ${daysNeeded}d)* ${daysOk ? emojis.success : emojis.danger}`,
    `${emojis.message} **Valid messages:** ${msgCount} *(need: ${msgsNeeded})* ${msgsOk ? emojis.success : emojis.danger}`,
    `${emojis.warning} **Spam flags:** ${flags} ${noFlags ? emojis.success : emojis.danger}`,
    `${emojis.user} **Account age:** ${accountAgeDays !== null ? `${accountAgeDays} days` : 'Unknown'}`,
  ]

  if (flags > 0) {
    lines.push('', `${emojis.danger} This member has been flagged for suspicious activity.`)
  }

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(lines.join('\n')))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_check_member')
          .setLabel('Check Another')
          .setEmoji(getEmoji(emojis.refresh))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_main')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

// ─── Link Control Panel ───────────────────────────────────────────────────
async function buildLinkPanel(guild, msg = null) {
  const cfg = await db.ensureConfig(guild.id)

  const wl = parseJson(cfg.link_whitelist_channels)
  const ex = parseJson(cfg.link_exempt_roles)
  const custom = parseJson(cfg.link_block_custom)

  const wlText     = wl.length ? wl.map(id => `<#${id}>`).join(', ') : 'None'
  const exText     = ex.length ? ex.map(id => `<@&${id}>`).join(', ') : 'None'
  const customText = custom.length ? custom.map(d => `\`${d}\``).join(', ') : 'None'

  const lines = [
    `${emojis.lock} **Link Control** | ${guild.name}`,
    '',
    `${emojis.block}  Block Discord Invites — ${onOff(cfg.link_block_invites)}`,
    `${emojis.web}   Block URL Shorteners — ${onOff(cfg.link_block_shorteners)}`,
    `${emojis.warning} Block Repeated Links — ${onOff(cfg.link_block_repeat)} *(${cfg.link_repeat_count}× in ${cfg.link_repeat_window_sec}s)*`,
    `${emojis.user}  New Member Link Block — ${onOff(cfg.link_enabled)} *(< ${cfg.link_newmember_days} days)*`,
    '',
    `${emojis.cancel} **Blocked Custom Domains:** ${customText}`,
    `${emojis.textc} **Whitelist Channels** *(links allowed)*: ${wlText}`,
    `${emojis.role}  **Exempt Roles** *(bypass all link checks)*: ${exText}`,
    ...(msg ? ['', msg] : []),
  ]

  // Channel select with current whitelist pre-selected
  const channelSel = new ChannelSelectMenuBuilder()
    .setCustomId('sec_link_whitelist')
    .setPlaceholder(wl.length ? 'Update whitelist channels (reselect to keep)…' : 'Add whitelist channels…')
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(0).setMaxValues(10)
  if (wl.length) channelSel.setDefaultChannels(wl)

  // Role select with current exempt roles pre-selected
  const roleSel = new RoleSelectMenuBuilder()
    .setCustomId('sec_link_exempt_roles')
    .setPlaceholder(ex.length ? 'Update exempt roles (reselect to keep)…' : 'Add exempt roles…')
    .setMinValues(0).setMaxValues(10)
  if (ex.length) roleSel.setDefaultRoles(ex)

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(lines.join('\n')))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(channelSel))
    .addActionRowComponents(row => row.setComponents(roleSel))
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_toggle_link_enabled')
          .setLabel(toggleLabel(cfg.link_enabled, 'New Member Block'))
          .setStyle(toggleStyle(cfg.link_enabled)),
        new ButtonBuilder()
          .setCustomId('sec_toggle_link_block_invites')
          .setLabel(toggleLabel(cfg.link_block_invites, 'Invite Block'))
          .setStyle(toggleStyle(cfg.link_block_invites)),
        new ButtonBuilder()
          .setCustomId('sec_toggle_link_block_shorteners')
          .setLabel(toggleLabel(cfg.link_block_shorteners, 'Shorteners'))
          .setStyle(toggleStyle(cfg.link_block_shorteners))
      )
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_toggle_link_block_repeat')
          .setLabel(toggleLabel(cfg.link_block_repeat, 'Repeat Block'))
          .setStyle(toggleStyle(cfg.link_block_repeat)),
        new ButtonBuilder()
          .setCustomId('sec_link_custom_domains')
          .setLabel('Block Custom Domains')
          .setEmoji(getEmoji(emojis.cancel))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_link_thresholds')
          .setLabel('Set Thresholds')
          .setEmoji(getEmoji(emojis.settings))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_main')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

// ─── Flood Detection Panel ─────────────────────────────────────────────────
async function buildFloodPanel(guild, msg = null) {
  const cfg = await db.ensureConfig(guild.id)
  const ex = parseJson(cfg.flood_exempt_roles)
  const exText = ex.length ? ex.map(id => `<@&${id}>`).join(', ') : 'None'

  const escalationMin = Math.floor((cfg.flood_escalation_window_sec ?? 900) / 60)

  const lines = [
    `${emojis.lightning} **Flood Detection** | ${guild.name}`,
    '',
    `${emojis.message}  Message Rate Flood — ${onOff(cfg.flood_enabled)} *(${cfg.flood_msg_count} msgs / ${cfg.flood_msg_window_sec}s)*`,
    `${emojis.clipboard} Duplicate Messages — ${onOff(cfg.flood_duplicate_enabled)}`,
    `${emojis.users}   Mass Mentions — ${onOff(cfg.flood_enabled)} *(limit: ${cfg.flood_mention_limit})*`,
    `${emojis.star}    Emoji Spam — ${onOff(cfg.flood_enabled)} *(limit: ${cfg.flood_emoji_limit})*`,
    `${emojis.route}   Cross-Channel Spam — ${onOff(cfg.flood_crosspost_enabled)}`,
    '',
    `**Progressive Punishment** *(infractions counted within ${escalationMin} min)*:`,
    `${emojis.info}   1st infraction → warn + **${cfg.flood_timeout_level_1 ?? 5} min** timeout *(LOW alert)*`,
    `${emojis.warning} 2nd infraction → **${cfg.flood_timeout_level_2 ?? 15} min** timeout *(MEDIUM alert)*`,
    `${emojis.danger}  3rd+ infraction → **${cfg.flood_timeout_level_3 ?? 60} min** timeout *(HIGH alert)*`,
    '',
    `${emojis.role} **Exempt Roles** *(bypass all flood checks)*: ${exText}`,
    ...(msg ? ['', msg] : []),
  ]

  const roleSel = new RoleSelectMenuBuilder()
    .setCustomId('sec_flood_exempt_roles')
    .setPlaceholder(ex.length ? 'Update exempt roles (reselect to keep)…' : 'Add exempt roles…')
    .setMinValues(0).setMaxValues(10)
  if (ex.length) roleSel.setDefaultRoles(ex)

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(lines.join('\n')))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(roleSel))
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_toggle_flood_enabled')
          .setLabel(toggleLabel(cfg.flood_enabled, 'Flood Detection'))
          .setStyle(toggleStyle(cfg.flood_enabled)),
        new ButtonBuilder()
          .setCustomId('sec_toggle_flood_duplicate_enabled')
          .setLabel(toggleLabel(cfg.flood_duplicate_enabled, 'Duplicate Check'))
          .setStyle(toggleStyle(cfg.flood_duplicate_enabled)),
        new ButtonBuilder()
          .setCustomId('sec_toggle_flood_crosspost_enabled')
          .setLabel(toggleLabel(cfg.flood_crosspost_enabled, 'Cross-Channel'))
          .setStyle(toggleStyle(cfg.flood_crosspost_enabled))
      )
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_flood_thresholds')
          .setLabel('Detection Thresholds')
          .setEmoji(getEmoji(emojis.settings))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_flood_escalation')
          .setLabel('Punishment Escalation')
          .setEmoji(getEmoji(emojis.timedout))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_main')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

// ─── New Member Panel ──────────────────────────────────────────────────────
async function buildNewMemberPanel(guild, msg = null) {
  const cfg = await db.ensureConfig(guild.id)

  const lines = [
    `${emojis.users} **New Member Restrictions** | ${guild.name}`,
    '',
    `${emojis.check} **Trust System** — ${onOff(cfg.trust_enabled)}`,
    '',
    `A new member gains **Normal** access after meeting **all** of:`,
    `— ${emojis.calendar} At least **${cfg.trust_days} days** in the server`,
    `— ${emojis.message} At least **${cfg.trust_messages} valid messages** sent`,
    `— ${emojis.success} Zero spam flags recorded`,
    '',
    `While **Low Trust**, members cannot:`,
    `— ${emojis.lock} Send links in public channels`,
    `— ${emojis.block} Post attachments in restricted channels`,
    `— ${emojis.users} Mention more than ${cfg.flood_mention_limit} users`,
    '',
    `${emojis.account} Use **Check Member** on the main panel to inspect any member's status.`,
    ...(msg ? ['', msg] : []),
  ]

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(lines.join('\n')))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_toggle_trust_enabled')
          .setLabel(toggleLabel(cfg.trust_enabled, 'Trust System'))
          .setStyle(toggleStyle(cfg.trust_enabled)),
        new ButtonBuilder()
          .setCustomId('sec_trust_thresholds')
          .setLabel('Set Thresholds')
          .setEmoji(getEmoji(emojis.settings))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_main')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

// ─── Alerts Panel ─────────────────────────────────────────────────────────
async function buildAlertsPanel(guild, msg = null) {
  const cfg = await db.ensureConfig(guild.id)

  const alertChannel = cfg.alert_channel ? `<#${cfg.alert_channel}>` : `${emojis.warning} Not configured`

  const alertSel = new ChannelSelectMenuBuilder()
    .setCustomId('sec_do_set_alert:sec_alerts')
    .setPlaceholder(cfg.alert_channel ? 'Change alert channel…' : 'Set alert channel…')
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1).setMaxValues(1)
  if (cfg.alert_channel) alertSel.setDefaultChannels([cfg.alert_channel])

  const lines = [
    `${emojis.activity} **Alerts & Notifications** | ${guild.name}`,
    '',
    `${emojis.announcementc} **Alert Channel:** ${alertChannel}`,
    '',
    `Toggle which events send a staff alert:`,
    `${cfg.notify_join_spike       ? emojis.success : emojis.danger}  Join Spike`,
    `${cfg.notify_suspicious_link  ? emojis.success : emojis.danger}  Suspicious Link`,
    `${cfg.notify_flood            ? emojis.success : emojis.danger}  Flood / Spam`,
    `${cfg.notify_new_account_link ? emojis.success : emojis.danger}  New Account Sending Link`,
    `${cfg.notify_mass_delete      ? emojis.success : emojis.danger}  Mass Message Deletion`,
    `${cfg.notify_external_invite  ? emojis.success : emojis.danger}  External Invite Detected`,
    ...(msg ? ['', msg] : []),
  ]

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(lines.join('\n')))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(alertSel))
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_toggle_notify_join_spike')
          .setLabel('Join Spike')
          .setStyle(cfg.notify_join_spike ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_toggle_notify_suspicious_link')
          .setLabel('Suspicious Link')
          .setStyle(cfg.notify_suspicious_link ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_toggle_notify_flood')
          .setLabel('Flood')
          .setStyle(cfg.notify_flood ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_toggle_notify_new_account_link')
          .setLabel('New Account Link')
          .setStyle(cfg.notify_new_account_link ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_toggle_notify_mass_delete')
          .setLabel('Mass Delete')
          .setStyle(cfg.notify_mass_delete ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_toggle_notify_external_invite')
          .setLabel('External Invite')
          .setStyle(cfg.notify_external_invite ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_main')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

// ─── Server Protection Panel ──────────────────────────────────────────────
async function buildProtectPanel(guild, msg = null) {
  const cfg = await db.ensureConfig(guild.id)

  const exemptRoles = parseJson(cfg.protect_exempt_roles)
  const exemptText  = exemptRoles.length ? exemptRoles.map(id => `<@&${id}>`).join(', ') : 'None'

  const timeoutText = cfg.protect_action_timeout > 0
    ? `${cfg.protect_action_timeout} minutes`
    : 'Disabled *(role removal only)*'

  const lines = [
    `${emojis.danger} **Server Protection** | ${guild.name}`,
    '',
    `${emojis.seguranca} **Protection System** — ${onOff(cfg.protect_enabled)}`,
    '',
    `**Triggers** — if a member exceeds the threshold within the window:`,
    `${emojis.textc}  Channels deleted ≥ **${cfg.protect_channel_threshold}** triggers action`,
    `${emojis.role}  Roles deleted ≥ **${cfg.protect_role_threshold}** triggers action`,
    `${emojis.clock}  Detection window: **${cfg.protect_window_sec} seconds**`,
    '',
    `**Automatic Actions** on trigger:`,
    `${emojis.remove}  **Remove ALL roles** the bot can reach (respects hierarchy)`,
    `${emojis.timedout} Timeout: ${timeoutText}`,
    `${emojis.bell}   Alert always sent to the configured alert channel`,
    '',
    `${emojis.role} **Exempt Roles** *(can delete freely, no action taken)*: ${exemptText}`,
    ...(msg ? ['', msg] : []),
  ]

  const roleSel = new RoleSelectMenuBuilder()
    .setCustomId('sec_protect_exempt_roles')
    .setPlaceholder(exemptRoles.length ? 'Update exempt roles (reselect to keep)…' : 'Add exempt roles…')
    .setMinValues(0).setMaxValues(10)
  if (exemptRoles.length) roleSel.setDefaultRoles(exemptRoles)

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(lines.join('\n')))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(roleSel))
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('sec_toggle_protect_enabled')
          .setLabel(toggleLabel(cfg.protect_enabled, 'Protection'))
          .setStyle(toggleStyle(cfg.protect_enabled)),
        new ButtonBuilder()
          .setCustomId('sec_protect_thresholds')
          .setLabel('Set Thresholds')
          .setEmoji(getEmoji(emojis.settings))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sec_main')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary)
      )
    )
}

// ─── Modals ────────────────────────────────────────────────────────────────
function buildLinkThresholdsModal(cfg) {
  return new ModalBuilder()
    .setCustomId('sec_modal_link_thresholds')
    .setTitle('Link Security — Thresholds')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('link_newmember_days')
          .setLabel('New member block period (days)')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.link_newmember_days))
          .setPlaceholder('e.g. 3')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('link_repeat_count')
          .setLabel('Max times same link before alert')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.link_repeat_count))
          .setPlaceholder('e.g. 3')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('link_repeat_window_sec')
          .setLabel('Repeat detection window (seconds)')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.link_repeat_window_sec))
          .setPlaceholder('e.g. 60')
          .setRequired(true)
      )
    )
}

function buildFloodThresholdsModal(cfg) {
  return new ModalBuilder()
    .setCustomId('sec_modal_flood_thresholds')
    .setTitle('Flood — Detection Thresholds')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('flood_msg_count')
          .setLabel('Max messages before flood trigger')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.flood_msg_count))
          .setPlaceholder('e.g. 5')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('flood_msg_window_sec')
          .setLabel('Flood detection window (seconds)')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.flood_msg_window_sec))
          .setPlaceholder('e.g. 5')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('flood_mention_limit')
          .setLabel('Max @mentions per message')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.flood_mention_limit))
          .setPlaceholder('e.g. 5')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('flood_emoji_limit')
          .setLabel('Max emojis per message')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.flood_emoji_limit))
          .setPlaceholder('e.g. 15')
          .setRequired(true)
      )
    )
}

function buildFloodEscalationModal(cfg) {
  return new ModalBuilder()
    .setCustomId('sec_modal_flood_escalation')
    .setTitle('Flood — Punishment Escalation')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('flood_escalation_window_sec')
          .setLabel('Infraction memory window (seconds)')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.flood_escalation_window_sec ?? 900))
          .setPlaceholder('900 = 15 minutes')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('flood_timeout_level_1')
          .setLabel('Level 1 timeout (minutes) — LOW alert')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.flood_timeout_level_1 ?? 5))
          .setPlaceholder('e.g. 5')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('flood_timeout_level_2')
          .setLabel('Level 2 timeout (minutes) — MEDIUM alert')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.flood_timeout_level_2 ?? 15))
          .setPlaceholder('e.g. 15')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('flood_timeout_level_3')
          .setLabel('Level 3 timeout (minutes) — HIGH alert')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.flood_timeout_level_3 ?? 60))
          .setPlaceholder('e.g. 60')
          .setRequired(true)
      )
    )
}

function buildTrustThresholdsModal(cfg) {
  return new ModalBuilder()
    .setCustomId('sec_modal_trust_thresholds')
    .setTitle('New Member Trust — Thresholds')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('trust_days')
          .setLabel('Days in server required')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.trust_days))
          .setPlaceholder('e.g. 3')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('trust_messages')
          .setLabel('Valid messages required')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.trust_messages))
          .setPlaceholder('e.g. 20')
          .setRequired(true)
      )
    )
}

function buildProtectThresholdsModal(cfg) {
  return new ModalBuilder()
    .setCustomId('sec_modal_protect_thresholds')
    .setTitle('Server Protection — Thresholds')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('protect_channel_threshold')
          .setLabel('Channels deleted to trigger action')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.protect_channel_threshold))
          .setPlaceholder('e.g. 3')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('protect_role_threshold')
          .setLabel('Roles deleted to trigger action')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.protect_role_threshold))
          .setPlaceholder('e.g. 3')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('protect_window_sec')
          .setLabel('Detection window (seconds)')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.protect_window_sec))
          .setPlaceholder('e.g. 30')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('protect_action_timeout')
          .setLabel('Timeout duration in minutes (0 = disabled)')
          .setStyle(TextInputStyle.Short)
          .setValue(String(cfg.protect_action_timeout))
          .setPlaceholder('e.g. 60  |  0 = no timeout, role removal only')
          .setRequired(true)
      )
    )
}

function buildCustomDomainsModal(cfg) {
  const current = parseJson(cfg.link_block_custom)
  return new ModalBuilder()
    .setCustomId('sec_modal_custom_domains')
    .setTitle('Block Custom Domains')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('custom_domains')
          .setLabel('Domains to block (one per line)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(current.join('\n'))
          .setPlaceholder('example.com\nbadsite.net\nspamlink.org\n\nLeave blank to clear all.')
          .setRequired(false)
          .setMaxLength(1000)
      )
    )
}

// ─── Toggle map ────────────────────────────────────────────────────────────
const TOGGLE_MAP = {
  sec_toggle_system:                     ['system_enabled',           'main'],
  sec_toggle_link_enabled:               ['link_enabled',             'link'],
  sec_toggle_link_block_invites:         ['link_block_invites',       'link'],
  sec_toggle_link_block_shorteners:      ['link_block_shorteners',    'link'],
  sec_toggle_link_block_repeat:          ['link_block_repeat',        'link'],
  sec_toggle_flood_enabled:              ['flood_enabled',            'flood'],
  sec_toggle_flood_duplicate_enabled:    ['flood_duplicate_enabled',  'flood'],
  sec_toggle_flood_crosspost_enabled:    ['flood_crosspost_enabled',  'flood'],
  sec_toggle_trust_enabled:              ['trust_enabled',            'newmember'],
  sec_toggle_notify_join_spike:          ['notify_join_spike',        'alerts'],
  sec_toggle_notify_suspicious_link:     ['notify_suspicious_link',   'alerts'],
  sec_toggle_notify_flood:               ['notify_flood',             'alerts'],
  sec_toggle_notify_new_account_link:    ['notify_new_account_link',  'alerts'],
  sec_toggle_notify_mass_delete:         ['notify_mass_delete',       'alerts'],
  sec_toggle_notify_external_invite:     ['notify_external_invite',   'alerts'],
  sec_toggle_protect_enabled:            ['protect_enabled',          'protect'],
}

async function getPanelComponents(panelName, guild, msg = null) {
  switch (panelName) {
    case 'main':      return [await buildMainPanel(guild)]
    case 'link':      return [await buildLinkPanel(guild, msg)]
    case 'flood':     return [await buildFloodPanel(guild, msg)]
    case 'newmember': return [await buildNewMemberPanel(guild, msg)]
    case 'alerts':    return [await buildAlertsPanel(guild, msg)]
    case 'protect':   return [await buildProtectPanel(guild, msg)]
    default:          return [await buildMainPanel(guild)]
  }
}

// ─── All handled custom IDs ────────────────────────────────────────────────
function isMine(interaction) {
  const id = interaction.customId || ''

  if (interaction.isButton()) {
    return id in TOGGLE_MAP || [
      'sec_main', 'sec_link', 'sec_flood', 'sec_newmember', 'sec_alerts',
      'sec_set_alert_channel_main', 'sec_check_member',
      'sec_link_thresholds', 'sec_flood_thresholds', 'sec_flood_escalation', 'sec_trust_thresholds',
      'sec_link_custom_domains',
      'sec_protect', 'sec_protect_thresholds',
    ].includes(id)
  }

  if (interaction.isChannelSelectMenu()) {
    return id === 'sec_link_whitelist' || id.startsWith('sec_do_set_alert:')
  }

  if (interaction.isRoleSelectMenu()) {
    return ['sec_link_exempt_roles', 'sec_flood_exempt_roles', 'sec_protect_exempt_roles'].includes(id)
  }

  if (interaction.isUserSelectMenu()) {
    return id === 'sec_do_check_member'
  }

  if (interaction.isModalSubmit()) {
    return [
      'sec_modal_link_thresholds', 'sec_modal_flood_thresholds',
      'sec_modal_flood_escalation',
      'sec_modal_trust_thresholds', 'sec_modal_custom_domains',
      'sec_modal_protect_thresholds',
    ].includes(id)
  }

  return false
}

module.exports = {
  async execute(_client, interaction) {
    if (!isMine(interaction)) return

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: `${emojis.danger} Only **Administrators** can use this.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    const { guild } = interaction
    const id = interaction.customId

    // ── Navigation ────────────────────────────────────────────────
    if (id === 'sec_main')      return interaction.update({ components: await getPanelComponents('main', guild),      flags: MessageFlags.IsComponentsV2 })
    if (id === 'sec_link')      return interaction.update({ components: await getPanelComponents('link', guild),      flags: MessageFlags.IsComponentsV2 })
    if (id === 'sec_flood')     return interaction.update({ components: await getPanelComponents('flood', guild),     flags: MessageFlags.IsComponentsV2 })
    if (id === 'sec_newmember') return interaction.update({ components: await getPanelComponents('newmember', guild), flags: MessageFlags.IsComponentsV2 })
    if (id === 'sec_alerts')    return interaction.update({ components: await getPanelComponents('alerts', guild),    flags: MessageFlags.IsComponentsV2 })
    if (id === 'sec_protect')   return interaction.update({ components: await getPanelComponents('protect', guild),   flags: MessageFlags.IsComponentsV2 })

    // ── Alert channel selector ────────────────────────────────────
    if (id === 'sec_set_alert_channel_main') {
      const cfg = await db.ensureConfig(guild.id)
      return interaction.update({
        components: [buildAlertChannelSelector(guild, 'sec_main', cfg.alert_channel)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Member check ──────────────────────────────────────────────
    if (id === 'sec_check_member') {
      return interaction.update({
        components: [buildMemberCheckSelector(guild)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'sec_do_check_member' && interaction.isUserSelectMenu()) {
      const userId = interaction.values[0]
      const cfg = await db.ensureConfig(guild.id)
      return interaction.update({
        components: [await buildMemberStatusPanel(guild, userId, cfg)],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Toggles ───────────────────────────────────────────────────
    if (id in TOGGLE_MAP) {
      const [field, panel] = TOGGLE_MAP[id]
      await db.toggleField(guild.id, field)
      return interaction.update({
        components: await getPanelComponents(panel, guild, `${emojis.success} Setting updated.`),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Threshold modals ──────────────────────────────────────────
    if (id === 'sec_link_thresholds') {
      const cfg = await db.ensureConfig(guild.id)
      return interaction.showModal(buildLinkThresholdsModal(cfg))
    }

    if (id === 'sec_flood_thresholds') {
      const cfg = await db.ensureConfig(guild.id)
      return interaction.showModal(buildFloodThresholdsModal(cfg))
    }

    if (id === 'sec_flood_escalation') {
      const cfg = await db.ensureConfig(guild.id)
      return interaction.showModal(buildFloodEscalationModal(cfg))
    }

    if (id === 'sec_trust_thresholds') {
      const cfg = await db.ensureConfig(guild.id)
      return interaction.showModal(buildTrustThresholdsModal(cfg))
    }

    if (id === 'sec_link_custom_domains') {
      const cfg = await db.ensureConfig(guild.id)
      return interaction.showModal(buildCustomDomainsModal(cfg))
    }

    if (id === 'sec_protect_thresholds') {
      const cfg = await db.ensureConfig(guild.id)
      return interaction.showModal(buildProtectThresholdsModal(cfg))
    }

    // ── Modal submits ─────────────────────────────────────────────
    if (id === 'sec_modal_link_thresholds') {
      const days   = parseInt(interaction.fields.getTextInputValue('link_newmember_days'))
      const count  = parseInt(interaction.fields.getTextInputValue('link_repeat_count'))
      const window = parseInt(interaction.fields.getTextInputValue('link_repeat_window_sec'))

      if ([days, count, window].some(v => isNaN(v))) {
        return interaction.reply({ content: `${emojis.danger} Invalid values — must be numbers.`, flags: MessageFlags.Ephemeral })
      }

      await db.setField(guild.id, 'link_newmember_days', Math.max(0, days))
      await db.setField(guild.id, 'link_repeat_count', Math.max(1, count))
      await db.setField(guild.id, 'link_repeat_window_sec', Math.max(5, window))

      return interaction.update({
        components: await getPanelComponents('link', guild, `${emojis.success} Link thresholds saved.`),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'sec_modal_flood_thresholds') {
      const msgCount  = parseInt(interaction.fields.getTextInputValue('flood_msg_count'))
      const msgWindow = parseInt(interaction.fields.getTextInputValue('flood_msg_window_sec'))
      const mentions  = parseInt(interaction.fields.getTextInputValue('flood_mention_limit'))
      const emojisLim = parseInt(interaction.fields.getTextInputValue('flood_emoji_limit'))

      if ([msgCount, msgWindow, mentions, emojisLim].some(v => isNaN(v) || v < 1)) {
        return interaction.reply({ content: `${emojis.danger} All values must be positive numbers.`, flags: MessageFlags.Ephemeral })
      }

      await db.setField(guild.id, 'flood_msg_count', msgCount)
      await db.setField(guild.id, 'flood_msg_window_sec', msgWindow)
      await db.setField(guild.id, 'flood_mention_limit', mentions)
      await db.setField(guild.id, 'flood_emoji_limit', emojisLim)

      return interaction.update({
        components: await getPanelComponents('flood', guild, `${emojis.success} Detection thresholds saved.`),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'sec_modal_flood_escalation') {
      const window = parseInt(interaction.fields.getTextInputValue('flood_escalation_window_sec'))
      const l1     = parseInt(interaction.fields.getTextInputValue('flood_timeout_level_1'))
      const l2     = parseInt(interaction.fields.getTextInputValue('flood_timeout_level_2'))
      const l3     = parseInt(interaction.fields.getTextInputValue('flood_timeout_level_3'))

      if ([window, l1, l2, l3].some(v => isNaN(v) || v < 1)) {
        return interaction.reply({ content: `${emojis.danger} All values must be positive numbers.`, flags: MessageFlags.Ephemeral })
      }

      if (!(l1 <= l2 && l2 <= l3)) {
        return interaction.reply({
          content: `${emojis.warning} Level timeouts should grow progressively: L1 ≤ L2 ≤ L3.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      await db.setField(guild.id, 'flood_escalation_window_sec', window)
      await db.setField(guild.id, 'flood_timeout_level_1', l1)
      await db.setField(guild.id, 'flood_timeout_level_2', l2)
      await db.setField(guild.id, 'flood_timeout_level_3', l3)

      return interaction.update({
        components: await getPanelComponents('flood', guild, `${emojis.success} Escalation settings saved.`),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'sec_modal_trust_thresholds') {
      const days = parseInt(interaction.fields.getTextInputValue('trust_days'))
      const msgs = parseInt(interaction.fields.getTextInputValue('trust_messages'))

      if (isNaN(days) || isNaN(msgs) || days < 0 || msgs < 0) {
        return interaction.reply({ content: `${emojis.danger} Values must be 0 or greater.`, flags: MessageFlags.Ephemeral })
      }

      await db.setField(guild.id, 'trust_days', days)
      await db.setField(guild.id, 'trust_messages', msgs)

      return interaction.update({
        components: await getPanelComponents('newmember', guild, `${emojis.success} Trust thresholds saved.`),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'sec_modal_custom_domains') {
      const raw = interaction.fields.getTextInputValue('custom_domains')
      const domains = raw
        .split('\n')
        .map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0])
        .filter(d => d.length > 0 && d.includes('.'))

      await db.setField(guild.id, 'link_block_custom', JSON.stringify(domains))

      const msg = domains.length
        ? `${emojis.success} Blocking **${domains.length}** custom domain(s).`
        : `${emojis.success} Custom domain block list cleared.`

      return interaction.update({
        components: await getPanelComponents('link', guild, msg),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // ── Channel / Role selects ────────────────────────────────────
    if (id.startsWith('sec_do_set_alert:') && interaction.isChannelSelectMenu()) {
      const backId = id.split(':')[1]
      const channelId = interaction.values[0]
      await db.setField(guild.id, 'alert_channel', channelId)

      const panelName = backId === 'sec_main' ? 'main' : backId === 'sec_alerts' ? 'alerts' : 'main'
      return interaction.update({
        components: await getPanelComponents(panelName, guild, `${emojis.success} Alert channel set to <#${channelId}>`),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'sec_link_whitelist' && interaction.isChannelSelectMenu()) {
      await db.setField(guild.id, 'link_whitelist_channels', JSON.stringify(interaction.values))
      const msg = interaction.values.length
        ? `${emojis.success} Whitelist channels updated: ${interaction.values.map(c => `<#${c}>`).join(', ')}`
        : `${emojis.success} Whitelist channels cleared.`
      return interaction.update({
        components: await getPanelComponents('link', guild, msg),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'sec_link_exempt_roles' && interaction.isRoleSelectMenu()) {
      await db.setField(guild.id, 'link_exempt_roles', JSON.stringify(interaction.values))
      const msg = interaction.values.length
        ? `${emojis.success} Link exempt roles updated.`
        : `${emojis.success} Link exempt roles cleared.`
      return interaction.update({
        components: await getPanelComponents('link', guild, msg),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'sec_protect_exempt_roles' && interaction.isRoleSelectMenu()) {
      await db.setField(guild.id, 'protect_exempt_roles', JSON.stringify(interaction.values))
      const msg = interaction.values.length
        ? `${emojis.success} Exempt roles updated — they can delete freely.`
        : `${emojis.success} Exempt roles cleared.`
      return interaction.update({
        components: await getPanelComponents('protect', guild, msg),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'sec_flood_exempt_roles' && interaction.isRoleSelectMenu()) {
      await db.setField(guild.id, 'flood_exempt_roles', JSON.stringify(interaction.values))
      const msg = interaction.values.length
        ? `${emojis.success} Flood exempt roles updated.`
        : `${emojis.success} Flood exempt roles cleared.`
      return interaction.update({
        components: await getPanelComponents('flood', guild, msg),
        flags: MessageFlags.IsComponentsV2,
      })
    }

    if (id === 'sec_modal_protect_thresholds') {
      const chThresh  = parseInt(interaction.fields.getTextInputValue('protect_channel_threshold'))
      const roThresh  = parseInt(interaction.fields.getTextInputValue('protect_role_threshold'))
      const window    = parseInt(interaction.fields.getTextInputValue('protect_window_sec'))
      const timeout   = parseInt(interaction.fields.getTextInputValue('protect_action_timeout'))

      if ([chThresh, roThresh, window].some(v => isNaN(v) || v < 1) || isNaN(timeout) || timeout < 0) {
        return interaction.reply({ content: `${emojis.danger} Invalid values. Thresholds ≥ 1, window ≥ 1, timeout ≥ 0.`, flags: MessageFlags.Ephemeral })
      }

      await db.setField(guild.id, 'protect_channel_threshold', chThresh)
      await db.setField(guild.id, 'protect_role_threshold', roThresh)
      await db.setField(guild.id, 'protect_window_sec', window)
      await db.setField(guild.id, 'protect_action_timeout', timeout)

      return interaction.update({
        components: await getPanelComponents('protect', guild, `${emojis.success} Protection thresholds saved.`),
        flags: MessageFlags.IsComponentsV2,
      })
    }
  },
}
