const { MessageFlags, ContainerBuilder, SeparatorSpacingSize, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js')
const db    = require('../../utils/askaquestions/database')
const faqDb = require('../../utils/faq/database')
const { loadFullConfig } = require('../../commands/slash/askaquestions/askaquestions')
const {
  STATUS_LABEL,
  DEFAULT_CATEGORIES,
  DEFAULT_SUPPORT_KEYWORDS,
  buildConfigHub,
  buildChannelsPanel,
  buildFeaturesPanel,
  buildAccessPanel,
  buildCategoriesPanel,
  buildKeywordsPanel,
  buildAccessDenied,
  buildQuestionPublishedContainer,
  buildAnswerDMContainer,
  buildPanel,
  buildPublicQuestion,
  buildReviewContainer,
  buildCategorySelect,
  buildAnonSelect,
  buildStatusSelect,
  buildDuplicateWarning,
  buildSearchResults,
  buildBlockedSupport,
  buildFaqSuggestion,
  buildFaqSuggestionDone,
  buildDeletedContainer,
  buildQuestionModal,
  buildAnswerModal,
  buildEditModal,
  buildSearchModal,
  buildAssignModal,
} = require('../../utils/askaquestions/manager')
const { buildAaqFaqPanel } = require('../../utils/faq/manager')
const { getEmojis } = require('../../utils/emojis/emojiHelper')
const emojis = getEmojis()

// ─── Helpers ─────────────────────────────────────────────────────────────────


function ok(text) {
  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.success} ${text}`))
}

function errBox(text) {
  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.danger} ${text}`))
}

async function loadGuildFeatures(conn) {
  const raw = await conn.getConfig('features')
  const defaults = { duplicateDetection: true, supportBlocking: true, keywordFilter: true }
  return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
}

async function loadGuildKeywords(conn) {
  const raw = await conn.getConfig('support_keywords')
  return raw ? JSON.parse(raw) : DEFAULT_SUPPORT_KEYWORDS
}

async function loadGuildCategories(conn) {
  const raw = await conn.getConfig('categories')
  return raw ? JSON.parse(raw) : DEFAULT_CATEGORIES
}

async function saveFeatures(conn, features) {
  await conn.setConfig('features', JSON.stringify(features))
}

async function getPublicMsg(guild, conn, question) {
  const chId = await conn.getConfig('questions_channel_id')
  if (!chId || !question.message_id) return null
  try {
    const ch = guild.channels.cache.get(chId)
    return await ch?.messages.fetch(question.message_id)
  } catch { return null }
}

async function getReviewMsg(guild, conn, question) {
  const chId = await conn.getConfig('review_channel_id')
  if (!chId || !question.review_msg_id) return null
  try {
    const ch = guild.channels.cache.get(chId)
    return await ch?.messages.fetch(question.review_msg_id)
  } catch { return null }
}

async function refreshPublic(guild, conn, question) {
  const msg = await getPublicMsg(guild, conn, question)
  if (!msg) return
  const votes       = await conn.getVotes(question.id)
  const followCount = await conn.getFollowCount(question.id)
  await msg.edit({
    components: [buildPublicQuestion(question, votes, followCount)],
    flags: [MessageFlags.IsComponentsV2],
  }).catch(() => {})
}

async function refreshReview(guild, conn, question) {
  const msg = await getReviewMsg(guild, conn, question)
  if (!msg) return
  await msg.edit({
    components: [buildReviewContainer(question)],
    flags: [MessageFlags.IsComponentsV2],
  }).catch(() => {})
}

async function dmUsers(client, userIds, payload) {
  for (const uid of [...new Set(userIds)]) {
    try {
      const user = await client.users.fetch(uid).catch(() => null)
      await user?.send(payload).catch(() => {})
    } catch {}
  }
}

// ─── Core: create question ────────────────────────────────────────────────────

