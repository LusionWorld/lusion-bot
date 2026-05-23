const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js')

const { translate }  = require('@vitalets/google-translate-api')
const db = require('../../utils/tradutor/database')
const { prettyLang, LANGUAGES } = require('../../utils/tradutor/database')
const { getEmojis }  = require('../../utils/emojis/emojiHelper')
const emojis = getEmojis()

const GLOBE = '🌐'

function buildSetLangPrompt(userId) {
  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.world} **Auto-Translate** — <@${userId}>`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(`You haven't set a preferred language yet.\nClick the button below to choose — your choice will be saved for all future translations.`),
    )
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(`autotrans_setlang:${userId}`)
          .setLabel('Choose Language')
          .setEmoji('🌐')
          .setStyle(ButtonStyle.Primary),
      ),
    )
}

module.exports = {
  name: 'messageReactionAdd',
  once: false,

  async execute(client, reaction, user) {
    if (user.bot) return

    try {
      if (reaction.partial)         await reaction.fetch()
      if (reaction.message.partial) await reaction.message.fetch()
    } catch {
      return
    }

    if (reaction.emoji.name !== GLOBE) return

    const message = reaction.message
    if (!message.guild) return
    if (!message.content?.trim()) return

    const guildId = message.guild.id

    try {
      const channelId = await db.getChannel(guildId)
      if (!channelId || message.channel.id !== channelId) return

      await reaction.users.remove(user.id).catch(() => {})

      const lang = await db.getUserLang(guildId, user.id)

      // ── No language set: send channel message with button ────────────────
      if (!lang) {
        const prompt = await message.channel.send({
          components: [buildSetLangPrompt(user.id)],
          flags: [MessageFlags.IsComponentsV2],
        }).catch(() => null)

        if (prompt) setTimeout(() => prompt.delete().catch(() => {}), 60_000)
        return
      }

      // ── Language set: translate and send in channel (auto-delete 15s) ───
      const content = message.content.slice(0, 4000)
      const res = await translate(content, { to: lang })
      const translated   = res.text
      const detectedLang = res.raw?.src || res.from?.language?.iso || 'auto'

      const displayOriginal   = content.length   > 800  ? content.slice(0, 800)   + '…' : content
      const displayTranslated = translated.length > 1200 ? translated.slice(0, 1200) + '…' : translated

      const resultContainer = new ContainerBuilder()
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.world} **Auto-Translate** — <@${user.id}>\n${prettyLang(detectedLang)} → ${prettyLang(lang)}`),
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(`**Original** *(by <@${message.author.id}>)*:\n> ${displayOriginal.replace(/\n/g, '\n> ')}`),
        )
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(`**Translated:**\n> ${displayTranslated.replace(/\n/g, '\n> ')}`),
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(row =>
          row.setComponents(
            new ButtonBuilder()
              .setCustomId(`autotrans_changelang:${user.id}`)
              .setLabel('Change Language')
              .setEmoji('⚙️')
              .setStyle(ButtonStyle.Secondary),
          ),
        )

      const temp = await message.channel.send({
        components: [resultContainer],
        flags: [MessageFlags.IsComponentsV2],
      }).catch(() => null)

      if (temp) setTimeout(() => temp.delete().catch(() => {}), 15_000)

    } catch (err) {
      console.error('[AutoTranslate:reaction]', err.message)
    }
  },
}
