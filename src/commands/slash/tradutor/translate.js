const {
  ApplicationCommandType,
  ContainerBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js')

const { getEmojis } = require('../../../utils/emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  const [, name, id] = match
  return { name, id }
}

module.exports = {
  name: 'Translate',
  type: ApplicationCommandType.Message,

  run: async (_client, interaction) => {
    const targetMessage = interaction.targetMessage

    if (!targetMessage?.content?.trim()) {
      return interaction.reply({
        content: `${emojis.danger} This message has no text content to translate.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    // Cap at 4000 chars to stay safe with APIs + Discord limits
    const content = targetMessage.content.slice(0, 4000)
    const messageId = targetMessage.id
    const authorId  = targetMessage.author.id

    const container = new ContainerBuilder()
      .addTextDisplayComponents(td =>
        td.setContent(
          `${emojis.world} **Translate Message**\n` +
          `From: <@${authorId}>\n\n` +
          `Select the target language below.`
        )
      )
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(row =>
        row.setComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`translate_lang:${messageId}`)
            .setPlaceholder('Choose target language…')
            .addOptions([
              { label: 'English',    value: 'en', emoji: '🇺🇸', description: 'Translate to English' },
              { label: 'Português',  value: 'pt', emoji: '🇧🇷', description: 'Traduzir para Português' },
              { label: 'Español',    value: 'es', emoji: '🇪🇸', description: 'Traducir al Español' },
              { label: 'Français',   value: 'fr', emoji: '🇫🇷', description: 'Traduire en Français' },
              { label: 'Nederlands', value: 'nl', emoji: '🇳🇱', description: 'Vertalen naar Nederlands' },
              { label: 'Deutsch',    value: 'de', emoji: '🇩🇪', description: 'Auf Deutsch übersetzen' },
              { label: 'Italiano',   value: 'it', emoji: '🇮🇹', description: 'Tradurre in Italiano' },
              { label: '한국어',      value: 'ko', emoji: '🇰🇷', description: '한국어로 번역' },
              { label: '日本語',      value: 'ja', emoji: '🇯🇵', description: '日本語に翻訳' },
              { label: 'ภาษาไทย',    value: 'th', emoji: '🇹🇭', description: 'แปลเป็นภาษาไทย' },
            ])
            .setMinValues(1).setMaxValues(1)
        )
      )

    // Stash the content on the client so the interaction handler can retrieve it
    // without re-fetching (avoids edge cases with deleted messages).
    if (!_client.translationCache) _client.translationCache = new Map()
    const imageUrl = targetMessage.attachments.find(a => a.contentType?.startsWith('image/'))?.url ?? null
    _client.translationCache.set(messageId, { content, authorId, imageUrl, cachedAt: Date.now() })

    // Clean entries older than 10 minutes to prevent memory growth
    for (const [k, v] of _client.translationCache) {
      if (Date.now() - v.cachedAt > 600_000) _client.translationCache.delete(k)
    }

    await interaction.reply({
      components: [container],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    })
  },
}
