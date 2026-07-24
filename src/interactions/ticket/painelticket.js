const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  LabelBuilder,
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
const { t, getGuildLocale, setGuildLocale, LOCALE_LABELS, SUPPORTED } = require("../../utils/i18n");

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
} = require("./helpers");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const handlerEstacoes = require("./estacoes");
const handlerIA = require("./ia");
const handlerLogs = require("./logs");
const handlerEquipe = require("./equipe");
const handlerHorarios = require("./horarios");
const handlerVisual = require("./visual");
const handlerTags = require("./tags");
const handlerAvaliacaoCriterios = require("./avaliacao-criterios");
const handlerPainelOverview = require("./painel-overview");
const handlerConfigInatividade = require("./config-inatividade");
const handlerFormularioEstacao = require("./formulario-estacao");
const handlerEstatisticasEstacao = require("./estatisticas-estacao");
const handlerBlacklist = require("./blacklist");

function buildOutrosTicketComponents(guildId) {
  const db = getConfigDB(guildId);
  const valorAtual = db.get("limit") ?? "1";
  const mencionarAoAbrir = db.get("mencionar_ao_abrir") ?? false;
  const notificarAutorAoAssumir = db.get("notificar_autor_ao_assumir") ?? false;
  const solicitarMotivo = db.get("solicitar_motivo") ?? false;
  const fecharAoSair = db.get("fechar_ao_sair_servidor") ?? false;
  const fecharAoSairTicket = db.get("fechar_ao_sair_ticket") ?? false;

  const limiteBtn = new ButtonBuilder()
    .setCustomId("limite_ticket")
    .setLabel(t("outros_limite_btn", guildId))
    .setEmoji(getEmoji(emojis.lock))
    .setStyle(ButtonStyle.Secondary);
  const toggleMencionar = new ButtonBuilder()
    .setCustomId("toggle_mencionar_ao_abrir")
    .setLabel(t("outros_mencionar_btn", guildId))
    .setEmoji(getEmoji(mencionarAoAbrir ? emojis.check : emojis.cancel))
    .setStyle(mencionarAoAbrir ? ButtonStyle.Success : ButtonStyle.Secondary);
  const toggleAssumido = new ButtonBuilder()
    .setCustomId("toggle_notificar_ao_assumir")
    .setLabel(t("outros_notificar_btn", guildId))
    .setEmoji(getEmoji(notificarAutorAoAssumir ? emojis.check : emojis.cancel))
    .setStyle(
      notificarAutorAoAssumir ? ButtonStyle.Success : ButtonStyle.Secondary,
    );
  const toggleMotivo = new ButtonBuilder()
    .setCustomId("toggle_solicitar_motivo")
    .setLabel(t("outros_motivo_btn", guildId))
    .setEmoji(getEmoji(solicitarMotivo ? emojis.check : emojis.cancel))
    .setStyle(solicitarMotivo ? ButtonStyle.Success : ButtonStyle.Secondary);
  const toggleFecharSairServidor = new ButtonBuilder()
    .setCustomId("toggle_fechar_ao_sair_servidor")
    .setLabel(t("outros_fechar_servidor_btn", guildId))
    .setEmoji(getEmoji(fecharAoSair ? emojis.check : emojis.cancel))
    .setStyle(fecharAoSair ? ButtonStyle.Success : ButtonStyle.Secondary);
  const toggleFecharSairTicket = new ButtonBuilder()
    .setCustomId("toggle_fechar_ao_sair_ticket")
    .setLabel(t("outros_fechar_ticket_btn", guildId))
    .setEmoji(getEmoji(fecharAoSairTicket ? emojis.check : emojis.cancel))
    .setStyle(fecharAoSairTicket ? ButtonStyle.Success : ButtonStyle.Secondary);
  const voltarBtn = new ButtonBuilder()
    .setCustomId("configurar_ticket")
    .setLabel(t("btn_voltar", guildId))
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          t("outros_pg1_titulo", guildId),
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("outros_limite_secao", guildId, { valor: valorAtual }),
            ),
          )
          .setButtonAccessory(limiteBtn),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("outros_mencionar_secao", guildId),
            ),
          )
          .setButtonAccessory(toggleMencionar),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("outros_notificar_secao", guildId),
            ),
          )
          .setButtonAccessory(toggleAssumido),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("outros_motivo_secao", guildId),
            ),
          )
          .setButtonAccessory(toggleMotivo),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("outros_fechar_servidor_secao", guildId),
            ),
          )
          .setButtonAccessory(toggleFecharSairServidor),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("outros_fechar_ticket_secao", guildId),
            ),
          )
          .setButtonAccessory(toggleFecharSairTicket),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**${emojis.sparks} Sistemas Avançados**`,
        ),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("outros_tags_secao", guildId),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId("config_tags_sistema")
              .setLabel(t("outros_tags_btn", guildId))
              .setEmoji(getEmoji(emojis.thread))
              .setStyle(ButtonStyle.Secondary),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("outros_overview_secao", guildId),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId("config_overview_")
              .setLabel(t("outros_overview_btn", guildId))
              .setEmoji(getEmoji(emojis.chart))
              .setStyle(ButtonStyle.Secondary),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("outros_avaliacao_secao", guildId),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId("config_avaliacao_criterios")
              .setLabel(t("outros_avaliacao_btn", guildId))
              .setEmoji(getEmoji(emojis.star))
              .setStyle(ButtonStyle.Secondary),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("outros_inatividade_secao", guildId),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId("config_inatividade_auto")
              .setLabel(t("btn_configurar", guildId))
              .setEmoji(getEmoji(emojis.clock))
              .setStyle(ButtonStyle.Secondary),
          ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large),
      )
      .addActionRowComponents(new ActionRowBuilder().addComponents(voltarBtn)),
  ];
}

module.exports = {
  buildOutrosTicketComponents,
  async execute(client, interaction) {
    if (!interaction.guild || !interaction.guildId) return;

    const ticketPanelIds = [
      "configurar_ticket",
      "voltar_inicio",
      "toggle_system",
      "team_ticket",
      "personalizar_ticket",
      "sistema_ticket",
      "horarios_ticket",
      "toggle_horario",
      "voltar_horario",
      "editar_monday",
      "editar_tuesday",
      "editar_wednesday",
      "editar_thursday",
      "editar_friday",
      "editar_saturday",
      "editar_sunday",
      "configurar_botao",
      "configurar_select",
      "botao_adicionar",
      "botao_remover",
      "botao_editar",
      "select_adicionar",
      "select_remover",
      "select_editar",
      "remover_botao_select",
      "remover_select_select",
      "adicionar_cargo",
      "adicionar_usuario",
      "usuarios_permitidos",
      "limpar_permissoes",
      "eq_add_role",
      "eq_add_user",
      "eq_listar",
      "eq_limpar",
      "eq_perm_atender_",
      "eq_perm_configurar_",
      "eq_remover_usuario_",
      "eq_select_roles",
      "eq_select_user",
      "modal_eq_add_user",
      "modal_eq_limpar",
      "logs_ticket",
      "outros_ticket",
      "blacklist_ticket",
      "bl_add_user",
      "bl_add_role",
      "bl_listar",
      "bl_limpar",
      "bl_remove_user_",
      "bl_remove_role_",
      "bl_confirm_limpar",
      "bl_cancel_limpar",
      "bl_select_user",
      "bl_select_role",
      "transcript_ticket",
      "avaliacao_ticket",
      "ia_ticket",
      "ia_setup_inicial",
      "limite_ticket",
      "enviar_ticket_painel",
      "atualizar_painel_embed_principal",
      "config_idioma",
      "set_idioma_",
      "toggle_",
      "perm_",
      "cor_",
      "editar_botao",
      "editar_select",
      "toggle_log_",
      "toggle_transcript_",
      "toggle_ia_",
      "toggle_mencionar_",
      "toggle_notificar_",
      "toggle_solicitar_",
      "toggle_fechar_",
      "ia_",
      "config_botao_",
      "config_select_",
      "emoji_",
      "modal_",
      "cancelar_config_botao_",
      "cancelar_config_select_",
      "gerenciar_estacoes",
      "criar_estacao",
      "editar_estacao_",
      "personalizar_estacao_",
      "botoes_estacao_",
      "selects_estacao_",
      "enviar_estacao_",
      "renomear_estacao_",
      "excluir_estacao_",
      "botao_adicionar_estacao_",
      "botao_remover_estacao_",
      "botao_editar_estacao_",
      "select_adicionar_estacao_",
      "select_remover_estacao_",
      "select_editar_estacao_",
      "config_botao_estacao_",
      "config_select_estacao_",
      "cancelar_config_botao_estacao_",
      "cancelar_config_select_estacao_",
      "remover_botao_estacao_select_",
      "remover_select_estacao_select_",
      "editar_botao_estacao_select_",
      "editar_select_estacao_select_",
      "editar_embed_estacao:",
      "salvar_embed_estacao:",
      "estacoes_pagina_",
      "estacao_config_avancado_",
      "estacao_toggle_horario_",
      "estacao_config_horario_",
      "estacao_config_limite_",
      "estacao_config_staff_",
      "estacao_staff_role_",
      "estacao_staff_user_",
      "estacao_staff_clear_",
      "toggle_motivo_estacao_",
      "botoes_pagina_",
      "editar_botao_paginado_",
      "enviar_estacao_tipo_",
      "config_overview_",
      "toggle_overview_",
      "atualizar_overview_",
      "enviar_overview_",
      "config_formulario_estacao_",
      "toggle_form_estacao_",
      "config_form_titulo_",
      "add_campo_form_",
      "remover_campo_form_",
      "stats_estacao_",
    ];

    const isTicketPanelInteraction =
      (interaction.isButton() &&
        ticketPanelIds.some(
          (id) =>
            interaction.customId === id || interaction.customId.startsWith(id),
        )) ||
      (interaction.isModalSubmit() &&
        (interaction.customId.startsWith("modal_") ||
          interaction.customId.startsWith("salvar_edicao_") ||
          interaction.customId.startsWith("salvar_embed_estacao:") ||
          interaction.customId.includes("botao") ||
          interaction.customId.includes("select") ||
          interaction.customId.includes("limite") ||
          interaction.customId.includes("horario") ||
          interaction.customId.includes("info_embed") ||
          interaction.customId.includes("field") ||
          interaction.customId.includes("confirmar") ||
          interaction.customId.includes("ia_") ||
          interaction.customId.includes("descricao") ||
          interaction.customId.includes("estacao") ||
          interaction.customId.includes("tag") ||
          interaction.customId.includes("form") ||
          interaction.customId.includes("inatividade") ||
          interaction.customId.startsWith("modal_bl_"))) ||
      (interaction.isStringSelectMenu() &&
        (interaction.customId.includes("select_") ||
          interaction.customId.includes("editar_") ||
          interaction.customId.includes("remover_") ||
          interaction.customId.includes("enviar_") ||
          interaction.customId.includes("ia_") ||
          interaction.customId.includes("estacao") ||
          interaction.customId === "set_idioma_select" ||
          interaction.customId.startsWith("emoji_escolher_") ||
          interaction.customId.startsWith("editar_embed_estacao:"))) ||
      (interaction.isChannelSelectMenu() &&
        (interaction.customId.includes("select_categoria") ||
          interaction.customId.includes("select_config_botao_categoria_") ||
          interaction.customId.includes("select_config_select_categoria_") ||
          interaction.customId.includes(
            "select_config_botao_estacao_categoria_",
          ) ||
          interaction.customId.includes(
            "select_config_select_estacao_categoria_",
          ) ||
          interaction.customId.includes("set_log_") ||
          interaction.customId.includes("ia_setup") ||
          interaction.customId.includes("enviar_") ||
          interaction.customId === "enviar_estacao_canal" ||
          interaction.customId === "overview_select_canal_")) ||
      (interaction.isRoleSelectMenu() &&
        (interaction.customId.includes("select_team") ||
          interaction.customId.includes("ia_setup") ||
          interaction.customId.includes("eq_select_roles") ||
          interaction.customId === "bl_select_role" ||
          interaction.customId.startsWith("estacao_staff_role_select_"))) ||
      (interaction.isUserSelectMenu() &&
        (interaction.customId === "select_team_users" ||
          interaction.customId === "eq_select_user" ||
          interaction.customId === "eq_user_select_modal" ||
          interaction.customId === "bl_select_user"));
    if (!isTicketPanelInteraction) return;

    const { customId } = interaction;

    if (customId === "configurar_ticket") {
      const db = getConfigDB(interaction.guildId);
      const systemStatus = db.get("system") ?? true;

      const sistemaBtn = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel(t("btn_painel", interaction.guildId))
        .setEmoji(getEmoji(emojis.laptop))
        .setStyle(ButtonStyle.Secondary);

      const teamBtn = new ButtonBuilder()
        .setCustomId("team_ticket")
        .setLabel(t("btn_equipe", interaction.guildId))
        .setEmoji(getEmoji(emojis.users))
        .setStyle(ButtonStyle.Secondary);

      const horariosBtn = new ButtonBuilder()
        .setCustomId("horarios_ticket")
        .setLabel(t("btn_horarios", interaction.guildId))
        .setEmoji(getEmoji(emojis.clock))
        .setStyle(ButtonStyle.Secondary);

      const personalizarBtn = new ButtonBuilder()
        .setCustomId("personalizar_ticket")
        .setLabel(t("btn_visual", interaction.guildId))
        .setEmoji(getEmoji(emojis.brush))
        .setStyle(ButtonStyle.Secondary);

      const estacoesBtn = new ButtonBuilder()
        .setCustomId("gerenciar_estacoes")
        .setLabel(t("btn_estacoes", interaction.guildId))
        .setEmoji(getEmoji(emojis.cube))
        .setStyle(ButtonStyle.Secondary);

      const toggleBtn = new ButtonBuilder()
        .setCustomId("toggle_system")
        .setLabel(t("btn_sistema", interaction.guildId))
        .setEmoji(systemStatus ? getEmoji(emojis.on) : getEmoji(emojis.off))
        .setStyle(systemStatus ? ButtonStyle.Success : ButtonStyle.Secondary);

      const row1 = new ActionRowBuilder().addComponents(
        toggleBtn,
        sistemaBtn,
        teamBtn,
        horariosBtn,
        personalizarBtn,
      );

      const logsBtn = new ButtonBuilder()
        .setCustomId("logs_ticket")
        .setLabel(t("btn_logs", interaction.guildId))
        .setEmoji(getEmoji(emojis.logs))
        .setStyle(ButtonStyle.Secondary);

      const transcriptBtn = new ButtonBuilder()
        .setCustomId("transcript_ticket")
        .setLabel(t("btn_transcript", interaction.guildId))
        .setEmoji(getEmoji(emojis.yaml))
        .setStyle(ButtonStyle.Secondary);

      const avaliacaoBtn = new ButtonBuilder()
        .setCustomId("avaliacao_ticket")
        .setLabel(t("btn_avaliacao", interaction.guildId))
        .setEmoji(getEmoji(emojis.fav))
        .setStyle(ButtonStyle.Secondary);

      const iaBtn = new ButtonBuilder()
        .setCustomId("ia_ticket")
        .setLabel(t("btn_ia", interaction.guildId))
        .setEmoji(getEmoji(emojis.bot))
        .setStyle(ButtonStyle.Secondary);

      const outrosBtn = new ButtonBuilder()
        .setCustomId("outros_ticket")
        .setLabel(t("btn_outros", interaction.guildId))
        .setEmoji(getEmoji(emojis.settings))
        .setStyle(ButtonStyle.Secondary);

      const blacklistBtn = new ButtonBuilder()
        .setCustomId("blacklist_ticket")
        .setLabel(t("btn_blacklist", interaction.guildId))
        .setEmoji(getEmoji(emojis.block))
        .setStyle(ButtonStyle.Secondary);

      const row2 = new ActionRowBuilder().addComponents(
        logsBtn,
        transcriptBtn,
        avaliacaoBtn,
        estacoesBtn,
        iaBtn,
      );

      const voltarBtn = new ButtonBuilder()
        .setCustomId("voltar_inicio")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      const row3 = new ActionRowBuilder().addComponents(blacklistBtn, outrosBtn, voltarBtn);

      const components = [
        new ContainerBuilder()
          .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
              new MediaGalleryItemBuilder().setURL(
                "https://cdn.discordapp.com/attachments/1336038554723160096/1410695553985151006/labz_banner_1.png?ex=695ea89d&is=695d571d&hm=7654f10c9060cfe4c3224337ba6c3f6b807ba731fbde7b8a5e20ea1368f31aff&",
              ),
            ),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${emojis.L_}${emojis.A_}${emojis.B_}${emojis.Z_} | ${interaction.guild.name}`,
            ),
            new TextDisplayBuilder().setContent(
              `${t("painel_desc", interaction.guildId)}\n\n-# Ping do bot: ${client.ws.ping}ms`,
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addActionRowComponents(row1, row2, row3),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.customId === "voltar_inicio") {
      const buttonConfig = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_configurar", interaction.guildId))
        .setEmoji(getEmoji(emojis.settings))
        .setStyle(ButtonStyle.Primary);

      const buttonBanco = new ButtonBuilder()
        .setCustomId("banco_ticket")
        .setLabel(t("btn_banco", interaction.guildId))
        .setEmoji(getEmoji(emojis.cardbox))
        .setStyle(ButtonStyle.Primary);

      const buttonPix = new ButtonBuilder()
        .setCustomId("pix_ticket")
        .setLabel(t("btn_pix", interaction.guildId))
        .setEmoji(getEmoji(emojis.dollar))
        .setStyle(ButtonStyle.Primary);

      const enviarTicketBtn = new ButtonBuilder()
        .setCustomId("enviar_ticket_painel")
        .setLabel(t("btn_enviar_ticket", interaction.guildId))
        .setEmoji(getEmoji(emojis.embeds))
        .setStyle(ButtonStyle.Success);

      const iaSetupBtn = new ButtonBuilder()
        .setCustomId("ia_setup_inicial")
        .setLabel(t("btn_ia_setup", interaction.guildId))
        .setEmoji(getEmoji(emojis.bot))
        .setStyle(ButtonStyle.Success);

      const buttonSuporte = new ButtonBuilder()
        .setLabel(t("btn_suporte", interaction.guildId))
        .setEmoji(getEmoji(emojis.suporte))
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/MmUB4H3uCM");

      const buttonIdioma = new ButtonBuilder()
        .setCustomId("config_idioma")
        .setLabel(t("btn_alterar_idioma", interaction.guildId))
        .setEmoji(getEmoji(emojis.world))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            t("painel_principal_titulo", interaction.guildId, {
              guild: interaction.guild.name,
            }),
          ),
        ),
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${t("painel_principal_desc", interaction.guildId)}\n\n-# Ping do bot: ${client.ws.ping}ms`,
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
                  t("painel_secao_banco", interaction.guildId),
                ),
              )
              .setButtonAccessory(buttonBanco),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("painel_secao_pix", interaction.guildId),
                ),
              )
              .setButtonAccessory(buttonPix),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("painel_secao_enviar", interaction.guildId),
                ),
              )
              .setButtonAccessory(enviarTicketBtn),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("painel_secao_ia", interaction.guildId),
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
                  t("painel_secao_suporte", interaction.guildId),
                ),
              )
              .setButtonAccessory(buttonSuporte),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("painel_secao_idioma", interaction.guildId),
                ),
              )
              .setButtonAccessory(buttonIdioma),
          ),
      ];

      await interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton()) {
      if (interaction.customId === "toggle_system") {
        const db = getConfigDB(interaction.guildId);
        const systemStatus = db.get("system") ?? true;
        const newStatus = !systemStatus;

        db.set("system", newStatus);

        const toggleBtn = new ButtonBuilder()
          .setCustomId("toggle_system")
          .setLabel(t("btn_sistema", interaction.guildId))
          .setEmoji(newStatus ? getEmoji(emojis.on) : getEmoji(emojis.off))
          .setStyle(newStatus ? ButtonStyle.Success : ButtonStyle.Secondary);

        const sistemaBtn = new ButtonBuilder()
          .setCustomId("sistema_ticket")
          .setLabel(t("btn_painel", interaction.guildId))
          .setEmoji(getEmoji(emojis.laptop))
          .setStyle(ButtonStyle.Secondary);

        const teamBtn = new ButtonBuilder()
          .setCustomId("team_ticket")
          .setLabel(t("btn_equipe", interaction.guildId))
          .setEmoji(getEmoji(emojis.users))
          .setStyle(ButtonStyle.Secondary);

        const horariosBtn = new ButtonBuilder()
          .setCustomId("horarios_ticket")
          .setLabel(t("btn_horarios", interaction.guildId))
          .setEmoji(getEmoji(emojis.clock))
          .setStyle(ButtonStyle.Secondary);

        const personalizarBtn = new ButtonBuilder()
          .setCustomId("personalizar_ticket")
          .setLabel(t("btn_visual", interaction.guildId))
          .setEmoji(getEmoji(emojis.brush))
          .setStyle(ButtonStyle.Secondary);

        const estacoesBtn = new ButtonBuilder()
          .setCustomId("gerenciar_estacoes")
          .setLabel(t("btn_estacoes", interaction.guildId))
          .setEmoji(getEmoji(emojis.cube))
          .setStyle(ButtonStyle.Secondary);

        const row1 = new ActionRowBuilder().addComponents(
          toggleBtn,
          sistemaBtn,
          teamBtn,
          horariosBtn,
          personalizarBtn,
        );

        const logsBtn = new ButtonBuilder()
          .setCustomId("logs_ticket")
          .setLabel(t("btn_logs", interaction.guildId))
          .setEmoji(getEmoji(emojis.logs))
          .setStyle(ButtonStyle.Secondary);

        const transcriptBtn = new ButtonBuilder()
          .setCustomId("transcript_ticket")
          .setLabel(t("btn_transcript", interaction.guildId))
          .setEmoji(getEmoji(emojis.yaml))
          .setStyle(ButtonStyle.Secondary);

        const avaliacaoBtn = new ButtonBuilder()
          .setCustomId("avaliacao_ticket")
          .setLabel(t("btn_avaliacao", interaction.guildId))
          .setEmoji(getEmoji(emojis.fav))
          .setStyle(ButtonStyle.Secondary);

        const iaBtn = new ButtonBuilder()
          .setCustomId("ia_ticket")
          .setLabel(t("btn_ia", interaction.guildId))
          .setEmoji(getEmoji(emojis.bot))
          .setStyle(ButtonStyle.Secondary);

        const outrosBtn = new ButtonBuilder()
          .setCustomId("outros_ticket")
          .setLabel(t("btn_outros", interaction.guildId))
          .setEmoji(getEmoji(emojis.settings))
          .setStyle(ButtonStyle.Secondary);

        const blacklistBtn = new ButtonBuilder()
          .setCustomId("blacklist_ticket")
          .setLabel(t("btn_blacklist", interaction.guildId))
          .setEmoji(getEmoji(emojis.block))
          .setStyle(ButtonStyle.Secondary);

        const row2 = new ActionRowBuilder().addComponents(
          logsBtn,
          transcriptBtn,
          avaliacaoBtn,
          estacoesBtn,
          iaBtn,
        );

        const voltarBtn = new ButtonBuilder()
          .setCustomId("voltar_inicio")
          .setLabel(t("btn_voltar", interaction.guildId))
          .setEmoji(getEmoji(emojis.home))
          .setStyle(ButtonStyle.Secondary);

        const row3 = new ActionRowBuilder().addComponents(blacklistBtn, outrosBtn, voltarBtn);

        const components = [
          new ContainerBuilder()
            .addMediaGalleryComponents(
              new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(
                  "https://cdn.discordapp.com/attachments/1336038554723160096/1410695553985151006/labz_banner_1.png?ex=695ea89d&is=695d571d&hm=7654f10c9060cfe4c3224337ba6c3f6b807ba731fbde7b8a5e20ea1368f31aff&",
                ),
              ),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.L_}${emojis.A_}${emojis.B_}${emojis.Z_} | ${interaction.guild.name}`,
              ),
              new TextDisplayBuilder().setContent(
                `${t("painel_desc", interaction.guildId)}\n\n-# Ping do bot: ${client.ws.ping}ms`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(row1, row2, row3),
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
      interaction.customId === "personalizar_ticket"
    ) {
      const guildId = interaction.guildId;

      const select = new StringSelectMenuBuilder()
        .setCustomId("select_personalizacao_embed")
        .setPlaceholder(t("visual_embed_select_placeholder", guildId))
        .addOptions([
          {
            label: t("visual_embed_principal_label", guildId),
            description: t("visual_embed_principal_desc", guildId),
            value: "embedprincipal",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_ticket_label", guildId),
            description: t("visual_embed_ticket_desc", guildId),
            value: "embedticket",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logs_label", guildId),
            description: t("visual_embed_logs_desc", guildId),
            value: "embedlogs",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logsuser_label", guildId),
            description: t("visual_embed_logsuser_desc", guildId),
            value: "embedlogsuser",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_notificar_label", guildId),
            description: t("visual_embed_notificar_desc", guildId),
            value: "embednotificar",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_avaliacao_label", guildId),
            description: t("visual_embed_avaliacao_desc", guildId),
            value: "embedavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_logavaliacao_label", guildId),
            description: t("visual_embed_logavaliacao_desc", guildId),
            value: "embedlogavaliacao",
            emoji: getEmoji(emojis.embeds),
          },
          {
            label: t("visual_embed_assumido_label", guildId),
            description: t("visual_embed_assumido_desc", guildId),
            value: "embedassumido",
            emoji: getEmoji(emojis.embeds),
          },
        ]);

      const rowSelect = new ActionRowBuilder().addComponents(select);

      const voltarButton = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", guildId))
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmoji(emojis.home));

      const rowButton = new ActionRowBuilder().addComponents(voltarButton);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("visual_personalizar_titulo", guildId),
            ),
            new TextDisplayBuilder().setContent(
              t("visual_personalizar_desc", guildId),
            ),
          )
          .addActionRowComponents(rowSelect, rowButton),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "sistema_ticket") {
      const gid = interaction.guildId;

      const button1 = new ButtonBuilder()
        .setCustomId("configurar_botao")
        .setLabel(t("sistema_btn_botao", gid))
        .setEmoji(getEmoji(emojis.cardbox))
        .setStyle(ButtonStyle.Secondary);

      const button2 = new ButtonBuilder()
        .setCustomId("configurar_select")
        .setLabel(t("sistema_btn_select", gid))
        .setEmoji(getEmoji(emojis.cardbox))
        .setStyle(ButtonStyle.Secondary);

      const button3 = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", gid))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(
        button1,
        button2,
        button3,
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("sistema_titulo", gid)),
            new TextDisplayBuilder().setContent(
              t("sistema_desc", gid),
            ),
          )
          .addActionRowComponents(row),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (interaction.isButton() && interaction.customId === "outros_ticket") {
      const guildId = interaction.guildId;
      const db = getConfigDB(guildId);
      if (!db.has("mencionar_ao_abrir")) db.set("mencionar_ao_abrir", false);
      if (!db.has("notificar_autor_ao_assumir"))
        db.set("notificar_autor_ao_assumir", false);
      if (!db.has("solicitar_motivo")) db.set("solicitar_motivo", false);
      if (!db.has("fechar_ao_sair_servidor"))
        db.set("fechar_ao_sair_servidor", false);
      if (!db.has("fechar_ao_sair_ticket"))
        db.set("fechar_ao_sair_ticket", false);

      return interaction.update({
        components: buildOutrosTicketComponents(guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "toggle_mencionar_ao_abrir"
    ) {
      const db = getConfigDB(interaction.guildId);
      const atual = db.get("mencionar_ao_abrir") ?? false;
      db.set("mencionar_ao_abrir", !atual);
      return interaction.update({
        components: buildOutrosTicketComponents(interaction.guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "toggle_notificar_ao_assumir"
    ) {
      const db = getConfigDB(interaction.guildId);
      const atual = db.get("notificar_autor_ao_assumir") ?? false;
      db.set("notificar_autor_ao_assumir", !atual);
      return interaction.update({
        components: buildOutrosTicketComponents(interaction.guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "toggle_solicitar_motivo"
    ) {
      const db = getConfigDB(interaction.guildId);
      const atual = db.get("solicitar_motivo") ?? false;
      db.set("solicitar_motivo", !atual);
      return interaction.update({
        components: buildOutrosTicketComponents(interaction.guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "toggle_fechar_ao_sair_servidor"
    ) {
      const db = getConfigDB(interaction.guildId);
      const atual = db.get("fechar_ao_sair_servidor") ?? false;
      db.set("fechar_ao_sair_servidor", !atual);
      return interaction.update({
        components: buildOutrosTicketComponents(interaction.guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "toggle_fechar_ao_sair_ticket"
    ) {
      const db = getConfigDB(interaction.guildId);
      const atual = db.get("fechar_ao_sair_ticket") ?? false;
      db.set("fechar_ao_sair_ticket", !atual);
      return interaction.update({
        components: buildOutrosTicketComponents(interaction.guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && interaction.customId === "config_idioma") {
      const atual = getGuildLocale(interaction.guildId);

      const options = SUPPORTED.map((l) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(LOCALE_LABELS[l])
          .setValue(l)
          .setDefault(l === atual),
      );

      const select = new StringSelectMenuBuilder()
        .setCustomId("modal_idioma_select")
        .setPlaceholder("Escolha o idioma")
        .addOptions(options);

      const label = new LabelBuilder()
        .setLabel("Idioma do sistema de tickets")
        .setStringSelectMenuComponent(select);

      const modal = new ModalBuilder()
        .setCustomId("modal_idioma_submit")
        .setTitle("Idioma do sistema de tickets")
        .addLabelComponents(label);

      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_idioma_submit"
    ) {
      const escolhido = interaction.fields.getStringSelectValues(
        "modal_idioma_select",
      )[0];
      if (!escolhido) return interaction.deferUpdate().catch(() => {});
      setGuildLocale(interaction.guildId, escolhido);

      try {
        const { resyncGuildCommands } = require("../../handlers/slashHandler");
        await resyncGuildCommands(interaction.client, interaction.guildId);
      } catch {}

      const container = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            t("idioma_alterado_msg_titulo", interaction.guildId),
          ),
          new TextDisplayBuilder().setContent(
            t("idioma_alterado_msg_desc", interaction.guildId, {
              idioma: LOCALE_LABELS[escolhido],
            }),
          ),
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large),
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("voltar_inicio")
              .setLabel("Voltar")
              .setEmoji(getEmoji(emojis.home))
              .setStyle(ButtonStyle.Secondary),
          ),
        );

      return interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    const subHandlers = [
      handlerLogs,
      handlerEquipe,
      handlerHorarios,
      handlerEstacoes,
      handlerEstatisticasEstacao,
      handlerFormularioEstacao,
      handlerPainelOverview,
      handlerVisual,
      handlerIA,
      handlerBlacklist,
    ];

    const handler = subHandlers.find((h) =>
      h.customIds.some((id) => customId === id || customId.startsWith(id)),
    );

    if (handler) {
      interaction._fromPainel = true;
      await handler.execute(client, interaction);
    }
  },
};