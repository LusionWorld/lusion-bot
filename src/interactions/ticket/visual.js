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
        .setLabel("Adicionar")
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(_botoesAtual.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel("Remover")
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("botao_editar")
        .setLabel("Editar")
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel("Voltar")
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
              "Configuração do Painel: Botão",
            ),
            new TextDisplayBuilder().setContent(
              "Escolha uma das ações abaixo.",
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
        .setLabel("Adicionar")
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(_selectsAtual.length >= 10);

      const remover = new ButtonBuilder()
        .setCustomId("select_remover")
        .setLabel("Remover")
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("select_editar")
        .setLabel("Editar")
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel("Voltar")
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
              "Configuração do Painel: Select",
            ),
            new TextDisplayBuilder().setContent(
              "Escolha uma das ações abaixo.",
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
              "❌ Nenhum botão encontrado para remover.",
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
        .setPlaceholder("Selecione o botão que deseja remover")
        .addOptions(
          botoes.map((botao) => ({
            label: botao.nome || "Sem nome",
            value: botao.id,
            description: `ID: ${botao.id}`,
            emoji: botao.emoji || undefined,
          })),
        );

      const voltar = new ButtonBuilder()
        .setCustomId("configurar_botao")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
      const rowVoltar = new ActionRowBuilder().addComponents(voltar);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Selecione o botão que deseja remover:",
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
            new TextDisplayBuilder().setContent("❌ Botão não encontrado."),
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
        .setLabel("Adicionar")
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel("Remover")
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("botao_editar")
        .setLabel("Editar")
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel("Voltar")
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
              "Configuração do Painel: Botão",
            ),
            new TextDisplayBuilder().setContent(
              `✅ Botão **${botaoRemovido.nome}** removido com sucesso!`,
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
              "❌ Nenhuma opção de select encontrada para remover.",
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
        .setPlaceholder("Selecione a opção que deseja remover")
        .addOptions(
          selects.map((select) => ({
            label: select.nome || "Sem nome",
            value: select.id,
            description: `ID: ${select.id}`,
            emoji: select.selectoptions || undefined,
          })),
        );

      const voltarButton = new ButtonBuilder()
        .setCustomId("configurar_select")
        .setLabel("Voltar")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmoji(emojis.arrowl));

      const row1 = new ActionRowBuilder().addComponents(selectMenu);
      const row2 = new ActionRowBuilder().addComponents(voltarButton);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Selecione a opção que deseja remover do select:",
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
              "❌ Opção de select não encontrada.",
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
        .setLabel("Adicionar")
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(selects.length >= 10);

      const remover = new ButtonBuilder()
        .setCustomId("select_remover")
        .setLabel("Remover")
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("select_editar")
        .setLabel("Editar")
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel("Voltar")
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
              "Configuração do Painel: Select",
            ),
            new TextDisplayBuilder().setContent(
              "Escolha uma das ações abaixo.",
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
              "❌ Nenhum botão encontrado para editar.",
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
        .setLabel("Adicionar")
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel("Remover")
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Editar Botões"),
            new TextDisplayBuilder().setContent(
              `Página 1 de ${totalPaginas}\n\nSelecione um botão para editar:`,
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
        .setPlaceholder("Selecione o campo que deseja editar")
        .addOptions([
          {
            label: "Voltar",
            value: "voltar_botao",
            emoji: getEmoji(emojis.arrowl),
          },
          { label: "Nome", value: "nome", emoji: getEmoji(emojis.title) },
          {
            label: "Categoria",
            value: "categoria",
            emoji: getEmoji(emojis.folder),
          },
          { label: "Emoji", value: "emoji", emoji: getEmoji(emojis.boost1) },
          {
            label: "Início do Ticket",
            value: "inicio",
            emoji: getEmoji(emojis.home),
          },
          { label: "Cor", value: "cor", emoji: getEmoji(emojis.colorpicker) },
        ]);

      const row = new ActionRowBuilder().addComponents(editarCamposSelect);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Edição de Botão"),
            new TextDisplayBuilder().setContent(
              `Configure abaixo as propriedades do botão:\n\n**ID:** \`${botao.id}\``,
            ),
            new TextDisplayBuilder().setContent(
              `**Nome:** ${botao.nome || "Não definido"}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Categoria:** ${
                botao.categoria
                  ? botao.categoria
                      .split(",")
                      .map((id) => `<#${id}>`)
                      .join(" ")
                  : "Não definida"
              }`,
            ),
            new TextDisplayBuilder().setContent(
              `**Emoji:** ${botao.emoji || "Não definido"}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Início do Ticket:** ${botao.inicio || "Não definido"}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Cor:** ${botao.cor || "Não definida"}`,
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
            new TextDisplayBuilder().setContent("❌ Botão não encontrado."),
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
            new TextDisplayBuilder().setContent("❌ Botão não encontrado."),
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
          .setLabel("Adicionar")
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(botoes.length >= 5);

        const remover = new ButtonBuilder()
          .setCustomId("botao_remover")
          .setLabel("Remover")
          .setEmoji(getEmoji(emojis.minus))
          .setStyle(ButtonStyle.Secondary);

        const editar = new ButtonBuilder()
          .setCustomId("botao_editar")
          .setLabel("Editar")
          .setEmoji(getEmoji(emojis.title))
          .setStyle(ButtonStyle.Secondary);

        const voltar = new ButtonBuilder()
          .setCustomId("sistema_ticket")
          .setLabel("Voltar")
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
                "Configuração do Painel: Botão",
              ),
              new TextDisplayBuilder().setContent(
                "Escolha uma das ações abaixo.",
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
          .setTitle("Editar Nome do Botão");

        const input = new TextInputBuilder()
          .setCustomId("novo_nome")
          .setLabel("Digite o novo nome do botão")
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
            .setPlaceholder("Selecione uma ou mais categorias")
            .setMinValues(1)
            .setMaxValues(5)
            .addChannelTypes(ChannelType.GuildCategory),
        );

        const categoriasTexto =
          categoriasSalvas.length > 0
            ? categoriasSalvas.map((id) => `<#${id}>`).join(", ")
            : "Nenhuma categoria vinculada ainda.";

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "📂 Selecione as categorias que deseja vincular ao botão.",
              ),
              new TextDisplayBuilder().setContent(
                `**Categorias atuais:** ${categoriasTexto}`,
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
          .setTitle("Editar Emoji do Botão");

        const input = new TextInputBuilder()
          .setCustomId("novo_emoji")
          .setLabel("Utilize emojis padrões ou do discord.")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(botao.emoji || "");

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        return interaction.showModal(modal);
      } else if (campoSelecionado === "inicio") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_editar_inicio_botao_${botao.id}`)
          .setTitle("Editar Início do Ticket");

        const input = new TextInputBuilder()
          .setCustomId("novo_inicio")
          .setLabel("Digite até 20 caracteres.")
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
            .setLabel("Azul")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId(`cor_cinza_${botao.id}`)
            .setLabel("Cinza")
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId(`cor_vermelho_${botao.id}`)
            .setLabel("Vermelho")
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId(`cor_verde_${botao.id}`)
            .setLabel("Verde")
            .setStyle(ButtonStyle.Success),
        );

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "🎨 Selecione a cor do botão:",
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
              "❌ Nenhum dado de personalização encontrado. Configure o sistema primeiro.",
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
              "❌ Você precisa configurar pelo menos um botão ou select antes de enviar o painel.",
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
        .setPlaceholder("Escolha o tipo de painel");

      const opcoes = [];

      if (botoes.length > 0) {
        opcoes.push({
          label: "Painel com Botões",
          value: "botao",
          description: `${botoes.length} botão(ões) configurado(s)`,
          emoji: getEmoji(emojis.cube),
        });
      }

      if (selects.length > 0) {
        opcoes.push({
          label: "Painel com Select Menu",
          value: "select",
          description: `${selects.length} opção(ões) configurada(s)`,
          emoji: getEmoji(emojis.cube),
        });
      }

      selectTipo.addOptions(opcoes);

      const voltarBtn = new ButtonBuilder()
        .setCustomId("voltar_inicio")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("# Enviar Painel de Tickets"),
            new TextDisplayBuilder().setContent(
              "Selecione o tipo de painel que deseja enviar:",
            ),
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
          .setTitle("Nome do Botão");

        const input = new TextInputBuilder()
          .setCustomId("nome")
          .setLabel("Digite o nome do botão")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "categoria") {
        const selectCategoria = new ChannelSelectMenuBuilder()
          .setCustomId(`select_config_botao_categoria_${botaoId}`)
          .setPlaceholder("Selecione uma ou mais categorias")
          .setMinValues(1)
          .setMaxValues(5)
          .addChannelTypes(ChannelType.GuildCategory);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("Selecione as Categorias"),
              new TextDisplayBuilder().setContent(
                "Escolha as categorias onde os tickets serão criados.",
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
          .setTitle("Tag Inicial do Ticket");

        const input = new TextInputBuilder()
          .setCustomId("inicio")
          .setLabel("Digite a tag inicial (máx 5 caracteres)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(5)
          .setPlaceholder("Ex: sup-");

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
                "Preencha pelo menos o nome e a categoria antes de salvar.",
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
          .setLabel("Adicionar")
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(botoes.length >= 5);

        const remover = new ButtonBuilder()
          .setCustomId("botao_remover")
          .setLabel("Remover")
          .setEmoji(getEmoji(emojis.minus))
          .setStyle(ButtonStyle.Secondary);

        const editar = new ButtonBuilder()
          .setCustomId("botao_editar")
          .setLabel("Editar")
          .setEmoji(getEmoji(emojis.title))
          .setStyle(ButtonStyle.Secondary);

        const voltar = new ButtonBuilder()
          .setCustomId("sistema_ticket")
          .setLabel("Voltar")
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "Configuração do Painel: Botão",
              ),
              new TextDisplayBuilder().setContent(
                `Botão **${botao.nome}** salvo com sucesso!`,
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
            new TextDisplayBuilder().setContent("❌ Emoji não encontrado."),
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
          .setTitle("Inserir Emoji Manualmente");

        const input = new TextInputBuilder()
          .setCustomId("emoji")
          .setLabel("Cole o emoji ou ID do emoji")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("Ex: 🎫 ou :nome_emoji: ou ID");

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
          .setTitle("Nome da Opção");

        const input = new TextInputBuilder()
          .setCustomId("nome")
          .setLabel("Digite o nome da opção")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "categoria") {
        const selectCategoria = new ChannelSelectMenuBuilder()
          .setCustomId(`select_config_select_categoria_${selectId}`)
          .setPlaceholder("Selecione uma ou mais categorias")
          .setMinValues(1)
          .setMaxValues(5)
          .addChannelTypes(ChannelType.GuildCategory);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("Selecione as Categorias"),
              new TextDisplayBuilder().setContent(
                "Escolha as categorias onde os tickets serão criados.",
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
          .setTitle("Tag Inicial do Ticket");

        const input = new TextInputBuilder()
          .setCustomId("inicio")
          .setLabel("Digite a tag inicial (máx 5 caracteres)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(5)
          .setPlaceholder("Ex: sup-");

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
                "Preencha pelo menos o nome e a categoria antes de salvar.",
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
          .setLabel("Adicionar")
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(selects.length >= 10);

        const remover = new ButtonBuilder()
          .setCustomId("select_remover")
          .setLabel("Remover")
          .setEmoji(getEmoji(emojis.minus))
          .setStyle(ButtonStyle.Secondary);

        const editar = new ButtonBuilder()
          .setCustomId("select_editar")
          .setLabel("Editar")
          .setEmoji(getEmoji(emojis.title))
          .setStyle(ButtonStyle.Secondary);

        const voltar = new ButtonBuilder()
          .setCustomId("sistema_ticket")
          .setLabel("Voltar")
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "Configuração do Painel: Select",
              ),
              new TextDisplayBuilder().setContent(
                `Opção **${select.nome}** salva com sucesso!`,
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
        .setTitle("Descrição da Opção");

      const input = new TextInputBuilder()
        .setCustomId("descricao")
        .setLabel("Digite a descrição (opcional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100)
        .setPlaceholder("Aparece abaixo do nome no select menu")
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
              "Nenhum painel foi enviado ainda. Use /ticket para enviar o painel primeiro.",
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
            new TextDisplayBuilder().setContent("Canal não encontrado."),
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
            label: sel.nome || "Ticket",
            value: `select_${sel.id}`,
            description:
              sel.descricao ||
              `Abrir ticket para: ${sel.nome || "Atendimento"}`,
            emoji: parseEmoji(sel.emoji, interaction.guild) || undefined,
          }));

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("Escolha uma opção")
            .addOptions(options);

          containerTicket.addActionRowComponents(
            new ActionRowBuilder().addComponents(selectMenu),
          );
        } else if (!tinhaSelectMenu && temBotoes) {
          const botoesFormatados = botoes.map((botao) => {
            const button = new ButtonBuilder()
              .setCustomId(`ticket_botoes_${botao.id}`)
              .setLabel(botao.nome || "Abrir")
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
              "Erro ao atualizar o painel. A mensagem pode ter sido deletada.",
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
        return null;
      if (typeof colorString === "number") return colorString;
      const cleanColor = colorString.replace("#", "");
      const colorInt = parseInt(cleanColor, 16);
      return !isNaN(colorInt) ? colorInt : null;
    }

    function parseEmoji(emojiString, guild) {
      if (!emojiString) return null;
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
      return null;
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
        .setLabel("Adicionar")
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel("Remover")
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("botao_editar")
        .setLabel("Editar")
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Configuração do Painel: Botão",
            ),
            new TextDisplayBuilder().setContent(
              "Escolha uma das ações abaixo.",
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
        .setLabel("Adicionar")
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(selects.length >= 10);

      const remover = new ButtonBuilder()
        .setCustomId("select_remover")
        .setLabel("Remover")
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId("select_editar")
        .setLabel("Editar")
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Configuração do Painel: Select",
            ),
            new TextDisplayBuilder().setContent(
              "Escolha uma das ações abaixo.",
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
        monday: "Segunda-feira",
        tuesday: "Terça-feira",
        wednesday: "Quarta-feira",
        thursday: "Quinta-feira",
        friday: "Sexta-feira",
        saturday: "Sábado",
        sunday: "Domingo",
      };

      const modal = new ModalBuilder()
        .setCustomId(`modal_horario_${dia}`)
        .setTitle(`Editar ${diasSemana[dia]}`);

      const startInput = new TextInputBuilder()
        .setCustomId("horario_start")
        .setLabel("Horário de Início (HH:MM)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("08:00")
        .setRequired(false)
        .setValue(horarioAtual?.start || "");

      const endInput = new TextInputBuilder()
        .setCustomId("horario_end")
        .setLabel("Horário de Término (HH:MM)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("18:00")
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
        .setLabel("Adicionar")
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel("Remover")
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Editar Botões"),
            new TextDisplayBuilder().setContent(
              `Página ${pagina + 1} de ${totalPaginas}\n\nSelecione um botão para editar:`,
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
            new TextDisplayBuilder().setContent("❌ Botão não encontrado."),
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
            new TextDisplayBuilder().setContent("❌ Botão não encontrado."),
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
                  "❌ Emoji inválido. Use um emoji padrão ou personalizado válido.",
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
                "❌ Cor inválida. Use apenas: vermelho, azul, cinza ou verde.",
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
              "❌ Botão não encontrado para atualizar.",
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
            new TextDisplayBuilder().setContent("❌ Botão não encontrado."),
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
                  "❌ Emoji inválido. Use um emoji padrão ou personalizado válido.",
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
            new TextDisplayBuilder().setContent("❌ Botão não encontrado."),
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
              "❌ Máximo de 5 caracteres permitido.",
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
        .setPlaceholder("Escolha o campo para editar")
        .addOptions([
          {
            label: "Voltar",
            value: "voltar",
            emoji: getEmoji(emojis.arrowl),
          },
          { label: "Nome", value: "nome", emoji: getEmoji(emojis.title) },
          {
            label: "Descrição",
            value: "descricao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Categoria",
            value: "categoria",
            emoji: getEmoji(emojis.folder),
          },
          { label: "Emoji", value: "emoji", emoji: getEmoji(emojis.boost1) },
          {
            label: "Início do Ticket",
            value: "inicio",
            emoji: getEmoji(emojis.home),
          },
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Edição de Select"),
            new TextDisplayBuilder().setContent(
              "Configure abaixo as propriedades do select:",
            ),
            new TextDisplayBuilder().setContent(
              `**Nome**: ${selectObj.nome || "Não definido"}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Descrição**: ${selectObj.descricao || "Não definida"}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Categoria**: ${
                selectObj.categoria
                  ? selectObj.categoria
                      .split(",")
                      .map((id) => `<#${id}>`)
                      .join(", ")
                  : "Não definido"
              }`,
            ),
            new TextDisplayBuilder().setContent(
              `**Emoji**: ${selectObj.emoji || "Não definido"}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Início do Ticket**: ${selectObj.inicio || "Não definido"}`,
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
              "❌ Select não encontrado para atualizar.",
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
            new TextDisplayBuilder().setContent("❌ Select não encontrado."),
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
                  "❌ Emoji inválido. Use um emoji padrão ou personalizado válido.",
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
              new TextDisplayBuilder().setContent("❌ Field inválido."),
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
              new TextDisplayBuilder().setContent("❌ Field não encontrado."),
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
                new TextDisplayBuilder().setContent("❌ JSON inválido."),
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
              new TextDisplayBuilder().setContent("❌ Erro ao processar JSON."),
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
                  "❌ Cor inválida. Use formato hexadecimal (ex: #2ecc71) ou deixe vazio para sem cor.",
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
        return null;

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
            new TextDisplayBuilder().setContent("Dados não encontrados."),
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
                  new TextDisplayBuilder().setContent(data.descricao),
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
                    label: sel.nome || "Ticket",
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
                  .setPlaceholder("Escolha uma opção")
                  .addOptions(options);

                containerTicket.addActionRowComponents(
                  new ActionRowBuilder().addComponents(selectMenu),
                );
              } else if (!tinhaSelectMenu && temBotoes) {
                const botoesFormatados = botoes.map((botao) => {
                  const button = new ButtonBuilder()
                    .setCustomId(`ticket_botoes_${botao.id}`)
                    .setLabel(botao.nome || "Abrir")
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
        new TextDisplayBuilder().setContent(data.title || "Sem título"),
        new TextDisplayBuilder().setContent(data.descricao || "Sem descrição"),
      ];

      if (Array.isArray(data.fields)) {
        data.fields.forEach((field) => {
          previewTexts.push(
            new TextDisplayBuilder().setContent(
              `**${field.name || "Campo sem nome"}**: ${
                field.value || "Sem valor"
              }`,
            ),
          );
        });
      }

      previewTexts.push(
        new TextDisplayBuilder().setContent(
          `**Cor**: ${data.color || "Sem cor definida"}`,
        ),
      );

      const rows = [];

      if (embedSelecionada !== "embedprincipal" && Array.isArray(data.botoes)) {
        const btns = data.botoes.map((botao) => {
          const btn = new ButtonBuilder()
            .setCustomId(`editar_botao:${botao.id}`)
            .setLabel(botao.nome || "Sem nome")
            .setStyle(ButtonStyle.Secondary);

          if (botao.emoji) btn.setEmoji(botao.emoji);
          return btn;
        });

        rows.push(new ActionRowBuilder().addComponents(...btns));
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_personalizacao_embed")
        .setPlaceholder("Escolha uma embed para personalizar")
        .addOptions([
          {
            label: "Embed Principal",
            description: "Personalize a embed usada no painel de tickets.",
            value: "embedprincipal",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Ticket",
            description: "Personalize a embed usada dentro do ticket.",
            value: "embedticket",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Logs",
            description: "Personalize a embed usada nos logs de fechamento.",
            value: "embedlogs",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Logs User",
            description: "Personalize a embed enviada para o autor do ticket.",
            value: "embedlogsuser",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Notificar",
            description:
              "Personalize a embed enviada ao ser feita uma chamada.",
            value: "embednotificar",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Avaliação",
            description: "Personalize a embed de avaliação enviada ao usuário.",
            value: "embedavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Log Avaliação",
            description: "Personalize a embed de log de avaliações.",
            value: "embedlogavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Assumido",
            description:
              "Personalize a embed enviada quando o ticket é assumido.",
            value: "embedassumido",
            emoji: getEmoji(emojis.embeds),
          },
        ]);

      rows.push(new ActionRowBuilder().addComponents(selectMenu));

      const editarMenuOptions = [
        { label: "Título", value: "titulo", emoji: getEmoji(emojis.title) },
        {
          label: "Descrição",
          value: "descricao",
          emoji: getEmoji(emojis.embeds),
        },
        { label: "Cor", value: "cor", emoji: getEmoji(emojis.colorpicker) },
        { label: "Banner", value: "banner", emoji: getEmoji(emojis.image) },
        {
          label: "Placeholders disponíveis",
          value: "placeholders",
          emoji: getEmoji(emojis.cube),
        },
      ];

      if (Array.isArray(data.fields)) {
        data.fields.forEach((field, i) => {
          editarMenuOptions.push({
            label: `Field ${i + 1} - ${field.name || "Sem nome"}`,
            value: `field_${i}`,
            emoji: getEmoji(emojis.fields),
          });
        });
      }

      const editarMenu = new StringSelectMenuBuilder()
        .setCustomId(`editar_info_embed:${embedSelecionada}`)
        .setPlaceholder("Editar conteúdo da embed")
        .addOptions(editarMenuOptions);
      rows.push(new ActionRowBuilder().addComponents(editarMenu));

      const btnAtualizar = new ButtonBuilder()
        .setCustomId("atualizar_painel_embed_principal")
        .setLabel("Atualizar Painel")
        .setEmoji(getEmoji(emojis.settings))
        .setStyle(ButtonStyle.Success);

      const voltarButton = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel("Voltar")
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
                "❌ Valor inválido! Digite um número inteiro maior ou igual a 1.",
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
              "❌ Máximo de 5 caracteres permitido.",
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
            new TextDisplayBuilder().setContent("❌ Select não encontrado."),
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
              "❌ Dados dos fields não encontrados.",
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
            .setLabel(botao.nome || "Sem nome")
            .setStyle(ButtonStyle.Secondary);

          if (botao.emoji) btn.setEmoji(botao.emoji);

          return btn;
        });

        rows.push(new ActionRowBuilder().addComponents(...btns));
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_personalizacao_embed")
        .setPlaceholder("Escolha uma embed para personalizar")
        .addOptions([
          {
            label: "Embed Principal",
            description: "Personalize a embed usada no painel de tickets.",
            value: "embedprincipal",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Ticket",
            description: "Personalize a embed usada dentro do ticket.",
            value: "embedticket",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Logs",
            description: "Personalize a embed usada nos logs de fechamento.",
            value: "embedlogs",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Logs User",
            description: "Personalize a embed enviada para o autor do ticket.",
            value: "embedlogsuser",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Notificar",
            description:
              "Personalize a embed enviada ao ser feita uma chamada.",
            value: "embednotificar",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Avaliação",
            description: "Personalize a embed de avaliação enviada ao usuário.",
            value: "embedavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Log Avaliação",
            description: "Personalize a embed de log de avaliações.",
            value: "embedlogavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Assumido",
            description:
              "Personalize a embed enviada quando o ticket é assumido.",
            value: "embedassumido",
            emoji: getEmoji(emojis.embeds),
          },
        ]);

      rows.push(new ActionRowBuilder().addComponents(selectMenu));

      const editarMenuOptions = [
        { label: "Título", value: "titulo", emoji: getEmoji(emojis.title) },
        {
          label: "Descrição",
          value: "descricao",
          emoji: getEmoji(emojis.embeds),
        },
        { label: "Cor", value: "cor", emoji: getEmoji(emojis.colorpicker) },
        { label: "Banner", value: "banner", emoji: getEmoji(emojis.image) },
        {
          label: "Placeholders disponíveis",
          value: "placeholders",
          emoji: getEmoji(emojis.cube),
        },
      ];

      if (Array.isArray(data.fields)) {
        data.fields.forEach((field, i) => {
          editarMenuOptions.push({
            label: `Field ${i + 1} - ${field.name || "Sem nome"}`,
            value: `field_${i}`,
            emoji: getEmoji(emojis.fields),
          });
        });
      }

      const editarMenu = new StringSelectMenuBuilder()
        .setCustomId(`editar_info_embed:${embedSelecionada}`)
        .setPlaceholder("Editar conteúdo da embed")
        .addOptions(editarMenuOptions);

      rows.push(new ActionRowBuilder().addComponents(editarMenu));

      const voltarButton = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      rows.push(new ActionRowBuilder().addComponents(voltarButton));

      const previewTexts = [
        new TextDisplayBuilder().setContent(dados.titulo || "Sem título"),
        new TextDisplayBuilder().setContent(dados.descricao || "Sem descrição"),
      ];

      if (Array.isArray(dados.fields)) {
        dados.fields.forEach((f) => {
          previewTexts.push(
            new TextDisplayBuilder().setContent(
              `**${f.name || "Campo sem nome"}**: ${f.value || "Sem valor"}`,
            ),
          );
        });
      }

      previewTexts.push(
        new TextDisplayBuilder().setContent(`**Cor**: ${dados.cor || "White"}`),
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
            new TextDisplayBuilder().setContent("❌ Select não encontrado."),
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
            new TextDisplayBuilder().setContent("❌ Botão não encontrado."),
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

      return interaction.editReply({
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
              "❌ Opção de select não encontrada.",
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
            .setLabel("Adicionar")
            .setEmoji(getEmoji(emojis.plus))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(selects.length >= 10);

          const remover = new ButtonBuilder()
            .setCustomId("select_remover")
            .setLabel("Remover")
            .setEmoji(getEmoji(emojis.minus))
            .setStyle(ButtonStyle.Secondary);

          const editar = new ButtonBuilder()
            .setCustomId("select_editar")
            .setLabel("Editar")
            .setEmoji(getEmoji(emojis.title))
            .setStyle(ButtonStyle.Secondary);

          const voltar = new ButtonBuilder()
            .setCustomId("sistema_ticket")
            .setLabel("Voltar")
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
                  "Configuração do Painel: Select",
                ),
                new TextDisplayBuilder().setContent(
                  "Escolha uma das ações abaixo.",
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
            new TextDisplayBuilder().setContent("❌ Select não encontrado."),
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
          .setTitle("Editar Nome do Select");

        const inputNome = new TextInputBuilder()
          .setCustomId("novo_nome")
          .setLabel("Digite o novo nome")
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
          .setTitle("Descrição da Opção");

        const input = new TextInputBuilder()
          .setCustomId("descricao")
          .setLabel("Digite a descrição (opcional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(100)
          .setPlaceholder("Aparece abaixo do nome no select menu");

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "categoria") {
        const selectObj = selects[selectObjIndex];

        const selectChannel = new ChannelSelectMenuBuilder()
          .setCustomId(`select_categoria_select_${selectId}`)
          .setPlaceholder("Escolha as categorias permitidas")
          .setMinValues(1)
          .setMaxValues(25)
          .addChannelTypes(ChannelType.GuildCategory);

        const row = new ActionRowBuilder().addComponents(selectChannel);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `📂 Selecione as categorias para o select: **${selectObj.nome}**`,
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
          .setTitle("Editar Emoji do Select");

        const input = new TextInputBuilder()
          .setCustomId("novo_emoji")
          .setLabel("Emoji (padrão ou personalizado)")
          .setPlaceholder("Utilize emojis padrões ou do discord.")
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
            new TextDisplayBuilder().setContent("❌ Select não encontrado."),
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
              "❌ Não foi possível encontrar os dados dessa embed.",
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const previewTexts = [
        new TextDisplayBuilder().setContent(data.title || "Sem título"),
        new TextDisplayBuilder().setContent(data.descricao || "Sem descrição"),
      ];

      if (Array.isArray(data.fields)) {
        data.fields.forEach((field) => {
          previewTexts.push(
            new TextDisplayBuilder().setContent(
              `**${field.name || "Campo sem nome"}**: ${
                field.value || "Sem valor"
              }`,
            ),
          );
        });
      }

      previewTexts.push(
        new TextDisplayBuilder().setContent(
          `**Cor**: ${data.color || "White"}`,
        ),
      );

      const rows = [];

      if (embedSelecionada !== "embedprincipal" && Array.isArray(data.botoes)) {
        const btns = data.botoes.map((botao) => {
          const btn = new ButtonBuilder()
            .setCustomId(`editar_botao:${botao.id}`)
            .setLabel(botao.nome || "Sem nome")
            .setStyle(ButtonStyle.Secondary);

          if (botao.emoji) btn.setEmoji(botao.emoji);

          return btn;
        });

        rows.push(new ActionRowBuilder().addComponents(...btns));
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_personalizacao_embed")
        .setPlaceholder("Escolha uma embed para personalizar")
        .addOptions([
          {
            label: "Embed Principal",
            description: "Personalize a embed usada no painel de tickets.",
            value: "embedprincipal",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Ticket",
            description: "Personalize a embed usada dentro do ticket.",
            value: "embedticket",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Logs",
            description: "Personalize a embed usada nos logs de fechamento.",
            value: "embedlogs",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Logs User",
            description: "Personalize a embed enviada para o autor do ticket.",
            value: "embedlogsuser",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Notificar",
            description:
              "Personalize a embed enviada ao ser feita uma chamada.",
            value: "embednotificar",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Avaliação",
            description: "Personalize a embed de avaliação enviada ao usuário.",
            value: "embedavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Log Avaliação",
            description: "Personalize a embed de log de avaliações.",
            value: "embedlogavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: "Embed Assumido",
            description:
              "Personalize a embed enviada quando o ticket é assumido.",
            value: "embedassumido",
            emoji: getEmoji(emojis.embeds),
          },
        ]);

      rows.push(new ActionRowBuilder().addComponents(selectMenu));

      const editarMenuOptions = [
        { label: "Título", value: "titulo", emoji: getEmoji(emojis.title) },
        {
          label: "Descrição",
          value: "descricao",
          emoji: getEmoji(emojis.embeds),
        },
        { label: "Cor", value: "cor", emoji: getEmoji(emojis.colorpicker) },
        { label: "Banner", value: "banner", emoji: getEmoji(emojis.image) },
        {
          label: "Placeholders disponíveis",
          value: "placeholders",
          emoji: getEmoji(emojis.cube),
        },
      ];

      if (Array.isArray(data.fields)) {
        data.fields.forEach((field, i) => {
          editarMenuOptions.push({
            label: `Field ${i + 1} - ${field.name || "Sem nome"}`,
            value: `field_${i}`,
            emoji: getEmoji(emojis.fields),
          });
        });
      }

      const editarMenu = new StringSelectMenuBuilder()
        .setCustomId(`editar_info_embed:${embedSelecionada}`)
        .setPlaceholder("Editar conteúdo da embed")
        .addOptions(editarMenuOptions);

      rows.push(new ActionRowBuilder().addComponents(editarMenu));

      const voltarButton = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel("Voltar")
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
              "❌ Não foi possível encontrar os dados dessa embed.",
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const options = [
        { label: "Título", value: "titulo", emoji: getEmoji(emojis.title) },
        {
          label: "Descrição",
          value: "descricao",
          emoji: getEmoji(emojis.embeds),
        },
        { label: "Cor", value: "cor", emoji: getEmoji(emojis.colorpicker) },
        {
          label: "Placeholders disponíveis",
          value: "placeholders",
          emoji: getEmoji(emojis.cube),
        },
      ];

      if (Array.isArray(dados.fields)) {
        dados.fields.forEach((field, index) => {
          options.push({
            label: `Field ${index + 1} - ${field.name || "Sem nome"}`,
            value: `field_${index}`,
          });
        });
      }

      if (escolha.startsWith("field_")) {
        const fieldIndex = parseInt(escolha.split("_")[1], 10);
        if (isNaN(fieldIndex) || !dados.fields || !dados.fields[fieldIndex]) {
          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent("❌ Field inválido."),
            ),
          ];

          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }
        const field = dados.fields[fieldIndex];

        const modal = new ModalBuilder()
          .setTitle(`Editar Field ${fieldIndex + 1}`)
          .setCustomId(`salvar_edicao_field:${embedSelecionada}:${fieldIndex}`);

        const nameInput = new TextInputBuilder()
          .setCustomId("field_name")
          .setLabel("Nome do campo")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(limparEmojisProcessados(field.name || ""));

        const valueInput = new TextInputBuilder()
          .setCustomId("field_value")
          .setLabel("Valor do campo")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(limparEmojisProcessados(field.value || ""));

        const inlineInput = new TextInputBuilder()
          .setCustomId("field_inline")
          .setLabel("Inline (true/false)")
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
        .setTitle("Editar Embed")
        .setCustomId(`salvar_edicao_info_embed:${embedSelecionada}:${escolha}`);

      if (escolha === "titulo") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("novo_valor")
              .setLabel("Novo título")
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
              .setLabel("Nova descrição")
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
              .setLabel("Nova cor (hexadecimal, ex: #ffffff)")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setPlaceholder("Deixe vazio para sem cor")
              .setValue(dados.color || ""),
          ),
        );
      } else if (escolha === "banner") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("novo_valor")
              .setLabel("URL do novo banner")
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
            new TextDisplayBuilder().setContent("❌ Opção inválida."),
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
              "❌ Dados dos fields não encontrados.",
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
        .setTitle(`Editar Field ${fieldIndex + 1}`)
        .setCustomId(`salvar_edicao_field:${embedSelecionada}:${fieldIndex}`);

      const nameInput = new TextInputBuilder()
        .setCustomId("field_name")
        .setLabel("Nome do campo")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(field.name || "");

      const valueInput = new TextInputBuilder()
        .setCustomId("field_value")
        .setLabel("Valor do campo")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(field.value || "");

      const inlineInput = new TextInputBuilder()
        .setCustomId("field_inline")
        .setLabel("Inline (true/false)")
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
        .setPlaceholder("Selecione o canal para enviar o painel")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);

      const voltarBtn = new ButtonBuilder()
        .setCustomId("enviar_ticket_painel")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("# Selecionar Canal"),
            new TextDisplayBuilder().setContent(
              `Tipo de painel: **${
                tipoPainel === "botao" ? "Botões" : "Select Menu"
              }**\n\nEscolha o canal onde o painel será enviado:`,
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
      if (!emojiString) return null;

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

      return null;
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
              "❌ Sessão expirada. Tente novamente.",
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
            new TextDisplayBuilder().setContent("❌ Canal não encontrado."),
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
          return null;
        if (typeof colorString === "number") return colorString;
        const cleanColor = colorString.replace("#", "");
        const colorInt = parseInt(cleanColor, 16);
        return !isNaN(colorInt) ? colorInt : null;
      }
      function parseEmoji(emojiString, guild) {
        if (!emojiString) return null;
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
        return null;
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
              `**${embedData.title || "🎫 Painel de Tickets"}**`,
            ),
          );
          if (embedData.descricao) {
            containerTicket.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                embedData.descricao ||
                  "Abra seu ticket usando o painel abaixo.",
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
              .setLabel(botao.nome || "Abrir")
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
              label: sel.nome || "Ticket",
              value: `select_${sel.id}`,
              description: `Abrir ticket para: ${sel.nome || "Atendimento"}`,
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
            .setPlaceholder("Escolha uma opção")
            .addOptions(
              selects.map((sel) => {
                const option = {
                  label: sel.nome || "Ticket",
                  value: `select_${sel.id}`,
                  description:
                    sel.descricao ||
                    `Abrir ticket para: ${sel.nome || "Atendimento"}`,
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
              `**${embedData.title || "🎫 Painel de Tickets"}**`,
            ),
          );
          if (embedData.descricao) {
            containerTicket.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                embedData.descricao ||
                  "Abra seu ticket usando o painel abaixo.",
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
          .setLabel("Configurar")
          .setEmoji(getEmoji(emojis.settings))
          .setStyle(ButtonStyle.Primary);

        const buttonBanco = new ButtonBuilder()
          .setCustomId("banco_ticket")
          .setLabel("Banco de Dados")
          .setEmoji(getEmoji(emojis.cardbox))
          .setStyle(ButtonStyle.Primary);

        const buttonPix = new ButtonBuilder()
          .setCustomId("pix_ticket")
          .setLabel("Pix")
          .setEmoji(getEmoji(emojis.dollar))
          .setStyle(ButtonStyle.Primary);

        const enviarTicketBtn = new ButtonBuilder()
          .setCustomId("enviar_ticket_painel")
          .setLabel("Enviar Ticket")
          .setEmoji(getEmoji(emojis.embeds))
          .setStyle(ButtonStyle.Success);

        const iaSetupBtn = new ButtonBuilder()
          .setCustomId("ia_setup_inicial")
          .setLabel("Setup com IA")
          .setEmoji(getEmoji(emojis.bot))
          .setStyle(ButtonStyle.Success);

        const buttonSuporte = new ButtonBuilder()
          .setLabel("Suporte")
          .setEmoji(getEmoji(emojis.suporte))
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/MmUB4H3uCM");

        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `# Painel Principal | ${interaction.guild.name}`,
            ),
          ),
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `Use os botões abaixo para acessar as configurações e o banco de dados e muito mais!\n\n-# Ping do bot: ${client.ws.ping}ms`,
              ),
            )
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "**Configurar Ticket**\nGerencie as configurações do sistema de tickets",
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
              "❌ Erro ao enviar o painel. Verifique se o bot tem permissão para enviar mensagens neste canal.",
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
              "❌ Nenhuma opção de select encontrada para editar.",
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
        .setPlaceholder("Selecione a opção que deseja editar")
        .addOptions(
          selects.map((s) => {
            const option = {
              label: s.nome || "Sem nome",
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
              "Selecione a opção que deseja editar:",
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
      if (!emojiString) return null;

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
              "Você já atingiu o limite máximo de 5 botões.",
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
              "Você já atingiu o limite máximo de 10 opções no select menu.",
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