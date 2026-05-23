const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  SectionBuilder,
  RoleSelectMenuBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require("discord.js");
const ConfigManager = require("../../utils/auth/configManager");
const axios = require("axios");
const customizarOauth = require("./customizarOauth");

const API_URL = process.env.API_URL || "https://labzapi.squareweb.app";

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

module.exports = {
  async execute(client, interaction) {
    const avaliacaoInteractionIds = [
      "avaliar_atendimento_",
      "avaliacao_estrelas_",
      "modal_avaliacao_",
      "aval_criterios_",
      "aval_c_velocidade_",
      "aval_c_qualidade_",
      "aval_c_simpatia_",
      "modal_aval_criterios_",
      "submit_aval_criterios_",
    ];

    const isAvaliacaoInteraction =
      (interaction.isButton() &&
        avaliacaoInteractionIds.some((id) =>
          interaction.customId.startsWith(id),
        )) ||
      (interaction.isStringSelectMenu() &&
        avaliacaoInteractionIds.some((id) =>
          interaction.customId.startsWith(id),
        )) ||
      (interaction.isModalSubmit() &&
        avaliacaoInteractionIds.some((id) =>
          interaction.customId.startsWith(id),
        ));

    if (isAvaliacaoInteraction) {
      return;
    }

    if (!interaction.guild) {
      return interaction
        .reply({
          content: `${emojis.cancel || "❌"} Este comando só pode ser usado dentro de um servidor.`,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }

    const guildId = interaction.guild.id;

    // ==================== INICIO: BOTOES ====================

    if (interaction.isButton()) {
      if (interaction.customId === `auth_open_config_${guildId}`) {
        await interaction.deferUpdate();

        const config = ConfigManager.getConfig(guildId);
        const stats = interaction.client.authStatsCache?.get(guildId) || {
          totalUsers: 0,
          activeUsers: 0,
        };
        const components = buildConfigPanel(config, stats, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `auth_open_customizar_${guildId}`) {
        await interaction.deferUpdate();

        const config = await customizarOauth.getCurrentCustomization(guildId);
        const components = customizarOauth.buildMainPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `auth_config_oauth_${guildId}`) {
        const config = ConfigManager.getConfig(guildId);

        const modal = new ModalBuilder()
          .setCustomId(`modal_oauth_config_${guildId}`)
          .setTitle("Configurar Auth");

        const botTokenInput = new TextInputBuilder()
          .setCustomId("oauth_bot_token")
          .setLabel("Token do Bot Auth")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder(
            "MTIzNDU2Nzg5MDEyMzQ1Njc4.XXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXX",
          )
          .setRequired(true)
          .setValue(config.oauth.botToken || "");

        const clientSecretInput = new TextInputBuilder()
          .setCustomId("oauth_client_secret")
          .setLabel("Client Secret")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Seu client secret aqui")
          .setRequired(true)
          .setValue(config.oauth.clientSecret || "");

        modal.addComponents(
          new ActionRowBuilder().addComponents(botTokenInput),
          new ActionRowBuilder().addComponents(clientSecretInput),
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === `auth_config_webhook_${guildId}`) {
        await interaction.deferUpdate();

        const webhookIcon = getEmoji(emojis.webhook);
        const backIcon = getEmoji(emojis.arrowl);

        const container = new ContainerBuilder()
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  webhookIcon
                    ? `<:${webhookIcon.name}:${webhookIcon.id}> LOGS DE VERIFICAÇÃO`
                    : "🔗 LOGS DE VERIFICAÇÃO",
                ),
              )
              .setButtonAccessory(
                new ButtonBuilder()
                  .setCustomId(`auth_back_config_${guildId}`)
                  .setLabel("Voltar")
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(
                    backIcon ? { name: backIcon.name, id: backIcon.id } : "◀️",
                  ),
              ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Escolha o canal onde os logs de verificação serão enviados.",
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(false)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId(`select_webhook_channel_${guildId}`)
                .setPlaceholder("Selecione o canal")
                .setChannelTypes(ChannelType.GuildText),
            ),
          );

        await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `auth_config_panel_${guildId}`) {
        await interaction.deferUpdate();

        const config = ConfigManager.getConfig(guildId);
        const components = buildPanelConfigMenu(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `auth_panel_select_channel_${guildId}`) {
        await interaction.deferUpdate();

        const config = ConfigManager.getConfig(guildId);
        const components = buildPanelConfigMenu(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `auth_panel_select_role_${guildId}`) {
        await interaction.deferUpdate();

        const config = ConfigManager.getConfig(guildId);
        const components = buildPanelConfigMenu(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `auth_panel_edit_message_${guildId}`) {
        await interaction.deferUpdate();

        const config = ConfigManager.getConfig(guildId);
        const components = buildEditMessagePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `auth_pull_members_${guildId}`) {
        await interaction.deferUpdate();

        const config = ConfigManager.getConfig(guildId);

        if (!config.oauth.enabled) {
          const dangerIcon = getEmoji(emojis.danger);
          const backIcon = getEmoji(emojis.arrowl);

          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                dangerIcon
                  ? `<:${dangerIcon.name}:${dangerIcon.id}> CONFIGURE O AUTH PRIMEIRO`
                  : "❌ CONFIGURE O AUTH PRIMEIRO",
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "Configure as credenciais Auth antes de puxar membros.",
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`auth_back_config_${guildId}`)
                  .setLabel("Voltar")
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(
                    backIcon ? { name: backIcon.name, id: backIcon.id } : "◀️",
                  ),
              ),
            );

          return interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (!config.apiKey) {
          const dangerIcon = getEmoji(emojis.danger);
          const backIcon = getEmoji(emojis.arrowl);

          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                dangerIcon
                  ? `<:${dangerIcon.name}:${dangerIcon.id}> API KEY NÃO ENCONTRADA`
                  : "❌ API KEY NÃO ENCONTRADA",
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "Reconfigure o Auth para gerar a API Key automaticamente.",
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`auth_back_config_${guildId}`)
                  .setLabel("Voltar")
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(
                    backIcon ? { name: backIcon.name, id: backIcon.id } : "◀️",
                  ),
              ),
            );

          return interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const refreshingIcon = getEmoji(emojis.refreshing);
        const usersIcon = getEmoji(emojis.users);

        const loadingContainer = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              refreshingIcon
                ? `<a:${refreshingIcon.name}:${refreshingIcon.id}> PUXANDO MEMBROS...`
                : "🔄 PUXANDO MEMBROS...",
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${
                usersIcon ? `<:${usersIcon.name}:${usersIcon.id}>` : "👥"
              } Processando usuários verificados...\nIsso pode levar alguns minutos.`,
            ),
          );

        await interaction.editReply({
          components: [loadingContainer],
          flags: MessageFlags.IsComponentsV2,
        });

        const startTime = Date.now();

        try {
          const response = await axios.post(
            `${config.oauth.serverUrl || API_URL}/api/pull-members/${guildId}`,
            {},
            {
              headers: {
                "Content-Type": "application/json",
                "x-api-key": config.apiKey,
              },
            },
          );

          const data = response.data;
          const endTime = Date.now();
          const elapsedSeconds = Math.floor((endTime - startTime) / 1000);

          const successIcon = getEmoji(emojis.success);
          const dangerIcon = getEmoji(emojis.danger);
          const clockIcon = getEmoji(emojis.clock);
          const warningIcon = getEmoji(emojis.warning);
          const backIcon = getEmoji(emojis.arrowl);
          const usersIcon = getEmoji(emojis.users);

          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                successIcon
                  ? `<:${successIcon.name}:${successIcon.id}> RELATÓRIO DE PULL`
                  : "✅ RELATÓRIO DE PULL",
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${
                  usersIcon ? `<:${usersIcon.name}:${usersIcon.id}>` : "👥"
                } **Total Processado:** ${data.total || 0}`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(false)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${
                  successIcon
                    ? `<:${successIcon.name}:${successIcon.id}>`
                    : "✅"
                } **Adicionados:** ${data.pulled || 0}\n${
                  dangerIcon ? `<:${dangerIcon.name}:${dangerIcon.id}>` : "🚫"
                } **Tokens Revogados:** ${
                  (data.tokenExpired || 0) + (data.invalidGrant || 0)
                }\n${
                  warningIcon
                    ? `<:${warningIcon.name}:${warningIcon.id}>`
                    : "⏳"
                } **Rate Limited:** ${data.rateLimited || 0}\n${
                  dangerIcon ? `<:${dangerIcon.name}:${dangerIcon.id}>` : "❓"
                } **Erros Desconhecidos:** ${data.unknownError || 0}`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(false)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${
                  clockIcon ? `<:${clockIcon.name}:${clockIcon.id}>` : "🕐"
                } **Tempo Total:** <t:${Math.floor(startTime / 1000)}:R> (${elapsedSeconds}s)`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`auth_back_config_${guildId}`)
                  .setLabel("Voltar")
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(
                    backIcon ? { name: backIcon.name, id: backIcon.id } : "◀️",
                  ),
              ),
            );

          await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (error) {
          console.error("Erro ao puxar membros:", error);

          const dangerIcon = getEmoji(emojis.danger);
          const backIcon = getEmoji(emojis.arrowl);

          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                dangerIcon
                  ? `<:${dangerIcon.name}:${dangerIcon.id}> ERRO AO PUXAR MEMBROS`
                  : "❌ ERRO AO PUXAR MEMBROS",
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `Não foi possível puxar os membros.\n\n**Erro:** ${
                  error.response?.data?.error || error.message
                }`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`auth_back_config_${guildId}`)
                  .setLabel("Voltar")
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(
                    backIcon ? { name: backIcon.name, id: backIcon.id } : "◀️",
                  ),
              ),
            );

          await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }

      if (interaction.customId === `auth_back_main_${guildId}`) {
        await interaction.deferUpdate();

        const config = ConfigManager.getConfig(guildId);
        const stats = interaction.client.authStatsCache?.get(guildId) || {
          totalUsers: 0,
          activeUsers: 0,
        };
        const components = buildMainPanel(config, stats, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `auth_back_config_${guildId}`) {
        await interaction.deferUpdate();

        const config = ConfigManager.getConfig(guildId);
        const stats = interaction.client.authStatsCache?.get(guildId) || {
          totalUsers: 0,
          activeUsers: 0,
        };
        const components = buildConfigPanel(config, stats, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `auth_edit_title_${guildId}`) {
      const config = ConfigManager.getConfig(guildId);

      const modal = new ModalBuilder()
        .setCustomId(`modal_edit_title_${guildId}`)
        .setTitle("Editar Título");

      const titleInput = new TextInputBuilder()
        .setCustomId("panel_title")
        .setLabel("Título do Painel")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: Verificação Auth")
        .setRequired(true)
        .setMaxLength(100)
        .setValue(config.verification.panelTitle || "Verificação Auth");

      modal.addComponents(new ActionRowBuilder().addComponents(titleInput));

      return interaction.showModal(modal);
    }

    if (interaction.customId === `auth_edit_description_${guildId}`) {
      const config = ConfigManager.getConfig(guildId);

      const modal = new ModalBuilder()
        .setCustomId(`modal_edit_description_${guildId}`)
        .setTitle("Editar Descrição");

      const descriptionInput = new TextInputBuilder()
        .setCustomId("panel_description")
        .setLabel("Descrição do Painel")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Ex: Clique no botão abaixo para se verificar...")
        .setRequired(true)
        .setMaxLength(2000)
        .setValue(
          config.verification.panelDescription ||
            "Clique no botão abaixo para se verificar através do Auth.",
        );

      modal.addComponents(
        new ActionRowBuilder().addComponents(descriptionInput),
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === `auth_edit_banner_top_${guildId}`) {
      const config = ConfigManager.getConfig(guildId);

      const modal = new ModalBuilder()
        .setCustomId(`modal_edit_banner_top_${guildId}`)
        .setTitle("Editar Banner Topo");

      const bannerInput = new TextInputBuilder()
        .setCustomId("banner_top_url")
        .setLabel("URL do Banner (Topo)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("https://cdn.discordapp.com/attachments/imagem.png")
        .setRequired(false)
        .setValue(config.verification.bannerTop || "");

      modal.addComponents(new ActionRowBuilder().addComponents(bannerInput));

      return interaction.showModal(modal);
    }

    if (interaction.customId === `auth_edit_banner_middle_${guildId}`) {
      const config = ConfigManager.getConfig(guildId);

      const modal = new ModalBuilder()
        .setCustomId(`modal_edit_banner_middle_${guildId}`)
        .setTitle("Editar Banner Meio");

      const bannerInput = new TextInputBuilder()
        .setCustomId("banner_middle_url")
        .setLabel("URL do Banner (Meio)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("https://cdn.discordapp.com/attachments/imagem.png")
        .setRequired(false)
        .setValue(config.verification.bannerMiddle || "");

      modal.addComponents(new ActionRowBuilder().addComponents(bannerInput));

      return interaction.showModal(modal);
    }

    if (interaction.customId === `auth_edit_footer_${guildId}`) {
      const config = ConfigManager.getConfig(guildId);

      const modal = new ModalBuilder()
        .setCustomId(`modal_edit_footer_${guildId}`)
        .setTitle("Editar Footer");

      const footerInput = new TextInputBuilder()
        .setCustomId("panel_footer")
        .setLabel("Texto do Footer")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: Sistema de verificação")
        .setRequired(false)
        .setMaxLength(100)
        .setValue(config.verification.footer || "");

      modal.addComponents(new ActionRowBuilder().addComponents(footerInput));

      return interaction.showModal(modal);
    }

    if (interaction.customId === `auth_edit_button_${guildId}`) {
      const config = ConfigManager.getConfig(guildId);

      const modal = new ModalBuilder()
        .setCustomId(`modal_edit_button_${guildId}`)
        .setTitle("Editar Botão");

      const buttonTextInput = new TextInputBuilder()
        .setCustomId("button_text")
        .setLabel("Texto do Botão")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: Verificar-se")
        .setRequired(true)
        .setMaxLength(80)
        .setValue(config.verification.buttonText || "Verificar-se");

      const buttonEmojiInput = new TextInputBuilder()
        .setCustomId("button_emoji")
        .setLabel("Emoji do Botão")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: ✅ ou <:nome:id>")
        .setRequired(false)
        .setValue(config.verification.buttonEmoji || "");

      modal.addComponents(
        new ActionRowBuilder().addComponents(buttonTextInput),
        new ActionRowBuilder().addComponents(buttonEmojiInput),
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === `auth_panel_preview_${guildId}`) {
      await interaction.deferUpdate();

      const config = ConfigManager.getConfig(guildId);

      if (!config.verification.roleId) {
        const container = buildErrorMessage(
          "Configure o cargo antes de visualizar o painel.",
        );
        return interaction.editReply({
          components: container,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const panelContainer = buildVerificationPanel(config, guildId);

      await interaction.followUp({
        components: [panelContainer],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    if (interaction.customId === `auth_panel_send_message_${guildId}`) {
      await interaction.deferUpdate();

      const config = ConfigManager.getConfig(guildId);

      if (!config.verification.roleId) {
        const container = buildErrorMessage(
          "Configure o cargo antes de enviar o painel.",
        );
        return interaction.editReply({
          components: container,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const panelContainer = buildVerificationPanel(config, guildId);

      await interaction.channel.send({
        components: [panelContainer],
        flags: MessageFlags.IsComponentsV2,
      });

      const successIcon = getEmoji(emojis.success);
      const backIcon = getEmoji(emojis.arrowl);

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            successIcon
              ? `<:${successIcon.name}:${successIcon.id}> PAINEL ENVIADO`
              : "✅ PAINEL ENVIADO",
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "O painel de verificação foi enviado neste canal com sucesso!",
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`auth_config_panel_${guildId}`)
              .setLabel("Voltar")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(
                backIcon ? { name: backIcon.name, id: backIcon.id } : "◀️",
              ),
          ),
        );

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (interaction.customId === `auth_show_callback_${guildId}`) {
      await interaction.deferUpdate();

      const config = ConfigManager.getConfig(guildId);
      const callbackUrl = config.oauth.redirectUri || `${API_URL}/callback`;

      const copyIcon = getEmoji(emojis.clipboard);
      const backIcon = getEmoji(emojis.arrowl);

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("🔗 CALLBACK URL"),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "Adicione esta URL na seção **Auth > Redirects** do seu bot no Discord Developer Portal:",
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(false)
            .setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`\`\`\`\n${callbackUrl}\n\`\`\``),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`auth_back_config_${guildId}`)
              .setLabel("Voltar")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji(
                backIcon ? { name: backIcon.name, id: backIcon.id } : "◀️",
              ),
          ),
        );

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (interaction.customId === `auth_toggle_block_vpn_${guildId}`) {
      await interaction.deferUpdate();

      const config = ConfigManager.getConfig(guildId);
      const newState = !config.blockVpnUsers;

      ConfigManager.updateBlockVpnUsers(guildId, newState);

      const stats = interaction.client.authStatsCache?.get(guildId) || {
        totalUsers: 0,
        activeUsers: 0,
      };
      const components = buildConfigPanel(
        ConfigManager.getConfig(guildId),
        stats,
        guildId,
      );

      await interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (interaction.customId === `auth_config_role_${guildId}`) {
      await interaction.deferUpdate();

      const config = ConfigManager.getConfig(guildId);
      const roleIcon = getEmoji(emojis.role);
      const backIcon = getEmoji(emojis.arrowl);

      const container = new ContainerBuilder()
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                roleIcon
                  ? `<:${roleIcon.name}:${roleIcon.id}> CONFIGURAR CARGO DE VERIFICAÇÃO`
                  : "👤 CONFIGURAR CARGO DE VERIFICAÇÃO",
              ),
            )
            .setButtonAccessory(
              new ButtonBuilder()
                .setCustomId(`auth_back_config_${guildId}`)
                .setLabel("Voltar")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(
                  backIcon ? { name: backIcon.name, id: backIcon.id } : "◀️",
                ),
            ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "Selecione o cargo que será dado aos membros após a verificação Auth.",
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(false)
            .setSpacing(SeparatorSpacingSize.Small),
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
              .setCustomId(`select_verification_role_${guildId}`)
              .setPlaceholder("Selecione o cargo de verificação")
              .setDefaultRoles(
                config.verification.roleId ? [config.verification.roleId] : [],
              ),
          ),
        );

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ==================== FIM: BOTOES ====================

    // ==================== INICIO: STRING SELECT MENUS ====================

    if (interaction.isStringSelectMenu()) {
    }

    // ==================== FIM: STRING SELECT MENUS ====================

    // ==================== INICIO: ROLE SELECT MENUS ====================

    if (interaction.isRoleSelectMenu()) {
      if (interaction.customId === `select_verification_role_${guildId}`) {
        await interaction.deferUpdate();

        const roleId = interaction.values[0];
        ConfigManager.updateVerificationRole(guildId, roleId);

        const successIcon = getEmoji(emojis.success);
        const backIcon = getEmoji(emojis.arrowl);

        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              successIcon
                ? `<:${successIcon.name}:${successIcon.id}> CARGO CONFIGURADO`
                : "✅ CARGO CONFIGURADO",
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Cargo configurado: <@&${roleId}>`,
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`auth_back_config_${guildId}`)
                .setLabel("Voltar")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(
                  backIcon ? { name: backIcon.name, id: backIcon.id } : "◀️",
                ),
            ),
          );

        await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    // ==================== FIM: ROLE SELECT MENUS ====================

    // ==================== INICIO: CHANNEL SELECT MENUS ====================

    if (interaction.isChannelSelectMenu()) {
      if (interaction.customId === `select_verification_channel_${guildId}`) {
        await interaction.deferUpdate();

        const channelId = interaction.values[0];
        ConfigManager.updateVerificationChannel(guildId, channelId);

        const container = buildSuccessMessage(
          `Canal configurado: <#${channelId}>`,
          `auth_config_panel_${guildId}`,
        );
        await interaction.editReply({
          components: container,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `select_webhook_channel_${guildId}`) {
        await interaction.deferUpdate();

        const channelId = interaction.values[0];

        try {
          const channel = await interaction.guild.channels.fetch(channelId);

          const webhook = await channel.createWebhook({
            name: "Auth Logs",
            avatar: interaction.client.user.displayAvatarURL(),
          });

          ConfigManager.updateWebhook(guildId, webhook.url);

          const successIcon = getEmoji(emojis.success);
          const checkIcon = getEmoji(emojis.check);
          const webhookIcon = getEmoji(emojis.webhook);
          const backIcon = getEmoji(emojis.arrowl);

          const voltarBtn = new ButtonBuilder()
            .setCustomId(`auth_back_config_${guildId}`)
            .setLabel("Voltar")
            .setStyle(ButtonStyle.Secondary);
          if (backIcon) voltarBtn.setEmoji(backIcon);

          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                successIcon
                  ? `<:${successIcon.name}:${successIcon.id}> WEBHOOK CRIADA COM SUCESSO`
                  : "✅ WEBHOOK CRIADA COM SUCESSO",
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${
                  checkIcon ? `<:${checkIcon.name}:${checkIcon.id}>` : "✅"
                } Canal configurado: <#${channelId}>\n${
                  webhookIcon
                    ? `<:${webhookIcon.name}:${webhookIcon.id}>`
                    : "🔗"
                } Webhook ativa e pronta para uso\n${
                  checkIcon ? `<:${checkIcon.name}:${checkIcon.id}>` : "✅"
                } Logs de autenticação serão enviados aqui`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(voltarBtn),
            );

          await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (error) {
          const dangerIcon = getEmoji(emojis.danger);
          const cancelIcon = getEmoji(emojis.cancel);
          const lockIcon = getEmoji(emojis.lock);

          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                dangerIcon
                  ? `<:${dangerIcon.name}:${dangerIcon.id}> ERRO AO CRIAR WEBHOOK`
                  : "❌ ERRO AO CRIAR WEBHOOK",
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${
                  cancelIcon ? `<:${cancelIcon.name}:${cancelIcon.id}>` : "❌"
                } Não foi possível criar a webhook\n${
                  lockIcon ? `<:${lockIcon.name}:${lockIcon.id}>` : "🔒"
                } Verifique se o bot tem a permissão **Gerenciar Webhooks** no canal selecionado`,
              ),
            );

          await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }
    }

    // ==================== FIM: CHANNEL SELECT MENUS ====================

    // ==================== INICIO: MODAL SUBMITS ====================

    if (interaction.isModalSubmit()) {
      if (interaction.customId === `modal_oauth_config_${guildId}`) {
        await interaction.deferUpdate();

        const botToken = interaction.fields
          .getTextInputValue("oauth_bot_token")
          .trim();
        const clientSecret = interaction.fields
          .getTextInputValue("oauth_client_secret")
          .trim();

        try {
          const clientIdMatch = botToken.match(/^([A-Za-z0-9_-]+)\./);
          if (!clientIdMatch) {
            const dangerIcon = getEmoji(emojis.danger);
            const container = new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  dangerIcon
                    ? `<:${dangerIcon.name}:${dangerIcon.id}> ERRO`
                    : "❌ ERRO",
                ),
              )
              .addSeparatorComponents(
                new SeparatorBuilder()
                  .setDivider(true)
                  .setSpacing(SeparatorSpacingSize.Small),
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "Token inválido! Não foi possível extrair o Client ID.",
                ),
              );

            return interaction.editReply({
              components: [container],
              flags: MessageFlags.IsComponentsV2,
            });
          }

          const clientId = Buffer.from(clientIdMatch[1], "base64").toString(
            "ascii",
          );
          const redirectUri = `${API_URL}/callback`;

          const testResponse = await axios.post(
            "https://discord.com/api/oauth2/token",
            new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: "client_credentials",
              scope: "identify",
            }),
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            },
          );

          if (!testResponse.data.access_token) {
            const dangerIcon = getEmoji(emojis.danger);
            const container = new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  dangerIcon
                    ? `<:${dangerIcon.name}:${dangerIcon.id}> ERRO`
                    : "❌ ERRO",
                ),
              )
              .addSeparatorComponents(
                new SeparatorBuilder()
                  .setDivider(true)
                  .setSpacing(SeparatorSpacingSize.Small),
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "Credenciais inválidas! Verifique o Token e Client Secret.",
                ),
              );

            return interaction.editReply({
              components: [container],
              flags: MessageFlags.IsComponentsV2,
            });
          }

          const appResponse = await axios.get(
            `https://discord.com/api/v10/oauth2/applications/@me`,
            {
              headers: {
                Authorization: `Bot ${botToken}`,
              },
            },
          );

          const appData = appResponse.data;
          const hasRedirect =
            appData.redirect_uris &&
            appData.redirect_uris.includes(redirectUri);

          if (!hasRedirect) {
            const dangerIcon = getEmoji(emojis.danger);
            const linkIcon = getEmoji(emojis.link);
            const backIcon = getEmoji(emojis.arrowl);

            const container = new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  dangerIcon
                    ? `<:${dangerIcon.name}:${dangerIcon.id}> CALLBACK URL NÃO CONFIGURADA`
                    : "⚠️ CALLBACK URL NÃO CONFIGURADA",
                ),
              )
              .addSeparatorComponents(
                new SeparatorBuilder()
                  .setDivider(true)
                  .setSpacing(SeparatorSpacingSize.Small),
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "Você precisa adicionar a Callback URL no seu bot antes de continuar.",
                ),
              )
              .addSeparatorComponents(
                new SeparatorBuilder()
                  .setDivider(false)
                  .setSpacing(SeparatorSpacingSize.Small),
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${
                    linkIcon ? `<:${linkIcon.name}:${linkIcon.id}>` : "🔗"
                  } **Como configurar:**\n\n1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications/${clientId}/oauth2/general)\n2. Vá em **OAuth2**\n3. Em **Redirects**, adicione:\n\`\`\`\n${redirectUri}\n\`\`\`\n4. Clique em **Save Changes**\n5. Volte aqui e configure o Auth novamente`,
                ),
              )
              .addSeparatorComponents(
                new SeparatorBuilder()
                  .setDivider(true)
                  .setSpacing(SeparatorSpacingSize.Small),
              )
              .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId(`auth_back_config_${guildId}`)
                    .setLabel("Voltar")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(
                      backIcon
                        ? { name: backIcon.name, id: backIcon.id }
                        : "◀️",
                    ),
                ),
              );

            return interaction.editReply({
              components: [container],
              flags: MessageFlags.IsComponentsV2,
            });
          }
        } catch (error) {
          console.error("Erro ao validar credenciais:", error);
          const dangerIcon = getEmoji(emojis.danger);
          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                dangerIcon
                  ? `<:${dangerIcon.name}:${dangerIcon.id}> ERRO`
                  : "❌ ERRO",
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `Credenciais inválidas! Erro: ${
                  error.response?.data?.error || error.message
                }`,
              ),
            );

          return interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const clientId = Buffer.from(botToken.split(".")[0], "base64").toString(
          "ascii",
        );
        const redirectUri = `${API_URL}/callback`;

        const oauthConfig = {
          clientId,
          clientSecret,
          botToken,
          redirectUri,
          serverUrl: API_URL,
          enabled: true,
        };

        await ConfigManager.updateOAuth(
          guildId,
          oauthConfig,
          interaction.user.id,
          interaction.guild.name,
        );

        const successIcon = getEmoji(emojis.success);
        const checkIcon = getEmoji(emojis.check);
        const shieldIcon = getEmoji(emojis.cloud);
        const backIcon = getEmoji(emojis.arrowl);
        const inviteIcon = getEmoji(emojis.invite);
        const botIcon = getEmoji(emojis.bot);
        const warningIcon = getEmoji(emojis.warning);

        const voltarBtn = new ButtonBuilder()
          .setCustomId(`auth_back_config_${guildId}`)
          .setLabel("Voltar")
          .setStyle(ButtonStyle.Secondary);
        if (backIcon) voltarBtn.setEmoji(backIcon);

        const inviteBtn = new ButtonBuilder()
          .setLabel("Adicionar Bot")
          .setURL(
            `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=268435456&integration_type=0&scope=bot+applications.commands`,
          )
          .setStyle(ButtonStyle.Link);
        if (inviteIcon) inviteBtn.setEmoji(inviteIcon);

        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              successIcon
                ? `<:${successIcon.name}:${successIcon.id}> AUTH CONFIGURADO COM SUCESSO`
                : "✅ AUTH CONFIGURADO COM SUCESSO",
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${
                checkIcon ? `<:${checkIcon.name}:${checkIcon.id}>` : "✅"
              } Credenciais validadas\n${
                checkIcon ? `<:${checkIcon.name}:${checkIcon.id}>` : "✅"
              } Callback URL configurada\n${
                shieldIcon ? `<:${shieldIcon.name}:${shieldIcon.id}>` : "🔐"
              } Sistema Auth ativo`,
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(false)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${
                botIcon ? `<:${botIcon.name}:${botIcon.id}>` : "🤖"
              } **Próximo passo:** Adicione o bot Auth no seu servidor com as permissões necessárias usando o botão abaixo.`,
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(false)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${
                warningIcon ? `<:${warningIcon.name}:${warningIcon.id}>` : "⚠️"
              } **IMPORTANTE:** Para que o bot Auth entregue o cargo após a verificação bem-sucedida, ele precisa:\n• Estar presente no servidor\n• Ter seu cargo posicionado **acima** do cargo que será entregue na hierarquia de cargos`,
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(inviteBtn, voltarBtn),
          );

        await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `modal_edit_title_${guildId}`) {
        await interaction.deferUpdate();

        const title = interaction.fields.getTextInputValue("panel_title");
        ConfigManager.updatePanelTitle(guildId, title);

        const config = ConfigManager.getConfig(guildId);
        const components = buildEditMessagePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `modal_edit_description_${guildId}`) {
        await interaction.deferUpdate();

        const description =
          interaction.fields.getTextInputValue("panel_description");
        ConfigManager.updatePanelDescription(guildId, description);

        const config = ConfigManager.getConfig(guildId);
        const components = buildEditMessagePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `modal_edit_banner_top_${guildId}`) {
        await interaction.deferUpdate();

        const bannerTop =
          interaction.fields.getTextInputValue("banner_top_url");
        ConfigManager.updatePanelBannerTop(guildId, bannerTop);

        const config = ConfigManager.getConfig(guildId);
        const components = buildEditMessagePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `modal_edit_banner_middle_${guildId}`) {
        await interaction.deferUpdate();

        const bannerMiddle =
          interaction.fields.getTextInputValue("banner_middle_url");
        ConfigManager.updatePanelBannerMiddle(guildId, bannerMiddle);

        const config = ConfigManager.getConfig(guildId);
        const components = buildEditMessagePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `modal_edit_footer_${guildId}`) {
        await interaction.deferUpdate();

        const footer = interaction.fields.getTextInputValue("panel_footer");
        ConfigManager.updatePanelFooter(guildId, footer);

        const config = ConfigManager.getConfig(guildId);
        const components = buildEditMessagePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `modal_edit_button_${guildId}`) {
        await interaction.deferUpdate();

        const buttonText = interaction.fields.getTextInputValue("button_text");
        const buttonEmoji =
          interaction.fields.getTextInputValue("button_emoji") || "";

        ConfigManager.updatePanelButton(guildId, buttonText, buttonEmoji);

        const config = ConfigManager.getConfig(guildId);
        const components = buildEditMessagePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }
  },
};

// ==================== FIM: MODAL SUBMITS ====================

function buildEditMessagePanel(config, guildId) {
  const editIcon = getEmoji(emojis.edit);
  const backIcon = getEmoji(emojis.arrowl);
  const titleIcon = getEmoji(emojis.title);
  const contentIcon = getEmoji(emojis.content);
  const imageIcon = getEmoji(emojis.image);
  const footerIcon = getEmoji(emojis.footer);
  const buttonIcon = getEmoji(emojis.buttonclick);

  const voltarBtn = new ButtonBuilder()
    .setCustomId(`auth_config_panel_${guildId}`)
    .setLabel("Voltar")
    .setStyle(ButtonStyle.Secondary);
  if (backIcon) voltarBtn.setEmoji({ name: backIcon.name, id: backIcon.id });

  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            editIcon
              ? `<:${editIcon.name}:${editIcon.id}> EDITAR MENSAGEM DO PAINEL`
              : "EDITAR MENSAGEM DO PAINEL",
          ),
        )
        .setButtonAccessory(voltarBtn),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Personalize a mensagem do painel de verificação.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${titleIcon ? `<:${titleIcon.name}:${titleIcon.id}>` : ""} Título\n${
          config.verification.panelTitle || "Verificação Auth"
        }`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          contentIcon ? `<:${contentIcon.name}:${contentIcon.id}>` : ""
        } Descrição\n${
          config.verification.panelDescription ||
          "Clique no botão abaixo para se verificar através do Auth."
        }`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : ""
        } Banner Topo\n${config.verification.bannerTop || "Não configurado"}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : ""
        } Banner Meio\n${config.verification.bannerMiddle || "Não configurado"}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          footerIcon ? `<:${footerIcon.name}:${footerIcon.id}>` : ""
        } Footer\n${config.verification.footer || "Não configurado"}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${buttonIcon ? `<:${buttonIcon.name}:${buttonIcon.id}>` : ""} Botão\n${
          config.verification.buttonText || "Verificar-se"
        }`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    );

  const btnTitulo = new ButtonBuilder()
    .setCustomId(`auth_edit_title_${guildId}`)
    .setLabel("Título")
    .setStyle(ButtonStyle.Primary);
  if (titleIcon) btnTitulo.setEmoji({ name: titleIcon.name, id: titleIcon.id });

  const btnDescricao = new ButtonBuilder()
    .setCustomId(`auth_edit_description_${guildId}`)
    .setLabel("Descrição")
    .setStyle(ButtonStyle.Primary);
  if (contentIcon)
    btnDescricao.setEmoji({ name: contentIcon.name, id: contentIcon.id });

  container
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(btnTitulo, btnDescricao),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    );

  const btnBannerTop = new ButtonBuilder()
    .setCustomId(`auth_edit_banner_top_${guildId}`)
    .setLabel("Banner Topo")
    .setStyle(ButtonStyle.Secondary);
  if (imageIcon)
    btnBannerTop.setEmoji({ name: imageIcon.name, id: imageIcon.id });

  const btnBannerMiddle = new ButtonBuilder()
    .setCustomId(`auth_edit_banner_middle_${guildId}`)
    .setLabel("Banner Meio")
    .setStyle(ButtonStyle.Secondary);
  if (imageIcon)
    btnBannerMiddle.setEmoji({ name: imageIcon.name, id: imageIcon.id });

  container
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(btnBannerTop, btnBannerMiddle),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    );

  const btnFooter = new ButtonBuilder()
    .setCustomId(`auth_edit_footer_${guildId}`)
    .setLabel("Footer")
    .setStyle(ButtonStyle.Secondary);
  if (footerIcon)
    btnFooter.setEmoji({ name: footerIcon.name, id: footerIcon.id });

  const btnButton = new ButtonBuilder()
    .setCustomId(`auth_edit_button_${guildId}`)
    .setLabel("Botão")
    .setStyle(ButtonStyle.Secondary);
  if (buttonIcon)
    btnButton.setEmoji({ name: buttonIcon.name, id: buttonIcon.id });

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(btnFooter, btnButton),
  );

  return [container];
}

