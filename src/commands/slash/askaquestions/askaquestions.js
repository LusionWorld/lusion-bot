const { MessageFlags, PermissionsBitField } = require('discord.js')

const db = require('../../../utils/askaquestions/database')
const {
  buildConfigHub,
  DEFAULT_CATEGORIES,
  DEFAULT_SUPPORT_KEYWORDS,
} = require('../../../utils/askaquestions/manager')

async function loadFullConfig(conn) {
  const [
    askChannelId, reviewChannelId, questionsChannelId,
    featuresRaw, accessMode, accessRolesRaw,
    categoriesRaw, keywordsRaw, faqThresholdStr,
  ] = await Promise.all([
    conn.getConfig('ask_channel_id'),
    conn.getConfig('review_channel_id'),
    conn.getConfig('questions_channel_id'),
    conn.getConfig('features'),
    conn.getConfig('access_mode', 'open'),
    conn.getConfig('access_roles', '[]'),
    conn.getConfig('categories'),
    conn.getConfig('support_keywords'),
    conn.getConfig('faq_threshold', '5'),
  ])

  const defaultFeatures = { duplicateDetection: true, supportBlocking: true, keywordFilter: true }
  const features    = featuresRaw    ? { ...defaultFeatures, ...JSON.parse(featuresRaw) } : defaultFeatures
  const accessRoles = JSON.parse(accessRolesRaw || '[]')
  const categories  = categoriesRaw ? JSON.parse(categoriesRaw) : DEFAULT_CATEGORIES
  const keywords    = keywordsRaw   ? JSON.parse(keywordsRaw)   : DEFAULT_SUPPORT_KEYWORDS
  const faqThreshold = parseInt(faqThresholdStr) || 5

  return {
    askChannelId, reviewChannelId, questionsChannelId,
    features, accessMode, accessRoles,
    categories, keywords, faqThreshold,
  }
}

module.exports = {
  name: 'askaquestions',
  description: 'Opens the Ask a Questions settings panel',
  default_member_permissions: PermissionsBitField.Flags.ManageGuild.toString(),

  loadFullConfig,

  run: async (client, interaction) => {
    const conn = db.getConnection(interaction.guild.id)
    await conn.ready

    const cfg = await loadFullConfig(conn)

    // Keep channels state in memory for the channels sub-panel
    if (!client.aaqConfigData) client.aaqConfigData = {}
    client.aaqConfigData[interaction.guild.id] = {
      askChannelId:       cfg.askChannelId,
      reviewChannelId:    cfg.reviewChannelId,
      questionsChannelId: cfg.questionsChannelId,
    }

    return interaction.reply({
      components: [buildConfigHub(cfg)],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    })
  },
}
