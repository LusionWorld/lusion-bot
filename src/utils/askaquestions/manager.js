const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js')
const { getEmojis } = require('../emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  const [, name, id] = match
  return { name, id }
}

const STATUS_LABEL = {
  pending:     '🟡 Pending',
  in_progress: '🔵 In Progress',
  answered:    '🟢 Answered',
  archived:    '⚫ Archived',
  rejected:    '❌ Rejected',
}

const DEFAULT_CATEGORIES = [
  { value: 'development', label: '🛠️ Development',        description: 'Features, systems, design' },
  { value: 'community',   label: '💬 Community / Discord', description: 'Discord, community topics' },
  { value: 'support',     label: '🎫 Support / Patreon',   description: 'Account, access, Patreon help' },
]

const DEFAULT_SUPPORT_KEYWORDS = ['patreon', 'lost access', 'cant access', "can't access", 'my subscription', 'my refund', 'my tier']

// Backward-compat aliases
const CATEGORIES      = DEFAULT_CATEGORIES
const SUPPORT_KEYWORDS = DEFAULT_SUPPORT_KEYWORDS
const CATEGORY_LABEL   = Object.fromEntries(DEFAULT_CATEGORIES.map(c => [c.value, c.label]))

function getCategoryLabel(categories, value) {
  return categories.find(c => c.value === value)?.label ?? value
}

// ─── Public panel ────────────────────────────────────────────────────────────

function buildPanel() {
  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(
        `## ${emojis.clipboard} Ask a Question\n` +
        `This channel is for **development questions only**.\n\n` +
        `${emojis.danger} No support  ·  ${emojis.danger} No Patreon help  ·  ${emojis.danger} No account issues\n` +
        `Use **#support** for those topics.\n\n` +
        `**What you can ask here:**\n` +
        `${emojis.success} Development questions\n` +
        `${emojis.success} Game systems & mechanics\n` +
        `${emojis.success} Design decisions\n` +
        `${emojis.success} Product-related ideas`,
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId('aaq_ask').setLabel('Ask a Question').setEmoji(getEmoji(emojis.message)).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('aaq_search').setLabel('Search Questions').setEmoji(getEmoji(emojis.find ?? emojis.logs)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

// ─── Public question container ────────────────────────────────────────────────

function buildPublicQuestion(question, votes, followCount) {
  const category = CATEGORY_LABEL[question.category] ?? question.category
  const status   = STATUS_LABEL[question.status]     ?? question.status
  const author   = question.anonymous ? '🕶️ Anonymous' : `<@${question.author_id}>`
  const content  = question.content.length > 1500 ? question.content.slice(0, 1500) + '…' : question.content

  const container = new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.clipboard} **${category}**  ·  #${question.id}  ·  ${status}`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.user} **Asked by** ${author}\n\n${content}`),
    )

  if (question.answer) {
    const answer = question.answer.length > 1500 ? question.answer.slice(0, 1500) + '…' : question.answer
    container
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td =>
        td.setContent(`${emojis.success} **Answer** *(by <@${question.answer_by}>)*\n${answer}`),
      )
  }

  container
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(`aaq_follow:${question.id}`)
          .setLabel(`Follow (${followCount})`)
          .setEmoji(getEmoji(emojis.bell))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`aaq_vote:${question.id}:1`)
          .setLabel(String(votes.up))
          .setEmoji(getEmoji(emojis.success))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`aaq_vote:${question.id}:-1`)
          .setLabel(String(votes.down))
          .setEmoji(getEmoji(emojis.danger))
          .setStyle(ButtonStyle.Secondary),
      ),
    )

  return container
}

// ─── Staff review container ───────────────────────────────────────────────────

