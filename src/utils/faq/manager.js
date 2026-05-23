const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js')
const { getEmojis } = require('../emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  return { name: match[1], id: match[2] }
}

const DEFAULT_CATEGORIES = [
  { value: 'core',      label: '🌍 Core' },
  { value: 'access',    label: '💎 Access' },
  { value: 'community', label: '💬 Community' },
  { value: 'updates',   label: '📢 Updates' },
  { value: 'project',   label: '🛠️ Project' },
  { value: 'language',  label: '🌐 Language' },
]

const DEFAULT_TITLE = '❓ Frequently Asked Questions'
const DEFAULT_TEXT  = 'Select a category below to find answers to common questions.\nAll responses are private — only you can see them.'

// ─── Public panel (posted in the FAQ channel) ─────────────────────────────────

function buildFaqPanel(title, text, categories) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`## ${title || DEFAULT_TITLE}`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(text || DEFAULT_TEXT))

  if (categories && categories.length > 0) {
    container
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(row =>
        row.setComponents(
          new StringSelectMenuBuilder()
            .setCustomId('faq_cat')
            .setPlaceholder('Select a category…')
            // Select menus support up to 25 options
            .addOptions(categories.slice(0, 25).map(c => ({ label: c.label, value: c.value }))),
        ),
      )
  } else {
    container
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent('*No categories have been configured yet.*'))
  }

  return container
}

// ─── Ephemeral: category browse (shown when user clicks "← Categories") ───────

function buildEphemeralCategorySelect(categories) {
  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`## ❓ FAQ — Browse`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId('faq_cat_eph')
          .setPlaceholder('Select a category…')
          .addOptions(categories.slice(0, 25).map(c => ({ label: c.label, value: c.value }))),
      ),
    )
}

// ─── Ephemeral: question list for a category ──────────────────────────────────

function buildQuestionSelect(category, questions) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`## ${category.label}`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))

  if (questions && questions.length > 0) {
    container.addActionRowComponents(row =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`faq_q:${category.value}`)
          .setPlaceholder('Select a question…')
          // Select menus support up to 25 options
          .addOptions(questions.slice(0, 25).map(q => ({
            label: q.question.length > 100 ? q.question.slice(0, 97) + '…' : q.question,
            value: String(q.id),
          }))),
      ),
    )
  } else {
    container.addTextDisplayComponents(td =>
      td.setContent('*No questions in this category yet.*'),
    )
  }

  container
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId('faq_change_cat')
          .setLabel('← Categories')
          .setStyle(ButtonStyle.Secondary),
      ),
    )

  return container
}

// ─── Ephemeral: answer ────────────────────────────────────────────────────────

function buildAnswerContainer(question, categoryLabel) {
  const qText = question.question.length > 200 ? question.question.slice(0, 197) + '…' : question.question

  return new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(td =>
      td.setContent(`${categoryLabel ? `*${categoryLabel}*\n` : ''}**${qText}**`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(question.answer))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(`faq_q_back:${question.category_value}`)
          .setLabel('← Back to questions')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('faq_change_cat')
          .setLabel('← Categories')
          .setStyle(ButtonStyle.Secondary),
      ),
    )
}

// ─── Config hub ───────────────────────────────────────────────────────────────

function buildConfigHub(cfg, categories, totalQuestions) {
  const channelTxt = cfg.channelId ? `<#${cfg.channelId}>` : '*Not set*'
  const catCount   = categories.length
  const catPreview = catCount
    ? categories.slice(0, 3).map(c => c.label).join('  ·  ') + (catCount > 3 ? ` +${catCount - 3}` : '')
    : '*None configured*'

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.settings} **FAQ System — Settings**`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.thread} **Channel**\n${channelTxt}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('faq_nav:channel').setLabel('Configure').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.clipboard} **Panel Text**\n*${(cfg.panelTitle || DEFAULT_TITLE).slice(0, 60)}*`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('faq_nav:panel_text').setLabel('Edit').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.message} **Categories** (${catCount}/25)\n${catPreview}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('faq_nav:categories').setLabel('Manage').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.find ?? emojis.logs} **Questions** (${totalQuestions ?? 0} total)\nManage per category`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('faq_nav:questions').setLabel('Manage').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.star} **Analytics**\nTrack interactions & popular questions`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('faq_nav:analytics').setLabel('View').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

