const axios = require("axios");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  StringSelectMenuOptionBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const API_URL = process.env.API_URL || "https://labzapi.squareweb.app";
const API_KEY =
  "a793aaa08d2f2d57aa4fcb52423b1327bb957f9d7ac6541ce1b135488247afa7";

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

function truncateText(text, maxLength = 50) {
  if (!text || text === "Não configurado") return text;
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

function formatUrl(url) {
  if (!url || url === "Não configurado") return "Não configurado";
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch {
    return url;
  }
}

const CUSTOMIZATION_ENABLED = true;

function getCustomizationPath(guildId) {
  const guildDir = path.join(__dirname, "../../../banco/auth", guildId);
  if (!fs.existsSync(guildDir)) {
    fs.mkdirSync(guildDir, { recursive: true });
  }
  return path.join(guildDir, "custom.json");
}

function loadLocalCustomization(guildId) {
  const customPath = getCustomizationPath(guildId);
  if (!fs.existsSync(customPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(customPath, "utf-8"));
}

function saveLocalCustomization(guildId, customization) {
  const customPath = getCustomizationPath(guildId);
  fs.writeFileSync(customPath, JSON.stringify(customization, null, 2));
}

async function getCurrentCustomization(guildId) {
  const localCustom = loadLocalCustomization(guildId);
  return localCustom;
}

async function showMainPanel(client, interaction) {
  await interaction.deferUpdate();

  const guildId = interaction.guild.id;
  const config = await getCurrentCustomization(guildId);
  const components = buildMainPanel(config, guildId);

  await interaction.editReply({
    components,
    flags: MessageFlags.IsComponentsV2,
  });
}

module.exports = {
  showMainPanel,
  getCurrentCustomization,
  buildMainPanel,
  async execute(client, interaction) {
    // Permite interações de avaliação em DM
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

    // Se for interação de avaliação, não verifica guild (permite DM)
    if (isAvaliacaoInteraction) {
      return; // Deixa o ticket.js processar
    }

    // Para todas as outras interações, exige guild
    if (!interaction.guild) {
      return interaction
        .reply({
          content: "❌ Este comando só pode ser usado dentro de um servidor.",
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }

    const guildId = interaction.guild.id;

    if (!interaction.customId) {
      return;
    }

    if (
      !CUSTOMIZATION_ENABLED &&
      !interaction.customId?.includes("back_main")
    ) {
      const components = buildErrorMessage(
        "O sistema de customização está temporariamente desabilitado.",
      );
      return await interaction.reply({
        components,
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true,
      });
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === `oauth_main_select_${guildId}`) {
        const value = interaction.values[0];
        const config = await getCurrentCustomization(guildId);

        let components;

        switch (value) {
          case "success":
            components = buildSuccessPanel(config, guildId);
            break;
          case "error":
            components = buildErrorPanel(config, guildId);
            break;
          case "theme":
            components = buildThemePanel(config, guildId);
            break;
          case "assets":
            components = buildAssetsPanel(config, guildId);
            break;
          case "buttons":
            components = buildButtonsPanel(config, guildId);
            break;
        }

        await interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `select_theme_font_${guildId}`) {
      await interaction.deferUpdate();

      const fontFamily = interaction.values[0];

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          theme: {
            ...(currentConfig?.theme || {}),
            fontFamily: fontFamily,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildThemePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar fonte.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    // FIM SELECTMENU

    if (interaction.isButton()) {
      if (interaction.customId === `oauth_back_main_${guildId}`) {
        const config = await getCurrentCustomization(guildId);
        const components = buildMainPanel(config, guildId);
        await interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `oauth_edit_theme_${guildId}`) {
        const currentConfig = await getCurrentCustomization(guildId);
        const themeData = currentConfig?.theme || {};

        const modal = new ModalBuilder()
          .setCustomId(`oauth_theme_modal_${guildId}`)
          .setTitle("Editar Tema e Cores");

        const primaryInput = new TextInputBuilder()
          .setCustomId("theme_primary")
          .setLabel("Cor Primária (HEX)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Ex: #5865F2")
          .setRequired(true)
          .setValue(themeData.primaryColor || "#5865F2");

        const backgroundImageInput = new TextInputBuilder()
          .setCustomId("theme_bg_image")
          .setLabel("Imagem de Fundo (URL)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(
            "Ex: https://cdn.discordapp.com/attachments/background.jpg",
          )
          .setRequired(false);
        if (themeData.backgroundImage)
          backgroundImageInput.setValue(themeData.backgroundImage);

        const bgOpacityInput = new TextInputBuilder()
          .setCustomId("theme_bg_opacity")
          .setLabel("Opacidade do Fundo (0-100)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Ex: 80")
          .setRequired(false)
          .setValue(String(themeData.backgroundOpacity || 100));

        const blurInput = new TextInputBuilder()
          .setCustomId("theme_blur")
          .setLabel("Desfoque do Fundo (0-20px)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Ex: 10")
          .setRequired(false)
          .setValue(String(themeData.backgroundBlur || 0));

        modal.addComponents(
          new ActionRowBuilder().addComponents(primaryInput),
          new ActionRowBuilder().addComponents(backgroundImageInput),
          new ActionRowBuilder().addComponents(bgOpacityInput),
          new ActionRowBuilder().addComponents(blurInput),
        );

        await interaction.showModal(modal);
      }

      if (interaction.customId === `oauth_preview_${guildId}`) {
        const previewUrl = `${API_URL}/preview/${guildId}`;
        const icon = getEmoji(emojis.visible);
        const linkIcon = getEmoji(emojis.url);
        const backIcon = getEmoji(emojis.arrowl);

        const previewButton = new ButtonBuilder()
          .setLabel("Abrir Preview")
          .setURL(previewUrl)
          .setStyle(ButtonStyle.Link);
        if (linkIcon)
          previewButton.setEmoji({ name: linkIcon.name, id: linkIcon.id });

        const backButton = new ButtonBuilder()
          .setCustomId(`oauth_back_main_${guildId}`)
          .setLabel("Voltar")
          .setStyle(ButtonStyle.Secondary);
        if (backIcon)
          backButton.setEmoji({ name: backIcon.name, id: backIcon.id });

        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${
                icon ? `<:${icon.name}:${icon.id}>` : ""
              } **PREVIEW DA PÁGINA**`,
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Visualize como ficou sua página de Auth.",
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(previewButton, backButton),
          );

        await interaction.update({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `oauth_reset_${guildId}`) {
        const components = buildResetConfirmPanel(guildId);
        await interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (interaction.customId === `oauth_reset_confirm_${guildId}`) {
        try {
          await interaction.deferUpdate();

          const customPath = getCustomizationPath(guildId);
          if (fs.existsSync(customPath)) {
            fs.unlinkSync(customPath);
          }

          const ConfigManager = require("../../utils/auth/configManager");
          const config = ConfigManager.getConfig(guildId);

          if (config && config.apiKey) {
            await axios.delete(`${API_URL}/api/customize/${guildId}`, {
              headers: { "X-API-Key": config.apiKey },
            });
          }

          const components = buildSuccessMessage(
            "Todas as personalizações foram removidas com sucesso.",
            guildId,
          );
          await interaction.editReply({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (error) {
          console.error("Erro ao resetar:", error);

          const components = buildErrorMessage(
            "Não foi possível resetar a customização.",
          );
          await interaction.editReply({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }

      if (interaction.customId === `oauth_reset_cancel_${guildId}`) {
        const config = await getCurrentCustomization(guildId);
        const components = buildMainPanel(config, guildId);

        await interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_edit_success_title_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_success_title_modal_${guildId}`)
        .setTitle("Editar Título de Sucesso");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Título da Página de Sucesso")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: Bem-vindo ao servidor!")
        .setRequired(false)
        .setMaxLength(100);

      if (currentConfig?.successPage?.title)
        input.setValue(currentConfig.successPage.title);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_success_subtitle_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_success_subtitle_modal_${guildId}`)
        .setTitle("Editar Subtítulo");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Subtítulo da Página")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: Você agora é um membro verificado")
        .setRequired(false)
        .setMaxLength(150);

      if (currentConfig?.successPage?.subtitle)
        input.setValue(currentConfig.successPage.subtitle);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_success_message_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_success_message_modal_${guildId}`)
        .setTitle("Editar Mensagem Principal");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Mensagem Detalhada")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Ex: Aproveite todos os nossos canais exclusivos!")
        .setRequired(false)
        .setMaxLength(500);

      if (currentConfig?.successPage?.message)
        input.setValue(currentConfig.successPage.message);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_success_redirect_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_success_redirect_modal_${guildId}`)
        .setTitle("Editar Redirecionamento");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("URL de Redirecionamento")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: https://labz.com.br")
        .setRequired(false);

      if (currentConfig?.successPage?.redirectUrl)
        input.setValue(currentConfig.successPage.redirectUrl);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_success_delay_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_success_delay_modal_${guildId}`)
        .setTitle("Editar Delay");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Tempo em Segundos")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 5")
        .setRequired(false)
        .setValue(String(currentConfig?.successPage?.redirectDelay || 0));

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_error_title_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_error_title_modal_${guildId}`)
        .setTitle("Editar Título de Erro");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Título da Página de Erro")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: Erro na Verificação")
        .setRequired(true)
        .setMaxLength(100);

      if (currentConfig?.errorPage?.title)
        input.setValue(currentConfig.errorPage.title);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_error_message_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_error_message_modal_${guildId}`)
        .setTitle("Editar Mensagem de Erro");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Mensagem Detalhada")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Ex: Algo deu errado. Tente novamente.")
        .setRequired(true)
        .setMaxLength(500);

      if (currentConfig?.errorPage?.message)
        input.setValue(currentConfig.errorPage.message);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_error_support_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_error_support_modal_${guildId}`)
        .setTitle("Editar Link de Suporte");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("URL de Suporte")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: https://discord.gg/seu-servidor")
        .setRequired(false);

      if (currentConfig?.errorPage?.supportUrl)
        input.setValue(currentConfig.errorPage.supportUrl);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_assets_logo_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_assets_logo_modal_${guildId}`)
        .setTitle("Editar Logo");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("URL do Logo")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: https://cdn.discordapp.com/attachments/logo.png")
        .setRequired(false);

      if (currentConfig?.assets?.logo)
        input.setValue(currentConfig.assets.logo);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_assets_banner_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_assets_banner_modal_${guildId}`)
        .setTitle("Editar Banner de Fundo");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("URL do Banner")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: https://cdn.discordapp.com/attachments/banner.png")
        .setRequired(false);

      if (currentConfig?.assets?.banner)
        input.setValue(currentConfig.assets.banner);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_assets_opacity_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_assets_opacity_modal_${guildId}`)
        .setTitle("Editar Opacidade");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Opacidade (0-100)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 80")
        .setRequired(false)
        .setValue(String(currentConfig?.assets?.bannerOpacity || 100));

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_assets_position_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_assets_position_modal_${guildId}`)
        .setTitle("Editar Posição do Banner");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Posição")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("center, top, bottom, left, right")
        .setRequired(false)
        .setValue(currentConfig?.assets?.bannerPosition || "center");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_assets_favicon_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_assets_favicon_modal_${guildId}`)
        .setTitle("Editar Favicon");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("URL do Favicon")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(
          "Ex: https://cdn.discordapp.com/attachments/favicon.ico",
        )
        .setRequired(false);

      if (currentConfig?.assets?.favicon)
        input.setValue(currentConfig.assets.favicon);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_add_button_${guildId}`) {
      const modal = new ModalBuilder()
        .setCustomId(`oauth_add_button_modal_${guildId}`)
        .setTitle("Adicionar Novo Botão");

      const labelInput = new TextInputBuilder()
        .setCustomId("label")
        .setLabel("Texto do Botão")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: Ver Regras")
        .setRequired(true)
        .setMaxLength(80);

      const urlInput = new TextInputBuilder()
        .setCustomId("url")
        .setLabel("URL do Link")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: https://labz.com/regras")
        .setRequired(true);

      const emojiInput = new TextInputBuilder()
        .setCustomId("emoji")
        .setLabel("Emoji (opcional)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 📜")
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(labelInput),
        new ActionRowBuilder().addComponents(urlInput),
        new ActionRowBuilder().addComponents(emojiInput),
      );

      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_remove_last_button_${guildId}`) {
      await interaction.deferUpdate();

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const buttons = currentConfig?.buttons || [];

        if (buttons.length > 0) {
          buttons.pop();

          const customization = {
            ...currentConfig,
            buttons,
          };

          await saveCustomization(guildId, customization);

          const config = await getCurrentCustomization(guildId);
          const components = buildButtonsPanel(config, guildId);

          await interaction.editReply({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        }
      } catch (error) {
        console.error("Erro ao remover botão:", error);

        const components = buildErrorMessage(
          "Não foi possível remover o botão.",
        );
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (
      interaction.customId?.startsWith(`oauth_edit_button_`) &&
      interaction.customId.split("_").length === 5 &&
      !interaction.customId.includes("modal")
    ) {
      const parts = interaction.customId.split("_");
      const buttonIndex = parseInt(parts[3]);

      const currentConfig = await getCurrentCustomization(guildId);
      const button = currentConfig?.buttons?.[buttonIndex];

      if (!button) return;

      const modal = new ModalBuilder()
        .setCustomId(`oauth_edit_button_${buttonIndex}_modal_${guildId}`)
        .setTitle(`Editar Botão ${buttonIndex + 1}`);

      const labelInput = new TextInputBuilder()
        .setCustomId("label")
        .setLabel("Texto do Botão")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(80)
        .setValue(button.label);

      const urlInput = new TextInputBuilder()
        .setCustomId("url")
        .setLabel("URL do Link")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(button.url);

      const emojiInput = new TextInputBuilder()
        .setCustomId("emoji")
        .setLabel("Emoji (opcional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      if (button.emoji) emojiInput.setValue(button.emoji);

      modal.addComponents(
        new ActionRowBuilder().addComponents(labelInput),
        new ActionRowBuilder().addComponents(urlInput),
        new ActionRowBuilder().addComponents(emojiInput),
      );

      await interaction.showModal(modal);
    }

    if (interaction.customId === `auth_back_main_from_custom_${guildId}`) {
      try {
        await interaction.deferUpdate();

        const ConfigManager = require("../../utils/auth/configManager");
        const config = ConfigManager.getConfig(guildId);

        const stats = await getAuthStats(guildId);
        const components = buildAuthMainPanel(config, stats, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro ao voltar:", error);

        const dangerIcon = getEmoji(emojis.danger);
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              dangerIcon
                ? `<:${dangerIcon.name}:${dangerIcon.id}> **ERRO**`
                : "❌ **ERRO**",
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Erro ao voltar ao menu principal.",
            ),
          );

        await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_edit_theme_primary_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_theme_primary_modal_${guildId}`)
        .setTitle("Editar Cor Primária");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Cor Primária (HEX)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: #10b981")
        .setRequired(true)
        .setValue(currentConfig?.theme?.primaryColor || "#10b981");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_theme_secondary_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_theme_secondary_modal_${guildId}`)
        .setTitle("Editar Cor Secundária");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Cor Secundária (HEX)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: #3b82f6")
        .setRequired(true)
        .setValue(currentConfig?.theme?.secondaryColor || "#3b82f6");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_theme_background_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_theme_background_modal_${guildId}`)
        .setTitle("Editar Cor de Fundo");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Cor de Fundo (HEX)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: #1a1a1a")
        .setRequired(true)
        .setValue(currentConfig?.theme?.backgroundColor || "#1a1a1a");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_theme_text_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_theme_text_modal_${guildId}`)
        .setTitle("Editar Cor do Texto");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Cor do Texto (HEX)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: #ffffff")
        .setRequired(true)
        .setValue(currentConfig?.theme?.textColor || "#ffffff");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_theme_font_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const fontFamily =
        currentConfig?.theme?.fontFamily || "Inter, sans-serif";

      const modal = new ModalBuilder()
        .setCustomId(`oauth_theme_font_modal_${guildId}`)
        .setTitle("Selecionar Fonte Tipográfica");

      const {
        StringSelectMenuOptionBuilder,
        LabelBuilder,
      } = require("discord.js");

      const fontSelect = new StringSelectMenuBuilder()
        .setCustomId("font_family")
        .setPlaceholder("Selecione uma fonte")
        .setRequired(true)
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel("Inter")
            .setValue("Inter, sans-serif")
            .setDefault(fontFamily === "Inter, sans-serif"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Roboto")
            .setValue("Roboto, sans-serif")
            .setDefault(fontFamily === "Roboto, sans-serif"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Poppins")
            .setValue("Poppins, sans-serif")
            .setDefault(fontFamily === "Poppins, sans-serif"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Montserrat")
            .setValue("Montserrat, sans-serif")
            .setDefault(fontFamily === "Montserrat, sans-serif"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Open Sans")
            .setValue("Open Sans, sans-serif")
            .setDefault(fontFamily === "Open Sans, sans-serif"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Lato")
            .setValue("Lato, sans-serif")
            .setDefault(fontFamily === "Lato, sans-serif"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Arial")
            .setValue("Arial, sans-serif")
            .setDefault(fontFamily === "Arial, sans-serif"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Helvetica")
            .setValue("Helvetica, sans-serif")
            .setDefault(fontFamily === "Helvetica, sans-serif"),
        );

      const fontLabel = new LabelBuilder()
        .setLabel("Família de Fonte")
        .setDescription("Escolha a fonte que será utilizada")
        .setStringSelectMenuComponent(fontSelect);

      modal.addLabelComponents(fontLabel);

      return interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_edit_assets_blur_${guildId}`) {
      const currentConfig = await getCurrentCustomization(guildId);
      const modal = new ModalBuilder()
        .setCustomId(`oauth_assets_blur_modal_${guildId}`)
        .setTitle("Editar Desfoque");

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Desfoque (0-20px)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 10")
        .setRequired(false)
        .setValue(String(currentConfig?.assets?.bannerBlur || 0));

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === `oauth_reset_success_${guildId}`) {
      try {
        await interaction.deferUpdate();

        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          successPage: undefined,
        };

        await saveCustomization(guildId, customization);

        const config = await getCurrentCustomization(guildId);
        const components = buildSuccessPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro ao resetar:", error);
        const components = buildErrorMessage(
          "Não foi possível resetar a página de sucesso.",
        );
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_reset_error_${guildId}`) {
      try {
        await interaction.deferUpdate();

        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          errorPage: undefined,
        };

        await saveCustomization(guildId, customization);

        const config = await getCurrentCustomization(guildId);
        const components = buildErrorPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro ao resetar:", error);
        const components = buildErrorMessage(
          "Não foi possível resetar a página de erro.",
        );
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_reset_theme_${guildId}`) {
      try {
        await interaction.deferUpdate();

        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          theme: undefined,
        };

        await saveCustomization(guildId, customization);

        const config = await getCurrentCustomization(guildId);
        const components = buildThemePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro ao resetar:", error);
        const components = buildErrorMessage(
          "Não foi possível resetar o tema.",
        );
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_reset_assets_${guildId}`) {
      try {
        await interaction.deferUpdate();

        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          assets: undefined,
        };

        await saveCustomization(guildId, customization);

        const config = await getCurrentCustomization(guildId);
        const components = buildAssetsPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro ao resetar:", error);
        const components = buildErrorMessage(
          "Não foi possível resetar os recursos.",
        );
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_reset_buttons_${guildId}`) {
      try {
        await interaction.deferUpdate();

        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          buttons: [],
        };

        await saveCustomization(guildId, customization);

        const config = await getCurrentCustomization(guildId);
        const components = buildButtonsPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro ao resetar:", error);
        const components = buildErrorMessage(
          "Não foi possível resetar os botões.",
        );
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (
      interaction.customId?.startsWith(`oauth_remove_button_`) &&
      interaction.customId.split("_").length === 5
    ) {
      await interaction.deferUpdate();

      const parts = interaction.customId.split("_");
      const buttonIndex = parseInt(parts[3]);

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const buttons = currentConfig?.buttons || [];

        if (buttons[buttonIndex]) {
          buttons.splice(buttonIndex, 1);

          const customization = {
            ...currentConfig,
            buttons,
          };

          await saveCustomization(guildId, customization);

          const config = await getCurrentCustomization(guildId);
          const components = buildButtonsPanel(config, guildId);

          await interaction.editReply({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        }
      } catch (error) {
        console.error("Erro ao remover botão:", error);

        const components = buildErrorMessage(
          "Não foi possível remover o botão.",
        );
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_back_theme_${guildId}`) {
      await interaction.deferUpdate();

      const config = await getCurrentCustomization(guildId);
      const components = buildThemePanel(config, guildId);

      await interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // FIM BOTAO

    if (interaction.isModalSubmit()) {
      if (interaction.customId === `oauth_theme_modal_${guildId}`) {
        await interaction.deferUpdate();

        const primary = interaction.fields.getTextInputValue("theme_primary");
        const bgImage =
          interaction.fields.getTextInputValue("theme_bg_image") || null;
        const bgOpacity = parseInt(
          interaction.fields.getTextInputValue("theme_bg_opacity") || "100",
        );
        const blur = parseInt(
          interaction.fields.getTextInputValue("theme_blur") || "0",
        );

        try {
          const currentConfig = await getCurrentCustomization(guildId);

          const customization = {
            ...currentConfig,
            theme: {
              primaryColor: primary,
              backgroundImage: bgImage,
              backgroundOpacity: bgOpacity,
              backgroundBlur: blur,
            },
          };

          await saveCustomization(guildId, customization);

          const config = await getCurrentCustomization(guildId);
          const components = buildThemePanel(config, guildId);

          await interaction.editReply({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (error) {
          console.error("Erro ao salvar tema:", error);

          const components = buildErrorMessage(
            "Não foi possível salvar o tema.",
          );
          await interaction.editReply({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }
    }

    if (interaction.customId === `oauth_theme_font_modal_${guildId}`) {
      await interaction.deferUpdate();

      let fontFamily = null;

      try {
        if (interaction.fields && interaction.fields.fields) {
          const fieldData = interaction.fields.fields.get("font_family");

          if (fieldData && fieldData.values && fieldData.values.length > 0) {
            fontFamily = fieldData.values[0];
          }
        }
      } catch (e) {
        console.error("Erro ao extrair fonte:", e);
      }

      if (!fontFamily) {
        const components = buildErrorMessage("Nenhuma fonte foi selecionada.");
        return await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          theme: {
            ...(currentConfig?.theme || {}),
            fontFamily: fontFamily,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildThemePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar fonte.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_assets_banner_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value") || null;

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          assets: {
            ...(currentConfig?.assets || {}),
            banner: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildAssetsPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_assets_opacity_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = parseInt(
        interaction.fields.getTextInputValue("value") || "100",
      );

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          assets: {
            ...(currentConfig?.assets || {}),
            bannerOpacity: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildAssetsPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_assets_position_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value") || "center";

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          assets: {
            ...(currentConfig?.assets || {}),
            bannerPosition: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildAssetsPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_assets_favicon_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value") || null;

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          assets: {
            ...(currentConfig?.assets || {}),
            favicon: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildAssetsPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_add_button_modal_${guildId}`) {
      await interaction.deferUpdate();

      const label = interaction.fields.getTextInputValue("label");
      const url = interaction.fields.getTextInputValue("url");
      const emoji = interaction.fields.getTextInputValue("emoji") || null;

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const buttons = currentConfig?.buttons || [];

        if (buttons.length >= 3) {
          const components = buildErrorMessage(
            "Você já atingiu o limite de 3 botões.",
          );
          return await interaction.editReply({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        }

        buttons.push({
          label: label.trim(),
          url: url.trim(),
          emoji: emoji?.trim() || null,
          style: "secondary",
        });

        const customization = {
          ...currentConfig,
          buttons,
        };

        await saveCustomization(guildId, customization);

        const config = await getCurrentCustomization(guildId);
        const components = buildButtonsPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro ao adicionar botão:", error);

        const components = buildErrorMessage(
          "Não foi possível adicionar o botão.",
        );
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (
      interaction.customId.startsWith(`oauth_edit_button_`) &&
      interaction.customId.includes("modal")
    ) {
      await interaction.deferUpdate();

      const parts = interaction.customId.split("_");
      const buttonIndex = parseInt(parts[3]);

      const label = interaction.fields.getTextInputValue("label");
      const url = interaction.fields.getTextInputValue("url");
      const emoji = interaction.fields.getTextInputValue("emoji") || null;

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const buttons = currentConfig?.buttons || [];

        if (!buttons[buttonIndex]) {
          const components = buildErrorMessage("Botão não encontrado.");
          return await interaction.editReply({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        }

        buttons[buttonIndex] = {
          label: label.trim(),
          url: url.trim(),
          emoji: emoji?.trim() || null,
          style: "secondary",
        };

        const customization = {
          ...currentConfig,
          buttons,
        };

        await saveCustomization(guildId, customization);

        const config = await getCurrentCustomization(guildId);
        const components = buildButtonsPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro ao editar botão:", error);

        const components = buildErrorMessage(
          "Não foi possível editar o botão.",
        );
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_theme_primary_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value");

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          theme: {
            ...(currentConfig?.theme || {}),
            primaryColor: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildThemePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_theme_secondary_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value");

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          theme: {
            ...(currentConfig?.theme || {}),
            secondaryColor: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildThemePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_theme_background_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value");

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          theme: {
            ...(currentConfig?.theme || {}),
            backgroundColor: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildThemePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_theme_text_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value");

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          theme: {
            ...(currentConfig?.theme || {}),
            textColor: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildThemePanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_assets_blur_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = parseInt(
        interaction.fields.getTextInputValue("value") || "0",
      );

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          assets: {
            ...(currentConfig?.assets || {}),
            bannerBlur: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildAssetsPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_assets_logo_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value") || null;

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          assets: {
            ...(currentConfig?.assets || {}),
            logo: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildAssetsPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_success_title_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value");

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          successPage: {
            ...(currentConfig?.successPage || {}),
            title: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildSuccessPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_success_subtitle_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value");

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          successPage: {
            ...(currentConfig?.successPage || {}),
            subtitle: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildSuccessPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_success_message_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value");

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          successPage: {
            ...(currentConfig?.successPage || {}),
            message: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildSuccessPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_success_redirect_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value") || null;

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          successPage: {
            ...(currentConfig?.successPage || {}),
            redirectUrl: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildSuccessPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_success_delay_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = parseInt(
        interaction.fields.getTextInputValue("value") || "0",
      );

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          successPage: {
            ...(currentConfig?.successPage || {}),
            redirectDelay: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildSuccessPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_error_title_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value");

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          errorPage: {
            ...(currentConfig?.errorPage || {}),
            title: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildErrorPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_error_message_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value");

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          errorPage: {
            ...(currentConfig?.errorPage || {}),
            message: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildErrorPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.customId === `oauth_error_support_modal_${guildId}`) {
      await interaction.deferUpdate();
      const value = interaction.fields.getTextInputValue("value") || null;

      try {
        const currentConfig = await getCurrentCustomization(guildId);
        const customization = {
          ...currentConfig,
          errorPage: {
            ...(currentConfig?.errorPage || {}),
            supportUrl: value,
          },
        };

        await saveCustomization(guildId, customization);
        const config = await getCurrentCustomization(guildId);
        const components = buildErrorPanel(config, guildId);

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro:", error);
        const components = buildErrorMessage("Erro ao salvar.");
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }
  },
};

// FIM MODAL

function buildMainPanel(config, guildId) {
  const settingsIcon = getEmoji(emojis.settings);
  const successIcon = getEmoji(emojis.success);
  const dangerIcon = getEmoji(emojis.danger);
  const colorIcon = getEmoji(emojis.colorpicker);
  const imageIcon = getEmoji(emojis.image);
  const buttonIcon = getEmoji(emojis.buttonclick);
  const previewIcon = getEmoji(emojis.visible);
  const resetIcon = getEmoji(emojis.lixeira);
  const backIcon = getEmoji(emojis.arrowl);

  const successConfigured = config?.successPage
    ? "Configurado"
    : "Não configurado";
  const errorConfigured = config?.errorPage ? "Configurado" : "Não configurado";
  const themeConfigured = config?.theme ? "Configurado" : "Padrão";
  const assetsConfigured =
    config?.assets?.logo || config?.assets?.banner
      ? "Configurado"
      : "Não configurado";
  const buttonsCount = config?.buttons?.length || 0;

  const backButton = new ButtonBuilder()
    .setCustomId(`auth_back_main_from_custom_${guildId}`)
    .setLabel("Voltar")
    .setStyle(ButtonStyle.Secondary);
  if (backIcon) backButton.setEmoji({ name: backIcon.name, id: backIcon.id });

  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            settingsIcon
              ? `<:${settingsIcon.name}:${settingsIcon.id}> **PAINEL DE CUSTOMIZAÇÃO OAUTH2**`
              : "⚙️ **PAINEL DE CUSTOMIZAÇÃO OAUTH2**",
          ),
        )
        .setButtonAccessory(backButton),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Personalize completamente a experiência de verificação Auth do seu servidor.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("**STATUS DAS CONFIGURAÇÕES**"),
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
        } **Página de Sucesso**\n${successConfigured}`,
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
          dangerIcon ? `<:${dangerIcon.name}:${dangerIcon.id}>` : "❌"
        } **Página de Erro**\n${errorConfigured}`,
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
          colorIcon ? `<:${colorIcon.name}:${colorIcon.id}>` : "🎨"
        } **Tema e Cores**\n${themeConfigured}`,
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
          imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : "🖼️"
        } **Logo e Banner**\n${assetsConfigured}`,
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
          buttonIcon ? `<:${buttonIcon.name}:${buttonIcon.id}>` : "🔘"
        } **Botões Personalizados**\n${buttonsCount} botão(ões) configurado(s)`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`oauth_main_select_${guildId}`)
          .setPlaceholder("Selecione o que deseja editar")
          .addOptions([
            {
              label: "Página de Sucesso",
              description: "Editar título, mensagem e redirecionamento",
              value: "success",
              emoji: successIcon
                ? { name: successIcon.name, id: successIcon.id }
                : "✅",
            },
            {
              label: "Página de Erro",
              description: "Editar mensagem de erro e suporte",
              value: "error",
              emoji: dangerIcon
                ? { name: dangerIcon.name, id: dangerIcon.id }
                : "❌",
            },
            {
              label: "Tema e Cores",
              description: "Personalizar cores e fontes",
              value: "theme",
              emoji: colorIcon
                ? { name: colorIcon.name, id: colorIcon.id }
                : "🎨",
            },
            {
              label: "Logo e Banner",
              description: "Configurar imagens da página",
              value: "assets",
              emoji: imageIcon
                ? { name: imageIcon.name, id: imageIcon.id }
                : "🖼️",
            },
            {
              label: "Botões Personalizados",
              description: "Adicionar botões customizados",
              value: "buttons",
              emoji: buttonIcon
                ? { name: buttonIcon.name, id: buttonIcon.id }
                : "🔘",
            },
          ]),
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    );

  const previewBtn = new ButtonBuilder()
    .setCustomId(`oauth_preview_${guildId}`)
    .setLabel("Visualizar")
    .setStyle(ButtonStyle.Secondary);
  if (previewIcon)
    previewBtn.setEmoji({ name: previewIcon.name, id: previewIcon.id });

  const resetBtn = new ButtonBuilder()
    .setCustomId(`oauth_reset_${guildId}`)
    .setLabel("Resetar Tudo")
    .setStyle(ButtonStyle.Danger);
  if (resetIcon) resetBtn.setEmoji({ name: resetIcon.name, id: resetIcon.id });

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(previewBtn, resetBtn),
  );

  return [container];
}

function buildSuccessPanel(config, guildId) {
  const successIcon = getEmoji(emojis.success);
  const backIcon = getEmoji(emojis.arrowl);
  const titleIcon = getEmoji(emojis.title);
  const textIcon = getEmoji(emojis.textc);
  const urlIcon = getEmoji(emojis.url);
  const clockIcon = getEmoji(emojis.clock);
  const editIcon = getEmoji(emojis.lapis);
  const resetIcon = getEmoji(emojis.lixeira);
  const previewIcon = getEmoji(emojis.visible);

  const successData = config?.successPage || {};
  const title = successData.title || "Não configurado";
  const subtitle = successData.subtitle || "Não configurado";
  const message = truncateText(successData.message || "Não configurado", 80);
  const redirectUrl = formatUrl(successData.redirectUrl || "Não configurado");
  const redirectDelay = successData.redirectDelay || 0;

  const editBtn1 = new ButtonBuilder()
    .setCustomId(`oauth_edit_success_title_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn1.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn2 = new ButtonBuilder()
    .setCustomId(`oauth_edit_success_subtitle_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn2.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn3 = new ButtonBuilder()
    .setCustomId(`oauth_edit_success_message_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn3.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn4 = new ButtonBuilder()
    .setCustomId(`oauth_edit_success_redirect_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn4.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn5 = new ButtonBuilder()
    .setCustomId(`oauth_edit_success_delay_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn5.setEmoji({ name: editIcon.name, id: editIcon.id });

  const titleSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          successIcon ? `<:${successIcon.name}:${successIcon.id}>` : ""
        } **PÁGINA DE SUCESSO**`,
      ),
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId(`oauth_back_main_${guildId}`)
        .setLabel("Voltar")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(
          backIcon ? { name: backIcon.name, id: backIcon.id } : undefined,
        ),
    );

  const section1 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          titleIcon ? `<:${titleIcon.name}:${titleIcon.id}>` : ""
        } **Título Principal**`,
      ),
      new TextDisplayBuilder().setContent(
        `Texto destacado no topo da página\n\`${title}\``,
      ),
    )
    .setButtonAccessory(editBtn1);

  const section2 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${textIcon ? `<:${textIcon.name}:${textIcon.id}>` : ""} **Subtítulo**`,
      ),
      new TextDisplayBuilder().setContent(
        `Descrição secundária abaixo do título\n\`${subtitle}\``,
      ),
    )
    .setButtonAccessory(editBtn2);

  const section3 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          textIcon ? `<:${textIcon.name}:${textIcon.id}>` : ""
        } **Mensagem Principal**`,
      ),
      new TextDisplayBuilder().setContent(
        `Conteúdo detalhado exibido ao usuário\nUse \`\${guild}\` para mencionar o servidor\n\`${message}\``,
      ),
    )
    .setButtonAccessory(editBtn3);

  const section4 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          urlIcon ? `<:${urlIcon.name}:${urlIcon.id}>` : ""
        } **Redirecionamento**`,
      ),
      new TextDisplayBuilder().setContent(
        `URL para onde o usuário será enviado\n\`${redirectUrl}\``,
      ),
    )
    .setButtonAccessory(editBtn4);

  const section5 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          clockIcon ? `<:${clockIcon.name}:${clockIcon.id}>` : ""
        } **Tempo de Espera**`,
      ),
      new TextDisplayBuilder().setContent(
        `Segundos antes de redirecionar automaticamente\n\`${redirectDelay}s\``,
      ),
    )
    .setButtonAccessory(editBtn5);

  const hasCustomizations = !!(
    config?.successPage?.title ||
    config?.successPage?.subtitle ||
    config?.successPage?.message ||
    config?.successPage?.redirectUrl ||
    (config?.successPage?.redirectDelay && config.successPage.redirectDelay > 0)
  );

  const resetBtn = new ButtonBuilder()
    .setCustomId(`oauth_reset_success_${guildId}`)
    .setLabel("Resetar Página")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(!hasCustomizations);
  if (resetIcon) resetBtn.setEmoji({ name: resetIcon.name, id: resetIcon.id });

  const previewBtn = new ButtonBuilder()
    .setLabel("Preview")
    .setURL(`${API_URL}/preview/${guildId}`)
    .setStyle(ButtonStyle.Link);
  if (previewIcon)
    previewBtn.setEmoji({ name: previewIcon.name, id: previewIcon.id });

  const container = new ContainerBuilder()
    .setAccentColor(0x10b981)
    .addSectionComponents(titleSection)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Configure como será exibida a página após uma verificação bem-sucedida. Personalize mensagens, redirecionamentos e experiência visual.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addSectionComponents(section1)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section2)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section3)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section4)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section5)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents((actionRow) =>
      actionRow.addComponents(resetBtn, previewBtn),
    );

  return [container];
}