function buildReviewContainer(question, categories = DEFAULT_CATEGORIES) {
  const category = getCategoryLabel(categories, question.category)
  const status   = STATUS_LABEL[question.status] ?? question.status
  const assigned = question.assigned_to ? `<@${question.assigned_to}>` : 'Unassigned'

  const threadLink = question.thread_id
    ? `\n${emojis.thread} <#${question.thread_id}>`
    : ''

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.clipboard} **Staff Review**  ·  ${category}  ·  ${status}`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.user} **Author:** <@${question.author_id}>${question.anonymous ? '  *(posted anonymously)*' : ''}\n` +
        `${emojis.role} **Assigned:** ${assigned}\n` +
        `${emojis.pin} **ID:** #${question.id}` +
        threadLink +
        `\n\n${question.content}`,
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId(`aaq_answer:${question.id}`).setLabel('Answer').setEmoji(getEmoji(emojis.message)).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`aaq_assign:${question.id}`).setLabel('Assign').setEmoji(getEmoji(emojis.user)).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`aaq_status:${question.id}`).setLabel('Status').setEmoji(getEmoji(emojis.status)).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`aaq_reject:${question.id}`).setLabel('Reject').setEmoji(getEmoji(emojis.cancel)).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`aaq_delete:${question.id}`).setLabel('Delete').setEmoji(getEmoji(emojis.trashcan)).setStyle(ButtonStyle.Danger),
      ),
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId(`aaq_edit:${question.id}`).setLabel('Edit Answer').setEmoji(getEmoji(emojis.brush)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

// ─── Ephemeral builders ───────────────────────────────────────────────────────

function buildCategorySelect(categories = DEFAULT_CATEGORIES) {
  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.message} **Ask a Question** — Choose a category:`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId('aaq_cat')
          .setPlaceholder('Choose a category…')
          .addOptions(categories.map(c => ({ label: c.label, value: c.value, description: c.description ?? '' }))),
      ),
    )
}

function buildAnonSelect(category) {
  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`**${CATEGORY_LABEL[category]}** — Submit anonymously?`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `If you choose **anonymous**, your name won't appear publicly.\n` +
        `The team can still see who asked internally.`,
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId(`aaq_anon:0:${category}`).setLabel('No — show my name').setEmoji(getEmoji(emojis.visible)).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`aaq_anon:1:${category}`).setLabel('Yes — anonymous').setEmoji(getEmoji(emojis.hidden)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

function buildStatusSelect(questionId) {
  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent('🔄 **Change Status**'))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`aaq_setstatus:${questionId}`)
          .setPlaceholder('Select new status…')
          .addOptions([
            { label: '🟡 Pending',     value: 'pending' },
            { label: '🔵 In Progress', value: 'in_progress' },
            { label: '🟢 Answered',    value: 'answered' },
            { label: '⚫ Archived',    value: 'archived' },
          ]),
      ),
    )
}

function buildDuplicateWarning(similar, pendingKey, guildId, questionsChannelId) {
  const list = similar
    .map((q, i) => {
      const short = q.content.length > 80 ? q.content.slice(0, 80) + '…' : q.content
      return `**${i + 1}.** ${short}\n${STATUS_LABEL[q.status] ?? q.status}`
    })
    .join('\n\n')

  const linkButtons = similar
    .slice(0, 4)
    .map((q, i) => {
      const url = q.thread_id
        ? `https://discord.com/channels/${guildId}/${q.thread_id}`
        : (questionsChannelId && q.message_id)
          ? `https://discord.com/channels/${guildId}/${questionsChannelId}/${q.message_id}`
          : null
      if (!url) return null
      return new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(url)
        .setLabel(`View #${i + 1}`)
    })
    .filter(Boolean)

  const rowButtons = [
    ...linkButtons,
    new ButtonBuilder()
      .setCustomId(`aaq_ask_anyway:${pendingKey}`)
      .setLabel('Ask Anyway')
      .setEmoji(getEmoji(emojis.send))
      .setStyle(ButtonStyle.Primary),
  ]

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.warning} **This question has been asked before**\n\nCheck these before submitting:`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(list))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(...rowButtons))
}

function buildSearchResults(results, term) {
  if (!results.length) {
    return new ContainerBuilder()
      .addTextDisplayComponents(td =>
        td.setContent(`🔍 No results for **"${term}"**.\n\nTry different keywords or ask a new question.`),
      )
  }

  const list = results
    .map((q, i) => {
      const short = q.content.length > 80 ? q.content.slice(0, 80) + '…' : q.content
      return `**${i + 1}.** ${short}\n${CATEGORY_LABEL[q.category] ?? q.category}  ·  ${STATUS_LABEL[q.status] ?? q.status}`
    })
    .join('\n\n')

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`🔍 **Results for "${term}"**`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(list))
}

function buildBlockedSupport() {
  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.danger} **This is not the right place for support.**\n\n` +
        `Please use the **#support** channel for:\n` +
        `${emojis.cancel} Patreon / subscription issues\n` +
        `${emojis.cancel} Role access problems\n` +
        `${emojis.cancel} Account issues`,
      ),
    )
}