// ─── Channel sub-panel ────────────────────────────────────────────────────────

function buildChannelPanel(channelId) {
  const val    = channelId ? `<#${channelId}>` : '*Not set*'
  const select = new ChannelSelectMenuBuilder()
    .setCustomId('faq_cfg_channel_select')
    .setPlaceholder('Select the FAQ channel…')
    .setChannelTypes(ChannelType.GuildText)
  if (channelId) select.setDefaultChannels([channelId])

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.thread} **Channel**`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `**Current channel:** ${val}\n\n` +
        `Select the channel where the FAQ panel will be posted.\n` +
        `Make sure the channel is locked — only the bot should be able to send messages there.`,
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(select))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId('faq_cfg_save_channel').setLabel('Save & Post Panel')
          .setEmoji(getEmoji(emojis.success)).setStyle(ButtonStyle.Success).setDisabled(!channelId),
        new ButtonBuilder().setCustomId('faq_cfg_back').setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

// ─── Panel text sub-panel ─────────────────────────────────────────────────────

function buildPanelTextPanel(title, text) {
  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.clipboard} **Panel Text**`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`**Title:**\n${title || DEFAULT_TITLE}\n\n**Description:**\n${text || DEFAULT_TEXT}`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId('faq_cfg_edit_text').setLabel('Edit Text')
          .setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('faq_cfg_back').setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

// ─── Categories sub-panel ─────────────────────────────────────────────────────

function buildCategoriesPanel(categories) {
  const list = categories.length
    ? categories.map((c, i) => `\`${i + 1}.\` ${c.label}  \`${c.value}\``).join('\n')
    : '*No categories yet.*'

  const container = new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.message} **Categories** (${categories.length}/25)\n` +
        `*Select menus support up to 25 options — keep this in mind when adding categories.*`,
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(list))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))

  if (categories.length > 0) {
    container
      .addActionRowComponents(row =>
        row.setComponents(
          new StringSelectMenuBuilder()
            .setCustomId('faq_cat_edit_select')
            .setPlaceholder('Select a category to edit…')
            .addOptions(categories.map(c => ({ label: c.label, value: c.value }))),
        ),
      )
      .addActionRowComponents(row =>
        row.setComponents(
          new StringSelectMenuBuilder()
            .setCustomId('faq_cat_remove_select')
            .setPlaceholder('Select a category to remove (also removes its questions)…')
            .addOptions(categories.map(c => ({ label: c.label, value: c.value }))),
        ),
      )
  }

  container.addActionRowComponents(row =>
    row.setComponents(
      new ButtonBuilder().setCustomId('faq_cat_add').setLabel('Add Category')
        .setEmoji(getEmoji(emojis.plus)).setStyle(ButtonStyle.Secondary).setDisabled(categories.length >= 25),
      new ButtonBuilder().setCustomId('faq_cat_defaults').setLabel('Add Defaults')
        .setEmoji(getEmoji(emojis.refresh)).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('faq_cfg_back').setLabel('Back')
        .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
    ),
  )

  return container
}

// ─── Questions: category picker ───────────────────────────────────────────────

function buildQuestionsHub(categories) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.find ?? emojis.logs} **Questions — Select a Category**`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))

  if (categories.length > 0) {
    container.addActionRowComponents(row =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId('faq_manage_cat_select')
          .setPlaceholder('Select a category to manage its questions…')
          .addOptions(categories.slice(0, 25).map(c => ({ label: c.label, value: c.value }))),
      ),
    )
  } else {
    container.addTextDisplayComponents(td =>
      td.setContent('*No categories yet. Add categories first.*'),
    )
  }

  container
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId('faq_cfg_back').setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
      ),
    )

  return container
}

