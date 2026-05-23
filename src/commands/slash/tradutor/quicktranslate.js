const {
  ApplicationCommandType,
  ContainerBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js')

const db = require('../../../utils/tradutor/database')
const { LANGUAGES } = require('../../../utils/tradutor/database')
const { getEmojis } = require('../../../utils/emojis/emojiHelper')
const emojis = getEmojis()

// ─── Shared builders (imported by interaction handler) ────────────────────────

function buildLangSelector(messageId, isFirstTime) {
  const customId = isFirstTime
    ? `quicktrans_lang_first:${messageId}`
    : `quicktrans_lang_change:${messageId}`

  const heading = isFirstTime
    ? `${emojis.world} **Quick Translate** — Choose Your Language`
    : `${emojis.world} **Quick Translate** — Change Language`

  const body = isFirstTime
    ? `Choose the language you want messages translated to.\n${emojis.info} This preference will be **saved** — next time you won't need to pick again.`
    : `Select a new default language.`

  return new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(heading))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(body))
    .addActionRowComponents(row =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId(customId)
          .setPlaceholder('Choose a language…')
          .addOptions(
            Object.entries(LANGUAGES).map(([code, l]) => ({
              label: l.label,
              value: code,
              emoji: l.flag,
              description: l.description,
            })),
          ),
      ),
    )
}

function buildResult(targetLang, detectedLang, original, translated, authorId, messageId) {
  const { prettyLang } = require('../../../utils/tradutor/database')
  const { ButtonBuilder, ButtonStyle } = require('discord.js')

  const displayOriginal    = original.length   > 1000 ? original.slice(0, 1000)   + '…' : original
  const displayTranslated  = translated.length > 1500 ? translated.slice(0, 1500) + '…' : translated

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.world} **Quick Translate** | ${prettyLang(detectedLang)} → ${prettyLang(targetLang)}`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`**Original** *(from <@${authorId}>)*:\n>>> ${displayOriginal}`),
    )
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`**Translated:**\n>>> ${displayTranslated}`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(`quicktrans_change:${messageId}`)
          .setLabel('Change Language')
          .setEmoji('⚙️')
          .setStyle(ButtonStyle.Secondary),
      ),
    )
}

module.exports = {
  name: 'Quick Translate',
  type: ApplicationCommandType.Message,

  buildLangSelector,
  buildResult,

  run: async (client, interaction) => {
    const targetMessage = interaction.targetMessage

    if (!targetMessage?.content?.trim()) {
      return interaction.reply({
        content: `${emojis.danger} This message has no text content to translate.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    const content    = targetMessage.content.slice(0, 4000)
    const messageId  = targetMessage.id
    const authorId   = targetMessage.author.id
    const guildId    = interaction.guild.id
    const userId     = interaction.user.id

    // Cache content so the interaction handler can retrieve it
    if (!client.translationCache) client.translationCache = new Map()
    const imageUrl = targetMessage.attachments.find(a => a.contentType?.startsWith('image/'))?.url ?? null
    client.translationCache.set(messageId, { content, authorId, imageUrl, cachedAt: Date.now() })
    for (const [k, v] of client.translationCache) {
      if (Date.now() - v.cachedAt > 3_600_000) client.translationCache.delete(k)
    }

    const savedLang = await db.getUserLang(guildId, userId).catch(() => null)

    if (!savedLang) {
      return interaction.reply({
        components: [buildLangSelector(messageId, true)],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // Has saved preference — translate right away
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      const { translate } = require('@vitalets/google-translate-api')
      const res = await translate(content, { to: savedLang })
      const translated    = res.text
      const detectedLang  = res.raw?.src || res.from?.language?.iso || 'auto'

      return interaction.editReply({
        components: [buildResult(savedLang, detectedLang, content, translated, authorId, messageId)],
        flags: [MessageFlags.IsComponentsV2],
      })
    } catch (err) {
      console.error('[QuickTranslate]', err.message)
      return interaction.editReply({
        content: `${emojis.danger} Translation failed: \`${err.message}\``,
      })
    }
  },
}