function buildErrorPanel(config, guildId) {
  const errorIcon = getEmoji(emojis.danger);
  const backIcon = getEmoji(emojis.arrowl);
  const titleIcon = getEmoji(emojis.title);
  const textIcon = getEmoji(emojis.textc);
  const supportIcon = getEmoji(emojis.suporte);
  const editIcon = getEmoji(emojis.lapis);
  const resetIcon = getEmoji(emojis.lixeira);
  const previewIcon = getEmoji(emojis.visible);

  const errorData = config?.errorPage || {};
  const title = errorData.title || "Não configurado";
  const message = truncateText(errorData.message || "Não configurado", 80);
  const supportUrl = formatUrl(errorData.supportUrl || "Não configurado");

  const editBtn1 = new ButtonBuilder()
    .setCustomId(`oauth_edit_error_title_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn1.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn2 = new ButtonBuilder()
    .setCustomId(`oauth_edit_error_message_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn2.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn3 = new ButtonBuilder()
    .setCustomId(`oauth_edit_error_support_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn3.setEmoji({ name: editIcon.name, id: editIcon.id });

  const titleSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          errorIcon ? `<:${errorIcon.name}:${errorIcon.id}>` : ""
        } **PÁGINA DE ERRO**`,
      ),
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId(`oauth_back_main_${guildId}`)
        .setLabel("Voltar")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(
          backIcon ? { name: backIcon.name, id: backIcon.id } : undefined,
        ),
    );

  const section1 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          titleIcon ? `<:${titleIcon.name}:${titleIcon.id}>` : ""
        } **Título do Erro**`,
      ),
      new TextDisplayBuilder().setContent(
        `Texto principal exibido na página de erro\n\`${title}\``,
      ),
    )
    .setButtonAccessory(editBtn1);

  const section2 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          textIcon ? `<:${textIcon.name}:${textIcon.id}>` : ""
        } **Mensagem Detalhada**`,
      ),
      new TextDisplayBuilder().setContent(
        `Explicação sobre o erro e próximos passos\n\`${message}\``,
      ),
    )
    .setButtonAccessory(editBtn2);

  const section3 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          supportIcon ? `<:${supportIcon.name}:${supportIcon.id}>` : ""
        } **Link de Suporte**`,
      ),
      new TextDisplayBuilder().setContent(
        `URL para obter ajuda (servidor/site)\n\`${supportUrl}\``,
      ),
    )
    .setButtonAccessory(editBtn3);

  const hasCustomizations = !!(
    config?.errorPage?.title ||
    config?.errorPage?.message ||
    config?.errorPage?.supportUrl
  );

  const resetBtn = new ButtonBuilder()
    .setCustomId(`oauth_reset_error_${guildId}`)
    .setLabel("Resetar Página")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(!hasCustomizations);
  if (resetIcon) resetBtn.setEmoji({ name: resetIcon.name, id: resetIcon.id });

  const previewBtn = new ButtonBuilder()
    .setLabel("Preview")
    .setURL(`${API_URL}/preview/${guildId}?error=true`)
    .setStyle(ButtonStyle.Link);
  if (previewIcon)
    previewBtn.setEmoji({ name: previewIcon.name, id: previewIcon.id });

  const container = new ContainerBuilder()
    .setAccentColor(0xef4444)
    .addSectionComponents(titleSection)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Personalize a mensagem exibida quando ocorrer falha na verificação. Configure textos informativos e links de suporte.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addSectionComponents(section1)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section2)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section3)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents((actionRow) =>
      actionRow.addComponents(resetBtn, previewBtn),
    );

  return [container];
}