// ─── Questions: list for a specific category ──────────────────────────────────

function buildQuestionsPanel(category, questions) {
  const list = questions.length
    ? questions.map((q, i) =>
        `\`${i + 1}.\` ${q.question.length > 70 ? q.question.slice(0, 67) + '…' : q.question}`
      ).join('\n')
    : '*No questions yet. Add up to 25.*'

  const container = new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.find ?? emojis.logs} **${category.label}** — Questions (${questions.length}/25)\n` +
        `*Select menus support up to 25 options — keep this in mind when adding questions.*`,
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(list))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))

  if (questions.length > 0) {
    container
      .addActionRowComponents(row =>
        row.setComponents(
          new StringSelectMenuBuilder()
            .setCustomId('faq_q_edit_select')
            .setPlaceholder('Select a question to edit…')
            .addOptions(questions.slice(0, 25).map(q => ({
              label: q.question.length > 100 ? q.question.slice(0, 97) + '…' : q.question,
              value: String(q.id),
            }))),
        ),
      )
      .addActionRowComponents(row =>
        row.setComponents(
          new StringSelectMenuBuilder()
            .setCustomId('faq_q_remove_select')
            .setPlaceholder('Select a question to remove…')
            .addOptions(questions.slice(0, 25).map(q => ({
              label: q.question.length > 100 ? q.question.slice(0, 97) + '…' : q.question,
              value: String(q.id),
            }))),
        ),
      )
  }

  container.addActionRowComponents(row =>
    row.setComponents(
      new ButtonBuilder().setCustomId(`faq_q_add:${category.value}`).setLabel('Add Question')
        .setEmoji(getEmoji(emojis.plus)).setStyle(ButtonStyle.Secondary).setDisabled(questions.length >= 25),
      new ButtonBuilder().setCustomId('faq_q_back_cfg').setLabel('← Categories')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('faq_cfg_back').setLabel('Back to Hub')
        .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
    ),
  )

  return container
}

// ─── Analytics sub-panel ─────────────────────────────────────────────────────

function buildAnalyticsPanel(stats) {
  const { total, byCategory, byQuestion } = stats

  const catLines = byCategory.length
    ? byCategory.map((r, i) => `\`${i + 1}.\` ${r.category_value}  —  **${r.count}**`).join('\n')
    : '*No data yet.*'

  const qLines = byQuestion.length
    ? byQuestion.map((r, i) => {
        const label = r.question
          ? (r.question.length > 60 ? r.question.slice(0, 57) + '…' : r.question)
          : '*deleted*'
        return `\`${i + 1}.\` ${label}  —  **${r.count}**`
      }).join('\n')
    : '*No data yet.*'

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.star} **FAQ Analytics**`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`📊 **Total interactions:** **${total}**`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(`**Top Categories:**\n${catLines}`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(`**Top Questions:**\n${qLines}`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId('faq_analytics_clear').setLabel('Clear Analytics')
          .setEmoji(getEmoji(emojis.trashcan)).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('faq_cfg_back').setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

// ─── AaQ → FAQ approval panel (shown when staff clicks "Add to FAQ" in AaQ) ──

function buildAaqFaqPanel(aaqQuestion, faqCategories) {
  const short = aaqQuestion.content.length > 250
    ? aaqQuestion.content.slice(0, 247) + '…'
    : aaqQuestion.content

  const container = new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.star} **Add to FAQ** — Question #${aaqQuestion.id}`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`> ${short.replace(/\n/g, '\n> ')}`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))

  if (faqCategories && faqCategories.length > 0) {
    container
      .addTextDisplayComponents(td =>
        td.setContent('Select a FAQ category, then write the question and answer in the modal:'),
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(row =>
        row.setComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`faq_from_aaq_cat:${aaqQuestion.id}`)
            .setPlaceholder('Select a FAQ category…')
            .addOptions(faqCategories.slice(0, 25).map(c => ({ label: c.label, value: c.value }))),
        ),
      )
  } else {
    container.addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.warning} No FAQ categories configured.\n` +
        `Set up the FAQ system first using \`/faq\`.`,
      ),
    )
  }

  return container
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function buildPanelTextModal(currentTitle, currentText) {
  return new ModalBuilder()
    .setCustomId('modal_faq_panel_text')
    .setTitle('Edit FAQ Panel Text')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panel_title')
          .setLabel('Panel title')
          .setStyle(TextInputStyle.Short)
          .setValue(currentTitle || DEFAULT_TITLE)
          .setMaxLength(100)
          .setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panel_text')
          .setLabel('Panel description')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentText || DEFAULT_TEXT)
          .setMaxLength(1000)
          .setRequired(true),
      ),
    )
}