function buildMainPanel(config, stats, guildId) {
  const labzIcon = getEmoji(emojis.labz);
  const cloudIcon = getEmoji(emojis.cloud);
  const successIcon = getEmoji(emojis.success);
  const usersIcon = getEmoji(emojis.users);
  const shieldIcon = getEmoji(emojis.cloud);
  const keyIcon = getEmoji(emojis.key);
  const paletteIcon = getEmoji(emojis.colorpicker);
  const activityIcon = getEmoji(emojis.activity);

  const oauthConfigured = config.oauth.enabled
    ? "Configurado"
    : "Não configurado";
  const totalUsers = stats?.totalUsers || 0;
  const activeUsers = stats?.activeUsers || 0;

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(
            "https://cdn.discordapp.com/attachments/1336038554723160096/1410695553985151006/labz_banner_1.png",
          )
          .setDescription("Labz Cloud Banner"),
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        labzIcon && cloudIcon
          ? `# <:${cloudIcon.name}:${cloudIcon.id}> **Labz Cloud**`
          : "# ☁️ Labz Cloud",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Gerencie o sistema de autenticação e customize completamente seu site de forma profissional e segura.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        activityIcon
          ? `### <:${activityIcon.name}:${activityIcon.id}> Estatísticas do Sistema`
          : "### 📊 Estatísticas do Sistema",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          usersIcon ? `<:${usersIcon.name}:${usersIcon.id}>` : "👥"
        } **Total de Usuários**\n${totalUsers} ${
          totalUsers === 1 ? "usuário cadastrado" : "usuários cadastrados"
        }`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          successIcon ? `<:${successIcon.name}:${successIcon.id}>` : "✅"
        } **Usuários Ativos**\n${activeUsers} ${
          activeUsers === 1 ? "usuário ativo" : "usuários ativos"
        }`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          shieldIcon ? `<:${shieldIcon.name}:${shieldIcon.id}>` : "🔐"
        } **Status da Autenticação**\n${oauthConfigured}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`auth_open_config_${guildId}`)
          .setLabel("Configurar")
          .setStyle(ButtonStyle.Primary)
          .setEmoji(keyIcon ? { name: keyIcon.name, id: keyIcon.id } : "🔑"),
        new ButtonBuilder()
          .setCustomId(`auth_open_customizar_${guildId}`)
          .setLabel("Customizar")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(
            paletteIcon ? { name: paletteIcon.name, id: paletteIcon.id } : "🎨",
          ),
      ),
    );

  return [container];
}