function buildThemePanel(config, guildId) {
  const themeIcon = getEmoji(emojis.colorpicker);
  const editIcon = getEmoji(emojis.lapis);
  const backIcon = getEmoji(emojis.arrowl);
  const colorIcon = getEmoji(emojis.color);
  const brushIcon = getEmoji(emojis.brush);
  const resetIcon = getEmoji(emojis.lixeira);

  const themeData = config?.theme || {};
  const primaryColor = themeData.primaryColor || "#10b981";
  const secondaryColor = themeData.secondaryColor || "#3b82f6";
  const backgroundColor = themeData.backgroundColor || "#1a1a1a";
  const textColor = themeData.textColor || "#ffffff";
  const fontFamily = themeData.fontFamily || "Inter, sans-serif";

  const backButton = new ButtonBuilder()
    .setCustomId(`oauth_back_main_${guildId}`)
    .setLabel("Voltar")
    .setStyle(ButtonStyle.Secondary);
  if (backIcon) backButton.setEmoji({ name: backIcon.name, id: backIcon.id });

  const hasCustomizations = !!(
    config?.theme?.primaryColor ||
    config?.theme?.secondaryColor ||
    config?.theme?.backgroundColor ||
    config?.theme?.textColor ||
    config?.theme?.fontFamily
  );

  const resetBtn = new ButtonBuilder()
    .setCustomId(`oauth_reset_theme_${guildId}`)
    .setLabel("Resetar Tema")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(!hasCustomizations);
  if (resetIcon) resetBtn.setEmoji({ name: resetIcon.name, id: resetIcon.id });

  const editBtn1 = new ButtonBuilder()
    .setCustomId(`oauth_edit_theme_primary_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn1.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn2 = new ButtonBuilder()
    .setCustomId(`oauth_edit_theme_secondary_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn2.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn3 = new ButtonBuilder()
    .setCustomId(`oauth_edit_theme_background_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn3.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn4 = new ButtonBuilder()
    .setCustomId(`oauth_edit_theme_text_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn4.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn5 = new ButtonBuilder()
    .setCustomId(`oauth_edit_theme_font_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn5.setEmoji({ name: editIcon.name, id: editIcon.id });

  const titleSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          themeIcon ? `<:${themeIcon.name}:${themeIcon.id}>` : ""
        } **TEMA E CORES**`,
      ),
    )
    .setButtonAccessory(backButton);

  const section1 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          colorIcon ? `<:${colorIcon.name}:${colorIcon.id}>` : ""
        } **Cor Primária**`,
      ),
      new TextDisplayBuilder().setContent(
        `Cor principal dos botões e elementos\n\`${primaryColor}\``,
      ),
    )
    .setButtonAccessory(editBtn1);

  const section2 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          colorIcon ? `<:${colorIcon.name}:${colorIcon.id}>` : ""
        } **Cor Secundária**`,
      ),
      new TextDisplayBuilder().setContent(
        `Cor de destaque e acentos visuais\n\`${secondaryColor}\``,
      ),
    )
    .setButtonAccessory(editBtn2);

  const section3 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          colorIcon ? `<:${colorIcon.name}:${colorIcon.id}>` : ""
        } **Cor de Fundo**`,
      ),
      new TextDisplayBuilder().setContent(
        `Cor de fundo da página\n\`${backgroundColor}\``,
      ),
    )
    .setButtonAccessory(editBtn3);

  const section4 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          colorIcon ? `<:${colorIcon.name}:${colorIcon.id}>` : ""
        } **Cor do Texto**`,
      ),
      new TextDisplayBuilder().setContent(
        `Cor dos textos da página\n\`${textColor}\``,
      ),
    )
    .setButtonAccessory(editBtn4);

  const section5 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          brushIcon ? `<:${brushIcon.name}:${brushIcon.id}>` : ""
        } **Fonte Tipográfica**`,
      ),
      new TextDisplayBuilder().setContent(
        `Família de fonte utilizada\n\`${fontFamily}\``,
      ),
    )
    .setButtonAccessory(editBtn5);

  const container = new ContainerBuilder()
    .addSectionComponents(titleSection)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Personalize o esquema de cores e tipografia da página de verificação.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addSectionComponents(section1)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section2)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section3)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section4)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section5)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents((actionRow) => actionRow.addComponents(resetBtn));

  return [container];
}