function buildFaqSuggestion(question, similarCount) {
  const short = question.content.length > 150 ? question.content.slice(0, 147) + '…' : question.content

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.star} **FAQ Suggestion** — asked **${similarCount}** time(s)`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `> ${short.replace(/\n/g, '\n> ')}\n\n` +
        `This question or a very similar one has been submitted **${similarCount}** times.\n` +
        `Consider adding an official answer to the FAQ.`,
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId(`aaq_faq_add:${question.id}`).setLabel('Add to FAQ').setEmoji(getEmoji(emojis.star)).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`aaq_faq_ignore:${question.id}`).setLabel('Ignore').setEmoji(getEmoji(emojis.cancel)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

function buildFaqSuggestionDone(question, addedBy, categoryValue) {
  const short = question.content.length > 150 ? question.content.slice(0, 147) + '…' : question.content

  return new ContainerBuilder()
    .setAccentColor(0x57F287)
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.success} **Added to FAQ** — category: \`${categoryValue}\``),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`> ${short.replace(/\n/g, '\n> ')}\n\nApproved by <@${addedBy}>`),
    )
}

// ─── Question published (success after submit) ───────────────────────────────

function buildQuestionPublishedContainer(question, guildId, channelId) {
  const link = channelId
    ? `https://discord.com/channels/${guildId}/${channelId}${question.message_id ? `/${question.message_id}` : ''}`
    : null

  const container = new ContainerBuilder()
    .setAccentColor(0x57F287)
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.success} **Question posted successfully!**`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.pin} **ID:** #${question.id}\n` +
        (channelId  ? `${emojis.message} **Channel:** <#${channelId}>\n`  : '') +
        (question.thread_id ? `${emojis.thread} **Discussion thread:** <#${question.thread_id}>` : ''),
      ),
    )

  if (link) {
    container
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(row =>
        row.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(link)
            .setLabel('View question')
            .setEmoji(getEmoji(emojis.find ?? emojis.message)),
        ),
      )
  }

  return container
}

// ─── Answer DM (sent to author + followers) ───────────────────────────────────

function buildAnswerDMContainer({ question, answer, answeredBy, guildName, guildId, channelId, isFollower = false }) {
  const qShort = question.content.length > 300 ? question.content.slice(0, 300) + '…' : question.content
  const aShort = answer.length > 800 ? answer.slice(0, 800) + '…' : answer
  const link   = channelId && question.message_id
    ? `https://discord.com/channels/${guildId}/${channelId}/${question.message_id}`
    : null

  const container = new ContainerBuilder()
    .setAccentColor(0x57F287)
    .addTextDisplayComponents(td =>
      td.setContent(isFollower
        ? `${emojis.bell ?? emojis.success} **A question you're following has been answered!**`
        : `${emojis.success ?? emojis.success} **Your question has been answered!**`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.crown ?? emojis.pin} **Server:** ${guildName}`),
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.clipboard} ${isFollower ? '**Question:**' : '**Your question:**'}\n> ${qShort.replace(/\n/g, '\n> ')}`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.message} **Staff answer** *(by <@${answeredBy}>)*\n${aShort}`),
    )

  if (link) {
    container
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(row =>
        row.setComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(link)
            .setLabel('View on server')
            .setEmoji(getEmoji(emojis.find ?? emojis.message)),
        ),
      )
  }

  return container
}

// ─── Access denied ────────────────────────────────────────────────────────────

function buildAccessDenied(accessRoles) {
  const roles = accessRoles.slice(0, 5).map(r => `<@&${r}>`).join(', ')
  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.lock} **Restricted Access**\n\n` +
        `Only members with the ${roles} role(s) can submit questions in this channel.`,
      ),
    )
}

// ─── Config hub ────────────────────────────────────────────────────────────────