function buildConfigPanel(config, stats, guildId) {
  const successIcon = getEmoji(emojis.success);
  const usersIcon = getEmoji(emojis.users);
  const webhookIcon = getEmoji(emojis.webhook);
  const checkIcon = getEmoji(emojis.check);
  const keyIcon = getEmoji(emojis.key);
  const linkIcon = getEmoji(emojis.link);
  const refreshIcon = getEmoji(emojis.refresh);
  const settingsIcon = getEmoji(emojis.settings);
  const backIcon = getEmoji(emojis.arrowl);
  const copyIcon = getEmoji(emojis.clipboard);
  const inviteIcon = getEmoji(emojis.invite);
  const shieldIcon = getEmoji(emojis.cloud);
  const dangerIcon = getEmoji(emojis.danger);
  const roleIcon = getEmoji(emojis.role);
  const blockIcon = getEmoji(emojis.block);
  const infoIcon = getEmoji(emojis.info);
  const discordIcon = getEmoji(emojis.discord);

  const webhookConfigured = config.webhook ? "Configurado" : "Não configurado";
  const verificationConfigured = config.verification.enabled
    ? "Configurado"
    : "Não configurado";
  const totalUsers = stats?.totalUsers || 0;
  const activeUsers = stats?.activeUsers || 0;
  const blockVpnEnabled = config.blockVpnUsers || false;

  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            settingsIcon
              ? `<:${settingsIcon.name}:${settingsIcon.id}> **CONFIGURAR AUTENTICAÇÃO**`
              : "⚙️ **CONFIGURAR AUTENTICAÇÃO**",
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`auth_back_main_${guildId}`)
            .setLabel("Voltar")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(
              backIcon ? { name: backIcon.name, id: backIcon.id } : "◀️",
            ),
        ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Configure as funcionalidades do sistema de autenticação.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          usersIcon ? `<:${usersIcon.name}:${usersIcon.id}>` : "👥"
        } Total de Usuários\n${totalUsers}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          successIcon ? `<:${successIcon.name}:${successIcon.id}>` : "✅"
        } Usuários Ativos\n${activeUsers}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          webhookIcon ? `<:${webhookIcon.name}:${webhookIcon.id}>` : "🔗"
        } Webhook\n${webhookConfigured}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          checkIcon ? `<:${checkIcon.name}:${checkIcon.id}>` : "✅"
        } Painel de Verificação\n${verificationConfigured}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          blockIcon ? `<:${blockIcon.name}:${blockIcon.id}>` : "🚫"
        } Bloquear VPN/Proxy\n${
          blockVpnEnabled
            ? "Ativado - Usuários com VPN/Proxy não receberão o cargo"
            : "Desativado - Usuários com VPN/Proxy receberão o cargo normalmente"
        }`,
      ),
    );

  const btnDevPortal = new ButtonBuilder()
    .setLabel("Portal de Desenvolvedor")
    .setURL("https://discord.com/developers/applications")
    .setStyle(ButtonStyle.Link);
  if (discordIcon)
    btnDevPortal.setEmoji({ name: discordIcon.name, id: discordIcon.id });

  container
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(new ActionRowBuilder().addComponents(btnDevPortal))
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              linkIcon ? `<:${linkIcon.name}:${linkIcon.id}>` : "🔗"
            } Callback URL`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`auth_show_callback_${guildId}`)
            .setLabel("Ver")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(
              copyIcon ? { name: copyIcon.name, id: copyIcon.id } : "📋",
            ),
        ),
    );

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  const btnOAuth = new ButtonBuilder()
    .setCustomId(`auth_config_oauth_${guildId}`)
    .setLabel("Auth")
    .setStyle(ButtonStyle.Primary);
  if (keyIcon) btnOAuth.setEmoji({ name: keyIcon.name, id: keyIcon.id });

  const btnWebhook = new ButtonBuilder()
    .setCustomId(`auth_config_webhook_${guildId}`)
    .setLabel("Webhook")
    .setStyle(ButtonStyle.Secondary);
  if (webhookIcon)
    btnWebhook.setEmoji({ name: webhookIcon.name, id: webhookIcon.id });

  const btnPainel = new ButtonBuilder()
    .setCustomId(`auth_config_panel_${guildId}`)
    .setLabel("Painel")
    .setStyle(ButtonStyle.Secondary);
  if (checkIcon) btnPainel.setEmoji({ name: checkIcon.name, id: checkIcon.id });

  const btnPullMembers = new ButtonBuilder()
    .setCustomId(`auth_pull_members_${guildId}`)
    .setLabel("Puxar Membros")
    .setStyle(ButtonStyle.Success);
  if (refreshIcon)
    btnPullMembers.setEmoji({ name: refreshIcon.name, id: refreshIcon.id });

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      btnOAuth,
      btnWebhook,
      btnPainel,
      btnPullMembers,
    ),
  );

  const btnVPN = new ButtonBuilder()
    .setCustomId(`auth_toggle_block_vpn_${guildId}`)
    .setLabel(blockVpnEnabled ? "VPN: Ativado" : "VPN: Desativado")
    .setStyle(blockVpnEnabled ? ButtonStyle.Success : ButtonStyle.Danger);
  if (blockVpnEnabled && shieldIcon)
    btnVPN.setEmoji({ name: shieldIcon.name, id: shieldIcon.id });
  if (!blockVpnEnabled && dangerIcon)
    btnVPN.setEmoji({ name: dangerIcon.name, id: dangerIcon.id });

  const btnCargo = new ButtonBuilder()
    .setCustomId(`auth_config_role_${guildId}`)
    .setLabel("Cargo")
    .setStyle(ButtonStyle.Secondary);
  if (roleIcon) btnCargo.setEmoji({ name: roleIcon.name, id: roleIcon.id });

  const inviteBtn = new ButtonBuilder()
    .setLabel("Adicionar Bot")
    .setURL(
      config.oauth.clientId
        ? `https://discord.com/oauth2/authorize?client_id=${config.oauth.clientId}&permissions=268435456&integration_type=0&scope=bot+applications.commands`
        : "https://discord.com/developers/applications",
    )
    .setStyle(ButtonStyle.Link);
  if (inviteIcon)
    inviteBtn.setEmoji({ name: inviteIcon.name, id: inviteIcon.id });

  const tutorialBtn = new ButtonBuilder()
    .setLabel("Tutorial")
    .setURL("https://www.youtube.com/watch?v=QIKI-RVI_FY")
    .setStyle(ButtonStyle.Link);
  if (infoIcon) tutorialBtn.setEmoji({ name: infoIcon.name, id: infoIcon.id });

  container
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        btnVPN,
        btnCargo,
        inviteBtn,
        tutorialBtn,
      ),
    );

  return [container];
}

