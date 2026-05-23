const {
  MessageFlags,
  ContainerBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
} = require('discord.js')
const { translate }   = require('@vitalets/google-translate-api')

const db = require('../../utils/tradutor/database')
const { LANGUAGES } = require('../../utils/tradutor/database')
const { buildLangSelector, buildResult } = require('../../commands/slash/tradutor/quicktranslate')
const { getEmojis } = require('../../utils/emojis/emojiHelper')
const emojis = getEmojis()

function buildAutoTransLangSelector(userId) {
  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.world} **Auto-Translate** — Choose Your Language`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`Choose the language you want messages translated to.\n${emojis.info} This preference will be **saved** for all future auto-translations.`),
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`autotrans_lang:${userId}`)
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

async function doTranslate(content, targetLang) {
  const res = await translate(content, { to: targetLang })
  return {
    text:         res.text,
    detectedLang: res.raw?.src || res.from?.language?.iso || 'auto',
  }
}

async function getContent(client, interaction, messageId) {
  const cached = client.translationCache?.get(messageId)
  if (cached) return cached

  try {
    const msg = await interaction.channel.messages.fetch(messageId)
    return {
      content:  msg.content?.slice(0, 4000) ?? '',
      authorId: msg.author.id,
      imageUrl: null,
    }
  } catch {
    return null
  }
}

module.exports = {
  async execute(client, interaction) {
    const id = interaction.customId

    // ── Auto-translate: button "Change Language" (on result container) ───
    if (interaction.isButton() && id.startsWith('autotrans_changelang:')) {
      const targetUserId = id.split(':')[1]

      if (interaction.user.id !== targetUserId) {
        return interaction.reply({
          content: `${emojis.warning} This button is not for you.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      return interaction.reply({
        components: [buildAutoTransLangSelector(targetUserId)],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // ── Auto-translate: button "Choose Language" (channel message) ────────
    if (interaction.isButton() && id.startsWith('autotrans_setlang:')) {
      const targetUserId = id.split(':')[1]

      // Only the intended user may click
      if (interaction.user.id !== targetUserId) {
        return interaction.reply({
          content: `${emojis.warning} This button is not for you.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      // Delete the channel prompt, then reply ephemerally with selector
      await interaction.message.delete().catch(() => {})

      return interaction.reply({
        components: [buildAutoTransLangSelector(targetUserId)],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // ── Auto-translate: language selected ────────────────────────────────
    if (interaction.isStringSelectMenu() && id.startsWith('autotrans_lang:')) {
      const targetUserId = id.split(':')[1]

      if (interaction.user.id !== targetUserId) {
        return interaction.reply({
          content: `${emojis.warning} This menu is not for you.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      const targetLang = interaction.values[0]
      const { prettyLang } = require('../../utils/tradutor/database')

      await db.setUserLang(interaction.guild.id, interaction.user.id, targetLang).catch(() => {})

      const confirm = new ContainerBuilder()
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.world} **Auto-Translate** — Language set to **${prettyLang(targetLang)}**!\nReact with 🌐 on any message in the configured channel to translate it.`),
        )

      return interaction.update({
        components: [confirm],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Button: open "Change Language" selector ───────────────────────────
    if (interaction.isButton() && id.startsWith('quicktrans_change:')) {
      const messageId = id.split(':')[1]

      return interaction.update({
        components: [buildLangSelector(messageId, false)],
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    // ── Select menus ──────────────────────────────────────────────────────
    const isFirst  = interaction.isStringSelectMenu() && id.startsWith('quicktrans_lang_first:')
    const isChange = interaction.isStringSelectMenu() && id.startsWith('quicktrans_lang_change:')

    if (!isFirst && !isChange) return

    const messageId = id.split(':')[1]
    const targetLang = interaction.values[0]
    const guildId    = interaction.guild.id
    const userId     = interaction.user.id

    // Save language preference
    await db.setUserLang(guildId, userId, targetLang).catch(() => {})

    // Retrieve original message content
    const cached = await getContent(client, interaction, messageId)

    if (!cached?.content) {
      return interaction.update({
        components: [
          require('discord.js').ContainerBuilder
            ? new (require('discord.js').ContainerBuilder)()
                .addTextDisplayComponents(td =>
                  td.setContent(`${emojis.danger} Original message not found. Run **Quick Translate** on the message again.`),
                )
            : undefined,
        ].filter(Boolean),
        flags: [MessageFlags.IsComponentsV2],
      })
    }

    await interaction.deferUpdate().catch(() => {})

    try {
      const { text, detectedLang } = await doTranslate(cached.content, targetLang)

      return interaction.editReply({
        components: [buildResult(targetLang, detectedLang, cached.content, text, cached.authorId, messageId)],
        flags: [MessageFlags.IsComponentsV2],
      })
    } catch (err) {
      console.error('[QuickTranslate:select]', err.message)
      return interaction.editReply({
        content: `${emojis.danger} Translation failed: \`${err.message}\``,
      })
    }
  },
}
