const { ContainerBuilder, MessageFlags } = require('discord.js')
const emojis = require('../emojis/emojis.json')

const PRIORITY = {
  high:   { color: 0xFF0000, icon: emojis.danger,  label: 'HIGH' },
  medium: { color: 0xFF8800, icon: emojis.warning, label: 'MEDIUM' },
  low:    { color: 0x3498DB, icon: emojis.info,    label: 'LOW' },
}

async function sendSecurityAlert(guild, cfg, opts = {}) {
  if (!cfg?.alert_channel) return
  const channel = await guild.channels.fetch(cfg.alert_channel).catch(() => null)
  if (!channel?.isTextBased()) return

  const { title = 'Security Alert', fields = {}, priority = 'medium', footer = null } = opts
  const p = PRIORITY[priority] ?? PRIORITY.medium

  const lines = [
    `${p.icon} **[${p.label}] ${title}** | ${guild.name}`,
    '',
    ...Object.entries(fields).map(([k, v]) => `${emojis.arrowr} **${k}:** ${v}`),
    '',
    `${emojis.clock} <t:${Math.floor(Date.now() / 1000)}:f>`,
    ...(footer ? ['', footer] : []),
  ]

  const container = new ContainerBuilder()
    .setAccentColor(p.color)
    .addTextDisplayComponents(td => td.setContent(lines.join('\n')))

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  }).catch(() => {})
}

module.exports = { sendSecurityAlert, PRIORITY }