function buildAssetsPanel(config, guildId) {
  const imageIcon = getEmoji(emojis.image);
  const backIcon = getEmoji(emojis.arrowl);
  const editIcon = getEmoji(emojis.lapis);
  const colorIcon = getEmoji(emojis.colorpicker);
  const locationIcon = getEmoji(emojis.location);
  const brushIcon = getEmoji(emojis.brush);
  const resetIcon = getEmoji(emojis.lixeira);

  const assetsData = config?.assets || {};
  const logo = formatUrl(assetsData.logo || "Não configurado");
  const banner = formatUrl(assetsData.banner || "Não configurado");
  const bannerOpacity = assetsData.bannerOpacity || 100;
  const bannerBlur = assetsData.bannerBlur || 0;
  const bannerPosition = assetsData.bannerPosition || "center";
  const favicon = formatUrl(assetsData.favicon || "Não configurado");

  const backButton = new ButtonBuilder()
    .setCustomId(`oauth_back_main_${guildId}`)
    .setLabel("Voltar")
    .setStyle(ButtonStyle.Secondary);
  if (backIcon) backButton.setEmoji({ name: backIcon.name, id: backIcon.id });

  const resetBtn = new ButtonBuilder()
    .setCustomId(`oauth_reset_assets_${guildId}`)
    .setLabel("Resetar Assets")
    .setStyle(ButtonStyle.Danger);
  if (resetIcon) resetBtn.setEmoji({ name: resetIcon.name, id: resetIcon.id });

  const editBtn1 = new ButtonBuilder()
    .setCustomId(`oauth_edit_assets_logo_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn1.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn2 = new ButtonBuilder()
    .setCustomId(`oauth_edit_assets_banner_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn2.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn3 = new ButtonBuilder()
    .setCustomId(`oauth_edit_assets_opacity_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn3.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn4 = new ButtonBuilder()
    .setCustomId(`oauth_edit_assets_blur_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn4.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn5 = new ButtonBuilder()
    .setCustomId(`oauth_edit_assets_position_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn5.setEmoji({ name: editIcon.name, id: editIcon.id });

  const editBtn6 = new ButtonBuilder()
    .setCustomId(`oauth_edit_assets_favicon_${guildId}`)
    .setLabel("Editar")
    .setStyle(ButtonStyle.Secondary);
  if (editIcon) editBtn6.setEmoji({ name: editIcon.name, id: editIcon.id });

  const titleSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : ""
        } **IMAGENS E RECURSOS**`,
      ),
    )
    .setButtonAccessory(backButton);

  const section1 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : ""
        } **Logo Principal**`,
      ),
      new TextDisplayBuilder().setContent(
        `Imagem exibida no centro da página\n\`${logo}\``,
      ),
    )
    .setButtonAccessory(editBtn1);

  const section2 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : ""
        } **Banner de Fundo**`,
      ),
      new TextDisplayBuilder().setContent(
        `Imagem de fundo atrás do conteúdo\n\`${banner}\``,
      ),
    )
    .setButtonAccessory(editBtn2);

  const section3 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          colorIcon ? `<:${colorIcon.name}:${colorIcon.id}>` : ""
        } **Opacidade do Banner**`,
      ),
      new TextDisplayBuilder().setContent(
        `Transparência da imagem (0-100)\n\`${bannerOpacity}%\``,
      ),
    )
    .setButtonAccessory(editBtn3);

  const section4 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          brushIcon ? `<:${brushIcon.name}:${brushIcon.id}>` : ""
        } **Desfoque do Banner**`,
      ),
      new TextDisplayBuilder().setContent(
        `Intensidade do blur (0-20px)\n\`${bannerBlur}px\``,
      ),
    )
    .setButtonAccessory(editBtn4);

  const section5 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          locationIcon ? `<:${locationIcon.name}:${locationIcon.id}>` : ""
        } **Posição do Banner**`,
      ),
      new TextDisplayBuilder().setContent(
        `Alinhamento da imagem de fundo\n\`${bannerPosition}\``,
      ),
    )
    .setButtonAccessory(editBtn5);

  const section6 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          imageIcon ? `<:${imageIcon.name}:${imageIcon.id}>` : ""
        } **Favicon (Aba)**`,
      ),
      new TextDisplayBuilder().setContent(
        `Ícone exibido na aba do navegador\n\`${favicon}\``,
      ),
    )
    .setButtonAccessory(editBtn6);

  const container = new ContainerBuilder()
    .addSectionComponents(titleSection)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Configure todas as imagens da página de verificação. Logo, banner de fundo, favicon e ajustes visuais.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addSectionComponents(section1)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section2)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section3)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section4)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section5)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(section6)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents((actionRow) => actionRow.addComponents(resetBtn));

  return [container];
}

