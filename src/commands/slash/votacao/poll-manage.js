const {
  ContainerBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js')

const db = require('../../../utils/votacao/database')
const { getEmojis } = require('../../../utils/emojis/emojiHelper')
const emojis = getEmojis()

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  const [, name, id] = match
  return { name, id }
}

function buildManageList(polls) {
  if (!polls.length) {
    return new ContainerBuilder()
      .addTextDisplayComponents(td =>
        td.setContent(`${emojis.info} No active polls in this server.`),
      )
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('poll_manage_select')
    .setPlaceholder('Select a poll to manage…')
    .addOptions(
      polls.slice(0, 25).map(p => {
        const endsTs  = Math.floor(p.ends_at / 1000)
        return {
          label:       p.title.slice(0, 100),
          value:       p.id,
          description: `Ends <t:${endsTs}:R>`.slice(0, 100),
        }
      }),
    )

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.settings} **Poll Manager** — ${polls.length} active poll(s)`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row => row.setComponents(select))
}

function buildManageDetail(poll, totalVotes) {
  const endsTs = Math.floor(poll.ends_at / 1000)

  return new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.settings} **Poll Manager**`),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.crown} **${poll.title}**\n` +
        `${emojis.clock} Ends: <t:${endsTs}:R> (<t:${endsTs}:f>)\n` +
        `${emojis.users} Votes: **${totalVotes}**`,
      ),
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(row =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(`poll_manage_extend:${poll.id}`)
          .setLabel('Extend Time')
          .setEmoji(getEmoji(emojis.clock))
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`poll_manage_end:${poll.id}`)
          .setLabel('End Now')
          .setEmoji(getEmoji(emojis.stop))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('poll_manage_back')
          .setLabel('Back')
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary),
      ),
    )
}

module.exports = {
  name: 'poll-manage',
  description: 'Gerencia votações ativas — extender tempo ou encerrar',
  default_member_permissions: PermissionsBitField.Flags.ManageMessages.toString(),

  buildManageList,
  buildManageDetail,

  run: async (client, interaction) => {
    const guildId = interaction.guild.id
    const polls   = await db.getActivePolls(guildId).catch(() => [])

    return interaction.reply({
      components: [buildManageList(polls)],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    })
  },
}
