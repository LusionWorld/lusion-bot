const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionsBitField,
  ApplicationCommandType,
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
  name: 'bot-config',
  description: 'Painel de controle do bot.',
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),

  async run(client, interaction) {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator,
      )
    ) {
      const errorContainer = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            'Você não tem permissão para usar este comando.',
          ),
        )

      return await interaction.reply({
        components: [errorContainer],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    const headerContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# Painel de Configuração do Bot'),
        new TextDisplayBuilder().setContent('Personalize a identidade visual e informações do seu bot através das opções abaixo.'),
      )

    const identityContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## Identidade Visual'),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('**Nome do Bot**'),
            new TextDisplayBuilder().setContent('Altere o nome de usuário que será exibido no Discord.'),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId('bot_change_name')
              .setLabel('Configurar')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(getEmoji(emojis.identidade))
          ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(false).setSpacing(1),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('**Avatar do Bot**'),
            new TextDisplayBuilder().setContent('Defina a imagem de perfil que representa seu bot.'),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId('bot_change_avatar')
              .setLabel('Configurar')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(getEmoji(emojis.identidade))
          ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(false).setSpacing(1),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('**Banner do Bot**'),
            new TextDisplayBuilder().setContent('Personalize o banner que aparece no perfil do bot.'),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId('bot_change_banner')
              .setLabel('Configurar')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(getEmoji(emojis.identidade))
          ),
      )

    const statusContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## Presença e Status'),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(1),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('**Status Personalizado**'),
            new TextDisplayBuilder().setContent('Configure a mensagem de status que será exibida no perfil.'),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId('bot_change_status')
              .setLabel('Configurar')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(getEmoji(emojis.bot))
          ),
      )

    const footerContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Todas as alterações são aplicadas instantaneamente e refletem em todos os servidores.'),
      )

    await interaction.reply({
      components: [headerContainer, identityContainer, statusContainer, footerContainer],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    })
  },
}