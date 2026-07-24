const Discord = require('discord.js')
const {
  ContainerBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require('discord.js')

const { getEmojis } = require("../../../utils/emojis/emojiHelper");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

module.exports = {
  name: 'announcement',
  description: 'Server announcement management system.',
  descriptionKey: 'cmd_anuncio_desc',
  type: Discord.ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),

  run: async (client, interaction) => {
    try {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const errorContainer = new ContainerBuilder()
          .setAccentColor(0xff0000)
          .addTextDisplayComponents((td) =>
            td.setContent(
              '❌ You do not have permission to use this command.',
            ),
          )

        return await interaction.reply({
          components: [errorContainer],
          flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
        })
      }

      if (!client.anuncioData) client.anuncioData = {}

      client.anuncioData[interaction.user.id] = {
        nome: 'No name',
        descricao: 'No description',
        imagem: 'No image defined',
        thumbnail: 'No thumbnail defined',
        footer: 'No footer defined',
        links: [],
        cor: 'No color defined',
      }

      const anuncioContainer = new ContainerBuilder()
        .setAccentColor(0xFFFFFF)
        .addTextDisplayComponents((td) =>
          td.setContent('📢 **Announcement System**'),
        )
        .addSectionComponents((section) =>
          section
            .addTextDisplayComponents((td) =>
              td.setContent('Click here to create a new announcement'),
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId('criar_anuncio')
                .setLabel('Create Announcement')
                .setEmoji(getEmoji(emojis.plus))
                .setStyle(ButtonStyle.Secondary),
            ),
        )
        .addSeparatorComponents((separator) => separator)
        .addSectionComponents((section) =>
          section
            .addTextDisplayComponents((td) =>
              td.setContent('Click here to send a saved announcement'),
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId('anuncios_salvos')
                .setLabel('Saved Announcements')
                .setEmoji(getEmoji(emojis.fav))
                .setStyle(ButtonStyle.Secondary),
            ),
        )

      await interaction.reply({
        components: [anuncioContainer],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    } catch (error) {
      console.error('Error in /announcement command:', error)

      const errorContainer = new ContainerBuilder()
        .setAccentColor(0xff0000)
        .addTextDisplayComponents((td) =>
          td.setContent(
            '❌ **Error**\n\nAn error occurred while executing the command. Please try again.',
          ),
        )

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          components: [errorContainer],
          flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
        })
      } else {
        await interaction.reply({
          components: [errorContainer],
          flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
        })
      }
    }
  },
}
