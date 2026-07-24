const {
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ChannelType,
  ContainerBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js')

const db = require('../../../utils/tradutor/database')
const { getEmojis } = require('../../../utils/emojis/emojiHelper')
const emojis = getEmojis()

module.exports = {
  name: 'autotranslate',
  nameKey: 'cmd_autotranslate_name',
  description: 'Configure automatic translation reactions for a channel.',
  descriptionKey: 'cmd_autotranslate_desc',
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.ManageChannels.toString(),

  options: [
    {
      name: 'set',
      description: 'Set the channel where the bot will react with 🌐 for translation.',
      descriptionKey: 'opt_autotranslate_set_desc',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The text channel to monitor.',
          descriptionKey: 'opt_autotranslate_channel_desc',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true,
        },
      ],
    },
    {
      name: 'remove',
      description: 'Remove the auto-translate reaction from the configured channel.',
      descriptionKey: 'opt_autotranslate_remove_desc',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],

  run: async (client, interaction) => {
    const sub     = interaction.options.getSubcommand()
    const guildId = interaction.guild.id

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel')

      const botMember = interaction.guild.members.me
      if (!channel.permissionsFor(botMember).has(PermissionsBitField.Flags.AddReactions)) {
        return interaction.reply({
          content: `${emojis.danger} I don't have permission to add reactions in ${channel}.`,
          flags: MessageFlags.Ephemeral,
        })
      }

      await db.setChannel(guildId, channel.id)

      const container = new ContainerBuilder()
        .setAccentColor(0x57F287)
        .addTextDisplayComponents(td =>
          td.setContent(`${emojis.check} **Auto-Translate configured!**`),
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(
            `${emojis.world} Every new message in ${channel} will receive a 🌐 reaction.\n` +
            `${emojis.info} Members can react with 🌐 to receive the translation in their DMs.\n\n` +
            `${emojis.settings} Members set their language via the **Quick Translate** context menu *(right-click any message)*.\n` +
            `${emojis.warning} Make sure your DMs are open to receive translations.`,
          ),
        )

      return interaction.reply({
        components: [container],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    if (sub === 'remove') {
      await db.removeChannel(guildId)

      return interaction.reply({
        content: `${emojis.check} Auto-translate channel removed.`,
        flags: MessageFlags.Ephemeral,
      })
    }
  },
}
