const { PermissionsBitField, MessageFlags } = require('discord.js')
const db = require('../../../utils/faq/database')
const { buildConfigHub } = require('../../../utils/faq/manager')

module.exports = {
  name: 'faq',
  description: 'Open the FAQ system settings panel',
  descriptionKey: 'cmd_faq_desc',
  default_member_permissions: PermissionsBitField.Flags.ManageGuild.toString(),

  run: async (client, interaction) => {
    const conn = db.getConnection(interaction.guild.id)
    await conn.ready

    const [categories, totalQuestions, channelId, panelTitle, panelText] = await Promise.all([
      conn.getCategories(),
      conn.getTotalQuestions(),
      conn.getConfig('faq_channel_id'),
      conn.getConfig('panel_title'),
      conn.getConfig('panel_text'),
    ])

    return interaction.reply({
      components: [buildConfigHub({ channelId, panelTitle, panelText }, categories, totalQuestions)],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    })
  },
}