function buildConfigHub(cfg) {
  const {
    askChannelId, reviewChannelId, questionsChannelId,
    features = {}, accessMode = 'open', accessRoles = [],
    categories = DEFAULT_CATEGORIES, keywords = DEFAULT_SUPPORT_KEYWORDS,
    faqThreshold = 5,
  } = cfg

  const { duplicateDetection = true, supportBlocking = true, keywordFilter = true } = features

  const channelsOk = askChannelId && reviewChannelId && questionsChannelId
  const channelsTxt = channelsOk
    ? `${emojis.success} Configured`
    : `${emojis.warning} Incomplete — set all 3 channels`

  const featTxt = [
    `Duplicates ${duplicateDetection ? emojis.success : emojis.cancel}`,
    `Blocking ${supportBlocking ? emojis.success : emojis.cancel}`,
    `Filter ${keywordFilter ? emojis.success : emojis.cancel}`,
  ].join('  ·  ')

  const accessTxt = accessMode === 'restricted' && accessRoles.length
    ? `Restricted — ${accessRoles.slice(0, 3).map(r => `<@&${r}>`).join(', ')}${accessRoles.length > 3 ? ` +${accessRoles.length - 3}` : ''}`
    : 'Open to everyone'

  const catTxt = `${categories.length} category(s): ${categories.map(c => c.label).join(', ')}`
  const kwTxt  = `${keywords.length} keyword(s): ${keywords.slice(0, 4).join(', ')}${keywords.length > 4 ? '…' : ''}`

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.settings} **Ask a Questions — Settings**`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.thread} **Channels**\n${channelsTxt}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_nav:channels').setLabel('Configure').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.settings} **Features** · Auto FAQ: ${faqThreshold} similar\n${featTxt}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_nav:features').setLabel('Configure').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.lock} **Access Control**\n${accessTxt}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_nav:access').setLabel('Configure').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.clipboard} **Categories**\n${catTxt}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_nav:categories').setLabel('Manage').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.cancel} **Blocked Keywords**\n${kwTxt}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_nav:keywords').setLabel('Manage').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

// ─── Channels sub-panel ────────────────────────────────────────────────────────

function buildChannelsPanel(data) {
  const askVal       = data.askChannelId       ? `<#${data.askChannelId}>`       : '*Not set*'
  const reviewVal    = data.reviewChannelId    ? `<#${data.reviewChannelId}>`    : '*Not set*'
  const questionsVal = data.questionsChannelId ? `<#${data.questionsChannelId}>` : '*Not set*'
  const canSave      = !!data.askChannelId && !!data.reviewChannelId && !!data.questionsChannelId

  const askSelect = new ChannelSelectMenuBuilder()
    .setCustomId('aaq_cfg_ask_channel').setPlaceholder('Panel channel (Ask button)…').setChannelTypes(ChannelType.GuildText)
  if (data.askChannelId) askSelect.setDefaultChannels([data.askChannelId])

  const reviewSelect = new ChannelSelectMenuBuilder()
    .setCustomId('aaq_cfg_review_channel').setPlaceholder('Staff review channel…').setChannelTypes(ChannelType.GuildText)
  if (data.reviewChannelId) reviewSelect.setDefaultChannels([data.reviewChannelId])

  const questionsSelect = new ChannelSelectMenuBuilder()
    .setCustomId('aaq_cfg_questions_channel').setPlaceholder('Public questions channel…').setChannelTypes(ChannelType.GuildText)
  if (data.questionsChannelId) questionsSelect.setDefaultChannels([data.questionsChannelId])

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.thread} **Channels**`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.thread} **Panel Channel** *(where the Ask button lives)*\n${askVal}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_ch_noop1').setLabel('Panel').setStyle(ButtonStyle.Secondary).setDisabled(true),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.clipboard} **Review Channel** *(staff manages questions here)*\n${reviewVal}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_ch_noop2').setLabel('Review').setStyle(ButtonStyle.Secondary).setDisabled(true),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.message} **Questions Channel** *(public questions posted here)*\n${questionsVal}`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_ch_noop3').setLabel('Questions').setStyle(ButtonStyle.Secondary).setDisabled(true),
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(askSelect))
    .addActionRowComponents(row => row.setComponents(reviewSelect))
    .addActionRowComponents(row => row.setComponents(questionsSelect))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId('aaq_cfg_save').setLabel('Save & Post Panel')
          .setEmoji(getEmoji(emojis.success)).setStyle(ButtonStyle.Success).setDisabled(!canSave),
        new ButtonBuilder().setCustomId('aaq_cfg_back').setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

// ─── Features sub-panel ────────────────────────────────────────────────────────