async function createQuestion(client, guild, conn, { authorId, content, category, anonymous }) {
  const questionId = await conn.createQuestion({ authorId, content, category, anonymous })
  const question   = await conn.getQuestion(questionId)
  const votes      = { up: 0, down: 0 }

  const questionsChannelId = await conn.getConfig('questions_channel_id')
  const reviewChannelId    = await conn.getConfig('review_channel_id')

  // 1. Post directly to public questions channel + create thread
  let messageId = null
  let threadId  = null
  if (questionsChannelId) {
    const ch = guild.channels.cache.get(questionsChannelId)
    if (ch) {
      const msg = await ch.send({
        components: [buildPublicQuestion(question, votes, 0)],
        flags: [MessageFlags.IsComponentsV2],
      }).catch(() => null)

      if (msg) {
        messageId = msg.id
        const threadName = content.slice(0, 50) + (content.length > 50 ? '…' : '')
        const thread = await msg.startThread({ name: threadName, autoArchiveDuration: 10080 }).catch(() => null)
        if (thread) threadId = thread.id
      }
    }
  }

  // Update so the review container links to the thread
  await conn.updateQuestion(questionId, { message_id: messageId, thread_id: threadId })
  const withRefs = await conn.getQuestion(questionId)

  // 2. Send copy to review channel for staff management
  let reviewMsgId = null
  if (reviewChannelId) {
    const rch = guild.channels.cache.get(reviewChannelId)
    if (rch) {
      const rmsg = await rch.send({
        components: [buildReviewContainer(withRefs)],
        flags: [MessageFlags.IsComponentsV2],
      }).catch(() => null)
      if (rmsg) reviewMsgId = rmsg.id
    }
  }
  await conn.updateQuestion(questionId, { review_msg_id: reviewMsgId })

  // 3. Check FAQ threshold
  const threshold    = parseInt(await conn.getConfig('faq_threshold', '5')) || 5
  const similarCount = await conn.checkFaqThreshold(content, threshold)
  if (similarCount && reviewChannelId) {
    const existing = await conn.getFaqLog(questionId)
    if (!existing) {
      await conn.createFaqLog(questionId)
      const rch = guild.channels.cache.get(reviewChannelId)
      if (rch) {
        await rch.send({
          components: [buildFaqSuggestion(withRefs, similarCount)],
          flags: [MessageFlags.IsComponentsV2],
        }).catch(() => {})
      }
    }
  }

  return conn.getQuestion(questionId)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = {
  async execute(client, interaction) {
    if (!interaction.guild) return
    if (!interaction.customId) return
    const id   = interaction.customId
    const conn = db.getConnection(interaction.guild.id)
    await conn.ready

    const guildId = interaction.guild.id

    // ═════════════════════════════════════════════════════════════════════
    // CONFIG HUB NAVIGATION
    // ═════════════════════════════════════════════════════════════════════

    // ── Back to hub ───────────────────────────────────────────────────────
    if (interaction.isButton() && id === 'aaq_cfg_back') {
      const cfg = await loadFullConfig(conn)
      return interaction.update({
        components: [buildConfigHub(cfg)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Navigate to sub-panel ─────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_nav:')) {
      const panel = id.split(':')[1]

      if (panel === 'channels') {
        if (!client.aaqConfigData) client.aaqConfigData = {}
        if (!client.aaqConfigData[guildId]) {
          client.aaqConfigData[guildId] = {
            askChannelId:       await conn.getConfig('ask_channel_id')       ?? null,
            reviewChannelId:    await conn.getConfig('review_channel_id')    ?? null,
            questionsChannelId: await conn.getConfig('questions_channel_id') ?? null,
          }
        }
        return interaction.update({
          components: [buildChannelsPanel(client.aaqConfigData[guildId])],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'features') {
        const features      = await loadGuildFeatures(conn)
        const faqThreshold  = parseInt(await conn.getConfig('faq_threshold', '5')) || 5
        return interaction.update({
          components: [buildFeaturesPanel(features, faqThreshold)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'access') {
        const accessMode  = await conn.getConfig('access_mode', 'open')
        const accessRoles = JSON.parse(await conn.getConfig('access_roles', '[]') || '[]')
        return interaction.update({
          components: [buildAccessPanel({ accessMode, accessRoles })],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'categories') {
        const categories = await loadGuildCategories(conn)
        return interaction.update({
          components: [buildCategoriesPanel(categories)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'keywords') {
        const keywords = await loadGuildKeywords(conn)
        return interaction.update({
          components: [buildKeywordsPanel(keywords)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // CHANNELS SUB-PANEL
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isChannelSelectMenu() && id === 'aaq_cfg_ask_channel') {
if (!client.aaqConfigData) client.aaqConfigData = {}
      if (!client.aaqConfigData[guildId]) client.aaqConfigData[guildId] = {}
      client.aaqConfigData[guildId].askChannelId = interaction.values[0]
      return interaction.update({
        components: [buildChannelsPanel(client.aaqConfigData[guildId])],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isChannelSelectMenu() && id === 'aaq_cfg_review_channel') {
if (!client.aaqConfigData) client.aaqConfigData = {}
      if (!client.aaqConfigData[guildId]) client.aaqConfigData[guildId] = {}
      client.aaqConfigData[guildId].reviewChannelId = interaction.values[0]
      return interaction.update({
        components: [buildChannelsPanel(client.aaqConfigData[guildId])],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isChannelSelectMenu() && id === 'aaq_cfg_questions_channel') {
if (!client.aaqConfigData) client.aaqConfigData = {}
      if (!client.aaqConfigData[guildId]) client.aaqConfigData[guildId] = {}
      client.aaqConfigData[guildId].questionsChannelId = interaction.values[0]
      return interaction.update({
        components: [buildChannelsPanel(client.aaqConfigData[guildId])],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'aaq_cfg_save') {
const data = client.aaqConfigData?.[guildId]
      if (!data?.askChannelId || !data?.reviewChannelId || !data?.questionsChannelId) {
        return interaction.reply({ content: `${emojis.warning} Select all 3 channels before saving.`, flags: MessageFlags.Ephemeral })
      }

      await conn.setConfig('ask_channel_id',       data.askChannelId)
      await conn.setConfig('review_channel_id',    data.reviewChannelId)
      await conn.setConfig('questions_channel_id', data.questionsChannelId)

      const askCh = interaction.guild.channels.cache.get(data.askChannelId)
      await askCh?.send({ components: [buildPanel()], flags: [MessageFlags.IsComponentsV2] }).catch(() => {})

      // Show hub after save
      const cfg = await loadFullConfig(conn)
      return interaction.update({
        components: [buildConfigHub(cfg)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // FEATURES SUB-PANEL
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id.startsWith('aaq_toggle:')) {
const key      = id.split(':')[1]
      const features = await loadGuildFeatures(conn)
      if (key in features) features[key] = !features[key]
      await saveFeatures(conn, features)
      const faqThreshold = parseInt(await conn.getConfig('faq_threshold', '5')) || 5
      return interaction.update({
        components: [buildFeaturesPanel(features, faqThreshold)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'aaq_cfg_threshold') {
return interaction.showModal(
        new ModalBuilder()
          .setCustomId('modal_aaq_cfg_threshold')
          .setTitle('Auto FAQ Threshold')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('threshold_value')
                .setLabel('Similar questions to trigger FAQ (2–20)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Default: 5')
                .setMinLength(1)
                .setMaxLength(2)
                .setRequired(true),
            ),
          ),
      )
    }

    if (interaction.isModalSubmit() && id === 'modal_aaq_cfg_threshold') {
      const val = parseInt(interaction.fields.getTextInputValue('threshold_value'))
      if (isNaN(val) || val < 2 || val > 20) {
        return interaction.reply({ content: `${emojis.danger} Enter a number between 2 and 20.`, flags: MessageFlags.Ephemeral })
      }
      await conn.setConfig('faq_threshold', val)
      const features = await loadGuildFeatures(conn)
      return interaction.update({
        components: [buildFeaturesPanel(features, val)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // ACCESS SUB-PANEL
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id.startsWith('aaq_access_mode:')) {
const mode = id.split(':')[1]
      await conn.setConfig('access_mode', mode)
      const accessRoles = JSON.parse(await conn.getConfig('access_roles', '[]') || '[]')
      return interaction.update({
        components: [buildAccessPanel({ accessMode: mode, accessRoles })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isRoleSelectMenu() && id === 'aaq_cfg_access_roles') {
const roleIds = interaction.values
      await conn.setConfig('access_roles', JSON.stringify(roleIds))
      const accessMode = await conn.getConfig('access_mode', 'open')
      return interaction.update({
        components: [buildAccessPanel({ accessMode, accessRoles: roleIds })],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // CATEGORIES SUB-PANEL
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id === 'aaq_cat_add') {
return interaction.showModal(
        new ModalBuilder()
          .setCustomId('modal_aaq_cat_add')
          .setTitle('Add Category')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('cat_label').setLabel('Label (with emoji, e.g. 🛠️ Development)').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('cat_value').setLabel('Internal ID (e.g. development, no spaces)').setStyle(TextInputStyle.Short).setMaxLength(40).setRequired(true),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('cat_desc').setLabel('Short description').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false),
            ),
          ),
      )
    }

    if (interaction.isModalSubmit() && id === 'modal_aaq_cat_add') {
      const label = interaction.fields.getTextInputValue('cat_label').trim()
      const value = interaction.fields.getTextInputValue('cat_value').trim().toLowerCase().replace(/\s+/g, '_')
      const desc  = interaction.fields.getTextInputValue('cat_desc').trim()
      if (!label || !value) return interaction.reply({ content: `${emojis.danger} Label and ID are required.`, flags: MessageFlags.Ephemeral })

      const categories = await loadGuildCategories(conn)
      if (categories.some(c => c.value === value)) {
        return interaction.reply({ content: `${emojis.danger} A category with ID \`${value}\` already exists.`, flags: MessageFlags.Ephemeral })
      }
      if (categories.length >= 25) {
        return interaction.reply({ content: `${emojis.danger} Maximum of 25 categories reached.`, flags: MessageFlags.Ephemeral })
      }
      categories.push({ value, label, description: desc || undefined })
      await conn.setConfig('categories', JSON.stringify(categories))
      return interaction.update({
        components: [buildCategoriesPanel(categories)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isStringSelectMenu() && id === 'aaq_cat_remove_select') {
const toRemove = interaction.values[0]
      let categories = await loadGuildCategories(conn)
      categories = categories.filter(c => c.value !== toRemove)
      await conn.setConfig('categories', JSON.stringify(categories))
      return interaction.update({
        components: [buildCategoriesPanel(categories)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'aaq_cat_reset') {
await conn.setConfig('categories', JSON.stringify(DEFAULT_CATEGORIES))
      return interaction.update({
        components: [buildCategoriesPanel(DEFAULT_CATEGORIES)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // KEYWORDS SUB-PANEL
    // ═════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id === 'aaq_kw_add') {
return interaction.showModal(
        new ModalBuilder()
          .setCustomId('modal_aaq_kw_add')
          .setTitle('Add Keyword')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('keyword')
                .setLabel('Word or phrase to block')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setRequired(true),
            ),
          ),
      )
    }

    if (interaction.isModalSubmit() && id === 'modal_aaq_kw_add') {
      const kw = interaction.fields.getTextInputValue('keyword').trim().toLowerCase()
      if (!kw) return interaction.reply({ content: `${emojis.danger} Keyword cannot be empty.`, flags: MessageFlags.Ephemeral })
      const keywords = await loadGuildKeywords(conn)
      if (keywords.includes(kw)) return interaction.reply({ content: `${emojis.warning} That keyword is already in the list.`, flags: MessageFlags.Ephemeral })
      keywords.push(kw)
      await conn.setConfig('support_keywords', JSON.stringify(keywords))
      return interaction.update({
        components: [buildKeywordsPanel(keywords)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isStringSelectMenu() && id === 'aaq_kw_remove_select') {
const index = parseInt(interaction.values[0])
      const keywords = await loadGuildKeywords(conn)
      keywords.splice(index, 1)
      await conn.setConfig('support_keywords', JSON.stringify(keywords))
      return interaction.update({
        components: [buildKeywordsPanel(keywords)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'aaq_kw_reset') {
await conn.setConfig('support_keywords', JSON.stringify(DEFAULT_SUPPORT_KEYWORDS))
      return interaction.update({
        components: [buildKeywordsPanel(DEFAULT_SUPPORT_KEYWORDS)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // USER QUESTION FLOW
    // ═════════════════════════════════════════════════════════════════════

    // ── Ask button ────────────────────────────────────────────────────────
    if (interaction.isButton() && id === 'aaq_ask') {
      // Access check
      const accessMode  = await conn.getConfig('access_mode', 'open')
      const accessRoles = JSON.parse(await conn.getConfig('access_roles', '[]') || '[]')

      if (accessMode === 'restricted' && accessRoles.length) {
        const memberRoles = interaction.member.roles.cache
        const hasAccess   = accessRoles.some(roleId => memberRoles.has(roleId))
        if (!hasAccess) {
          return interaction.reply({
            components: [buildAccessDenied(accessRoles)],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }
      }

      const categories = await loadGuildCategories(conn)
      return interaction.reply({
        components: [buildCategorySelect(categories)],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // ── Search button ─────────────────────────────────────────────────────
    if (interaction.isButton() && id === 'aaq_search') {
      return interaction.showModal(buildSearchModal())
    }

    // ── Category select ───────────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && id === 'aaq_cat') {
      const category = interaction.values[0]
      const features = await loadGuildFeatures(conn)

      if (features.supportBlocking && category === 'support') {
        return interaction.update({
          components: [buildBlockedSupport()],
          flags: [MessageFlags.IsComponentsV2],
        })
      }
      return interaction.update({
        components: [buildAnonSelect(category)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Anon choice → modal ───────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_anon:')) {
      const parts    = id.split(':')
      const anon     = parts[1]
      const category = parts[2]
      return interaction.showModal(buildQuestionModal(category, anon))
    }

    // ── Question modal submitted ──────────────────────────────────────────
    if (interaction.isModalSubmit() && id.startsWith('modal_aaq:')) {
      const parts    = id.split(':')
      const category = parts[1]
      const anon     = parts[2] === '1'
      const content  = interaction.fields.getTextInputValue('question_content').trim()
      const userId   = interaction.user.id

      const features = await loadGuildFeatures(conn)
      const keywords = await loadGuildKeywords(conn)

      // Keyword / support filter
      if (features.keywordFilter && keywords.some(kw => content.toLowerCase().includes(kw))) {
        await interaction.deferUpdate()
        return interaction.editReply({
          components: [buildBlockedSupport()],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      // Duplicate detection
      if (features.duplicateDetection) {
        const similar = await conn.findSimilar(content)
        if (similar.length) {
          const pendingKey = `${guildId}_${userId}`
          if (!client.aaqCache) client.aaqCache = new Map()
          client.aaqCache.set(pendingKey, { content, category, anonymous: anon, cachedAt: Date.now() })
          for (const [k, v] of client.aaqCache) {
            if (Date.now() - v.cachedAt > 600_000) client.aaqCache.delete(k)
          }
          const questionsChannelId = await conn.getConfig('questions_channel_id')
          await interaction.deferUpdate()
          return interaction.editReply({
            components: [buildDuplicateWarning(similar, pendingKey, guildId, questionsChannelId)],
            flags: [MessageFlags.IsComponentsV2],
          })
        }
      }

      await interaction.deferUpdate()
      const question = await createQuestion(client, interaction.guild, conn, {
        authorId: userId, content, category, anonymous: anon,
      })
      const questionsChannelId = await conn.getConfig('questions_channel_id')
      return interaction.editReply({
        components: [buildQuestionPublishedContainer(question, guildId, questionsChannelId)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Ask Anyway ────────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_ask_anyway:')) {
      const pendingKey = id.replace('aaq_ask_anyway:', '')
      const cached     = client.aaqCache?.get(pendingKey)

      if (!cached) {
        return interaction.update({
          components: [errBox('Session expired. Click **Ask a Question** again.')],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      client.aaqCache.delete(pendingKey)
      await interaction.deferUpdate()

      const question = await createQuestion(client, interaction.guild, conn, {
        authorId:  interaction.user.id,
        content:   cached.content,
        category:  cached.category,
        anonymous: cached.anonymous,
      })

      const questionsChannelId = await conn.getConfig('questions_channel_id')
      return interaction.editReply({
        components: [buildQuestionPublishedContainer(question, guildId, questionsChannelId)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Search modal ──────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && id === 'modal_aaq_search') {
      const term    = interaction.fields.getTextInputValue('search_term').trim()
      const results = await conn.searchQuestions(term)
      return interaction.reply({
        components: [buildSearchResults(results, term)],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // ── Follow toggle ─────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_follow:')) {
      const questionId     = parseInt(id.split(':')[1])
      const question       = await conn.getQuestion(questionId)
      if (!question) return

      const isNowFollowing = await conn.toggleFollow(questionId, interaction.user.id)
      const followCount    = await conn.getFollowCount(questionId)
      const votes          = await conn.getVotes(questionId)

      const msg = await getPublicMsg(interaction.guild, conn, question)
      await msg?.edit({
        components: [buildPublicQuestion(question, votes, followCount)],
        flags: [MessageFlags.IsComponentsV2],
      }).catch(() => {})

      return interaction.reply({
        content: isNowFollowing
          ? `${emojis.success} You are now following this question. You'll be notified when it's answered.`
          : `You have unfollowed this question.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    // ── Vote ──────────────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_vote:')) {
      const parts      = id.split(':')
      const questionId = parseInt(parts[1])
      const value      = parseInt(parts[2])
      const question   = await conn.getQuestion(questionId)
      if (!question) return

      await conn.vote(questionId, interaction.user.id, value)
      const votes       = await conn.getVotes(questionId)
      const followCount = await conn.getFollowCount(questionId)

      const msg = await getPublicMsg(interaction.guild, conn, question)
      await msg?.edit({
        components: [buildPublicQuestion(question, votes, followCount)],
        flags: [MessageFlags.IsComponentsV2],
      }).catch(() => {})

      return interaction.reply({
        content: value === 1 ? '👍 Marked as helpful.' : '👎 Feedback recorded.',
        flags: MessageFlags.Ephemeral,
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // STAFF ACTIONS
    // ═════════════════════════════════════════════════════════════════════

    // ── Answer button ─────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_answer:')) {
      const questionId = parseInt(id.split(':')[1])
      return interaction.showModal(buildAnswerModal(questionId))
    }

    // ── Answer modal ──────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && id.startsWith('modal_aaq_answer:')) {
      const questionId = parseInt(id.split(':')[1])
      const answer     = interaction.fields.getTextInputValue('answer_content').trim()
      const question   = await conn.getQuestion(questionId)
      if (!question) return interaction.reply({ content: 'Question not found.', flags: MessageFlags.Ephemeral })

      await conn.updateQuestion(questionId, {
        answer,
        answer_by: interaction.user.id,
        answer_at: new Date().toISOString(),
        status:    'answered',
      })
      const updated = await conn.getQuestion(questionId)

      await interaction.deferReply({ flags: MessageFlags.Ephemeral })
      await refreshPublic(interaction.guild, conn, updated)
      await refreshReview(interaction.guild, conn, updated)

      if (updated.thread_id) {
        try {
          const thread = await interaction.guild.channels.fetch(updated.thread_id).catch(() => null)
          await thread?.send(`**Answer by <@${interaction.user.id}>:**\n${answer}`).catch(() => {})
        } catch {}
      }

      const questionsChannelId = await conn.getConfig('questions_channel_id')
      const dmBase = { question: updated, answer, answeredBy: interaction.user.id, guildName: interaction.guild.name, guildId: interaction.guild.id, channelId: questionsChannelId }

      await dmUsers(client, [updated.author_id], {
        components: [buildAnswerDMContainer({ ...dmBase, isFollower: false })],
        flags: [MessageFlags.IsComponentsV2],
      })

      const followers = (await conn.getFollowers(questionId)).filter(id => id !== updated.author_id)
      if (followers.length) {
        await dmUsers(client, followers, {
          components: [buildAnswerDMContainer({ ...dmBase, isFollower: true })],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      return interaction.editReply({ content: `${emojis.success} Answer posted. Notifications sent.` })
    }

    // ── Assign button ─────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_assign:')) {
      const questionId = parseInt(id.split(':')[1])
      return interaction.showModal(buildAssignModal(questionId))
    }

    // ── Assign modal ──────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && id.startsWith('modal_aaq_assign:')) {
      const questionId = parseInt(id.split(':')[1])
      const userId     = interaction.fields.getTextInputValue('user_id').trim().replace(/[<@!>]/g, '')
      const question   = await conn.getQuestion(questionId)
      if (!question) return interaction.reply({ content: 'Not found.', flags: MessageFlags.Ephemeral })

      await conn.updateQuestion(questionId, { assigned_to: userId, status: 'in_progress' })
      const updated = await conn.getQuestion(questionId)
      await refreshReview(interaction.guild, conn, updated)

      return interaction.reply({
        content: `${emojis.success} Assigned to <@${userId}> · status: 🔵 In Progress.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    // ── Status button ─────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_status:')) {
      const questionId = parseInt(id.split(':')[1])
      return interaction.reply({
        components: [buildStatusSelect(questionId)],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // ── Status select ─────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && id.startsWith('aaq_setstatus:')) {
      const questionId = parseInt(id.split(':')[1])
      const status     = interaction.values[0]
      await conn.updateQuestion(questionId, { status })
      const updated = await conn.getQuestion(questionId)
      await refreshPublic(interaction.guild, conn, updated)
      await refreshReview(interaction.guild, conn, updated)
      return interaction.update({
        components: [ok(`Status updated to **${STATUS_LABEL[status]}**.`)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Reject ────────────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_reject:')) {
      const questionId = parseInt(id.split(':')[1])
      const question   = await conn.getQuestion(questionId)
      if (!question) return interaction.reply({ content: 'Not found.', flags: MessageFlags.Ephemeral })

      await conn.updateQuestion(questionId, { status: 'rejected' })
      const updated = await conn.getQuestion(questionId)
      await refreshPublic(interaction.guild, conn, updated)
      await refreshReview(interaction.guild, conn, updated)

      return interaction.reply({
        content: `${emojis.success} Question #${questionId} rejected.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    // ── Delete ────────────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_delete:')) {
      const questionId = parseInt(id.split(':')[1])
      const question   = await conn.getQuestion(questionId)
      if (!question) return interaction.reply({ content: 'Not found.', flags: MessageFlags.Ephemeral })

      const deletedBy    = interaction.user.id
      const deletedContainer = buildDeletedContainer(question, deletedBy)

      // Edit public question message (remove buttons, show deleted)
      const pubMsg = await getPublicMsg(interaction.guild, conn, question)
      await pubMsg?.edit({
        components: [deletedContainer],
        flags: [MessageFlags.IsComponentsV2],
      }).catch(() => {})

      // Archive thread and post deletion notice
      if (question.thread_id) {
        const thread = await interaction.guild.channels.fetch(question.thread_id).catch(() => null)
        if (thread) {
          await thread.send(`${emojis.trashcan ?? '🗑️'} This question was deleted by <@${deletedBy}>.`).catch(() => {})
          await thread.setArchived(true).catch(() => {})
        }
      }

      await conn.deleteQuestion(questionId)

      // Update review message in-place (this is the message the button came from)
      return interaction.update({
        components: [deletedContainer],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Edit button ───────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_edit:')) {
      const questionId = parseInt(id.split(':')[1])
      const question   = await conn.getQuestion(questionId)
      if (!question) return interaction.reply({ content: 'Not found.', flags: MessageFlags.Ephemeral })
      return interaction.showModal(buildEditModal(questionId, question.answer))
    }

    // ── Edit modal ────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && id.startsWith('modal_aaq_edit:')) {
      const questionId = parseInt(id.split(':')[1])
      const answer     = interaction.fields.getTextInputValue('answer_content').trim()
      const question   = await conn.getQuestion(questionId)
      if (!question) return interaction.reply({ content: 'Not found.', flags: MessageFlags.Ephemeral })

      await conn.updateQuestion(questionId, {
        answer,
        answer_by: interaction.user.id,
        answer_at: new Date().toISOString(),
      })
      const updated = await conn.getQuestion(questionId)
      await refreshPublic(interaction.guild, conn, updated)
      await refreshReview(interaction.guild, conn, updated)

      return interaction.reply({
        content: `${emojis.success} Answer updated.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    // ── FAQ add → open FAQ approval flow ─────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_faq_add:')) {
      const questionId  = parseInt(id.split(':')[1])
      const question    = await conn.getQuestion(questionId)
      if (!question) return interaction.reply({ content: 'Question not found.', flags: MessageFlags.Ephemeral })

      // Store the suggestion message reference so we can edit it after approval
      if (!client.faqSuggestionMsgs) client.faqSuggestionMsgs = new Map()
      client.faqSuggestionMsgs.set(questionId, {
        messageId: interaction.message.id,
        channelId: interaction.message.channelId,
      })

      const faqConn     = faqDb.getConnection(interaction.guild.id)
      await faqConn.ready
      const faqCategories = await faqConn.getCategories()

      return interaction.reply({
        components: [buildAaqFaqPanel(question, faqCategories)],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // ── FAQ ignore ────────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('aaq_faq_ignore:')) {
      const questionId = parseInt(id.split(':')[1])
      await conn.updateFaqLog(questionId, { ignored: 1 })
      return interaction.reply({ content: 'FAQ suggestion ignored.', flags: MessageFlags.Ephemeral })
    }
  },
}
