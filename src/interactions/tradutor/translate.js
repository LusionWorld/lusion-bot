const {
  ContainerBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js')

const { translate } = require('@vitalets/google-translate-api')
const { getEmojis } = require('../../utils/emojis/emojiHelper')
const emojis = getEmojis()

const LANG_LABELS = {
  en: '🇺🇸 English',
  pt: '🇧🇷 Português',
  es: '🇪🇸 Español',
  fr: '🇫🇷 Français',
  nl: '🇳🇱 Nederlands',
  de: '🇩🇪 Deutsch',
  it: '🇮🇹 Italiano',
  ko: '🇰🇷 한국어',
  ja: '🇯🇵 日本語',
  th: '🇹🇭 ภาษาไทย',
}

// Fallback ISO → label for the detected source language
function prettyLang(code) {
  return LANG_LABELS[code] ?? `\`${code}\``
}

module.exports = {
  async execute(client, interaction) {
    if (!interaction.isStringSelectMenu()) return
    if (!interaction.customId.startsWith('translate_lang:')) return

    const messageId   = interaction.customId.split(':')[1]
    const targetLang  = interaction.values[0]

    // Retrieve stashed content (set in the context menu command)
    const cached = client.translationCache?.get(messageId)

    let content, authorId
    if (cached) {
      content  = cached.content
      authorId = cached.authorId
    } else {
      // Fallback: try to refetch the message from the current channel
      try {
        const msg = await interaction.channel.messages.fetch(messageId)
        content  = msg.content?.slice(0, 4000)
        authorId = msg.author.id
      } catch {}
    }

    if (!content) {
      return interaction.update({
        components: [
          new ContainerBuilder().addTextDisplayComponents(td =>
            td.setContent(`${emojis.danger} The original message could not be retrieved. Try running **Translate** again on the message.`)
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // Defer update so we can take our time fetching the translation
    await interaction.deferUpdate().catch(() => {})

    let translation, detectedLang
    try {
      const res = await translate(content, { to: targetLang })
      translation  = res.text
      detectedLang = res.raw?.src || res.from?.language?.iso || 'auto'
    } catch (err) {
      console.error('[translate]', err.message)
      return interaction.editReply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(td =>
            td.setContent(`${emojis.danger} Translation failed: \`${err.message}\``)
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      })
    }

    // Truncate for display if the result is huge
    const displayOriginal    = content.length > 1000     ? content.slice(0, 1000) + '…'     : content
    const displayTranslation = translation.length > 1500 ? translation.slice(0, 1500) + '…' : translation

    const container = new ContainerBuilder()
      .addTextDisplayComponents(td =>
        td.setContent(`${emojis.world} **Translation** | ${prettyLang(detectedLang)} → ${prettyLang(targetLang)}`)
      )
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td =>
        td.setContent(`**Original** *(from <@${authorId}>)*:\n>>> ${displayOriginal}`)
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td =>
        td.setContent(`**Translated:**\n>>> ${displayTranslation}`)
      )

    // Add image if the original message had one
    const imageUrl = cached?.imageUrl ?? null
    if (imageUrl) {
      container.addMediaGalleryComponents(g =>
        g.addItems({ media: { url: imageUrl } }),
      )
    }

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    })
  },
}