function buildFeaturesPanel(features, faqThreshold = 5) {
  const {
    duplicateDetection = true,
    supportBlocking    = true,
    keywordFilter      = true,
  } = features

  function ts(on) { return on ? ButtonStyle.Success : ButtonStyle.Secondary }
  function tl(on) { return on ? 'Active' : 'Inactive' }
  function te(on) { return getEmoji(on ? emojis.success : emojis.cancel) }

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.settings} **Features**`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.warning} **Duplicate Detection**\nWarns the user if a similar question already exists.`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_toggle:duplicateDetection').setLabel(tl(duplicateDetection)).setEmoji(te(duplicateDetection)).setStyle(ts(duplicateDetection)),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.cancel} **Support Blocking**\nBlocks support/Patreon questions.`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_toggle:supportBlocking').setLabel(tl(supportBlocking)).setEmoji(te(supportBlocking)).setStyle(ts(supportBlocking)),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.logs} **Keyword Filter**\nBlocks questions containing forbidden words.`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_toggle:keywordFilter').setLabel(tl(keywordFilter)).setEmoji(te(keywordFilter)).setStyle(ts(keywordFilter)),
      ),
    )
    .addSectionComponents(s =>
      s.addTextDisplayComponents(td =>
        td.setContent(`${emojis.star} **Auto FAQ** — threshold: **${faqThreshold}** similar questions`),
      ).setButtonAccessory(btn =>
        btn.setCustomId('aaq_cfg_threshold').setLabel('Adjust').setEmoji(getEmoji(emojis.settings)).setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId('aaq_cfg_back').setLabel('Back').setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
      ),
    )
}

// ─── Access sub-panel ──────────────────────────────────────────────────────────

function buildAccessPanel(cfg) {
  const { accessMode = 'open', accessRoles = [] } = cfg
  const isRestricted = accessMode === 'restricted'

  const modeTxt = isRestricted
    ? (accessRoles.length
      ? `Restricted — ${accessRoles.map(r => `<@&${r}>`).join(', ')}`
      : 'Restricted — no roles configured')
    : 'Open to all members'

  const container = new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.lock} **Access Control**`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `**Current mode:** ${modeTxt}\n\n` +
        `${emojis.users} **Open:** any member can submit questions.\n` +
        `${emojis.lock} **Restricted:** only members with the selected roles can submit questions.\n\n` +
        `*Posted questions are visible to everyone regardless of mode.*`,
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId('aaq_access_mode:open')
          .setLabel('Open to Everyone').setEmoji(getEmoji(emojis.users))
          .setStyle(isRestricted ? ButtonStyle.Secondary : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('aaq_access_mode:restricted')
          .setLabel('Restricted by Role').setEmoji(getEmoji(emojis.lock))
          .setStyle(isRestricted ? ButtonStyle.Success : ButtonStyle.Secondary),
      ),
    )

  if (isRestricted) {
    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId('aaq_cfg_access_roles')
      .setPlaceholder('Select roles that can submit questions…')
      .setMinValues(0)
      .setMaxValues(10)
    if (accessRoles.length) roleSelect.setDefaultRoles(accessRoles)

    container
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(row => row.setComponents(roleSelect))
  }

  container
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder().setCustomId('aaq_cfg_back').setLabel('Back').setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
      ),
    )

  return container
}

// ─── Categories sub-panel ──────────────────────────────────────────────────────

