const { PermissionsBitField, MessageFlags } = require('discord.js')
const db = require('../../../utils/supporter/database')
const { buildConfigHub } = require('../../../utils/supporter/manager')

module.exports = {
  name: 'supporter',
  description: 'Open the Supporter Experience system settings',
  default_member_permissions: PermissionsBitField.Flags.ManageGuild.toString(),

  run: async (client, interaction) => {
    const conn = db.getConnection(interaction.guild.id)
    await conn.ready

    const [logChannelId, reportChannelId, dmEnabled, logsEnabled, reportEnabled] = await Promise.all([
      conn.getConfig('log_channel_id'),
      conn.getConfig('report_channel_id'),
      conn.getConfig('dm_enabled', 'true'),
      conn.getConfig('logs_enabled', 'true'),
      conn.getConfig('report_enabled', 'false'),
    ])
    const tiers = await conn.getTierRoles()

    return interaction.reply({
      components: [buildConfigHub({ logChannelId, reportChannelId, dmEnabled, logsEnabled, reportEnabled, tierCount: tiers.length })],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    })
  },
}
