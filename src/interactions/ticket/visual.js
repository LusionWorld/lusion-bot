const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  StringSelectMenuBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ComponentType,
  UserSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  RoleSelectMenuBuilder,
  MessageFlags,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MediaType,
  SeparatorBuilder,
  SeparatorSpacingSize,
} = require("discord.js");

const path = require("path");
const { JsonDatabase } = require("wio.db");

const {
  getEmoji,
  getConfigDB,
  getPersonalizacaoDB,
  getIAConfigDB,
  getEstacoesDB,
  getEstacao,
  updateEstacao,
  deleteEstacao,
  criarEstacao,
  initIAConfig,
  criarPaginacaoBotoes,
  criarPainelConfiguracaoBotao,
  criarPainelConfiguracaoSelect,
  criarPainelConfiguracaoBotaoEstacao,
  criarPainelConfiguracaoSelectEstacao,
  criarPainelEscolhaEmoji,
  limparEmojisProcessados,
  parseEmojisInText,
} = require("./helpers");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const { t } = require("../../utils/i18n");

module.exports = {
  customIds: [
    "configurar_botao",
    "configurar_select",
    "botao_remover",
    "remover_botao_select",
    "select_remover",
    "remover_select_select",
    "botao_editar",
    "editar_botao_select_botao_",
    "editar_campo_botao_",
    "enviar_ticket_painel",
    "config_botao_",
    "emoji_escolher_",
    "emoji_",
    "config_select_",
    "config_select_descricao_",
    "atualizar_painel_embed_principal",
    "cancelar_config_botao_",
    "cancelar_config_select_",
    "editar_",
    "botoes_pagina_",
    "editar_botao_paginado_",
    "salvar_edicao_botao:",
    "modal_editar_nome_botao_",
    "modal_editar_emoji_botao_",
    "modal_editar_inicio_botao_",
    "modal_editar_nome_select_",
    "modal_editar_emoji_select_",
    "salvar_edicao_info_embed:",
    "modal_limite_ticket",
    "modal_editar_inicio_select_",
    "salvar_edicao_field:",
    "modal_config_select_descricao_",
    "modal_config_botao_",
    "modal_config_select_",
    "modal_editar_descricao_select_",
    "modal_emoji_manual_",
    "select_config_botao_categoria_",
    "select_config_select_categoria_",
    "select_categoria_botao_",
    "editar_select_select",
    "editar_campo_select_",
    "select_categoria_select_",
    "select_personalizacao_embed",
    "editar_info_embed:",
    "editar_info_embed_field:",
    "enviar_ticket_tipo",
    "enviar_ticket_canal",
    "select_editar",
    "botao_adicionar",
    "select_adicionar",
  ],
  async execute(client, interaction) {
    const { customId } = interaction;

    const belongsToThis = module.exports.customIds.some(
      (id) => customId && (customId === id || customId.startsWith(id)),
    );
    if (!belongsToThis) return;

    if (!interaction._fromPainel) return;

    if (interaction._visualProcessed) return;
    interaction._visualProcessed = true;

    if (customId === "configurar_botao") {
      const db = getPersonalizacaoDB(interaction.guild.id);
      const _botoesRaw = db.get("embedprincipal.botoes") || [];
      const _botoesAtual = _botoesRaw.filter((b) => !b.temp);
      if (_botoesRaw.length !== _botoesAtual.length) {
        db.set("embedprincipal.botoes", _botoesAtual);
      }
      const adicionar = new ButtonBuilder()
        .setCustomId("botao_adicionar")
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(_botoesAtual.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("botao_editar")
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(
        adicionar,
        remover,
        editar,
        voltar,
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_config_botao_titulo", interaction.guildId),
            ),
            new TextDisplayBuilder().setContent(
              t("visual_config_botao_desc", interaction.guildId),
            ),
          )
          .addActionRowComponents(row),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "configurar_select") {
      const db = getPersonalizacaoDB(interaction.guild.id);
      const _selectsRaw = db.get("embedprincipal.selects") || [];
      const _selectsAtual = _selectsRaw.filter((s) => !s.temp);
      if (_selectsRaw.length !== _selectsAtual.length) {
        db.set("embedprincipal.selects", _selectsAtual);
      }
      const adicionar = new ButtonBuilder()
        .setCustomId("select_adicionar")
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(_selectsAtual.length >= 10);

      const remover = new ButtonBuilder()
        .setCustomId("select_remover")
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("select_editar")
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(
        adicionar,
        remover,
        editar,
        voltar,
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_config_select_titulo", interaction.guildId),
            ),
            new TextDisplayBuilder().setContent(
              t("visual_config_select_desc", interaction.guildId),
            ),
          )
          .addActionRowComponents(row),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "botao_remover") {
      const db = getPersonalizacaoDB(interaction.guild.id);
      const botoes = db.get("embedprincipal.botoes") || [];

      if (botoes.length === 0) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_nenhum_botao_remover", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("remover_botao_select")
        .setPlaceholder(t("visual_placeholder_botao_remover", interaction.guildId))
        .addOptions(
          botoes.map((botao) => ({
            label: botao.nome || t("visual_sem_nome", interaction.guildId),
            value: botao.id,
            description: `ID: ${botao.id}`,
            emoji: botao.emoji || undefined,
          })),
        );

      const voltar = new ButtonBuilder()
        .setCustomId("configurar_botao")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
      const rowVoltar = new ActionRowBuilder().addComponents(voltar);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_selecione_botao_remover", interaction.guildId),
            ),
          )
          .addActionRowComponents(rowSelect, rowVoltar),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "remover_botao_select"
    ) {
      const db = getPersonalizacaoDB(interaction.guild.id);
      const botoes = db.get("embedprincipal.botoes") || [];
      const botaoIdParaRemover = interaction.values[0];

      const index = botoes.findIndex((b) => b.id === botaoIdParaRemover);

      if (index === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_botao_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const botaoRemovido = botoes[index];
      botoes.splice(index, 1);
      db.set("embedprincipal.botoes", botoes);

      const adicionar = new ButtonBuilder()
        .setCustomId("botao_adicionar")
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("botao_editar")
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(
        adicionar,
        remover,
        editar,
        voltar,
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_config_botao_titulo", interaction.guildId),
            ),
            new TextDisplayBuilder().setContent(
              t("visual_botao_removido", interaction.guildId, { nome: botaoRemovido.nome }),
            ),
          )
          .addActionRowComponents(row),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "select_remover") {
      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];

      if (selects.length === 0) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_nenhum_select_remover", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("remover_select_select")
        .setPlaceholder(t("visual_placeholder_select_remover", interaction.guildId))
        .addOptions(
          selects.map((select) => ({
            label: select.nome || t("visual_sem_nome", interaction.guildId),
            value: select.id,
            description: `ID: ${select.id}`,
            emoji: select.selectoptions || undefined,
          })),
        );

      const voltarButton = new ButtonBuilder()
        .setCustomId("configurar_select")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmoji(emojis.arrowl));

      const row1 = new ActionRowBuilder().addComponents(selectMenu);
      const row2 = new ActionRowBuilder().addComponents(voltarButton);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_selecione_select_remover", interaction.guildId),
            ),
          )
          .addActionRowComponents(row1, row2),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (interaction.customId === "remover_select_select") {
      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];
      const selectIdParaRemover = interaction.values[0];

      const index = selects.findIndex((s) => s.id === selectIdParaRemover);
      if (index === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_nenhum_select_encontrado", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      selects.splice(index, 1);
      db.set("embedprincipal.selects", selects);

      const adicionar = new ButtonBuilder()
        .setCustomId("select_adicionar")
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(selects.length >= 10);

      const remover = new ButtonBuilder()
        .setCustomId("select_remover")
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("select_editar")
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(
        adicionar,
        remover,
        editar,
        voltar,
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_config_select_titulo", interaction.guildId),
            ),
            new TextDisplayBuilder().setContent(
              t("visual_config_select_desc", interaction.guildId),
            ),
          )
          .addActionRowComponents(row),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "botao_editar") {
      const db = getPersonalizacaoDB(interaction.guild.id);
      const botoes = db.get("embedprincipal.botoes") || [];

      if (botoes.length === 0) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_nenhum_botao_editar", interaction.guildId),
            ),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const { sections, btnAnterior, btnProximo, totalPaginas } =
        criarPaginacaoBotoes(botoes, 0);

      const adicionar = new ButtonBuilder()
        .setCustomId("botao_adicionar")
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_editar_botoes_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(
              t("visual_editar_botoes_pagina", interaction.guildId, { pagina: 1, total: totalPaginas }),
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addSectionComponents(...sections)
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAnterior, btnProximo),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(adicionar, remover, voltar),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const criarEmbedESelectDeBotao = (botao, emojis, getEmoji) => {
      const editarCamposSelect = new StringSelectMenuBuilder()
        .setCustomId(`editar_campo_botao_${botao.id}`)
        .setPlaceholder(t("visual_editar_botao_placeholder", interaction.guildId))
        .addOptions([
          {
            label: t("btn_voltar", interaction.guildId),
            value: "voltar_botao",
            emoji: getEmoji(emojis.arrowl),
          },
          { label: t("visual_campo_nome", interaction.guildId), value: "nome", emoji: getEmoji(emojis.title) },
          {
            label: t("visual_campo_categoria", interaction.guildId),
            value: "categoria",
            emoji: getEmoji(emojis.folder),
          },
          { label: t("visual_campo_emoji", interaction.guildId), value: "emoji", emoji: getEmoji(emojis.boost1) },
          {
            label: t("visual_campo_inicio", interaction.guildId),
            value: "inicio",
            emoji: getEmoji(emojis.home),
          },
          { label: t("visual_campo_cor", interaction.guildId), value: "cor", emoji: getEmoji(emojis.colorpicker) },
        ]);

      const row = new ActionRowBuilder().addComponents(editarCamposSelect);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_editar_botao_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(
              `${t("visual_editar_botao_desc", interaction.guildId)}\n\n**ID:** \`${botao.id}\``,
            ),
            new TextDisplayBuilder().setContent(
              `**${t("visual_campo_nome", interaction.guildId)}:** ${botao.nome || t("visual_nao_definido", interaction.guildId)}`,
            ),
            new TextDisplayBuilder().setContent(
              `**${t("visual_campo_categoria", interaction.guildId)}:** ${
                botao.categoria
                  ? botao.categoria
                      .split(",")
                      .map((id) => `<#${id}>`)
                      .join(" ")
                  : t("visual_nao_definida", interaction.guildId)
              }`,
            ),
            new TextDisplayBuilder().setContent(
              `**${t("visual_campo_emoji", interaction.guildId)}:** ${botao.emoji || t("visual_nao_definido", interaction.guildId)}`,
            ),
            new TextDisplayBuilder().setContent(
              `**${t("visual_campo_inicio", interaction.guildId)}:** ${botao.inicio || t("visual_nao_definido", interaction.guildId)}`,
            ),
            new TextDisplayBuilder().setContent(
              `**${t("visual_campo_cor", interaction.guildId)}:** ${botao.cor || t("visual_nao_definida", interaction.guildId)}`,
            ),
          )
          .addActionRowComponents(row),
      ];

      return { components };
    };

    if (interaction.customId === "editar_botao_select_botao_") {
      const db = getPersonalizacaoDB(interaction.guild.id);
      const selectedId = interaction.values[0];
      const botoes = db.get("embedprincipal.botoes") || [];
      const botao = botoes.find((b) => b.id === selectedId);

      if (!botao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_botao_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const { components } = criarEmbedESelectDeBotao(botao, emojis, getEmoji);

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.customId &&
      interaction.customId.startsWith("editar_campo_botao_")
    ) {
      const botaoId = interaction.customId.slice("editar_campo_botao_".length);
      const campoSelecionado = interaction.values[0];
      const db = getPersonalizacaoDB(interaction.guild.id);

      const botoes = db.get("embedprincipal.botoes") || [];
      const botao = botoes.find((b) => b.id === botaoId);

      if (!botao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_botao_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (campoSelecionado === "voltar_botao") {
        const adicionar = new ButtonBuilder()
          .setCustomId("botao_adicionar")
          .setLabel(t("btn_adicionar", interaction.guildId))
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(botoes.length >= 5);

        const remover = new ButtonBuilder()
          .setCustomId("botao_remover")
          .setLabel(t("btn_remover", interaction.guildId))
          .setEmoji(getEmoji(emojis.minus))
          .setStyle(ButtonStyle.Secondary);

        const editar = new ButtonBuilder()
          .setCustomId("botao_editar")
          .setLabel(t("btn_editar", interaction.guildId))
          .setEmoji(getEmoji(emojis.title))
          .setStyle(ButtonStyle.Secondary);

        const voltar = new ButtonBuilder()
          .setCustomId("sistema_ticket")
          .setLabel(t("btn_voltar", interaction.guildId))
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(
          adicionar,
          remover,
          editar,
          voltar,
        );

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t("visual_config_botao_titulo", interaction.guildId),
              ),
              new TextDisplayBuilder().setContent(
                t("visual_config_botao_desc", interaction.guildId),
              ),
            )
            .addActionRowComponents(row),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      }

      if (campoSelecionado === "nome") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_editar_nome_botao_${botaoId}`)
          .setTitle(t("visual_modal_nome_botao_titulo", interaction.guildId));

        const input = new TextInputBuilder()
          .setCustomId("novo_nome")
          .setLabel(t("visual_modal_nome_botao_label", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(botao.nome || "");

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        return interaction.showModal(modal);
      } else if (campoSelecionado === "categoria") {
        const categoriasSalvas = botao.categoria
          ? botao.categoria.split(",")
          : [];

        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`select_categoria_botao_${botao.id}`)
            .setPlaceholder(t("visual_cat_placeholder", interaction.guildId))
            .setMinValues(1)
            .setMaxValues(5)
            .addChannelTypes(ChannelType.GuildCategory),
        );

        const categoriasTexto =
          categoriasSalvas.length > 0
            ? categoriasSalvas.map((id) => `<#${id}>`).join(", ")
            : t("visual_cat_nenhuma", interaction.guildId);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${getEmoji(emojis.folder)} ${t("visual_cat_titulo", interaction.guildId)}`,
              ),
              new TextDisplayBuilder().setContent(
                t("visual_cat_atuais", interaction.guildId, { cats: categoriasTexto }),
              ),
            )
            .addActionRowComponents(row),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      } else if (campoSelecionado === "emoji") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_editar_emoji_botao_${botao.id}`)
          .setTitle(t("visual_modal_emoji_botao_titulo", interaction.guildId));

        const input = new TextInputBuilder()
          .setCustomId("novo_emoji")
          .setLabel(t("visual_modal_emoji_botao_label", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(botao.emoji || "");

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        return interaction.showModal(modal);
      } else if (campoSelecionado === "inicio") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_editar_inicio_botao_${botao.id}`)
          .setTitle(t("visual_modal_inicio_botao_titulo", interaction.guildId));

        const input = new TextInputBuilder()
          .setCustomId("novo_inicio")
          .setLabel(t("visual_modal_inicio_botao_label", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setRequired(false)
          .setValue(botao.inicio || "");

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        return interaction.showModal(modal);
      } else if (campoSelecionado === "cor") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`cor_azul_${botao.id}`)
            .setLabel(t("visual_cor_azul", interaction.guildId))
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId(`cor_cinza_${botao.id}`)
            .setLabel(t("visual_cor_cinza", interaction.guildId))
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId(`cor_vermelho_${botao.id}`)
            .setLabel(t("visual_cor_vermelho", interaction.guildId))
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId(`cor_verde_${botao.id}`)
            .setLabel(t("visual_cor_verde", interaction.guildId))
            .setStyle(ButtonStyle.Success),
        );

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${getEmoji(emojis.colorpicker)} ${t("visual_cor_titulo", interaction.guildId)}`,
              ),
            )
            .addActionRowComponents(row),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      }
    }

    if (
      interaction.isButton() &&
      interaction.customId === "enviar_ticket_painel"
    ) {
      const db = getPersonalizacaoDB(interaction.guildId);
      const embedData = db.get("embedprincipal");

      if (!embedData) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_nenhum_dado", interaction.guildId),
            ),
          ),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const botoes = embedData.botoes || [];
      const selects = embedData.selects || [];

      if (botoes.length === 0 && selects.length === 0) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_precisa_config", interaction.guildId),
            ),
          ),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const selectTipo = new StringSelectMenuBuilder()
        .setCustomId("enviar_ticket_tipo")
        .setPlaceholder(t("enviar_escolha_tipo", interaction.guildId));

      const opcoes = [];

      if (botoes.length > 0) {
        opcoes.push({
          label: t("enviar_tipo_botoes", interaction.guildId),
          value: "botao",
          description: t("enviar_tipo_botoes_desc", interaction.guildId, { count: botoes.length }),
          emoji: getEmoji(emojis.cube),
        });
      }

      if (selects.length > 0) {
        opcoes.push({
          label: t("enviar_tipo_select", interaction.guildId),
          value: "select",
          description: t("enviar_tipo_select_desc", interaction.guildId, { count: selects.length }),
          emoji: getEmoji(emojis.cube),
        });
      }

      selectTipo.addOptions(opcoes);

      const voltarBtn = new ButtonBuilder()
        .setCustomId("voltar_inicio")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("enviar_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(t("enviar_desc", interaction.guildId)),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectTipo),
            new ActionRowBuilder().addComponents(voltarBtn),
          ),
      ];

      await interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("config_botao_")
    ) {
      const parts = interaction.customId.split("_");
      const campo = parts[2];
      const botaoId = parts[3];
      const db = getPersonalizacaoDB(interaction.guild.id);

      if (campo === "nome") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_config_botao_nome_${botaoId}`)
          .setTitle(t("visual_modal_nome_btn_titulo", interaction.guildId));

        const input = new TextInputBuilder()
          .setCustomId("nome")
          .setLabel(t("visual_modal_nome_btn_label", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "categoria") {
        const selectCategoria = new ChannelSelectMenuBuilder()
          .setCustomId(`select_config_botao_categoria_${botaoId}`)
          .setPlaceholder(t("visual_cat_placeholder", interaction.guildId))
          .setMinValues(1)
          .setMaxValues(5)
          .addChannelTypes(ChannelType.GuildCategory);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(t("visual_cat_tickets_titulo", interaction.guildId)),
              new TextDisplayBuilder().setContent(
                t("visual_cat_tickets_desc", interaction.guildId),
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(selectCategoria),
            ),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (campo === "emoji") {
        const components = criarPainelEscolhaEmoji(
          interaction,
          "botao",
          botaoId,
          0,
        );
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (campo === "inicio") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_config_botao_inicio_${botaoId}`)
          .setTitle(t("visual_modal_inicio_btn_titulo", interaction.guildId));

        const input = new TextInputBuilder()
          .setCustomId("inicio")
          .setLabel(t("visual_modal_inicio_btn_label", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(5)
          .setPlaceholder(t("visual_inicio_placeholder", interaction.guildId));

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "cor") {
        const cor = parts[4];
        const botoes = db.get("embedprincipal.botoes") || [];
        const index = botoes.findIndex((b) => b.id === botaoId);

        if (index !== -1) {
          botoes[index].cor = cor;
          db.set("embedprincipal.botoes", botoes);
        }

        const components = criarPainelConfiguracaoBotao(botaoId, db);
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (campo === "salvar") {
        const botoes = db.get("embedprincipal.botoes") || [];
        const botao = botoes.find((b) => b.id === botaoId);

        if (!botao || !botao.nome || !botao.categoria) {
          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t("visual_salvar_preencha", interaction.guildId),
              ),
            ),
          ];
          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }

        const index = botoes.findIndex((b) => b.id === botaoId);
        if (index !== -1) {
          delete botoes[index].temp;
          db.set("embedprincipal.botoes", botoes);
        }

        const adicionar = new ButtonBuilder()
          .setCustomId("botao_adicionar")
          .setLabel(t("btn_adicionar", interaction.guildId))
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(botoes.length >= 5);

        const remover = new ButtonBuilder()
          .setCustomId("botao_remover")
          .setLabel(t("btn_remover", interaction.guildId))
          .setEmoji(getEmoji(emojis.minus))
          .setStyle(ButtonStyle.Secondary);

        const editar = new ButtonBuilder()
          .setCustomId("botao_editar")
          .setLabel(t("btn_editar", interaction.guildId))
          .setEmoji(getEmoji(emojis.title))
          .setStyle(ButtonStyle.Secondary);

        const voltar = new ButtonBuilder()
          .setCustomId("sistema_ticket")
          .setLabel(t("btn_voltar", interaction.guildId))
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t("visual_config_botao_titulo", interaction.guildId),
              ),
              new TextDisplayBuilder().setContent(
                t("visual_botao_salvo", interaction.guildId, { nome: botao.nome }),
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                adicionar,
                remover,
                editar,
                voltar,
              ),
            ),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("emoji_escolher_")
    ) {
      const parts = interaction.customId.split("_");
      const tipo = parts[2];
      const itemId = parts[3];
      const emojiId = interaction.values[0];
      const db = getPersonalizacaoDB(interaction.guild.id);

      const emoji = interaction.guild.emojis.cache.get(emojiId);

      if (!emoji) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_botao_nao_encontrado", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (tipo === "botao") {
        const botoes = db.get("embedprincipal.botoes") || [];
        const index = botoes.findIndex((b) => b.id === itemId);
        if (index !== -1) {
          botoes[index].emoji = `<${emoji.animated ? "a" : ""}:${emoji.name}:${
            emoji.id
          }>`;
          db.set("embedprincipal.botoes", botoes);
        }
        const components = criarPainelConfiguracaoBotao(itemId, db);
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } else {
        const selects = db.get("embedprincipal.selects") || [];
        const index = selects.findIndex((s) => s.id === itemId);
        if (index !== -1) {
          selects[index].emoji = `<${emoji.animated ? "a" : ""}:${emoji.name}:${
            emoji.id
          }>`;
          db.set("embedprincipal.selects", selects);
        }
        const components = criarPainelConfiguracaoSelect(itemId, db);
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith("emoji_")) {
      const parts = interaction.customId.split("_");
      const acao = parts[1];
      const tipo = parts[2];
      const itemId = parts[3];
      const db = getPersonalizacaoDB(interaction.guild.id);

      if (acao === "escolher") {
        const emojiId = interaction.isStringSelectMenu()
          ? interaction.values[0]
          : parts[4];
        const emoji = interaction.guild.emojis.cache.get(emojiId);

        if (tipo === "botao") {
          const botoes = db.get("embedprincipal.botoes") || [];
          const index = botoes.findIndex((b) => b.id === itemId);
          if (index !== -1) {
            botoes[index].emoji = `<${emoji.animated ? "a" : ""}:${
              emoji.name
            }:${emoji.id}>`;
            db.set("embedprincipal.botoes", botoes);
          }
          const components = criarPainelConfiguracaoBotao(itemId, db);
          return interaction.update({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        } else {
          const selects = db.get("embedprincipal.selects") || [];
          const index = selects.findIndex((s) => s.id === itemId);
          if (index !== -1) {
            selects[index].emoji = `<${emoji.animated ? "a" : ""}:${
              emoji.name
            }:${emoji.id}>`;
            db.set("embedprincipal.selects", selects);
          }
          const components = criarPainelConfiguracaoSelect(itemId, db);
          return interaction.update({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }

      if (acao === "manual") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_emoji_manual_${tipo}_${itemId}`)
          .setTitle(t("visual_modal_emoji_manual_titulo", interaction.guildId));

        const input = new TextInputBuilder()
          .setCustomId("emoji")
          .setLabel(t("visual_modal_emoji_manual_label", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder(t("visual_modal_emoji_manual_placeholder", interaction.guildId));

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (acao === "pagina") {
        const pagina = parseInt(parts[4]);
        const components = criarPainelEscolhaEmoji(
          interaction,
          tipo,
          itemId,
          pagina,
        );
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (acao === "voltar") {
        if (tipo === "botao") {
          const components = criarPainelConfiguracaoBotao(itemId, db);
          return interaction.update({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        } else {
          const components = criarPainelConfiguracaoSelect(itemId, db);
          return interaction.update({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("config_select_")
    ) {
      const parts = interaction.customId.split("_");
      const campo = parts[2];
      const selectId = parts[3];
      const db = getPersonalizacaoDB(interaction.guild.id);

      if (campo === "nome") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_config_select_nome_${selectId}`)
          .setTitle(t("visual_modal_nome_select_titulo", interaction.guildId));

        const input = new TextInputBuilder()
          .setCustomId("nome")
          .setLabel(t("visual_modal_nome_select_label", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "categoria") {
        const selectCategoria = new ChannelSelectMenuBuilder()
          .setCustomId(`select_config_select_categoria_${selectId}`)
          .setPlaceholder(t("visual_cat_placeholder", interaction.guildId))
          .setMinValues(1)
          .setMaxValues(5)
          .addChannelTypes(ChannelType.GuildCategory);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(t("visual_cat_tickets_titulo", interaction.guildId)),
              new TextDisplayBuilder().setContent(
                t("visual_cat_tickets_desc", interaction.guildId),
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(selectCategoria),
            ),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (campo === "emoji") {
        const components = criarPainelEscolhaEmoji(
          interaction,
          "select",
          selectId,
          0,
        );
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (campo === "inicio") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_config_select_inicio_${selectId}`)
          .setTitle(t("visual_modal_inicio_btn_titulo", interaction.guildId));

        const input = new TextInputBuilder()
          .setCustomId("inicio")
          .setLabel(t("visual_modal_inicio_btn_label", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(5)
          .setPlaceholder(t("visual_inicio_placeholder", interaction.guildId));

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "salvar") {
        const selects = db.get("embedprincipal.selects") || [];
        const select = selects.find((s) => s.id === selectId);

        if (!select || !select.nome || !select.categoria) {
          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t("visual_salvar_preencha", interaction.guildId),
              ),
            ),
          ];
          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }

        const index = selects.findIndex((s) => s.id === selectId);
        if (index !== -1) {
          delete selects[index].temp;
          db.set("embedprincipal.selects", selects);
        }

        const adicionar = new ButtonBuilder()
          .setCustomId("select_adicionar")
          .setLabel(t("btn_adicionar", interaction.guildId))
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(selects.length >= 10);

        const remover = new ButtonBuilder()
          .setCustomId("select_remover")
          .setLabel(t("btn_remover", interaction.guildId))
          .setEmoji(getEmoji(emojis.minus))
          .setStyle(ButtonStyle.Secondary);

        const editar = new ButtonBuilder()
          .setCustomId("select_editar")
          .setLabel(t("btn_editar", interaction.guildId))
          .setEmoji(getEmoji(emojis.title))
          .setStyle(ButtonStyle.Secondary);

        const voltar = new ButtonBuilder()
          .setCustomId("sistema_ticket")
          .setLabel(t("btn_voltar", interaction.guildId))
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t("visual_config_select_titulo", interaction.guildId),
              ),
              new TextDisplayBuilder().setContent(
                t("visual_select_salvo", interaction.guildId, { nome: select.nome }),
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                adicionar,
                remover,
                editar,
                voltar,
              ),
            ),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("config_select_descricao_")
    ) {
      console.log("=== BOTAO DESCRICAO CLICADO ===");

      const selectId = interaction.customId.replace(
        "config_select_descricao_",
        "",
      );
      console.log("SelectId:", selectId);

      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];
      const select = selects.find((s) => s.id === selectId);

      console.log("Select encontrado:", select);

      const modal = new ModalBuilder()
        .setCustomId(`modal_config_select_descricao_${selectId}`)
        .setTitle(t("visual_modal_descricao_titulo", interaction.guildId));

      const input = new TextInputBuilder()
        .setCustomId("descricao")
        .setLabel(t("visual_modal_descricao_label", interaction.guildId))
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100)
        .setPlaceholder(t("visual_modal_descricao_placeholder", interaction.guildId))
        .setValue(select?.descricao || "");

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (
      interaction.isButton() &&
      interaction.customId === "atualizar_painel_embed_principal"
    ) {
      await interaction.deferUpdate();

      const db = getPersonalizacaoDB(interaction.guildId);
      const embedData = db.get("embedprincipal");
      const messageId = embedData.messageId;
      const channelId = embedData.channelId;

      if (!messageId || !channelId) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_nenhum_painel", interaction.guildId),
            ),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const canal = interaction.guild.channels.cache.get(channelId);
      if (!canal) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_canal_painel", interaction.guildId)),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      try {
        const mensagem = await canal.messages.fetch(messageId);

        const botoes = embedData.botoes || [];
        const selects = embedData.selects || [];

        const temBotoes = botoes.length > 0;
        const temSelects = selects.length > 0;

        const containerTicket = new ContainerBuilder();
        const accentColor = parseColor(embedData.color);
        if (accentColor !== null) {
          containerTicket.setAccentColor(accentColor);
        }

        containerTicket.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${embedData.title || "Painel de Tickets"}**`,
          ),
        );

        if (embedData.descricao) {
          containerTicket.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(embedData.descricao),
          );
        }

        if (
          embedData.banner &&
          typeof embedData.banner === "string" &&
          embedData.banner.startsWith("http")
        ) {
          containerTicket.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
              new MediaGalleryItemBuilder().setURL(embedData.banner),
            ),
          );
        }

        containerTicket.addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
        );

        const componentesAtuais = mensagem.components;
        const tinhaSelectMenu = componentesAtuais.some((row) =>
          row.components.some((comp) => comp.type === 3),
        );

        if (tinhaSelectMenu && temSelects) {
          const options = selects.map((sel) => ({
            label: sel.nome || t("painel_default_select_nome", interaction.guildId),
            value: `select_${sel.id}`,
            description:
              sel.descricao ||
              t("painel_default_select_desc", interaction.guildId, { nome: sel.nome || t("painel_default_select_nome", interaction.guildId) }),
            emoji: parseEmoji(sel.emoji, interaction.guild) || undefined,
          }));

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder(t("painel_select_placeholder", interaction.guildId))
            .addOptions(options);

          containerTicket.addActionRowComponents(
            new ActionRowBuilder().addComponents(selectMenu),
          );
        } else if (!tinhaSelectMenu && temBotoes) {
          const botoesFormatados = botoes.map((botao) => {
            const button = new ButtonBuilder()
              .setCustomId(`ticket_botoes_${botao.id}`)
              .setLabel(botao.nome || t("painel_default_botao", interaction.guildId))
              .setStyle(getButtonStyle(botao.cor));
            if (botao.emoji) {
              const parsedEmoji = parseEmoji(botao.emoji, interaction.guild);
              if (parsedEmoji) button.setEmoji(parsedEmoji);
            }
            return button;
          });

          for (let i = 0; i < botoesFormatados.length; i += 5) {
            containerTicket.addActionRowComponents(
              new ActionRowBuilder().addComponents(
                botoesFormatados.slice(i, i + 5),
              ),
            );
          }
        }

        await mensagem.edit({
          components: [containerTicket],
          flags: MessageFlags.IsComponentsV2,
        });

        await atualizarMensagemPainel(interaction, "embedprincipal", db, true);
      } catch (error) {
        console.error(error);
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_atualizar_painel", interaction.guildId),
            ),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    function getButtonStyle(cor) {
      if (!cor) return ButtonStyle.Primary;
      const styleKey = cor.toUpperCase();
      const map = {
        PRIMARY: ButtonStyle.Primary,
        SECONDARY: ButtonStyle.Secondary,
        SUCCESS: ButtonStyle.Success,
        DANGER: ButtonStyle.Danger,
      };
      return map[styleKey] || ButtonStyle.Primary;
    }

    function parseColor(colorString) {
      if (!colorString || colorString === "" || colorString === " ")
        return undefined;
      if (typeof colorString === "number") return colorString;
      const cleanColor = colorString.replace("#", "");
      const colorInt = parseInt(cleanColor, 16);
      return !isNaN(colorInt) ? colorInt : null;
    }

    function parseEmoji(emojiString, guild) {
      if (!emojiString) return undefined;
      if (/^[\u{1F000}-\u{1FFFF}]+$/u.test(emojiString)) return emojiString;
      const match = emojiString.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
      if (match) return match[0];
      const cleanName = emojiString.replace(/:/g, "");
      const foundEmoji = guild.emojis.cache.find((e) => e.name === cleanName);
      if (foundEmoji) {
        return `<${foundEmoji.animated ? "a" : ""}:${foundEmoji.name}:${
          foundEmoji.id
        }>`;
      }
      return undefined;
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("cancelar_config_botao_")
    ) {
      const botaoId = interaction.customId.replace(
        "cancelar_config_botao_",
        "",
      );
      const db = getPersonalizacaoDB(interaction.guild.id);
      const botoes = db.get("embedprincipal.botoes") || [];

      const index = botoes.findIndex((b) => b.id === botaoId);
      if (index !== -1 && botoes[index].temp === true) {
        botoes.splice(index, 1);
        db.set("embedprincipal.botoes", botoes);
      }

      const adicionar = new ButtonBuilder()
        .setCustomId("botao_adicionar")
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("botao_editar")
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_config_botao_titulo", interaction.guildId),
            ),
            new TextDisplayBuilder().setContent(
              t("visual_config_botao_desc", interaction.guildId),
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              adicionar,
              remover,
              editar,
              voltar,
            ),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("cancelar_config_select_")
    ) {
      const selectId = interaction.customId.replace(
        "cancelar_config_select_",
        "",
      );
      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];

      const index = selects.findIndex((s) => s.id === selectId);
      if (index !== -1 && selects[index].temp === true) {
        selects.splice(index, 1);
        db.set("embedprincipal.selects", selects);
      }

      const adicionar = new ButtonBuilder()
        .setCustomId("select_adicionar")
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(selects.length >= 10);

      const remover = new ButtonBuilder()
        .setCustomId("select_remover")
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("select_editar")
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_config_select_titulo", interaction.guildId),
            ),
            new TextDisplayBuilder().setContent(
              t("visual_config_select_desc", interaction.guildId),
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              adicionar,
              remover,
              editar,
              voltar,
            ),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("editar_") &&
      !interaction.customId.startsWith("editar_estacao_") &&
      !interaction.customId.startsWith("editar_botao_") &&
      !interaction.customId.startsWith("editar_select_") &&
      !interaction.customId.startsWith("editar_embed_") &&
      !interaction.customId.startsWith("editar_campo_")
    ) {
      const dia = interaction.customId.replace("editar_", "");

      const diasValidos = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];

      if (!diasValidos.includes(dia)) {
        return;
      }

      const db = getConfigDB(interaction.guildId);
      const schedule = db.get("schedule") || {};
      const horarioAtual = schedule[dia];

      const diasSemana = {
        monday: t("horario_segunda", interaction.guildId),
        tuesday: t("horario_terca", interaction.guildId),
        wednesday: t("horario_quarta", interaction.guildId),
        thursday: t("horario_quinta", interaction.guildId),
        friday: t("horario_sexta", interaction.guildId),
        saturday: t("horario_sabado", interaction.guildId),
        sunday: t("horario_domingo", interaction.guildId),
      };

      const modal = new ModalBuilder()
        .setCustomId(`modal_horario_${dia}`)
        .setTitle(t("horario_modal_titulo", interaction.guildId, { dia: diasSemana[dia] }));

      const startInput = new TextInputBuilder()
        .setCustomId("horario_start")
        .setLabel(t("horario_input_inicio_label", interaction.guildId))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(t("horario_input_inicio_placeholder", interaction.guildId))
        .setRequired(false)
        .setValue(horarioAtual?.start || "");

      const endInput = new TextInputBuilder()
        .setCustomId("horario_end")
        .setLabel(t("horario_input_fim_label", interaction.guildId))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(t("horario_input_fim_placeholder", interaction.guildId))
        .setRequired(false)
        .setValue(horarioAtual?.end || "");

      const row1 = new ActionRowBuilder().addComponents(startInput);
      const row2 = new ActionRowBuilder().addComponents(endInput);

      modal.addComponents(row1, row2);

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isButton() && customId.startsWith("botoes_pagina_")) {
      const pagina = parseInt(customId.split("_").pop());
      const db = getPersonalizacaoDB(interaction.guild.id);
      const botoes = db.get("embedprincipal.botoes") || [];

      const { sections, btnAnterior, btnProximo, totalPaginas } =
        criarPaginacaoBotoes(botoes, pagina);

      const adicionar = new ButtonBuilder()
        .setCustomId("botao_adicionar")
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_editar_botoes_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(
              t("visual_editar_botoes_pagina", interaction.guildId, { pagina: pagina + 1, total: totalPaginas }),
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addSectionComponents(...sections)
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAnterior, btnProximo),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(adicionar, remover, voltar),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isButton() &&
      customId.startsWith("editar_botao_paginado_")
    ) {
      const botaoId = customId.replace("editar_botao_paginado_", "");
      const db = getPersonalizacaoDB(interaction.guild.id);
      const botoes = db.get("embedprincipal.botoes") || [];
      const botao = botoes.find((b) => b.id === botaoId);

      if (!botao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_botao_nao_encontrado", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const components = criarPainelConfiguracaoBotao(botaoId, db);
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("salvar_edicao_botao:")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const [_, embedKey, botaoId] = interaction.customId.split(":");
      const guildId = interaction.guildId;
      const db = getPersonalizacaoDB(guildId);

      const texto = interaction.fields.getTextInputValue("texto_botao");
      let emoji = interaction.fields.getTextInputValue("emoji_botao") || null;

      const botoes = db.get(`${embedKey}.botoes`) || [];
      const index = botoes.findIndex((b) => b.id === botaoId);

      if (index === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_botao_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (emoji) {
        const parsed = parseEmoji(emoji, interaction.guild);

        if (parsed.id) {
          emoji = `<${parsed.animated ? "a" : ""}:${parsed.name}:${parsed.id}>`;
        } else {
          const unicodeRegex = /\p{Extended_Pictographic}/u;
          if (!unicodeRegex.test(parsed.name)) {
            const components = [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("visual_err_emoji_invalido", interaction.guildId),
                ),
              ),
            ];

            return interaction.reply({
              components,
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          }
          emoji = parsed.name;
        }
      }

      botoes[index].nome = texto;
      botoes[index].label = texto;
      botoes[index].emoji = emoji;

      const botoesLink = ["ver_transcript", "ir_ao_ticket"];
      const isLinkButton =
        botoes[index].style === "Link" || botoesLink.includes(botaoId);

      if (!isLinkButton) {
        const corDigitada = interaction.fields
          .getTextInputValue("cor_botao")
          .trim()
          .toLowerCase();

        const mapaCores = {
          vermelho: "Danger",
          azul: "Primary",
          cinza: "Secondary",
          verde: "Success",
        };

        if (!mapaCores[corDigitada]) {
          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t("visual_err_cor_invalida_digitar", interaction.guildId),
              ),
            ),
          ];

          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }

        botoes[index].cor = mapaCores[corDigitada];
      }

      db.set(`${embedKey}.botoes`, botoes);

      await atualizarMensagemPainel(interaction, embedKey, db);
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_editar_nome_botao_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const botaoId = interaction.customId.replace(
        "modal_editar_nome_botao_",
        "",
      );
      const novoNome = interaction.fields.getTextInputValue("novo_nome");
      const db = getPersonalizacaoDB(interaction.guild.id);

      const botoes = db.get("embedprincipal.botoes") || [];
      const botaoIndex = botoes.findIndex((b) => b.id === botaoId);

      if (botaoIndex === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_botao_nao_encontrado_update", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      botoes[botaoIndex].nome = novoNome;
      db.set("embedprincipal.botoes", botoes);
      const botao = botoes[botaoIndex];

      const { components } = criarEmbedESelectDeBotao(botao, emojis, getEmoji);

      await interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_editar_emoji_botao_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const botaoId = interaction.customId.split(
        "modal_editar_emoji_botao_",
      )[1];
      let novoEmoji = interaction.fields.getTextInputValue("novo_emoji").trim();
      const db = getPersonalizacaoDB(interaction.guild.id);

      const botoes = db.get("embedprincipal.botoes") || [];
      const botaoIndex = botoes.findIndex((b) => b.id === botaoId);
      if (botaoIndex === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_botao_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (novoEmoji) {
        const parsed = parseEmoji(novoEmoji, interaction.guild);

        if (parsed.id) {
          novoEmoji = `<${parsed.animated ? "a" : ""}:${parsed.name}:${
            parsed.id
          }>`;
        } else {
          const unicodeRegex = /\p{Extended_Pictographic}/u;
          if (!unicodeRegex.test(parsed.name)) {
            const components = [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("visual_err_emoji_invalido", interaction.guildId),
                ),
              ),
            ];

            return interaction.reply({
              components,
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          }
          novoEmoji = parsed.name;
        }
      } else {
        novoEmoji = null;
      }

      botoes[botaoIndex].emoji = novoEmoji;
      db.set("embedprincipal.botoes", botoes);

      const botao = botoes[botaoIndex];
      const { components } = criarEmbedESelectDeBotao(botao, emojis, getEmoji);

      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_editar_inicio_botao_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const botaoId = interaction.customId.split(
        "modal_editar_inicio_botao_",
      )[1];
      const novoInicio = interaction.fields
        .getTextInputValue("novo_inicio")
        .trim();
      const db = getPersonalizacaoDB(interaction.guild.id);

      const botoes = db.get("embedprincipal.botoes") || [];
      const botaoIndex = botoes.findIndex((b) => b.id === botaoId);
      if (botaoIndex === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_botao_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (novoInicio.length > 5) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_max_caracteres", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      botoes[botaoIndex].inicio = novoInicio || "";
      db.set("embedprincipal.botoes", botoes);

      const botao = botoes[botaoIndex];

      const { components } = criarEmbedESelectDeBotao(botao, emojis, getEmoji);

      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    const criarEdicaoSelectComponentes = (selectObj, selectId) => {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`editar_campo_select_${selectId}`)
        .setPlaceholder(t("visual_editar_select_placeholder", interaction.guildId))
        .addOptions([
          {
            label: t("btn_voltar", interaction.guildId),
            value: "voltar",
            emoji: getEmoji(emojis.arrowl),
          },
          { label: t("visual_campo_nome", interaction.guildId), value: "nome", emoji: getEmoji(emojis.title) },
          {
            label: t("visual_campo_descricao", interaction.guildId),
            value: "descricao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_campo_categoria", interaction.guildId),
            value: "categoria",
            emoji: getEmoji(emojis.folder),
          },
          { label: t("visual_campo_emoji", interaction.guildId), value: "emoji", emoji: getEmoji(emojis.boost1) },
          {
            label: t("visual_campo_inicio", interaction.guildId),
            value: "inicio",
            emoji: getEmoji(emojis.home),
          },
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_editar_select_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(
              t("visual_editar_select_desc", interaction.guildId),
            ),
            new TextDisplayBuilder().setContent(
              `**${t("visual_campo_nome", interaction.guildId)}**: ${selectObj.nome || t("visual_nao_definido", interaction.guildId)}`,
            ),
            new TextDisplayBuilder().setContent(
              `**${t("visual_campo_descricao", interaction.guildId)}**: ${selectObj.descricao || t("visual_nao_definida", interaction.guildId)}`,
            ),
            new TextDisplayBuilder().setContent(
              `**${t("visual_campo_categoria", interaction.guildId)}**: ${
                selectObj.categoria
                  ? selectObj.categoria
                      .split(",")
                      .map((id) => `<#${id}>`)
                      .join(", ")
                  : t("visual_nao_definido", interaction.guildId)
              }`,
            ),
            new TextDisplayBuilder().setContent(
              `**${t("visual_campo_emoji", interaction.guildId)}**: ${selectObj.emoji || t("visual_nao_definido", interaction.guildId)}`,
            ),
            new TextDisplayBuilder().setContent(
              `**${t("visual_campo_inicio", interaction.guildId)}**: ${selectObj.inicio || t("visual_nao_definido", interaction.guildId)}`,
            ),
          )
          .addActionRowComponents(row),
      ];

      return { components };
    };

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_editar_nome_select_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const selectId = interaction.customId.split(
        "modal_editar_nome_select_",
      )[1];
      const novoNome = interaction.fields.getTextInputValue("novo_nome");
      const db = getPersonalizacaoDB(interaction.guild.id);

      const selects = db.get("embedprincipal.selects") || [];
      const selectIndex = selects.findIndex((s) => s.id === selectId);

      if (selectIndex === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_select_nao_encontrado_update", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      selects[selectIndex].nome = novoNome;
      db.set("embedprincipal.selects", selects);

      const selectObj = selects[selectIndex];

      const { components } = criarEdicaoSelectComponentes(
        selectObj,
        selectObj.id,
      );

      await interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_editar_emoji_select_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const selectId = interaction.customId.split(
        "modal_editar_emoji_select_",
      )[1];
      let novoEmoji = interaction.fields.getTextInputValue("novo_emoji").trim();
      const db = getPersonalizacaoDB(interaction.guild.id);

      const selects = db.get("embedprincipal.selects") || [];
      const selectIndex = selects.findIndex((s) => s.id === selectId);

      if (selectIndex === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_select_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (novoEmoji) {
        const parsed = parseEmoji(novoEmoji, interaction.guild);

        if (parsed.id) {
          novoEmoji = `<${parsed.animated ? "a" : ""}:${parsed.name}:${
            parsed.id
          }>`;
        } else {
          const unicodeRegex = /\p{Extended_Pictographic}/u;
          if (!unicodeRegex.test(parsed.name)) {
            const components = [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("visual_err_emoji_invalido", interaction.guildId),
                ),
              ),
            ];

            return interaction.reply({
              components,
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          }
          novoEmoji = parsed.name;
        }
      } else {
        novoEmoji = null;
      }

      selects[selectIndex].emoji = novoEmoji;
      db.set("embedprincipal.selects", selects);

      const selectObj = selects[selectIndex];
      const { components } = criarEdicaoSelectComponentes(
        selectObj,
        selectObj.id,
      );

      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("salvar_edicao_info_embed:")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const [, embedSelecionada, campo] = interaction.customId.split(":");
      const guildId = interaction.guildId;
      const db = getPersonalizacaoDB(guildId);

      let novoValor = (interaction.fields.getTextInputValue("novo_valor") || "")
        .toString()
        .trim();

      if (campo === "titulo" || campo === "descricao") {
        const key = campo === "titulo" ? "title" : "descricao";
        let valorParaSalvar = novoValor !== "" ? novoValor : " ";

        valorParaSalvar = parseEmojisInText(valorParaSalvar, interaction.guild);

        db.set(`${embedSelecionada}.${key}`, valorParaSalvar);
      } else if (campo === "banner") {
        db.set(
          `${embedSelecionada}.banner`,
          novoValor !== "" ? novoValor : " ",
        );
      } else if (campo.startsWith("field_")) {
        const fieldIndex = parseInt(campo.split("_")[1], 10);
        if (isNaN(fieldIndex)) {
          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(t("visual_err_field_invalido", guildId)),
            ),
          ];

          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }

        const dados = db.get(embedSelecionada);
        if (!Array.isArray(dados.fields) || !dados.fields[fieldIndex]) {
          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(t("visual_err_field_nao_encontrado", interaction.guildId)),
            ),
          ];

          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }

        dados.fields[fieldIndex].value = novoValor !== "" ? novoValor : " ";
        db.set(`${embedSelecionada}.fields`, dados.fields);
      } else if (campo === "fields") {
        try {
          const parsed = JSON.parse(novoValor);
          if (!Array.isArray(parsed)) {
            const components = [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(t("visual_err_json_invalido", interaction.guildId)),
              ),
            ];

            return interaction.reply({
              components,
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          }
          db.set(`${embedSelecionada}.fields`, parsed);
        } catch (err) {
          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(t("visual_err_json_processo", interaction.guildId)),
            ),
          ];

          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }
      } else if (campo === "cor" || campo === "color") {
        if (novoValor === "" || novoValor.trim() === "") {
          db.delete(`${embedSelecionada}.color`);
        } else {
          let cor = novoValor.trim();
          if (!cor.startsWith("#")) cor = `#${cor}`;
          const hexColorRegex = /^#([0-9A-Fa-f]{6})$/;
          if (!hexColorRegex.test(cor)) {
            const components = [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("visual_err_cor_hex", interaction.guildId),
                ),
              ),
            ];

            return interaction.reply({
              components,
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          }
          db.set(`${embedSelecionada}.color`, cor);
        }
      } else {
        db.set(
          `${embedSelecionada}.${campo}`,
          novoValor !== "" ? novoValor : " ",
        );
      }

      await atualizarMensagemPainel(interaction, embedSelecionada, db, true);
    }

    function parseColor(colorString) {
      if (!colorString || colorString === "" || colorString === " ")
        return undefined;

      if (typeof colorString === "number") return colorString;

      const cleanColor = colorString.replace("#", "");
      const colorInt = parseInt(cleanColor, 16);

      return !isNaN(colorInt) ? colorInt : null;
    }

    async function atualizarMensagemPainel(
      interaction,
      embedSelecionada,
      db,
      jaFezDefer = false,
    ) {
      const data = db.get(embedSelecionada);
      if (!data) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_dados_nao_encontrados", interaction.guildId)),
          ),
        ];

        if (jaFezDefer) {
          return interaction.editReply({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        } else {
          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }
      }

      if (embedSelecionada === "embedprincipal") {
        const messageId = data.messageId;
        const channelId = data.channelId;

        if (messageId && channelId) {
          try {
            const canal = interaction.guild.channels.cache.get(channelId);
            if (canal) {
              const mensagem = await canal.messages.fetch(messageId);

              const botoes = data.botoes || [];
              const selects = data.selects || [];

              const temBotoes = botoes.length > 0;
              const temSelects = selects.length > 0;

              const componentesAtuais = mensagem.components;
              const tinhaSelectMenu = componentesAtuais.some((row) =>
                row.components.some((comp) => comp.type === 3),
              );

              const containerTicket = new ContainerBuilder();
              const accentColor = parseColor(data.color);
              if (accentColor !== null) {
                containerTicket.setAccentColor(accentColor);
              }

              containerTicket.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**${data.title || "Painel de Tickets"}**`,
                ),
              );

              if (data.descricao) {
                containerTicket.addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(data.descricao?.trim() || t("visual_sem_descricao", interaction.guildId)),
                );
              }

              if (
                data.banner &&
                typeof data.banner === "string" &&
                data.banner.startsWith("http")
              ) {
                containerTicket.addMediaGalleryComponents(
                  new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(data.banner),
                  ),
                );
              }

              containerTicket.addSeparatorComponents(
                new SeparatorBuilder()
                  .setDivider(true)
                  .setSpacing(SeparatorSpacingSize.Small),
              );

              if (tinhaSelectMenu && temSelects) {
                const options = selects.map((sel) => {
                  const option = {
                    label: sel.nome || t("painel_default_select_nome", interaction.guildId),
                    value: `select_${sel.id}`,
                  };

                  if (sel.descricao && sel.descricao.trim() !== "") {
                    option.description = sel.descricao;
                  } else {
                    option.description = `Abrir ticket para: ${
                      sel.nome || "Atendimento"
                    }`;
                  }

                  if (sel.emoji) {
                    const parsedEmoji = parseEmoji(
                      sel.emoji,
                      interaction.guild,
                    );
                    if (parsedEmoji) option.emoji = parsedEmoji;
                  }

                  return option;
                });

                const selectMenu = new StringSelectMenuBuilder()
                  .setCustomId("ticket_select")
                  .setPlaceholder(t("painel_select_placeholder", interaction.guildId))
                  .addOptions(options);

                containerTicket.addActionRowComponents(
                  new ActionRowBuilder().addComponents(selectMenu),
                );
              } else if (!tinhaSelectMenu && temBotoes) {
                const botoesFormatados = botoes.map((botao) => {
                  const button = new ButtonBuilder()
                    .setCustomId(`ticket_botoes_${botao.id}`)
                    .setLabel(botao.nome || t("painel_default_botao", interaction.guildId))
                    .setStyle(getButtonStyle(botao.cor));
                  if (botao.emoji) {
                    const parsedEmoji = parseEmoji(
                      botao.emoji,
                      interaction.guild,
                    );
                    if (parsedEmoji) button.setEmoji(parsedEmoji);
                  }
                  return button;
                });

                for (let i = 0; i < botoesFormatados.length; i += 5) {
                  containerTicket.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                      botoesFormatados.slice(i, i + 5),
                    ),
                  );
                }
              }

              await mensagem.edit({
                components: [containerTicket],
                flags: MessageFlags.IsComponentsV2,
              });
            }
          } catch (error) {
            console.error("Erro ao atualizar mensagem do painel:", error);
          }
        }
      }

      const previewTexts = [
        new TextDisplayBuilder().setContent(data.title?.trim() || t("visual_sem_titulo", interaction.guildId)),
        new TextDisplayBuilder().setContent(data.descricao?.trim() || t("visual_sem_descricao", interaction.guildId)),
      ];

      if (Array.isArray(data.fields)) {
        data.fields.forEach((field) => {
          previewTexts.push(
            new TextDisplayBuilder().setContent(
              `**${field.name?.trim() || t("visual_campo_sem_nome", interaction.guildId)}**: ${field.value?.trim() || t("visual_sem_valor", interaction.guildId)}`,
            ),
          );
        });
      }

      previewTexts.push(
        new TextDisplayBuilder().setContent(
          t("visual_preview_cor", interaction.guildId, { cor: data.color || t("visual_sem_cor", interaction.guildId) }),
        ),
      );

      const rows = [];

      if (embedSelecionada !== "embedprincipal" && Array.isArray(data.botoes)) {
        const btns = data.botoes.map((botao) => {
          const btn = new ButtonBuilder()
            .setCustomId(`editar_botao:${botao.id}`)
            .setLabel(botao.nome || t("visual_sem_nome", interaction.guildId))
            .setStyle(ButtonStyle.Secondary);

          if (botao.emoji) btn.setEmoji(botao.emoji);
          return btn;
        });

        rows.push(new ActionRowBuilder().addComponents(...btns));
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_personalizacao_embed")
        .setPlaceholder(t("visual_embed_select_placeholder", interaction.guildId))
        .addOptions([
          {
            label: t("visual_embed_principal_label", interaction.guildId),
            description: t("visual_embed_principal_desc", interaction.guildId),
            value: "embedprincipal",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_ticket_label", interaction.guildId),
            description: t("visual_embed_ticket_desc", interaction.guildId),
            value: "embedticket",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logs_label", interaction.guildId),
            description: t("visual_embed_logs_desc", interaction.guildId),
            value: "embedlogs",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logsuser_label", interaction.guildId),
            description: t("visual_embed_logsuser_desc", interaction.guildId),
            value: "embedlogsuser",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_notificar_label", interaction.guildId),
            description: t("visual_embed_notificar_desc", interaction.guildId),
            value: "embednotificar",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_avaliacao_label", interaction.guildId),
            description: t("visual_embed_avaliacao_desc", interaction.guildId),
            value: "embedavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logavaliacao_label", interaction.guildId),
            description: t("visual_embed_logavaliacao_desc", interaction.guildId),
            value: "embedlogavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_assumido_label", interaction.guildId),
            description: t("visual_embed_assumido_desc", interaction.guildId),
            value: "embedassumido",
            emoji: getEmoji(emojis.embeds),
          },
        ]);

      rows.push(new ActionRowBuilder().addComponents(selectMenu));

      const editarMenuOptions = [
        { label: t("visual_opt_titulo", interaction.guildId), value: "titulo", emoji: getEmoji(emojis.title) },
        {
          label: t("visual_opt_descricao", interaction.guildId),
          value: "descricao",
          emoji: getEmoji(emojis.embeds),
        },
        { label: t("visual_opt_cor", interaction.guildId), value: "cor", emoji: getEmoji(emojis.colorpicker) },
        { label: t("visual_opt_banner", interaction.guildId), value: "banner", emoji: getEmoji(emojis.image) },
        {
          label: t("visual_opt_placeholders", interaction.guildId),
          value: "placeholders",
          emoji: getEmoji(emojis.cube),
        },
      ];

      if (Array.isArray(data.fields)) {
        data.fields.forEach((field, i) => {
          editarMenuOptions.push({
            label: t("visual_field_sem_nome", interaction.guildId, { n: i + 1, nome: field.name || t("visual_sem_nome", interaction.guildId) }),
            value: `field_${i}`,
            emoji: getEmoji(emojis.fields),
          });
        });
      }

      const editarMenu = new StringSelectMenuBuilder()
        .setCustomId(`editar_info_embed:${embedSelecionada}`)
        .setPlaceholder(t("visual_editar_embed_placeholder", interaction.guildId))
        .addOptions(editarMenuOptions);
      rows.push(new ActionRowBuilder().addComponents(editarMenu));

      const btnAtualizar = new ButtonBuilder()
        .setCustomId("atualizar_painel_embed_principal")
        .setLabel(t("visual_btn_atualizar_painel", interaction.guildId))
        .setEmoji(getEmoji(emojis.settings))
        .setStyle(ButtonStyle.Success);

      const voltarButton = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      rows.push(
        new ActionRowBuilder().addComponents(btnAtualizar, voltarButton),
      );

      const container = new ContainerBuilder();

      const accentColor = parseColor(data.color);
      if (accentColor !== null) {
        container.setAccentColor(accentColor);
      }

      container.addTextDisplayComponents(...previewTexts);

      if (
        data.banner &&
        typeof data.banner === "string" &&
        data.banner.startsWith("http")
      ) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(data.banner),
          ),
        );
      }

      container.addActionRowComponents(...rows);

      const components = [container];

      if (jaFezDefer) {
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      } else {
        await interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      }
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_limite_ticket")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const valor = interaction.fields.getTextInputValue("input_limite");
      const numero = parseInt(valor, 10);
      if (isNaN(numero) || numero < 1) {
        return interaction.reply({
          components: [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t("visual_err_limite_invalido", interaction.guildId),
              ),
            ),
          ],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }
      const db = getConfigDB(interaction.guildId);
      db.set("limit", numero);
      const { buildOutrosTicketComponents } = require("./painelticket");
      return interaction.editReply({
        components: buildOutrosTicketComponents(interaction.guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_editar_inicio_select_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const selectId = interaction.customId.replace(
        "modal_editar_inicio_select_",
        "",
      );
      const novoInicio = interaction.fields
        .getTextInputValue("novo_inicio")
        .trim();

      if (novoInicio.length > 5) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_max_caracteres", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];
      const selectIndex = selects.findIndex((s) => s.id === selectId);

      if (selectIndex === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_select_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      selects[selectIndex].inicio = novoInicio;
      db.set("embedprincipal.selects", selects);

      const selectObj = selects[selectIndex];
      const { components } = criarEdicaoSelectComponentes(
        selectObj,
        selectObj.id,
      );

      await interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("salvar_edicao_field:")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const [, embedSelecionada, fieldIndexStr] =
        interaction.customId.split(":");
      const fieldIndex = parseInt(fieldIndexStr, 10);
      const guildId = interaction.guildId;
      const db = getPersonalizacaoDB(guildId);

      const dados = db.get(embedSelecionada);
      if (!dados || !Array.isArray(dados.fields)) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_dados_fields_nao", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const novoNome = interaction.fields.getTextInputValue("field_name");
      const novoValor = interaction.fields.getTextInputValue("field_value");
      const novoInline =
        interaction.fields.getTextInputValue("field_inline").toLowerCase() ===
        "true";

      dados.fields[fieldIndex] = {
        name: novoNome,
        value: novoValor,
        inline: novoInline,
      };

      db.set(embedSelecionada, dados);

      const data = db.get(embedSelecionada);
      const rows = [];

      if (embedSelecionada !== "embedprincipal" && Array.isArray(data.botoes)) {
        const btns = data.botoes.map((botao) => {
          const btn = new ButtonBuilder()
            .setCustomId(`editar_botao:${botao.id}`)
            .setLabel(botao.nome || t("visual_sem_nome", interaction.guildId))
            .setStyle(ButtonStyle.Secondary);

          if (botao.emoji) btn.setEmoji(botao.emoji);

          return btn;
        });

        rows.push(new ActionRowBuilder().addComponents(...btns));
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_personalizacao_embed")
        .setPlaceholder(t("visual_embed_select_placeholder", interaction.guildId))
        .addOptions([
          {
            label: t("visual_embed_principal_label", interaction.guildId),
            description: t("visual_embed_principal_desc", interaction.guildId),
            value: "embedprincipal",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_ticket_label", interaction.guildId),
            description: t("visual_embed_ticket_desc", interaction.guildId),
            value: "embedticket",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logs_label", interaction.guildId),
            description: t("visual_embed_logs_desc", interaction.guildId),
            value: "embedlogs",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logsuser_label", interaction.guildId),
            description: t("visual_embed_logsuser_desc", interaction.guildId),
            value: "embedlogsuser",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_notificar_label", interaction.guildId),
            description: t("visual_embed_notificar_desc", interaction.guildId),
            value: "embednotificar",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_avaliacao_label", interaction.guildId),
            description: t("visual_embed_avaliacao_desc", interaction.guildId),
            value: "embedavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logavaliacao_label", interaction.guildId),
            description: t("visual_embed_logavaliacao_desc", interaction.guildId),
            value: "embedlogavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_assumido_label", interaction.guildId),
            description: t("visual_embed_assumido_desc", interaction.guildId),
            value: "embedassumido",
            emoji: getEmoji(emojis.embeds),
          },
        ]);

      rows.push(new ActionRowBuilder().addComponents(selectMenu));

      const editarMenuOptions = [
        { label: t("visual_opt_titulo", interaction.guildId), value: "titulo", emoji: getEmoji(emojis.title) },
        {
          label: t("visual_opt_descricao", interaction.guildId),
          value: "descricao",
          emoji: getEmoji(emojis.embeds),
        },
        { label: t("visual_opt_cor", interaction.guildId), value: "cor", emoji: getEmoji(emojis.colorpicker) },
        { label: t("visual_opt_banner", interaction.guildId), value: "banner", emoji: getEmoji(emojis.image) },
        {
          label: t("visual_opt_placeholders", interaction.guildId),
          value: "placeholders",
          emoji: getEmoji(emojis.cube),
        },
      ];

      if (Array.isArray(data.fields)) {
        data.fields.forEach((field, i) => {
          editarMenuOptions.push({
            label: t("visual_field_sem_nome", interaction.guildId, { n: i + 1, nome: field.name || t("visual_sem_nome", interaction.guildId) }),
            value: `field_${i}`,
            emoji: getEmoji(emojis.fields),
          });
        });
      }

      const editarMenu = new StringSelectMenuBuilder()
        .setCustomId(`editar_info_embed:${embedSelecionada}`)
        .setPlaceholder(t("visual_editar_embed_placeholder", interaction.guildId))
        .addOptions(editarMenuOptions);

      rows.push(new ActionRowBuilder().addComponents(editarMenu));

      const voltarButton = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      rows.push(new ActionRowBuilder().addComponents(voltarButton));

      const previewTexts = [
        new TextDisplayBuilder().setContent(dados.titulo || t("visual_sem_titulo", interaction.guildId)),
        new TextDisplayBuilder().setContent(dados.descricao || t("visual_sem_descricao", interaction.guildId)),
      ];

      if (Array.isArray(dados.fields)) {
        dados.fields.forEach((f) => {
          previewTexts.push(
            new TextDisplayBuilder().setContent(
              `**${f.name || t("visual_campo_sem_nome", interaction.guildId)}**: ${f.value || t("visual_sem_valor", interaction.guildId)}`,
            ),
          );
        });
      }

      previewTexts.push(
        new TextDisplayBuilder().setContent(t("visual_preview_cor", interaction.guildId, { cor: dados.cor || t("visual_cor_white", interaction.guildId) })),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(...previewTexts)
          .addActionRowComponents(...rows),
      ];

      await interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_config_select_descricao_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const selectId = interaction.customId.replace(
        "modal_config_select_descricao_",
        "",
      );

      const descricao = interaction.fields.getTextInputValue("descricao");

      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];

      const index = selects.findIndex((s) => s.id === selectId);

      if (index !== -1) {
        selects[index].descricao = descricao;
        db.set("embedprincipal.selects", selects);
        console.log("Selects depois:", JSON.stringify(selects, null, 2));
      } else {
        console.log("❌ Select não encontrado no array!");
      }

      const components = criarPainelConfiguracaoSelect(selectId, db);
      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("modal_config_botao_") &&
      !customId.includes("estacao")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const parts = customId.split("_");
      const campo = parts[3];
      const botaoId = parts[4];
      const db = getPersonalizacaoDB(interaction.guild.id);
      const botoes = db.get("embedprincipal.botoes") || [];
      const index = botoes.findIndex((b) => b.id === botaoId);

      if (index === -1) return;

      if (campo === "nome") {
        botoes[index].nome = interaction.fields.getTextInputValue("nome");
      } else if (campo === "inicio") {
        botoes[index].inicio = interaction.fields.getTextInputValue("inicio");
      }

      db.set("embedprincipal.botoes", botoes);
      const components = criarPainelConfiguracaoBotao(botaoId, db);
      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("modal_config_select_") &&
      !customId.includes("estacao")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const parts = customId.split("_");
      const campo = parts[3];
      const selectId = parts[4];
      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];
      const index = selects.findIndex((s) => s.id === selectId);

      if (index === -1) return;

      if (campo === "nome") {
        selects[index].nome = interaction.fields.getTextInputValue("nome");
      } else if (campo === "inicio") {
        selects[index].inicio = interaction.fields.getTextInputValue("inicio");
      }

      db.set("embedprincipal.selects", selects);
      const components = criarPainelConfiguracaoSelect(selectId, db);
      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_editar_descricao_select_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const selectId = interaction.customId.replace(
        "modal_editar_descricao_select_",
        "",
      );
      const novaDescricao =
        interaction.fields.getTextInputValue("nova_descricao");
      const db = getPersonalizacaoDB(interaction.guild.id);

      const selects = db.get("embedprincipal.selects") || [];
      const selectIndex = selects.findIndex((s) => s.id === selectId);

      if (selectIndex === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_select_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      selects[selectIndex].descricao = novaDescricao;
      db.set("embedprincipal.selects", selects);

      const selectObj = selects[selectIndex];
      const { components } = criarEdicaoSelectComponentes(
        selectObj,
        selectObj.id,
      );

      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_emoji_manual_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const parts = interaction.customId.split("_");
      const tipo = parts[3];
      const itemId = parts[4];
      const emojiInput = interaction.fields.getTextInputValue("emoji");
      const db = getPersonalizacaoDB(interaction.guild.id);
      let emojiProcessado = parseEmoji(emojiInput, interaction.guild);

      if (tipo === "botao") {
        const botoes = db.get("embedprincipal.botoes") || [];
        const index = botoes.findIndex((b) => b.id === itemId);
        if (index !== -1) {
          botoes[index].emoji = emojiProcessado.id
            ? `<${emojiProcessado.animated ? "a" : ""}:${
                emojiProcessado.name
              }:${emojiProcessado.id}>`
            : emojiProcessado.name;
          db.set("embedprincipal.botoes", botoes);
        }
        const components = criarPainelConfiguracaoBotao(itemId, db);
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } else {
        const selects = db.get("embedprincipal.selects") || [];
        const index = selects.findIndex((s) => s.id === itemId);
        if (index !== -1) {
          selects[index].emoji = emojiProcessado.id
            ? `<${emojiProcessado.animated ? "a" : ""}:${
                emojiProcessado.name
              }:${emojiProcessado.id}>`
            : emojiProcessado.name;
          db.set("embedprincipal.selects", selects);
        }
        const components = criarPainelConfiguracaoSelect(itemId, db);
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId.startsWith("select_config_botao_categoria_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const botaoId = interaction.customId.split("_").pop();
      const db = getPersonalizacaoDB(interaction.guild.id);
      const botoes = db.get("embedprincipal.botoes") || [];
      const index = botoes.findIndex((b) => b.id === botaoId);

      if (index !== -1) {
        botoes[index].categoria = interaction.values.join(",");
        db.set("embedprincipal.botoes", botoes);
      }

      const components = criarPainelConfiguracaoBotao(botaoId, db);
      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId.startsWith("select_config_select_categoria_")
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const selectId = interaction.customId.split("_").pop();
      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];
      const index = selects.findIndex((s) => s.id === selectId);

      if (index !== -1) {
        selects[index].categoria = interaction.values.join(",");
        db.set("embedprincipal.selects", selects);
      }

      const components = criarPainelConfiguracaoSelect(selectId, db);
      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId.startsWith("select_categoria_botao_")
    ) {
      const botaoId = interaction.customId.split("select_categoria_botao_")[1];
      const db = getPersonalizacaoDB(interaction.guild.id);

      const botoes = db.get("embedprincipal.botoes") || [];
      const botaoIndex = botoes.findIndex((b) => b.id === botaoId);
      if (botaoIndex === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_botao_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const botao = botoes[botaoIndex];

      const categoriasAntigas = botao.categoria
        ? botao.categoria.split(",")
        : [];
      const novasCategorias = interaction.values;
      const todasCategorias = Array.from(
        new Set([...categoriasAntigas, ...novasCategorias]),
      );

      botao.categoria = todasCategorias.join(",");
      db.set("embedprincipal.botoes", botoes);

      const { components } = criarEmbedESelectDeBotao(botao, emojis, getEmoji);

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "editar_select_select"
    ) {
      const selectId = interaction.values[0];
      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];
      const selectObj = selects.find((s) => s.id === selectId);

      if (!selectObj) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_nenhum_select_encontrado", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const { components } = criarEdicaoSelectComponentes(selectObj, selectId);

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("editar_campo_select_")
    ) {
      const selectId = interaction.customId.split("editar_campo_select_")[1];
      const campo = interaction.values[0];
      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];
      const selectObjIndex = selects.findIndex((s) => s.id === selectId);

      if (campo === "voltar") {
        if (interaction.guild) {
          const adicionar = new ButtonBuilder()
            .setCustomId("select_adicionar")
            .setLabel(t("btn_adicionar", interaction.guildId))
            .setEmoji(getEmoji(emojis.plus))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(selects.length >= 10);

          const remover = new ButtonBuilder()
            .setCustomId("select_remover")
            .setLabel(t("btn_remover", interaction.guildId))
            .setEmoji(getEmoji(emojis.minus))
            .setStyle(ButtonStyle.Secondary);

          const editar = new ButtonBuilder()
            .setCustomId("select_editar")
            .setLabel(t("btn_editar", interaction.guildId))
            .setEmoji(getEmoji(emojis.title))
            .setStyle(ButtonStyle.Secondary);

          const voltar = new ButtonBuilder()
            .setCustomId("sistema_ticket")
            .setLabel(t("btn_voltar", interaction.guildId))
            .setEmoji(getEmoji(emojis.arrowl))
            .setStyle(ButtonStyle.Secondary);

          const row = new ActionRowBuilder().addComponents(
            adicionar,
            remover,
            editar,
            voltar,
          );

          const components = [
            new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("visual_config_select_titulo", interaction.guildId),
                ),
                new TextDisplayBuilder().setContent(
                  t("visual_config_botao_desc", interaction.guildId),
                ),
              )
              .addActionRowComponents(row),
          ];

          return interaction.update({
            components,
            flags: MessageFlags.IsComponentsV2,
            embeds: [],
            content: null,
          });
        }
      }

      if (selectObjIndex === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_select_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (campo === "nome") {
        const selectObj = selects[selectObjIndex];

        const modal = new ModalBuilder()
          .setCustomId(`modal_editar_nome_select_${selectId}`)
          .setTitle(t("visual_modal_nome_select_editar_titulo", interaction.guildId));

        const inputNome = new TextInputBuilder()
          .setCustomId("novo_nome")
          .setLabel(t("visual_modal_nome_select_editar_label", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(100)
          .setValue(selectObj.nome || "")
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(inputNome));

        return interaction.showModal(modal);
      }

      if (campo === "descricao") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_config_select_descricao_${selectId}`)
          .setTitle(t("visual_modal_descricao_titulo", interaction.guildId));

        const input = new TextInputBuilder()
          .setCustomId("descricao")
          .setLabel(t("visual_modal_descricao_label", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(100)
          .setPlaceholder(t("visual_modal_descricao_placeholder", interaction.guildId));

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "categoria") {
        const selectObj = selects[selectObjIndex];

        const selectChannel = new ChannelSelectMenuBuilder()
          .setCustomId(`select_categoria_select_${selectId}`)
          .setPlaceholder(t("visual_cat_select_placeholder", interaction.guildId))
          .setMinValues(1)
          .setMaxValues(25)
          .addChannelTypes(ChannelType.GuildCategory);

        const row = new ActionRowBuilder().addComponents(selectChannel);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${getEmoji(emojis.folder)} ${t("visual_cat_select_titulo", interaction.guildId, { nome: selectObj.nome })}`,
              ),
            )
            .addActionRowComponents(row),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      }

      if (campo === "emoji") {
        const selectObj = selects[selectObjIndex];

        const modal = new ModalBuilder()
          .setCustomId(`modal_editar_emoji_select_${selectId}`)
          .setTitle(t("visual_modal_emoji_select_titulo", interaction.guildId));

        const input = new TextInputBuilder()
          .setCustomId("novo_emoji")
          .setLabel(t("visual_modal_emoji_select_label", interaction.guildId))
          .setPlaceholder(t("visual_modal_emoji_select_placeholder", interaction.guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(selectObj.emoji || "");

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId.startsWith("select_categoria_select_")
    ) {
      const selectId = interaction.customId.split(
        "select_categoria_select_",
      )[1];
      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];
      const selectIndex = selects.findIndex((s) => s.id === selectId);

      if (selectIndex === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_select_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selecionadas = interaction.values;
      selects[selectIndex].categoria = selecionadas.join(",");
      db.set("embedprincipal.selects", selects);
      const selectObj = selects[selectIndex];

      const { components } = criarEdicaoSelectComponentes(
        selectObj,
        selectObj.id,
      );

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "select_personalizacao_embed"
    ) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
      const guildId = interaction.guildId;
      const db = getPersonalizacaoDB(guildId);
      const embedSelecionada = interaction.values[0];

      const data = db.get(embedSelecionada);
      if (!data) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_embed_nao_encontrada", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const previewTexts = [
        new TextDisplayBuilder().setContent(data.title?.trim() || t("visual_sem_titulo", interaction.guildId)),
        new TextDisplayBuilder().setContent(data.descricao?.trim() || t("visual_sem_descricao", interaction.guildId)),
      ];

      if (Array.isArray(data.fields)) {
        data.fields.forEach((field) => {
          previewTexts.push(
            new TextDisplayBuilder().setContent(
              `**${field.name?.trim() || t("visual_campo_sem_nome", interaction.guildId)}**: ${field.value?.trim() || t("visual_sem_valor", interaction.guildId)}`,
            ),
          );
        });
      }

      previewTexts.push(
        new TextDisplayBuilder().setContent(
          t("visual_preview_cor", interaction.guildId, { cor: data.color || t("visual_cor_white", interaction.guildId) }),
        ),
      );

      const rows = [];

      if (embedSelecionada !== "embedprincipal" && Array.isArray(data.botoes)) {
        const btns = data.botoes.map((botao) => {
          const btn = new ButtonBuilder()
            .setCustomId(`editar_botao:${botao.id}`)
            .setLabel(botao.nome || t("visual_sem_nome", interaction.guildId))
            .setStyle(ButtonStyle.Secondary);

          if (botao.emoji) btn.setEmoji(botao.emoji);

          return btn;
        });

        rows.push(new ActionRowBuilder().addComponents(...btns));
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_personalizacao_embed")
        .setPlaceholder(t("visual_embed_select_placeholder", interaction.guildId))
        .addOptions([
          {
            label: t("visual_embed_principal_label", interaction.guildId),
            description: t("visual_embed_principal_desc", interaction.guildId),
            value: "embedprincipal",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_ticket_label", interaction.guildId),
            description: t("visual_embed_ticket_desc", interaction.guildId),
            value: "embedticket",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logs_label", interaction.guildId),
            description: t("visual_embed_logs_desc", interaction.guildId),
            value: "embedlogs",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logsuser_label", interaction.guildId),
            description: t("visual_embed_logsuser_desc", interaction.guildId),
            value: "embedlogsuser",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_notificar_label", interaction.guildId),
            description: t("visual_embed_notificar_desc", interaction.guildId),
            value: "embednotificar",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_avaliacao_label", interaction.guildId),
            description: t("visual_embed_avaliacao_desc", interaction.guildId),
            value: "embedavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logavaliacao_label", interaction.guildId),
            description: t("visual_embed_logavaliacao_desc", interaction.guildId),
            value: "embedlogavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_assumido_label", interaction.guildId),
            description: t("visual_embed_assumido_desc", interaction.guildId),
            value: "embedassumido",
            emoji: getEmoji(emojis.embeds),
          },
        ]);

      rows.push(new ActionRowBuilder().addComponents(selectMenu));

      const editarMenuOptions = [
        { label: t("visual_opt_titulo", interaction.guildId), value: "titulo", emoji: getEmoji(emojis.title) },
        {
          label: t("visual_opt_descricao", interaction.guildId),
          value: "descricao",
          emoji: getEmoji(emojis.embeds),
        },
        { label: t("visual_opt_cor", interaction.guildId), value: "cor", emoji: getEmoji(emojis.colorpicker) },
        { label: t("visual_opt_banner", interaction.guildId), value: "banner", emoji: getEmoji(emojis.image) },
        {
          label: t("visual_opt_placeholders", interaction.guildId),
          value: "placeholders",
          emoji: getEmoji(emojis.cube),
        },
      ];

      if (Array.isArray(data.fields)) {
        data.fields.forEach((field, i) => {
          editarMenuOptions.push({
            label: t("visual_field_sem_nome", interaction.guildId, { n: i + 1, nome: field.name || t("visual_sem_nome", interaction.guildId) }),
            value: `field_${i}`,
            emoji: getEmoji(emojis.fields),
          });
        });
      }

      const editarMenu = new StringSelectMenuBuilder()
        .setCustomId(`editar_info_embed:${embedSelecionada}`)
        .setPlaceholder(t("visual_editar_embed_placeholder", interaction.guildId))
        .addOptions(editarMenuOptions);

      rows.push(new ActionRowBuilder().addComponents(editarMenu));

      const voltarButton = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      rows.push(new ActionRowBuilder().addComponents(voltarButton));

      const container = new ContainerBuilder();

      const accentColor = parseColor(data.color);
      if (accentColor !== null) {
        container.setAccentColor(accentColor);
      }

      container.addTextDisplayComponents(...previewTexts);

      if (
        data.banner &&
        typeof data.banner === "string" &&
        data.banner.startsWith("http")
      ) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(data.banner),
          ),
        );
      }

      container.addActionRowComponents(...rows);

      const components = [container];

      await interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("editar_info_embed:")
    ) {
      const embedSelecionada = interaction.customId.split(":")[1];
      const escolha = interaction.values[0];
      const guildId = interaction.guildId;
      const db = getPersonalizacaoDB(guildId);

      const dados = db.get(embedSelecionada);
      if (!dados) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_embed_nao_encontrada", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const options = [
        { label: t("visual_opt_titulo", interaction.guildId), value: "titulo", emoji: getEmoji(emojis.title) },
        {
          label: t("visual_opt_descricao", interaction.guildId),
          value: "descricao",
          emoji: getEmoji(emojis.embeds),
        },
        { label: t("visual_opt_cor", interaction.guildId), value: "cor", emoji: getEmoji(emojis.colorpicker) },
        {
          label: t("visual_opt_placeholders", interaction.guildId),
          value: "placeholders",
          emoji: getEmoji(emojis.cube),
        },
      ];

      if (Array.isArray(dados.fields)) {
        dados.fields.forEach((field, index) => {
          options.push({
            label: t("visual_field_sem_nome", guildId, { n: index + 1, nome: field.name || t("visual_sem_nome", guildId) }),
            value: `field_${index}`,
          });
        });
      }

      if (escolha.startsWith("field_")) {
        const fieldIndex = parseInt(escolha.split("_")[1], 10);
        if (isNaN(fieldIndex) || !dados.fields || !dados.fields[fieldIndex]) {
          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(t("visual_err_field_invalido", guildId)),
            ),
          ];

          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }
        const field = dados.fields[fieldIndex];

        const modal = new ModalBuilder()
          .setTitle(t("visual_modal_editar_field_titulo", guildId, { n: fieldIndex + 1 }))
          .setCustomId(`salvar_edicao_field:${embedSelecionada}:${fieldIndex}`);

        const nameInput = new TextInputBuilder()
          .setCustomId("field_name")
          .setLabel(t("visual_modal_field_nome_label", guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(limparEmojisProcessados(field.name || ""));

        const valueInput = new TextInputBuilder()
          .setCustomId("field_value")
          .setLabel(t("visual_modal_field_valor_label", guildId))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(limparEmojisProcessados(field.value || ""));

        const inlineInput = new TextInputBuilder()
          .setCustomId("field_inline")
          .setLabel(t("visual_modal_field_inline_label", guildId))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(field.inline ? "true" : "false");

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(valueInput),
          new ActionRowBuilder().addComponents(inlineInput),
        );

        return interaction.showModal(modal);
      }

      const modal = new ModalBuilder()
        .setTitle(t("visual_modal_editar_embed_titulo", guildId))
        .setCustomId(`salvar_edicao_info_embed:${embedSelecionada}:${escolha}`);

      if (escolha === "titulo") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("novo_valor")
              .setLabel(t("visual_modal_novo_titulo_label", guildId))
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setValue(limparEmojisProcessados(dados.title || "")),
          ),
        );
      } else if (escolha === "descricao") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("novo_valor")
              .setLabel(t("visual_modal_nova_descricao_label", guildId))
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setValue(limparEmojisProcessados(dados.descricao || "")),
          ),
        );
      } else if (escolha === "cor") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("novo_valor")
              .setLabel(t("visual_modal_nova_cor_label", guildId))
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setPlaceholder(t("visual_modal_cor_placeholder", guildId))
              .setValue(dados.color || ""),
          ),
        );
      } else if (escolha === "banner") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("novo_valor")
              .setLabel(t("visual_modal_url_banner_label", guildId))
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setValue(dados.banner || ""),
          ),
        );
      } else if (escolha === "placeholders") {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Placeholders disponíveis:**",
            ),
            new TextDisplayBuilder().setContent(
              "`{user}` → menciona o usuário = Use na embedlogs, logsuser, embednotificar, embedavaliacao e embedlogavaliacao",
            ),
            new TextDisplayBuilder().setContent(
              "`{staff}` → menciona o staff = Use na embedticket, embedlogs, logsuser, embednotificar e embedassumido",
            ),
            new TextDisplayBuilder().setContent(
              "`{canal}` → menciona o canal = Use na embedlogs, logsuser e embednotificar",
            ),
            new TextDisplayBuilder().setContent(
              "`{motivo}` → motivo da abertura = Use na embedticket, embedlogs e logsuser",
            ),
            new TextDisplayBuilder().setContent(
              "`{categoria}` → opção selecionada = Use na embedticket (mostra qual botão/select foi usado para abrir)",
            ),
            new TextDisplayBuilder().setContent(
              "`{abertura}` → hora de abertura = Use na embedlogs e logsuser",
            ),
            new TextDisplayBuilder().setContent(
              "`{fechamento}` → hora de fechamento = Use na embedlogs e logsuser",
            ),
            new TextDisplayBuilder().setContent(
              "`{horatotal}` → total de horas aberto = Use na embedlogs e logsuser",
            ),
            new TextDisplayBuilder().setContent(
              "`{ticket_id}` → ID do ticket = Use na embedlogavaliacao",
            ),
            new TextDisplayBuilder().setContent(
              "`{estrelas}` → estrelas em emoji (⭐⭐⭐) = Use na embedavaliacao e embedlogavaliacao",
            ),
            new TextDisplayBuilder().setContent(
              "`{avaliacao}` → nota numérica (1/5, 2/5...) = Use na embedavaliacao e embedlogavaliacao",
            ),
            new TextDisplayBuilder().setContent(
              "`{comentario}` → comentário da avaliação = Use na embedavaliacao e embedlogavaliacao",
            ),
            new TextDisplayBuilder().setContent(
              "`{data}` → data da avaliação = Use na embedlogavaliacao",
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      } else {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_opcao_invalida", guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      await interaction.showModal(modal);
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("editar_info_embed_field:")
    ) {
      const embedSelecionada = interaction.customId.split(":")[1];
      const guildId = interaction.guildId;
      const db = getPersonalizacaoDB(guildId);
      const dados = db.get(embedSelecionada);

      if (!dados || !Array.isArray(dados.fields)) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_dados_fields_nao", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const fieldIndex = parseInt(interaction.values[0], 10);
      if (
        isNaN(fieldIndex) ||
        fieldIndex < 0 ||
        fieldIndex >= dados.fields.length
      ) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Field inválido selecionado.",
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const field = dados.fields[fieldIndex];

      const modal = new ModalBuilder()
        .setTitle(t("visual_modal_editar_field_titulo", guildId, { n: fieldIndex + 1 }))
        .setCustomId(`salvar_edicao_field:${embedSelecionada}:${fieldIndex}`);

      const nameInput = new TextInputBuilder()
        .setCustomId("field_name")
        .setLabel(t("visual_modal_field_nome_label", guildId))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(field.name || "");

      const valueInput = new TextInputBuilder()
        .setCustomId("field_value")
        .setLabel(t("visual_modal_field_valor_label", guildId))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(field.value || "");

      const inlineInput = new TextInputBuilder()
        .setCustomId("field_inline")
        .setLabel(t("visual_modal_field_inline_label", guildId))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(field.inline ? "true" : "false");

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(valueInput),
        new ActionRowBuilder().addComponents(inlineInput),
      );

      await interaction.showModal(modal);
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "enviar_ticket_tipo"
    ) {
      const tipoPainel = interaction.values[0];
      const tempDB = getConfigDB(interaction.guildId);

      tempDB.set("enviar_ticket_temp", {
        tipo: tipoPainel,
        userId: interaction.user.id,
      });

      const selectCanal = new ChannelSelectMenuBuilder()
        .setCustomId("enviar_ticket_canal")
        .setPlaceholder(t("visual_canal_placeholder", interaction.guildId))
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);

      const voltarBtn = new ButtonBuilder()
        .setCustomId("enviar_ticket_painel")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("enviar_canal_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(
              t("enviar_canal_desc", interaction.guildId, {
                tipo:
                  tipoPainel === "botao"
                    ? t("enviar_tipo_botoes_nome", interaction.guildId)
                    : t("enviar_tipo_select_nome", interaction.guildId),
              }),
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectCanal),
            new ActionRowBuilder().addComponents(voltarBtn),
          ),
      ];

      await interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    function parseEmoji(emojiString, guild) {
      if (!emojiString) return undefined;

      if (/^[\u{1F000}-\u{1FFFF}]+$/u.test(emojiString)) {
        return emojiString;
      }

      const match = emojiString.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
      if (match) {
        return match[0];
      }

      const cleanName = emojiString.replace(/:/g, "");
      const foundEmoji = guild.emojis.cache.find((e) => e.name === cleanName);
      if (foundEmoji) {
        return `<${foundEmoji.animated ? "a" : ""}:${foundEmoji.name}:${
          foundEmoji.id
        }>`;
      }

      return undefined;
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId === "enviar_ticket_canal"
    ) {
      await interaction.deferUpdate();
      const tempDB = getConfigDB(interaction.guildId);
      const tempData = tempDB.get("enviar_ticket_temp");
      if (!tempData || tempData.userId !== interaction.user.id) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_sessao_expirada", interaction.guildId),
            ),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
      const canalId = interaction.values[0];
      const canal = interaction.guild.channels.cache.get(canalId);
      if (!canal) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("visual_err_canal_nao_encontrado", interaction.guildId)),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
      const db = getPersonalizacaoDB(interaction.guildId);
      const embedData = db.get("embedprincipal");
      const tipoPainel = tempData.tipo;
      function parseColor(colorString) {
        if (!colorString || colorString === "" || colorString === " ")
          return undefined;
        if (typeof colorString === "number") return colorString;
        const cleanColor = colorString.replace("#", "");
        const colorInt = parseInt(cleanColor, 16);
        return !isNaN(colorInt) ? colorInt : null;
      }
      function parseEmoji(emojiString, guild) {
        if (!emojiString) return undefined;
        if (/^[\u{1F000}-\u{1FFFF}]+$/u.test(emojiString))
          return { name: emojiString };
        const match = emojiString.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
        if (match) return { id: match[2], name: match[1] };
        const cleanName = emojiString.replace(/:/g, "");
        const foundEmoji = guild.emojis.cache.find((e) => e.name === cleanName);
        if (foundEmoji)
          return {
            id: foundEmoji.id,
            name: foundEmoji.name,
            animated: foundEmoji.animated,
          };
        return undefined;
      }
      try {
        if (tipoPainel === "botao") {
          const botoes = embedData.botoes || [];
          function getButtonStyle(cor) {
            if (!cor) return ButtonStyle.Primary;
            const styleKey = cor.toUpperCase();
            const map = {
              PRIMARY: ButtonStyle.Primary,
              SECONDARY: ButtonStyle.Secondary,
              SUCCESS: ButtonStyle.Success,
              DANGER: ButtonStyle.Danger,
              LINK: ButtonStyle.Link,
            };
            return map[styleKey] || ButtonStyle.Primary;
          }
          const containerTicket = new ContainerBuilder();
          const accentColor = parseColor(embedData.color);
          if (accentColor !== null) {
            containerTicket.setAccentColor(accentColor);
          }
          containerTicket.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${embedData.title || t("painel_default_titulo", interaction.guildId)}**`,
            ),
          );
          if (embedData.descricao) {
            containerTicket.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                embedData.descricao ||
                  t("painel_default_descricao", interaction.guildId),
              ),
            );
          }
          if (
            embedData.banner &&
            typeof embedData.banner === "string" &&
            embedData.banner.startsWith("http")
          ) {
            containerTicket.addMediaGalleryComponents(
              new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(embedData.banner),
              ),
            );
          }
          containerTicket.addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          );
          const botoesFormatados = botoes.map((botao) => {
            const button = new ButtonBuilder()
              .setCustomId(`ticket_botoes_${botao.id}`)
              .setLabel(botao.nome || t("painel_default_botao", interaction.guildId))
              .setStyle(getButtonStyle(botao.cor));
            if (botao.emoji && typeof botao.emoji === "string") {
              const parsedEmoji = parseEmoji(botao.emoji, interaction.guild);
              if (parsedEmoji) {
                button.setEmoji(parsedEmoji);
              }
            }
            return button;
          });
          for (let i = 0; i < botoesFormatados.length; i += 5) {
            containerTicket.addActionRowComponents(
              new ActionRowBuilder().addComponents(
                botoesFormatados.slice(i, i + 5),
              ),
            );
          }
          const mensagemEnviada = await canal.send({
            components: [containerTicket],
            flags: MessageFlags.IsComponentsV2,
          });

          db.set("embedprincipal.messageId", mensagemEnviada.id);
          db.set("embedprincipal.channelId", canal.id);
        } else if (tipoPainel === "select") {
          const selects = embedData.selects || [];

          const options = selects.map((sel) => {
            const option = {
              label: sel.nome || t("painel_default_select_nome", interaction.guildId),
              value: `select_${sel.id}`,
              description: t("painel_default_select_desc", interaction.guildId, { nome: sel.nome || t("painel_default_select_nome", interaction.guildId) }),
            };
            if (sel.emoji && typeof sel.emoji === "string") {
              const parsedEmoji = parseEmoji(sel.emoji, interaction.guild);
              if (parsedEmoji) {
                option.emoji = parsedEmoji;
              }
            }
            return option;
          });

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder(t("painel_select_placeholder", interaction.guildId))
            .addOptions(
              selects.map((sel) => {
                const option = {
                  label: sel.nome || t("painel_default_select_nome", interaction.guildId),
                  value: `select_${sel.id}`,
                  description:
                    sel.descricao ||
                    t("painel_default_select_desc", interaction.guildId, { nome: sel.nome || t("painel_default_select_nome", interaction.guildId) }),
                };
                if (sel.emoji && typeof sel.emoji === "string") {
                  const parsedEmoji = parseEmoji(sel.emoji, interaction.guild);
                  if (parsedEmoji) {
                    option.emoji = parsedEmoji;
                  }
                }
                return option;
              }),
            );

          const containerTicket = new ContainerBuilder();
          const accentColor = parseColor(embedData.color);
          if (accentColor !== null) {
            containerTicket.setAccentColor(accentColor);
          }
          containerTicket.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${embedData.title || t("painel_default_titulo", interaction.guildId)}**`,
            ),
          );
          if (embedData.descricao) {
            containerTicket.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                embedData.descricao ||
                  t("painel_default_descricao", interaction.guildId),
              ),
            );
          }
          if (
            embedData.banner &&
            typeof embedData.banner === "string" &&
            embedData.banner.startsWith("http")
          ) {
            containerTicket.addMediaGalleryComponents(
              new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(embedData.banner),
              ),
            );
          }

          containerTicket.addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          );

          containerTicket.addActionRowComponents(
            new ActionRowBuilder().addComponents(selectMenu),
          );

          const mensagemEnviada = await canal.send({
            components: [containerTicket],
            flags: MessageFlags.IsComponentsV2,
          });

          db.set("embedprincipal.messageId", mensagemEnviada.id);
          db.set("embedprincipal.channelId", canal.id);
        }

        tempDB.delete("enviar_ticket_temp");

        const buttonConfig = new ButtonBuilder()
          .setCustomId("configurar_ticket")
          .setLabel(t("btn_configurar", gid))
          .setEmoji(getEmoji(emojis.settings))
          .setStyle(ButtonStyle.Primary);

        const buttonBanco = new ButtonBuilder()
          .setCustomId("banco_ticket")
          .setLabel(t("btn_banco", gid))
          .setEmoji(getEmoji(emojis.cardbox))
          .setStyle(ButtonStyle.Primary);

        const buttonPix = new ButtonBuilder()
          .setCustomId("pix_ticket")
          .setLabel(t("btn_pix", gid))
          .setEmoji(getEmoji(emojis.dollar))
          .setStyle(ButtonStyle.Primary);

        const enviarTicketBtn = new ButtonBuilder()
          .setCustomId("enviar_ticket_painel")
          .setLabel(t("btn_enviar_ticket", gid))
          .setEmoji(getEmoji(emojis.embeds))
          .setStyle(ButtonStyle.Success);

        const iaSetupBtn = new ButtonBuilder()
          .setCustomId("ia_setup_inicial")
          .setLabel(t("btn_ia_setup", gid))
          .setEmoji(getEmoji(emojis.bot))
          .setStyle(ButtonStyle.Success);

        const buttonSuporte = new ButtonBuilder()
          .setLabel(t("btn_suporte", gid))
          .setEmoji(getEmoji(emojis.discord$))
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/MmUB4H3uCM");

        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("painel_principal_titulo", gid, { guild: interaction.guild.name }),
            ),
          ),
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${t("painel_principal_desc", gid)}\n\n-# Ping do bot: ${client.ws.ping}ms`,
              ),
            )
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    t("painel_secao_configurar", interaction.guildId),
                  ),
                )
                .setButtonAccessory(buttonConfig),
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "**Banco de Dados**\nAcesse relatórios e estatísticas dos tickets",
                  ),
                )
                .setButtonAccessory(buttonBanco),
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "**Pix**\nConfigurações relacionadas ao sistema de pagamento",
                  ),
                )
                .setButtonAccessory(buttonPix),
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "**Enviar Ticket**\nEnvie o painel de tickets configurado em um canal específico",
                  ),
                )
                .setButtonAccessory(enviarTicketBtn),
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "**Setup com IA**\nDeixe a inteligência artificial configurar automaticamente seu sistema de tickets de forma rápida e personalizada",
                  ),
                )
                .setButtonAccessory(iaSetupBtn),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "**Suporte**\nPrecisa de ajuda? Entre em contato conosco!",
                  ),
                )
                .setButtonAccessory(buttonSuporte),
            ),
        ];

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error(error);
        tempDB.delete("enviar_ticket_temp");

        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("enviar_erro_canal", interaction.guildId),
            ),
          ),
        ];

        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (interaction.isButton() && interaction.customId === "select_editar") {
      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];

      if (selects.length === 0) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_err_nenhum_select_editar", interaction.guildId),
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId("editar_select_select")
        .setPlaceholder(t("visual_selecionar_opcao_editar_placeholder", interaction.guildId))
        .addOptions(
          selects.map((s) => {
            const option = {
              label: s.nome || t("visual_sem_nome", interaction.guildId),
              value: s.id,
              description: `ID: ${s.id}`,
            };

            if (s.emoji) {
              const emojiId = getEmoji(s.emoji);

              if (emojiId) {
                if (interaction.guild.emojis.cache.has(emojiId)) {
                  const emoji = interaction.guild.emojis.cache.get(emojiId);
                  option.emoji = {
                    id: emoji.id,
                    name: emoji.name,
                    animated: emoji.animated,
                  };
                } else {
                  option.emoji = emojis.selectoptions || "📋";
                }
              } else {
                option.emoji = s.emoji;
              }
            } else {
              option.emoji = emojis.selectoptions || "📋";
            }

            return option;
          }),
        );

      const row = new ActionRowBuilder().addComponents(select);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_selecionar_opcao_editar", interaction.guildId),
            ),
          )
          .addActionRowComponents(row),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    function parseEmoji(emojiString, guild) {
      if (!emojiString) return undefined;

      if (/^[\p{Extended_Pictographic}]+$/u.test(emojiString)) {
        return { name: emojiString };
      }

      const matchComplete = emojiString.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
      if (matchComplete) {
        return {
          id: matchComplete[2],
          name: matchComplete[1],
          animated: emojiString.startsWith("<a:"),
        };
      }

      const matchNameOnly = emojiString.match(/^:([a-zA-Z0-9_]+):$/);
      if (matchNameOnly) {
        const emojiName = matchNameOnly[1];
        const foundEmoji = guild.emojis.cache.find((e) => e.name === emojiName);
        if (foundEmoji) {
          return {
            id: foundEmoji.id,
            name: foundEmoji.name,
            animated: foundEmoji.animated,
          };
        }
      }

      const cleanName = emojiString.replace(/:/g, "").trim();
      const foundEmoji = guild.emojis.cache.find((e) => e.name === cleanName);
      if (foundEmoji) {
        return {
          id: foundEmoji.id,
          name: foundEmoji.name,
          animated: foundEmoji.animated,
        };
      }

      return { name: cleanName };
    }

    if (customId === "botao_adicionar") {
      const db = getPersonalizacaoDB(interaction.guild.id);
      let botoesExistentes = db.get("embedprincipal.botoes") || [];

      botoesExistentes = botoesExistentes.filter((b) => !b.temp);
      db.set("embedprincipal.botoes", botoesExistentes);

      if (botoesExistentes.length >= 5) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_limite_botoes", interaction.guildId),
            ),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const novoId = Date.now().toString();
      const botaoTemp = {
        id: novoId,
        nome: "",
        categoria: "",
        emoji: null,
        inicio: "",
        cor: "Primary",
        temp: true,
      };

      botoesExistentes.push(botaoTemp);
      db.set("embedprincipal.botoes", botoesExistentes);

      const components = criarPainelConfiguracaoBotao(novoId, db);
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "select_adicionar") {
      const db = getPersonalizacaoDB(interaction.guild.id);
      let selectsExistentes = db.get("embedprincipal.selects") || [];

      selectsExistentes = selectsExistentes.filter((s) => !s.temp);
      db.set("embedprincipal.selects", selectsExistentes);

      if (selectsExistentes.length >= 10) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_limite_selects", interaction.guildId),
            ),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const novoId = Date.now().toString();
      const selectTemp = {
        id: novoId,
        nome: "",
        categoria: "",
        emoji: null,
        inicio: "",
        descricao: "",
        temp: true,
      };

      selectsExistentes.push(selectTemp);
      db.set("embedprincipal.selects", selectsExistentes);

      const components = criarPainelConfiguracaoSelect(novoId, db);
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }
  },
};