const { MessageFlags, ContainerBuilder } = require('discord.js')
const db = require('../../utils/faq/database')
const {
  DEFAULT_CATEGORIES,
  buildFaqPanel,
  buildEphemeralCategorySelect,
  buildQuestionSelect,
  buildAnswerContainer,
  buildConfigHub,
  buildChannelPanel,
  buildPanelTextPanel,
  buildCategoriesPanel,
  buildQuestionsHub,
  buildQuestionsPanel,
  buildAnalyticsPanel,
  buildPanelTextModal,
  buildAddCategoryModal,
  buildEditCategoryModal,
  buildAddQuestionModal,
  buildEditQuestionModal,
  buildAaqApproveModal,
} = require('../../utils/faq/manager')
const { buildFaqSuggestionDone } = require('../../utils/askaquestions/manager')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStaff(interaction) {
  return !!interaction.member?.permissions?.has('ManageMessages')
}

async function refreshPublicPanel(guild, conn) {
  const channelId  = await conn.getConfig('faq_channel_id')
  const messageId  = await conn.getConfig('faq_panel_message_id')
  const title      = await conn.getConfig('panel_title')
  const text       = await conn.getConfig('panel_text')
  const categories = await conn.getCategories()

  if (!channelId) return
  const ch = guild.channels.cache.get(channelId)
  if (!ch) return

  const payload = {
    components: [buildFaqPanel(title, text, categories)],
    flags: [MessageFlags.IsComponentsV2],
  }

  if (messageId) {
    const msg = await ch.messages.fetch(messageId).catch(() => null)
    if (msg) { await msg.edit(payload).catch(() => {}); return }
  }

  // Post new panel and store message ID
  const msg = await ch.send(payload).catch(() => null)
  if (msg) await conn.setConfig('faq_panel_message_id', msg.id)
}