function buildButtonsPanel(config, guildId) {
  const buttonIcon = getEmoji(emojis.buttonclick);
  const backIcon = getEmoji(emojis.arrowl);
  const plusIcon = getEmoji(emojis.plus);
  const editIcon = getEmoji(emojis.lapis);
  const trashIcon = getEmoji(emojis.lixeira);
  const resetIcon = getEmoji(emojis.lixeira);

  const buttons = config?.buttons || [];

  const titleSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          buttonIcon ? `<:${buttonIcon.name}:${buttonIcon.id}>` : ""
        } **BOTÕES PERSONALIZADOS**`,
      ),
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId(`oauth_back_main_${guildId}`)
        .setLabel("Voltar")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(
          backIcon ? { name: backIcon.name, id: backIcon.id } : undefined,
        ),
    );

  const container = new ContainerBuilder()
    .setAccentColor(0xf59e0b)
    .addSectionComponents(titleSection)
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Adicione até 3 botões com links externos na página de verificação. Perfeito para regras, loja VIP ou redes sociais.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    );

  if (buttons.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Nenhum botão configurado ainda."),
    );
  } else {
    buttons.forEach((btn, idx) => {
      const btnEmoji = btn.emoji || "";

      const editBtnItem = new ButtonBuilder()
        .setCustomId(`oauth_edit_button_${idx}_${guildId}`)
        .setLabel("Editar")
        .setStyle(ButtonStyle.Secondary);
      if (editIcon)
        editBtnItem.setEmoji({ name: editIcon.name, id: editIcon.id });

      const btnSection = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`${btnEmoji} **${btn.label}**`),
          new TextDisplayBuilder().setContent(`${formatUrl(btn.url)}`),
        )
        .setButtonAccessory(editBtnItem);

      container.addSectionComponents(btnSection);

      const removeBtnItem = new ButtonBuilder()
        .setCustomId(`oauth_remove_button_${idx}_${guildId}`)
        .setLabel("Remover")
        .setStyle(ButtonStyle.Danger);
      if (trashIcon)
        removeBtnItem.setEmoji({ name: trashIcon.name, id: trashIcon.id });

      const btnSection2 = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("⠀"))
        .setButtonAccessory(removeBtnItem);

      container.addSectionComponents(btnSection2);

      if (idx < buttons.length - 1) {
        container.addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
        );
      }
    });
  }

  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  const addBtn = new ButtonBuilder()
    .setCustomId(`oauth_add_button_${guildId}`)
    .setLabel("Adicionar Botão")
    .setStyle(ButtonStyle.Success)
    .setDisabled(buttons.length >= 3);
  if (plusIcon) addBtn.setEmoji({ name: plusIcon.name, id: plusIcon.id });

  const actionButtons = new ActionRowBuilder().addComponents(addBtn);

  if (buttons.length > 0) {
    const resetBtn = new ButtonBuilder()
      .setCustomId(`oauth_reset_buttons_${guildId}`)
      .setLabel("Resetar Todos")
      .setStyle(ButtonStyle.Danger);
    if (resetIcon)
      resetBtn.setEmoji({ name: resetIcon.name, id: resetIcon.id });

    actionButtons.addComponents(resetBtn);
  }

  container.addActionRowComponents((actionRow) =>
    actionRow.setComponents(...actionButtons.components),
  );

  return [container];
}

function buildResetConfirmPanel(guildId) {
  const warningIcon = getEmoji(emojis.warning);
  const checkIcon = getEmoji(emojis.check);
  const cancelIcon = getEmoji(emojis.cancel);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          warningIcon ? `<:${warningIcon.name}:${warningIcon.id}>` : ""
        } **CONFIRMAR RESET**`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Tem certeza que deseja resetar todas as customizações?",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("**O SEGUINTE SERÁ REMOVIDO**"),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Páginas customizadas de sucesso e erro\nConfigurações de tema e cores personalizadas\nLogo, banner e favicon configurados\nBotões personalizados adicionados",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Esta ação é irreversível e não pode ser desfeita.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    );

  const confirmBtn = new ButtonBuilder()
    .setCustomId(`oauth_reset_confirm_${guildId}`)
    .setLabel("Confirmar")
    .setStyle(ButtonStyle.Danger);
  if (checkIcon)
    confirmBtn.setEmoji({ name: checkIcon.name, id: checkIcon.id });

  const cancelBtn = new ButtonBuilder()
    .setCustomId(`oauth_reset_cancel_${guildId}`)
    .setLabel("Cancelar")
    .setStyle(ButtonStyle.Secondary);
  if (cancelIcon)
    cancelBtn.setEmoji({ name: cancelIcon.name, id: cancelIcon.id });

  const buttons = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

  return [container, buttons];
}