function buildAddCategoryModal() {
  return new ModalBuilder()
    .setCustomId('modal_faq_cat_add')
    .setTitle('Add FAQ Category')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('cat_label')
          .setLabel('Label (with emoji, e.g. 🌍 Core)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('cat_value')
          .setLabel('Internal ID (e.g. core — no spaces)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(40)
          .setRequired(true),
      ),
    )
}

function buildEditCategoryModal(category) {
  return new ModalBuilder()
    .setCustomId(`modal_faq_cat_edit:${category.value}`)
    .setTitle('Edit FAQ Category')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('cat_label')
          .setLabel('Label (with emoji)')
          .setStyle(TextInputStyle.Short)
          .setValue(category.label)
          .setMaxLength(80)
          .setRequired(true),
      ),
    )
}

function buildAddQuestionModal(categoryValue) {
  return new ModalBuilder()
    .setCustomId(`modal_faq_q_add:${categoryValue}`)
    .setTitle('Add FAQ Question')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('q_question')
          .setLabel('Question')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. What is Lusion?')
          .setMaxLength(200)
          .setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('q_answer')
          .setLabel('Answer')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Write the answer here… (supports links and formatting)')
          .setMaxLength(2000)
          .setRequired(true),
      ),
    )
}

function buildEditQuestionModal(question) {
  return new ModalBuilder()
    .setCustomId(`modal_faq_q_edit:${question.id}`)
    .setTitle('Edit FAQ Question')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('q_question')
          .setLabel('Question')
          .setStyle(TextInputStyle.Short)
          .setValue(question.question)
          .setMaxLength(200)
          .setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('q_answer')
          .setLabel('Answer')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(question.answer)
          .setMaxLength(2000)
          .setRequired(true),
      ),
    )
}

function buildAaqApproveModal(aaqQuestion, categoryValue) {
  const questionText = aaqQuestion.content.slice(0, 200)
  return new ModalBuilder()
    .setCustomId(`modal_faq_from_aaq:${aaqQuestion.id}:${categoryValue}`)
    .setTitle('Add to FAQ')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('q_question')
          .setLabel('Question (edit if needed)')
          .setStyle(TextInputStyle.Short)
          .setValue(questionText)
          .setMaxLength(200)
          .setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('q_answer')
          .setLabel('Answer')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Write the official answer to include in the FAQ…')
          .setMaxLength(2000)
          .setRequired(true),
      ),
    )
}

module.exports = {
  DEFAULT_CATEGORIES,
  DEFAULT_TITLE,
  DEFAULT_TEXT,
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
  buildAaqFaqPanel,
  buildPanelTextModal,
  buildAddCategoryModal,
  buildEditCategoryModal,
  buildAddQuestionModal,
  buildEditQuestionModal,
  buildAaqApproveModal,
}