function buildPanelConfigMenu(config, guildId) {
  const editIcon = getEmoji(emojis.edit);
  const checkIcon = getEmoji(emojis.check);
  const backIcon = getEmoji(emojis.arrowl);
  const titleIcon = getEmoji(emojis.title);
  const contentIcon = getEmoji(emojis.content);
  const imageIcon = getEmoji(emojis.image);
  const footerIcon = getEmoji(emojis.footer);
  const buttonIcon = getEmoji(emojis.buttonclick);
  const visibleIcon = getEmoji(emojis.visible);
  const sendIcon = getEmoji(emojis.send);

  const voltar = new ButtonBuilder()
    .setCustomId(`auth_back_config_${guildId}`)
    .setLabel("Voltar")
    .setStyle(ButtonStyle.Secondary);
  if (backIcon) voltar.setEmoji({ name: backIcon.name, id: backIcon.id });

  const btnTitulo = new ButtonBuilder()
    .setCustomId(`auth_edit_title_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (titleIcon) btnTitulo.setEmoji({ name: titleIcon.name, id: titleIcon.id });

  const btnDescricao = new ButtonBuilder()
    .setCustomId(`auth_edit_description_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (contentIcon)
    btnDescricao.setEmoji({ name: contentIcon.name, id: contentIcon.id });

  const btnBannerTop = new ButtonBuilder()
    .setCustomId(`auth_edit_banner_top_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (imageIcon)
    btnBannerTop.setEmoji({ name: imageIcon.name, id: imageIcon.id });

  const btnBannerMiddle = new ButtonBuilder()
    .setCustomId(`auth_edit_banner_middle_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (imageIcon)
    btnBannerMiddle.setEmoji({ name: imageIcon.name, id: imageIcon.id });

  const btnFooter = new ButtonBuilder()
    .setCustomId(`auth_edit_footer_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (footerIcon)
    btnFooter.setEmoji({ name: footerIcon.name, id: footerIcon.id });

  const btnButton = new ButtonBuilder()
    .setCustomId(`auth_edit_button_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (buttonIcon)
    btnButton.setEmoji({ name: buttonIcon.name, id: buttonIcon.id });

  const btnPreview = new ButtonBuilder()
    .setCustomId(`auth_panel_preview_${guildId}`)
    .setLabel("Visualizar")
    .setStyle(ButtonStyle.Primary);
  if (visibleIcon)
    btnPreview.setEmoji({ name: visibleIcon.name, id: visibleIcon.id });

  const btnEnviar = new ButtonBuilder()
    .setCustomId(`auth_panel_send_message_${guildId}`)
    .setLabel("Enviar Aqui")
    .setStyle(ButtonStyle.Success);
  if (sendIcon) btnEnviar.setEmoji({ name: sendIcon.name, id: sendIcon.id });

  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            checkIcon
              ? `<:${checkIcon.name}:${checkIcon.id}> CONFIGURAR PAINEL DE VERIFICAÇÃO`
              : "CONFIGURAR PAINEL DE VERIFICAÇÃO",
          ),
        )
        .setButtonAccessory(voltar),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Configure o painel de verificação Auth do seu servidor.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              titleIcon ? `<:${titleIcon.name}:${titleIcon.id}>` : ""
            } Título\n${config.verification.panelTitle || "Verificação Auth"}`,
          ),
        )
        .setButtonAccessory(btnTitulo),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              contentIcon ? `<:${contentIcon.name}:${contentIcon.id}>` : ""
            } Descrição\n${
              config.verification.panelDescription ||
              "Clique no botão abaixo para se verificar através do Auth."
            }`,
          ),
        )
        .setButtonAccessory(btnDescricao),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : ""
            } Banner Topo\n${
              config.verification.bannerTop || "Não configurado"
            }`,
          ),
        )
        .setButtonAccessory(btnBannerTop),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : ""
            } Banner Meio\n${
              config.verification.bannerMiddle || "Não configurado"
            }`,
          ),
        )
        .setButtonAccessory(btnBannerMiddle),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              footerIcon ? `<:${footerIcon.name}:${footerIcon.id}>` : ""
            } Footer\n${config.verification.footer || "Não configurado"}`,
          ),
        )
        .setButtonAccessory(btnFooter),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              buttonIcon ? `<:${buttonIcon.name}:${buttonIcon.id}>` : ""
            } Botão\n${config.verification.buttonText || "Verificar-se"}`,
          ),
        )
        .setButtonAccessory(btnButton),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(btnPreview, btnEnviar),
    );

  return [container];
}