function buildCategoriesPanel(categories) {
  const list = categories.length
    ? categories.map((c, i) => `\`${i + 1}.\` ${c.label}${c.description ? ` — *${c.description}*` : ''}`).join('\n')
    : '*No categories. Add at least one.*'

  const container = new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.clipboard} **Categories** (${categories.length})`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(list))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))

  if (categories.length > 0) {
    container.addActionRowComponents(row =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId('aaq_cat_remove_select')
          .setPlaceholder('Select a category to remove…')
          .addOptions(categories.map(c => ({
            label:       c.label.slice(0, 100),
            value:       c.value,
            description: (c.description ?? '').slice(0, 100),
          }))),
      ),
    )
  }

  container.addActionRowComponents(row =>
    row.setComponents(
      new ButtonBuilder().setCustomId('aaq_cat_add').setLabel('Add').setEmoji(getEmoji(emojis.plus)).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('aaq_cat_reset').setLabel('Reset').setEmoji(getEmoji(emojis.refresh)).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('aaq_cfg_back').setLabel('Back').setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
    ),
  )

  return container
}

// ─── Keywords sub-panel ────────────────────────────────────────────────────────

function buildKeywordsPanel(keywords) {
  const list = keywords.length
    ? keywords.map((kw, i) => `\`${i + 1}.\` \`${kw}\``).join('  ')
    : '*No keywords. The filter will not block anything.*'

  const container = new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.cancel} **Blocked Keywords** (${keywords.length})`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(list))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))

  if (keywords.length > 0) {
    container.addActionRowComponents(row =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId('aaq_kw_remove_select')
          .setPlaceholder('Select a keyword to remove…')
          .addOptions(keywords.slice(0, 25).map((kw, i) => ({ label: kw.slice(0, 100), value: String(i) }))),
      ),
    )
  }

  container.addActionRowComponents(row =>
    row.setComponents(
      new ButtonBuilder().setCustomId('aaq_kw_add').setLabel('Add').setEmoji(getEmoji(emojis.plus)).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('aaq_kw_reset').setLabel('Reset').setEmoji(getEmoji(emojis.refresh)).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('aaq_cfg_back').setLabel('Back').setEmoji(getEmoji(emojis.arrowl)).setStyle(ButtonStyle.Secondary),
    ),
  )

  return container
}

// ─── Deleted container ────────────────────────────────────────────────────────

function buildDeletedContainer(question, deletedBy) {
  const short = question.content.length > 200 ? question.content.slice(0, 200) + '…' : question.content
  return new ContainerBuilder()
    .setAccentColor(0xED4245)
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.trashcan} **Question #${question.id} deleted**`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`> ${short.replace(/\n/g, '\n> ')}\n\n${emojis.danger} Deleted by <@${deletedBy}>`),
    )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function buildQuestionModal(category, anon) {
  return new ModalBuilder()
    .setCustomId(`modal_aaq:${category}:${anon}`)
    .setTitle(`Ask — ${CATEGORY_LABEL[category] ?? category}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('question_content')
          .setLabel('Your Question')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Be clear and specific. Make sure it hasn't been asked before.")
          .setMinLength(10)
          .setMaxLength(1000)
          .setRequired(true),
      ),
    )
}

function buildAnswerModal(questionId) {
  return new ModalBuilder()
    .setCustomId(`modal_aaq_answer:${questionId}`)
    .setTitle('Answer Question')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('answer_content')
          .setLabel('Answer')
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(5)
          .setMaxLength(2000)
          .setRequired(true),
      ),
    )
}

function buildEditModal(questionId, currentAnswer) {
  return new ModalBuilder()
    .setCustomId(`modal_aaq_edit:${questionId}`)
    .setTitle('Edit Answer')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('answer_content')
          .setLabel('Answer')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentAnswer ?? '')
          .setMinLength(5)
          .setMaxLength(2000)
          .setRequired(true),
      ),
    )
}

function buildSearchModal() {
  return new ModalBuilder()
    .setCustomId('modal_aaq_search')
    .setTitle('Search Questions')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('search_term')
          .setLabel('Keywords')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type keywords to search…')
          .setMinLength(2)
          .setMaxLength(100)
          .setRequired(true),
      ),
    )
}

function buildAssignModal(questionId) {
  return new ModalBuilder()
    .setCustomId(`modal_aaq_assign:${questionId}`)
    .setTitle('Assign Question')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('User ID to assign to')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Paste a Discord user ID')
          .setRequired(true),
      ),
    )
}

module.exports = {
  // Constants
  STATUS_LABEL,
  DEFAULT_CATEGORIES,
  DEFAULT_SUPPORT_KEYWORDS,
  CATEGORIES,
  SUPPORT_KEYWORDS,
  getCategoryLabel,

  // Config hub & sub-panels
  buildConfigHub,
  buildChannelsPanel,
  buildFeaturesPanel,
  buildAccessPanel,
  buildCategoriesPanel,
  buildKeywordsPanel,
  buildAccessDenied,
  buildQuestionPublishedContainer,
  buildAnswerDMContainer,

  // Public UI
  buildPanel,
  buildPublicQuestion,
  buildReviewContainer,

  // User flow UI
  buildCategorySelect,
  buildAnonSelect,
  buildStatusSelect,
  buildDuplicateWarning,
  buildSearchResults,
  buildBlockedSupport,
  buildFaqSuggestion,
  buildFaqSuggestionDone,
  buildDeletedContainer,

  // Modals
  buildQuestionModal,
  buildAnswerModal,
  buildEditModal,
  buildSearchModal,
  buildAssignModal,
}