async function getAuthStats(guildId) {
  try {
    const ConfigManager = require("../../utils/auth/configManager");
    const config = ConfigManager.getConfig(guildId);

    if (!config.oauth.clientId || !config.apiKey) {
      return { totalUsers: 0, activeUsers: 0 };
    }

    const response = await axios.get(`${API_URL}/api/stats/${guildId}`, {
      headers: { "x-api-key": config.apiKey },
    });

    return {
      totalUsers: response.data.totalUsers || 0,
      activeUsers: response.data.activeUsers || 0,
    };
  } catch (error) {
    return { totalUsers: 0, activeUsers: 0 };
  }
}

function buildAuthMainPanel(config, stats, guildId) {
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

function buildErrorMessage(message) {
  const icon = getEmoji(emojis.danger);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${icon ? `<:${icon.name}:${icon.id}>` : ""} **ERRO**`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(message));

  return [container];
}

function buildSuccessMessage(message, guildId) {
  const icon = getEmoji(emojis.success);
  const backIcon = getEmoji(emojis.arrowl);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${icon ? `<:${icon.name}:${icon.id}>` : ""} **SUCESSO**`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(message));

  const backButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`oauth_back_main_${guildId}`)
      .setLabel("Voltar ao Painel")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(backIcon ? { name: backIcon.name, id: backIcon.id } : null),
  );

  return [container, backButton];
}

async function saveCustomization(guildId, customization) {
  if (!CUSTOMIZATION_ENABLED) {
    throw new Error("Customizações estão desabilitadas no momento.");
  }

  saveLocalCustomization(guildId, customization);

  try {
    const ConfigManager = require("../../utils/auth/configManager");
    const config = ConfigManager.getConfig(guildId);

    if (!config || !config.apiKey) {
      console.error("API Key não encontrada para sincronizar customização");
      return;
    }

    await axios.post(`${API_URL}/api/customize/${guildId}`, customization, {
      headers: { "X-API-Key": config.apiKey },
    });

    console.log("Customização sincronizada com sucesso");
  } catch (error) {
    console.error("Erro ao sincronizar customização com API:", error.message);
  }
}

async function getCurrentCustomization(guildId) {
  const localCustom = loadLocalCustomization(guildId);
  return localCustom;
}