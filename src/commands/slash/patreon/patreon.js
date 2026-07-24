const { PermissionsBitField, MessageFlags } = require('discord.js')
const db = require('../../../utils/patreon/database')
const { buildConfigHub } = require('../../../utils/patreon/manager')

module.exports = {
  name: 'patreon',
  description: 'Open the Patreon system settings panel',
  descriptionKey: 'cmd_patreon_desc',
  default_member_permissions: PermissionsBitField.Flags.ManageGuild.toString(),

  run: async (client, interaction) => {
    const conn = db.getConnection(interaction.guild.id)
    await conn.ready

    const [patreonUrl, panelChannelId, syncEnabled, supporterCount] = await Promise.all([
      conn.getConfig('patreon_url'),
      conn.getConfig('panel_channel_id'),
      conn.getConfig('sync_enabled', 'false'),
      conn.getConfig('supporter_count', '0'),
    ])

    return interaction.reply({
      components: [buildConfigHub({ patreonUrl, panelChannelId, syncEnabled, supporterCount })],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    })
  },
}