function buildEditMessagePanel(config, guildId) {
  const editIcon = getEmoji(emojis.edit);
  const backIcon = getEmoji(emojis.arrowl);
  const titleIcon = getEmoji(emojis.title);
  const contentIcon = getEmoji(emojis.content);
  const imageIcon = getEmoji(emojis.image);
  const footerIcon = getEmoji(emojis.footer);
  const buttonIcon = getEmoji(emojis.buttonclick);
  const visibleIcon = getEmoji(emojis.visible);
  const sendIcon = getEmoji(emojis.send);

  const voltar = new ButtonBuilder()
    .setCustomId(`auth_config_panel_${guildId}`)
    .setLabel("Voltar")
    .setStyle(ButtonStyle.Secondary);
  if (backIcon) voltar.setEmoji(backIcon);

  const btnTitulo = new ButtonBuilder()
    .setCustomId(`auth_edit_title_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (titleIcon) btnTitulo.setEmoji(titleIcon);

  const btnDescricao = new ButtonBuilder()
    .setCustomId(`auth_edit_description_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (contentIcon) btnDescricao.setEmoji(contentIcon);

  const btnBannerTop = new ButtonBuilder()
    .setCustomId(`auth_edit_banner_top_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (imageIcon) btnBannerTop.setEmoji(imageIcon);

  const btnBannerMiddle = new ButtonBuilder()
    .setCustomId(`auth_edit_banner_middle_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (imageIcon) btnBannerMiddle.setEmoji(imageIcon);

  const btnFooter = new ButtonBuilder()
    .setCustomId(`auth_edit_footer_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (footerIcon) btnFooter.setEmoji(footerIcon);

  const btnButton = new ButtonBuilder()
    .setCustomId(`auth_edit_button_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (buttonIcon) btnButton.setEmoji(buttonIcon);

  const btnPreview = new ButtonBuilder()
    .setCustomId(`auth_panel_preview_${guildId}`)
    .setLabel("Visualizar")
    .setStyle(ButtonStyle.Primary);
  if (visibleIcon) btnPreview.setEmoji(visibleIcon);

  const btnEnviar = new ButtonBuilder()
    .setCustomId(`auth_panel_send_message_${guildId}`)
    .setLabel("Enviar Aqui")
    .setStyle(ButtonStyle.Success);
  if (sendIcon) btnEnviar.setEmoji(sendIcon);

  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            editIcon
              ? `<:${editIcon.name}:${editIcon.id}> EDITAR MENSAGEM DO PAINEL`
              : "EDITAR MENSAGEM DO PAINEL",
          ),
        )
        .setButtonAccessory(voltar),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Personalize a mensagem do painel de verificação.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              titleIcon ? `<:${titleIcon.name}:${titleIcon.id}>` : ""
            } Título\n${config.verification.panelTitle || "Verificação Auth"}`,
          ),
        )
        .setButtonAccessory(btnTitulo),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              contentIcon ? `<:${contentIcon.name}:${contentIcon.id}>` : ""
            } Descrição\n${
              config.verification.panelDescription ||
              "Clique no botão abaixo para se verificar através do Auth."
            }`,
          ),
        )
        .setButtonAccessory(btnDescricao),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : ""
            } Banner Topo\n${
              config.verification.bannerTop || "Não configurado"
            }`,
          ),
        )
        .setButtonAccessory(btnBannerTop),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : ""
            } Banner Meio\n${
              config.verification.bannerMiddle || "Não configurado"
            }`,
          ),
        )
        .setButtonAccessory(btnBannerMiddle),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              footerIcon ? `<:${footerIcon.name}:${footerIcon.id}>` : ""
            } Footer\n${config.verification.footer || "Não configurado"}`,
          ),
        )
        .setButtonAccessory(btnFooter),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${
              buttonIcon ? `<:${buttonIcon.name}:${buttonIcon.id}>` : ""
            } Botão\n${config.verification.buttonText || "Verificar-se"}`,
          ),
        )
        .setButtonAccessory(btnButton),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(btnPreview, btnEnviar),
    );

  return [container];
}

