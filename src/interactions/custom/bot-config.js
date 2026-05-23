const fs = require('fs');
const path = require('path');
const {
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require('discord.js');

module.exports = {
  async execute(client, interaction) {
    if (!interaction.guild) return;

    const validIds = [
      'bot_change_name',
      'bot_change_avatar',
      'bot_change_banner',
      'bot_change_status',
      'modal_bot_name',
      'modal_bot_avatar',
      'modal_bot_banner',
      'modal_bot_status'
    ];

    if (interaction.isButton()) {
      if (!validIds.includes(interaction.customId)) return;

      if (interaction.customId === 'bot_change_name') {
        const modal = new ModalBuilder()
          .setCustomId('modal_bot_name')
          .setTitle('Alterar Nome do Bot');

        const nameInput = new TextInputBuilder()
          .setCustomId('input_name')
          .setLabel('Novo Nome')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32)
          .setPlaceholder('Digite o novo nome do bot');

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        await interaction.showModal(modal);
      }

      if (interaction.customId === 'bot_change_avatar') {
        const modal = new ModalBuilder()
          .setCustomId('modal_bot_avatar')
          .setTitle('Alterar Avatar do Bot');

        const avatarInput = new TextInputBuilder()
          .setCustomId('input_avatar')
          .setLabel('URL da Imagem')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('https://exemplo.com/imagem.png');

        modal.addComponents(new ActionRowBuilder().addComponents(avatarInput));
        await interaction.showModal(modal);
      }

      if (interaction.customId === 'bot_change_banner') {
        const modal = new ModalBuilder()
          .setCustomId('modal_bot_banner')
          .setTitle('Alterar Banner do Bot');

        const bannerInput = new TextInputBuilder()
          .setCustomId('input_banner')
          .setLabel('URL da Imagem do Banner')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('https://exemplo.com/banner.png');

        modal.addComponents(new ActionRowBuilder().addComponents(bannerInput));
        await interaction.showModal(modal);
      }
    }

    if (interaction.customId === 'bot_change_status') {
      const modal = new ModalBuilder()
        .setCustomId('modal_bot_status')
        .setTitle('Alterar Status do Bot');

      const statusInput = new TextInputBuilder()
        .setCustomId('input_status')
        .setLabel('Novo Status')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(128)
        .setPlaceholder('Digite o novo status do bot');

      modal.addComponents(new ActionRowBuilder().addComponents(statusInput));
      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_bot_name') {
        await interaction.deferReply({
          flags: [MessageFlags.Ephemeral]
        });

        const name = interaction.fields.getTextInputValue('input_name');

        try {
          await interaction.client.user.setUsername(name);

          const successContainer = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('## Operação Concluída')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(true).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('**Nome do Bot Atualizado**')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(false).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`O nome do bot foi alterado para **${name}** com sucesso. A alteração está visível em todos os servidores.`)
            );

          await interaction.editReply({
            components: [successContainer],
            flags: [MessageFlags.IsComponentsV2],
          });
        } catch (error) {
          const errorContainer = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('## Erro na Operação')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(true).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('**Não foi possível alterar o nome**')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(false).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('Você pode estar sendo limitado pelo Discord (rate limit). Tente novamente em alguns minutos.')
            );

          await interaction.editReply({
            components: [errorContainer],
            flags: [MessageFlags.IsComponentsV2],
          });
        }
      }

      if (interaction.customId === 'modal_bot_avatar') {
        await interaction.deferReply({
          flags: [MessageFlags.Ephemeral]
        });

        const avatarUrl = interaction.fields.getTextInputValue('input_avatar');

        try {
          await interaction.client.user.setAvatar(avatarUrl);

          const successContainer = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('## Operação Concluída')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(true).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('**Avatar do Bot Atualizado**')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(false).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('O avatar do bot foi alterado com sucesso. Pode levar alguns instantes para a alteração ser refletida em todos os servidores.')
            );

          await interaction.editReply({
            components: [successContainer],
            flags: [MessageFlags.IsComponentsV2],
          });
        } catch (error) {
          const errorContainer = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('## Erro na Operação')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(true).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('**Não foi possível alterar o avatar**')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(false).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('Verifique se a URL é válida, está acessível e aponta para uma imagem nos formatos PNG, JPG ou GIF.')
            );

          await interaction.editReply({
            components: [errorContainer],
            flags: [MessageFlags.IsComponentsV2],
          });
        }
      }

      if (interaction.customId === 'modal_bot_status') {
        await interaction.deferReply({
          flags: [MessageFlags.Ephemeral]
        });

        const status = interaction.fields.getTextInputValue('input_status');

        try {
          await interaction.client.user.setActivity(status);

          const successContainer = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('## Operação Concluída')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(true).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('**Status do Bot Atualizado**')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(false).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`O status do bot foi alterado para **${status}** com sucesso.`)
            );

          await interaction.editReply({
            components: [successContainer],
            flags: [MessageFlags.IsComponentsV2],
          });
        } catch (error) {
          const errorContainer = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('## Erro na Operação')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(true).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('**Não foi possível alterar o status**')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(false).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('Ocorreu um erro ao tentar alterar o status. Tente novamente.')
            );

          await interaction.editReply({
            components: [errorContainer],
            flags: [MessageFlags.IsComponentsV2],
          });
        }
      }

      if (interaction.customId === 'modal_bot_banner') {
        await interaction.deferReply({
          flags: [MessageFlags.Ephemeral]
        });

        const bannerUrl = interaction.fields.getTextInputValue('input_banner');

        try {
          await interaction.client.user.setBanner(bannerUrl);

          const successContainer = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('## Operação Concluída')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(true).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('**Banner do Bot Atualizado**')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(false).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('O banner do bot foi alterado com sucesso. A alteração é visível no perfil do bot.')
            );

          await interaction.editReply({
            components: [successContainer],
            flags: [MessageFlags.IsComponentsV2],
          });
        } catch (error) {
          const errorContainer = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('## Erro na Operação')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(true).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('**Não foi possível alterar o banner**')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setDivider(false).setSpacing(1)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('Verifique se a URL é válida e se o bot possui uma assinatura válida (Discord Nitro). Apenas bots com Nitro podem ter banners personalizados.')
            );

          await interaction.editReply({
            components: [errorContainer],
            flags: [MessageFlags.IsComponentsV2],
          });
        }
      }
    }
  }
};