const { AuditLogEvent } = require('discord.js')

const db = require('../../utils/moderacao/security-database')
const { sendSecurityAlert } = require('../../utils/moderacao/security-helpers')

module.exports = {
  name: 'messageDeleteBulk',

  async execute(_client, messages) {
    try {
      const first = messages.first()
      if (!first?.guild) return

      const guild = first.guild
      const cfg = await db.getConfig(guild.id)
      if (!cfg || !cfg.system_enabled || !cfg.notify_mass_delete) return

      // Try to find who performed the bulk delete via audit logs
      let executor = 'Unknown'
      try {
        await new Promise(r => setTimeout(r, 500))
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageBulkDelete, limit: 1 })
        const entry = logs.entries.first()
        if (entry && (Date.now() - entry.createdTimestamp) < 5_000) {
          executor = `<@${entry.executor.id}> \`${entry.executor.id}\``
        }
      } catch {}

      const deletedChannel = first.channelId ? `<#${first.channelId}>` : 'Unknown channel'

      await sendSecurityAlert(guild, cfg, {
        title: 'Mass Message Deletion',
        fields: {
          'Messages deleted': messages.size,
          Channel:            deletedChannel,
          Executor:           executor,
        },
        priority: 'high',
      })
    } catch (err) {
      console.error('[Security:messageDeleteBulk]', err.message)
    }
  },
}