function buildErrorMessage(message) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("❌ ERRO"))
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(message));

  return [container];
}

function buildSuccessMessage(message, backButtonId) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("✅ SUCESSO"))
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(message))
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(backButtonId)
          .setLabel("Voltar")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("◀️"),
      ),
    );

  return [container];
}

function buildVerificationPanel(config, guildId) {
  const lockIcon = getEmoji(emojis.lock);
  const buttonEmoji = config.verification.buttonEmoji
    ? getEmoji(config.verification.buttonEmoji)
    : null;

  const authUrl = `https://discord.com/oauth2/authorize?client_id=${
    config.oauth.clientId
  }&redirect_uri=${encodeURIComponent(
    config.oauth.redirectUri,
  )}&response_type=code&scope=identify%20email%20guilds%20guilds.join&state=${guildId}`;

  const btnVerificar = new ButtonBuilder()
    .setLabel(config.verification.buttonText || "Verificar-se")
    .setURL(authUrl)
    .setStyle(ButtonStyle.Link);

  if (buttonEmoji) {
    btnVerificar.setEmoji(buttonEmoji);
  }

  const container = new ContainerBuilder();

  if (config.verification.bannerTop) {
    container.addMediaGalleryComponents(
      new (require("discord.js").MediaGalleryBuilder)().addItems(
        new (require("discord.js").MediaGalleryItemBuilder)()
          .setURL(config.verification.bannerTop)
          .setDescription("Banner Superior"),
      ),
    );
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    );
  }

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${config.verification.panelTitle || "VERIFICAÇÃO AUTH"}**`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        config.verification.panelDescription ||
          "Clique no botão abaixo para se verificar através do Auth.",
      ),
    );

  if (config.verification.bannerMiddle) {
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    );
    container.addMediaGalleryComponents(
      new (require("discord.js").MediaGalleryBuilder)().addItems(
        new (require("discord.js").MediaGalleryItemBuilder)()
          .setURL(config.verification.bannerMiddle)
          .setDescription("Banner Meio"),
      ),
    );
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(new ActionRowBuilder().addComponents(btnVerificar));

  if (config.verification.footer) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(false)
          .setSpacing(SeparatorSpacingSize.Small),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(config.verification.footer),
      );
  }

  return container;
}