async function loadConfigHub(conn) {
  const [categories, totalQuestions, channelId, panelTitle, panelText] = await Promise.all([
    conn.getCategories(),
    conn.getTotalQuestions(),
    conn.getConfig('faq_channel_id'),
    conn.getConfig('panel_title'),
    conn.getConfig('panel_text'),
  ])
  return { categories, totalQuestions, cfg: { channelId, panelTitle, panelText } }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = {
  async execute(client, interaction) {
    if (!interaction.guild) return
    if (!interaction.customId) return

    const id   = interaction.customId
    const conn = db.getConnection(interaction.guild.id)
    await conn.ready

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC FLOW — anyone can use
    // ═══════════════════════════════════════════════════════════════════════

    // ── Category selected from public panel ────────────────────────────────
    if (interaction.isStringSelectMenu() && id === 'faq_cat') {
      const catValue   = interaction.values[0]
      const categories = await conn.getCategories()
      const category   = categories.find(c => c.value === catValue)
      if (!category) return interaction.reply({ content: 'Category not found.', flags: MessageFlags.Ephemeral })
      const questions = await conn.getQuestions(catValue)
      return interaction.reply({
        components: [buildQuestionSelect(category, questions)],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // ── Category selected from ephemeral (after "← Categories") ───────────
    if (interaction.isStringSelectMenu() && id === 'faq_cat_eph') {
      const catValue   = interaction.values[0]
      const categories = await conn.getCategories()
      const category   = categories.find(c => c.value === catValue)
      if (!category) return interaction.update({ components: [], flags: [MessageFlags.IsComponentsV2] })
      const questions = await conn.getQuestions(catValue)
      return interaction.update({
        components: [buildQuestionSelect(category, questions)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Question selected → show answer ───────────────────────────────────
    if (interaction.isStringSelectMenu() && id.startsWith('faq_q:')) {
      const catValue   = id.split(':')[1]
      const questionId = parseInt(interaction.values[0])
      const categories = await conn.getCategories()
      const category   = categories.find(c => c.value === catValue)
      const question   = await conn.getQuestion(questionId)
      if (!question) return interaction.update({ components: [], flags: [MessageFlags.IsComponentsV2] })

      await conn.logAccess(catValue, questionId)

      return interaction.update({
        components: [buildAnswerContainer(question, category?.label)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Back to question list ──────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('faq_q_back:')) {
      const catValue   = id.split(':')[1]
      const categories = await conn.getCategories()
      const category   = categories.find(c => c.value === catValue)
      if (!category) return
      const questions = await conn.getQuestions(catValue)
      return interaction.update({
        components: [buildQuestionSelect(category, questions)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Back to categories (ephemeral) ────────────────────────────────────
    if (interaction.isButton() && id === 'faq_change_cat') {
      const categories = await conn.getCategories()
      return interaction.update({
        components: [buildEphemeralCategorySelect(categories)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONFIG FLOW — staff only
    // ═══════════════════════════════════════════════════════════════════════

    const isConfigId =
      id === 'faq_cfg_back' ||
      id.startsWith('faq_nav:') ||
      id === 'faq_cfg_channel_select' ||
      id === 'faq_cfg_save_channel' ||
      id === 'faq_cfg_edit_text' ||
      id === 'modal_faq_panel_text' ||
      id === 'faq_cat_add' ||
      id === 'faq_cat_edit_select' ||
      id === 'faq_cat_remove_select' ||
      id === 'faq_cat_defaults' ||
      id === 'faq_manage_cat_select' ||
      id === 'faq_q_edit_select' ||
      id === 'faq_q_remove_select' ||
      id === 'faq_q_back_cfg' ||
      id === 'faq_analytics_clear' ||
      id.startsWith('faq_q_add:') ||
      id.startsWith('modal_faq_cat_add') ||
      id.startsWith('modal_faq_cat_edit:') ||
      id.startsWith('modal_faq_q_add:') ||
      id.startsWith('modal_faq_q_edit:') ||
      id.startsWith('faq_from_aaq_cat:') ||
      id.startsWith('modal_faq_from_aaq:')

    if (!isConfigId) return

    if (
      id !== 'faq_change_cat' &&
      !id.startsWith('faq_from_aaq_cat:') &&
      !id.startsWith('modal_faq_from_aaq:') &&
      !isStaff(interaction)
    ) {
      return interaction.reply({ content: "You don't have permission to do this.", flags: MessageFlags.Ephemeral })
    }

    // ── Back to hub ───────────────────────────────────────────────────────
    if (interaction.isButton() && id === 'faq_cfg_back') {
      const { categories, totalQuestions, cfg } = await loadConfigHub(conn)
      return interaction.update({
        components: [buildConfigHub(cfg, categories, totalQuestions)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Navigate to sub-panel ─────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith('faq_nav:')) {
      const panel = id.split(':')[1]

      if (panel === 'channel') {
        const channelId = await conn.getConfig('faq_channel_id')
        return interaction.update({
          components: [buildChannelPanel(channelId)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'panel_text') {
        const title = await conn.getConfig('panel_title')
        const text  = await conn.getConfig('panel_text')
        return interaction.update({
          components: [buildPanelTextPanel(title, text)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'categories') {
        const categories = await conn.getCategories()
        return interaction.update({
          components: [buildCategoriesPanel(categories)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'questions') {
        const categories = await conn.getCategories()
        return interaction.update({
          components: [buildQuestionsHub(categories)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }

      if (panel === 'analytics') {
        const stats = await conn.getAnalytics()
        return interaction.update({
          components: [buildAnalyticsPanel(stats)],
          flags: [MessageFlags.IsComponentsV2],
        })
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CHANNEL SUB-PANEL
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isChannelSelectMenu() && id === 'faq_cfg_channel_select') {
      const channelId = interaction.values[0]
      await conn.setConfig('faq_channel_id', channelId)
      return interaction.update({
        components: [buildChannelPanel(channelId)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'faq_cfg_save_channel') {
      const channelId = await conn.getConfig('faq_channel_id')
      if (!channelId) {
        return interaction.reply({ content: 'Select a channel first.', flags: MessageFlags.Ephemeral })
      }
      await refreshPublicPanel(interaction.guild, conn)
      const { categories, totalQuestions, cfg } = await loadConfigHub(conn)
      return interaction.update({
        components: [buildConfigHub(cfg, categories, totalQuestions)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PANEL TEXT SUB-PANEL
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id === 'faq_cfg_edit_text') {
      const title = await conn.getConfig('panel_title')
      const text  = await conn.getConfig('panel_text')
      return interaction.showModal(buildPanelTextModal(title, text))
    }

    if (interaction.isModalSubmit() && id === 'modal_faq_panel_text') {
      const title = interaction.fields.getTextInputValue('panel_title').trim()
      const text  = interaction.fields.getTextInputValue('panel_text').trim()
      await conn.setConfig('panel_title', title)
      await conn.setConfig('panel_text', text)
      await refreshPublicPanel(interaction.guild, conn)
      return interaction.update({
        components: [buildPanelTextPanel(title, text)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CATEGORIES SUB-PANEL
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id === 'faq_cat_add') {
      return interaction.showModal(buildAddCategoryModal())
    }

    if (interaction.isModalSubmit() && id === 'modal_faq_cat_add') {
      const label = interaction.fields.getTextInputValue('cat_label').trim()
      const value = interaction.fields.getTextInputValue('cat_value').trim().toLowerCase().replace(/\s+/g, '_')
      if (!label || !value) {
        return interaction.reply({ content: 'Label and ID are required.', flags: MessageFlags.Ephemeral })
      }
      const categories = await conn.getCategories()
      if (categories.length >= 25) {
        return interaction.reply({ content: 'Maximum of 25 categories reached.', flags: MessageFlags.Ephemeral })
      }
      if (categories.some(c => c.value === value)) {
        return interaction.reply({ content: `A category with ID \`${value}\` already exists.`, flags: MessageFlags.Ephemeral })
      }
      await conn.addCategory(value, label)
      const updated = await conn.getCategories()
      await refreshPublicPanel(interaction.guild, conn)
      return interaction.update({
        components: [buildCategoriesPanel(updated)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isStringSelectMenu() && id === 'faq_cat_edit_select') {
      const value      = interaction.values[0]
      const categories = await conn.getCategories()
      const category   = categories.find(c => c.value === value)
      if (!category) return
      return interaction.showModal(buildEditCategoryModal(category))
    }

    if (interaction.isModalSubmit() && id.startsWith('modal_faq_cat_edit:')) {
      const value = id.split(':')[1]
      const label = interaction.fields.getTextInputValue('cat_label').trim()
      if (!label) return interaction.reply({ content: 'Label is required.', flags: MessageFlags.Ephemeral })
      await conn.updateCategory(value, label)
      const updated = await conn.getCategories()
      await refreshPublicPanel(interaction.guild, conn)
      return interaction.update({
        components: [buildCategoriesPanel(updated)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isStringSelectMenu() && id === 'faq_cat_remove_select') {
      const value = interaction.values[0]
      await conn.removeCategory(value)
      const updated = await conn.getCategories()
      await refreshPublicPanel(interaction.guild, conn)
      return interaction.update({
        components: [buildCategoriesPanel(updated)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'faq_cat_defaults') {
      const existing = await conn.getCategories()
      const existing_values = new Set(existing.map(c => c.value))
      for (const cat of DEFAULT_CATEGORIES) {
        if (!existing_values.has(cat.value) && existing.length < 25) {
          await conn.addCategory(cat.value, cat.label)
        }
      }
      const updated = await conn.getCategories()
      await refreshPublicPanel(interaction.guild, conn)
      return interaction.update({
        components: [buildCategoriesPanel(updated)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // QUESTIONS SUB-PANEL
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isStringSelectMenu() && id === 'faq_manage_cat_select') {
      const catValue   = interaction.values[0]
      const categories = await conn.getCategories()
      const category   = categories.find(c => c.value === catValue)
      if (!category) return
      const questions = await conn.getQuestions(catValue)
      return interaction.update({
        components: [buildQuestionsPanel(category, questions)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id.startsWith('faq_q_add:')) {
      const catValue = id.split(':')[1]
      return interaction.showModal(buildAddQuestionModal(catValue))
    }

    if (interaction.isModalSubmit() && id.startsWith('modal_faq_q_add:')) {
      const catValue   = id.split(':')[1]
      const question   = interaction.fields.getTextInputValue('q_question').trim()
      const answer     = interaction.fields.getTextInputValue('q_answer').trim()
      if (!question || !answer) {
        return interaction.reply({ content: 'Question and answer are required.', flags: MessageFlags.Ephemeral })
      }
      const existing = await conn.getQuestions(catValue)
      if (existing.length >= 25) {
        return interaction.reply({ content: 'Maximum of 25 questions per category reached.', flags: MessageFlags.Ephemeral })
      }
      await conn.addQuestion(catValue, question, answer)
      const categories = await conn.getCategories()
      const category   = categories.find(c => c.value === catValue)
      const updated    = await conn.getQuestions(catValue)
      return interaction.update({
        components: [buildQuestionsPanel(category, updated)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isStringSelectMenu() && id === 'faq_q_edit_select') {
      const questionId = parseInt(interaction.values[0])
      const question   = await conn.getQuestion(questionId)
      if (!question) return
      return interaction.showModal(buildEditQuestionModal(question))
    }

    if (interaction.isModalSubmit() && id.startsWith('modal_faq_q_edit:')) {
      const questionId = parseInt(id.split(':')[1])
      const question   = interaction.fields.getTextInputValue('q_question').trim()
      const answer     = interaction.fields.getTextInputValue('q_answer').trim()
      const existing   = await conn.getQuestion(questionId)
      if (!existing) return interaction.reply({ content: 'Question not found.', flags: MessageFlags.Ephemeral })
      await conn.updateQuestion(questionId, question, answer)
      const categories = await conn.getCategories()
      const category   = categories.find(c => c.value === existing.category_value)
      const updated    = await conn.getQuestions(existing.category_value)
      return interaction.update({
        components: [buildQuestionsPanel(category, updated)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isStringSelectMenu() && id === 'faq_q_remove_select') {
      const questionId = parseInt(interaction.values[0])
      const existing   = await conn.getQuestion(questionId)
      if (!existing) return
      await conn.removeQuestion(questionId)
      const categories = await conn.getCategories()
      const category   = categories.find(c => c.value === existing.category_value)
      const updated    = await conn.getQuestions(existing.category_value)
      return interaction.update({
        components: [buildQuestionsPanel(category, updated)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    if (interaction.isButton() && id === 'faq_q_back_cfg') {
      const categories = await conn.getCategories()
      return interaction.update({
        components: [buildQuestionsHub(categories)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANALYTICS SUB-PANEL
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isButton() && id === 'faq_analytics_clear') {
      await conn.clearAnalytics()
      const stats = await conn.getAnalytics()
      return interaction.update({
        components: [buildAnalyticsPanel(stats)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AAQ → FAQ INTEGRATION (staff only — from review channel suggestion)
    // ═══════════════════════════════════════════════════════════════════════

    if (interaction.isStringSelectMenu() && id.startsWith('faq_from_aaq_cat:')) {
      if (!isStaff(interaction)) {
        return interaction.reply({ content: "You don't have permission to do this.", flags: MessageFlags.Ephemeral })
      }
      const aaqQuestionId = parseInt(id.split(':')[1])
      const catValue      = interaction.values[0]

      // Load the AaQ question to pre-fill the modal
      const aaqDb   = require('../../utils/askaquestions/database')
      const aaqConn = aaqDb.getConnection(interaction.guild.id)
      await aaqConn.ready
      const aaqQuestion = await aaqConn.getQuestion(aaqQuestionId)
      if (!aaqQuestion) {
        return interaction.reply({ content: 'Original question not found in Ask a Questions.', flags: MessageFlags.Ephemeral })
      }

      return interaction.showModal(buildAaqApproveModal(aaqQuestion, catValue))
    }

    if (interaction.isModalSubmit() && id.startsWith('modal_faq_from_aaq:')) {
      if (!isStaff(interaction)) {
        return interaction.reply({ content: "You don't have permission to do this.", flags: MessageFlags.Ephemeral })
      }
      const parts       = id.split(':')
      const aaqQId      = parseInt(parts[1])
      const catValue    = parts[2]
      const questionTxt = interaction.fields.getTextInputValue('q_question').trim()
      const answerTxt   = interaction.fields.getTextInputValue('q_answer').trim()

      if (!questionTxt || !answerTxt) {
        return interaction.reply({ content: 'Question and answer are required.', flags: MessageFlags.Ephemeral })
      }

      const existing = await conn.getQuestions(catValue)
      if (existing.length >= 25) {
        return interaction.reply({ content: 'Maximum of 25 questions per category reached.', flags: MessageFlags.Ephemeral })
      }

      await conn.addQuestion(catValue, questionTxt, answerTxt)

      // Mark the AaQ question as answered and its FAQ log as processed
      const aaqDb   = require('../../utils/askaquestions/database')
      const aaqConn = aaqDb.getConnection(interaction.guild.id)
      await aaqConn.ready
      const aaqQuestion = await aaqConn.getQuestion(aaqQId).catch(() => null)
      await aaqConn.updateQuestion(aaqQId, { status: 'answered' }).catch(() => {})
      await aaqConn.updateFaqLog(aaqQId, { ignored: 0 }).catch(() => {})

      // Edit the FAQ suggestion message in the review channel to show "added" state
      const suggestionRef = client.faqSuggestionMsgs?.get(aaqQId)
      if (suggestionRef && aaqQuestion) {
        try {
          const reviewCh = interaction.guild.channels.cache.get(suggestionRef.channelId)
          const suggMsg  = await reviewCh?.messages.fetch(suggestionRef.messageId).catch(() => null)
          if (suggMsg) {
            await suggMsg.edit({
              components: [buildFaqSuggestionDone(aaqQuestion, interaction.user.id, catValue)],
              flags: [MessageFlags.IsComponentsV2],
            }).catch(() => {})
          }
        } catch {}
        client.faqSuggestionMsgs.delete(aaqQId)
      }

      const successMsg = new ContainerBuilder()
        .setAccentColor(0x57F287)
        .addTextDisplayComponents(td =>
          td.setContent(`✅ Question added to the **${catValue}** FAQ category.`),
        )
      return interaction.update({
        components: [successMsg],
        flags: [MessageFlags.IsComponentsV2],
      })
    }
  },
}
