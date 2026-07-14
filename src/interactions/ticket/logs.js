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
} = require("./helpers");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const { t } = require("../../utils/i18n");

module.exports = {
  customIds: [
    "logs_ticket",
    "toggle_log_fechamento",
    "toggle_log_user",
    "limite_ticket",
    "transcript_ticket",
    "toggle_transcript_system",
    "toggle_transcript_staff",
    "toggle_transcript_user",
    "avaliacao_ticket",
    "toggle_log_avaliacao",
    "set_log_fechamento_canal",
    "set_log_avaliacao_canal",
    "editar_campo_select_",
  ],
  async execute(client, interaction) {
    const { customId } = interaction;

    const belongsToThis = module.exports.customIds.some(
      (id) => customId && (customId === id || customId.startsWith(id)),
    );
    if (!belongsToThis) return;

    if (!interaction._fromPainel) return;

    if (interaction.isButton() && interaction.customId === "logs_ticket") {
      const guildId = interaction.guildId;
      const db = getConfigDB(guildId);
      const config = db.get("logs") || {};
      const canalAtual = config.log_fechamento?.canal || null;

      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("toggle_log_fechamento")
          .setLabel(t("logs_btn_fechamento", guildId))
          .setStyle(
            config.log_fechamento?.ativo
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(
            getEmoji(config.log_fechamento?.ativo ? emojis.on : emojis.off),
          ),
        new ButtonBuilder()
          .setCustomId("toggle_log_user")
          .setLabel(t("logs_btn_usuario", guildId))
          .setStyle(
            config.log_user?.ativo
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(getEmoji(config.log_user?.ativo ? emojis.on : emojis.off)),
        new ButtonBuilder()
          .setCustomId("configurar_ticket")
          .setLabel(t("btn_voltar", guildId))
          .setEmoji(getEmoji(emojis.home))
          .setStyle(ButtonStyle.Secondary),
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_fechamento_canal")
          .setPlaceholder(t("logs_fechamento_canal_placeholder", guildId))
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(canalAtual ? [canalAtual] : []),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("logs_titulo", guildId)),
            new TextDisplayBuilder().setContent(t("logs_desc", guildId)),
            new TextDisplayBuilder().setContent(
              t("logs_log_fechamento_status", guildId, {
                status: config.log_fechamento?.ativo ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
                canal: config.log_fechamento?.canal ? `<#${config.log_fechamento.canal}>` : t("logs_canal_nenhum", guildId),
              }),
            ),
            new TextDisplayBuilder().setContent(
              t("logs_log_usuario_status", guildId, {
                status: config.log_user?.ativo ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
              }),
            ),
          )
          .addActionRowComponents(rowButtons, rowSelect),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      (interaction.customId === "toggle_log_fechamento" ||
        interaction.customId === "toggle_log_user")
    ) {
      const guildId = interaction.guildId;
      const db = getConfigDB(guildId);
      if (interaction.customId === "toggle_log_fechamento") {
        db.set(
          "logs.log_fechamento.ativo",
          !db.get("logs.log_fechamento.ativo"),
        );
      }
      if (interaction.customId === "toggle_log_user") {
        db.set("logs.log_user.ativo", !db.get("logs.log_user.ativo"));
      }

      const config = db.get("logs") || {};

      const canalAtual = config.log_fechamento?.canal || null;

      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("toggle_log_fechamento")
          .setLabel(t("logs_btn_fechamento", guildId))
          .setStyle(
            config.log_fechamento?.ativo
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(
            getEmoji(config.log_fechamento?.ativo ? emojis.on : emojis.off),
          ),
        new ButtonBuilder()
          .setCustomId("toggle_log_user")
          .setLabel(t("logs_btn_usuario", guildId))
          .setStyle(
            config.log_user?.ativo
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(getEmoji(config.log_user?.ativo ? emojis.on : emojis.off)),
        new ButtonBuilder()
          .setCustomId("configurar_ticket")
          .setLabel(t("btn_voltar", guildId))
          .setEmoji(getEmoji(emojis.home))
          .setStyle(ButtonStyle.Secondary),
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_fechamento_canal")
          .setPlaceholder(t("logs_fechamento_canal_placeholder", guildId))
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(canalAtual ? [canalAtual] : []),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("logs_titulo", guildId)),
            new TextDisplayBuilder().setContent(t("logs_desc", guildId)),
            new TextDisplayBuilder().setContent(
              t("logs_log_fechamento_status", guildId, {
                status: config.log_fechamento?.ativo ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
                canal: config.log_fechamento?.canal ? `<#${config.log_fechamento.canal}>` : t("logs_canal_nenhum", guildId),
              }),
            ),
            new TextDisplayBuilder().setContent(
              t("logs_log_usuario_status", guildId, {
                status: config.log_user?.ativo ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
              }),
            ),
          )
          .addActionRowComponents(rowButtons, rowSelect),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && interaction.customId === "limite_ticket") {
      const guildId = interaction.guildId;
      const db = getConfigDB(guildId);
      const valorAtual = db.get("limit") ?? "1";

      const modal = new ModalBuilder()
        .setCustomId("modal_limite_ticket")
        .setTitle(t("logs_modal_limite_titulo", guildId));

      const input = new TextInputBuilder()
        .setCustomId("input_limite")
        .setLabel(t("logs_modal_limite_label", guildId))
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setPlaceholder(t("logs_modal_limite_placeholder", guildId))
        .setRequired(true)
        .setValue(String(valorAtual));

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }

    if (
      interaction.isButton() &&
      interaction.customId === "transcript_ticket"
    ) {
      const guildId = interaction.guildId;
      const db = getConfigDB(guildId);
      const transcriptConfig = db.get("transcript") ?? {
        system: false,
        staff: true,
        user: true,
      };

      const systemBtn = new ButtonBuilder()
        .setCustomId("toggle_transcript_system")
        .setLabel(t("logs_transcript_btn_sistema", guildId))
        .setStyle(
          transcriptConfig.system ? ButtonStyle.Success : ButtonStyle.Danger,
        )
        .setEmoji(getEmoji(transcriptConfig.system ? emojis.on : emojis.off));

      const staffBtn = new ButtonBuilder()
        .setCustomId("toggle_transcript_staff")
        .setLabel(t("logs_transcript_btn_staff", guildId))
        .setStyle(
          transcriptConfig.staff ? ButtonStyle.Success : ButtonStyle.Danger,
        )
        .setEmoji(getEmoji(transcriptConfig.staff ? emojis.on : emojis.off));

      const userBtn = new ButtonBuilder()
        .setCustomId("toggle_transcript_user")
        .setLabel(t("logs_transcript_btn_usuario", guildId))
        .setStyle(
          transcriptConfig.user ? ButtonStyle.Success : ButtonStyle.Danger,
        )
        .setEmoji(getEmoji(transcriptConfig.user ? emojis.on : emojis.off));

      const voltarBtn = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", guildId))
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmoji(emojis.home));

      const row1 = new ActionRowBuilder().addComponents(
        systemBtn,
        staffBtn,
        userBtn,
        voltarBtn,
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("logs_transcript_titulo", guildId)),
            new TextDisplayBuilder().setContent(t("logs_transcript_desc", guildId)),
            new TextDisplayBuilder().setContent(
              t("logs_transcript_sistema_status", guildId, {
                status: transcriptConfig.system ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
              }),
            ),
            new TextDisplayBuilder().setContent(
              t("logs_transcript_staff_status", guildId, {
                status: transcriptConfig.staff ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
              }),
            ),
            new TextDisplayBuilder().setContent(
              t("logs_transcript_usuario_status", guildId, {
                status: transcriptConfig.user ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
              }),
            ),
          )
          .addActionRowComponents(row1),
      ];

      await interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton()) {
      const guildId = interaction.guildId;
      const db = getConfigDB(guildId);

      if (
        interaction.customId === "toggle_transcript_system" ||
        interaction.customId === "toggle_transcript_staff" ||
        interaction.customId === "toggle_transcript_user"
      ) {
        const transcriptConfig = db.get("transcript") ?? {
          system: false,
          staff: true,
          user: true,
        };

        let campo = "";
        if (interaction.customId === "toggle_transcript_system")
          campo = "system";
        else if (interaction.customId === "toggle_transcript_staff")
          campo = "staff";
        else if (interaction.customId === "toggle_transcript_user")
          campo = "user";

        transcriptConfig[campo] = !transcriptConfig[campo];

        db.set("transcript", transcriptConfig);

        const systemBtn = new ButtonBuilder()
          .setCustomId("toggle_transcript_system")
          .setLabel(t("logs_transcript_btn_sistema", guildId))
          .setStyle(
            transcriptConfig.system ? ButtonStyle.Success : ButtonStyle.Danger,
          )
          .setEmoji(getEmoji(transcriptConfig.system ? emojis.on : emojis.off));

        const staffBtn = new ButtonBuilder()
          .setCustomId("toggle_transcript_staff")
          .setLabel(t("logs_transcript_btn_staff", guildId))
          .setStyle(
            transcriptConfig.staff ? ButtonStyle.Success : ButtonStyle.Danger,
          )
          .setEmoji(getEmoji(transcriptConfig.staff ? emojis.on : emojis.off));

        const userBtn = new ButtonBuilder()
          .setCustomId("toggle_transcript_user")
          .setLabel(t("logs_transcript_btn_usuario", guildId))
          .setStyle(
            transcriptConfig.user ? ButtonStyle.Success : ButtonStyle.Danger,
          )
          .setEmoji(getEmoji(transcriptConfig.user ? emojis.on : emojis.off));

        const voltarBtn = new ButtonBuilder()
          .setCustomId("configurar_ticket")
          .setLabel(t("btn_voltar", guildId))
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(getEmoji(emojis.home));

        const row1 = new ActionRowBuilder().addComponents(
          systemBtn,
          staffBtn,
          userBtn,
          voltarBtn,
        );

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(t("logs_transcript_titulo", guildId)),
              new TextDisplayBuilder().setContent(t("logs_transcript_desc", guildId)),
              new TextDisplayBuilder().setContent(
                t("logs_transcript_sistema_status", guildId, {
                  status: transcriptConfig.system ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
                }),
              ),
              new TextDisplayBuilder().setContent(
                t("logs_transcript_staff_status", guildId, {
                  status: transcriptConfig.staff ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
                }),
              ),
              new TextDisplayBuilder().setContent(
                t("logs_transcript_usuario_status", guildId, {
                  status: transcriptConfig.user ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
                }),
              ),
            )
            .addActionRowComponents(row1),
        ];

        await interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      }
    }

    if (interaction.isButton() && interaction.customId === "avaliacao_ticket") {
      const guildId = interaction.guildId;
      const db = getConfigDB(guildId);
      const avaliacaoConfig = db.get("logs.log_avaliacao") || {
        ativo: false,
        canal: null,
      };

      const toggleBtn = new ButtonBuilder()
        .setCustomId("toggle_log_avaliacao")
        .setLabel(t("logs_avaliacao_btn_sistema", guildId))
        .setStyle(
          avaliacaoConfig.ativo ? ButtonStyle.Success : ButtonStyle.Secondary,
        )
        .setEmoji(getEmoji(avaliacaoConfig.ativo ? emojis.on : emojis.off));

      const voltarBtn = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", guildId))
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      const rowButtons = new ActionRowBuilder().addComponents(
        toggleBtn,
        voltarBtn,
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_avaliacao_canal")
          .setPlaceholder(t("logs_avaliacao_canal_placeholder", guildId))
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(
            avaliacaoConfig.canal ? [avaliacaoConfig.canal] : [],
          ),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("logs_avaliacao_titulo", guildId)),
            new TextDisplayBuilder().setContent(t("logs_avaliacao_desc", guildId)),
            new TextDisplayBuilder().setContent(
              t("logs_avaliacao_status", guildId, {
                status: avaliacaoConfig.ativo ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
                canal: avaliacaoConfig.canal ? `<#${avaliacaoConfig.canal}>` : t("logs_canal_nenhum_definido", guildId),
              }),
            ),
          )
          .addActionRowComponents(rowButtons, rowSelect),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "toggle_log_avaliacao"
    ) {
      const guildId = interaction.guildId;
      const db = getConfigDB(guildId);
      const avaliacaoConfig = db.get("logs.log_avaliacao") || {
        ativo: false,
        canal: null,
      };

      avaliacaoConfig.ativo = !avaliacaoConfig.ativo;
      db.set("logs.log_avaliacao", avaliacaoConfig);

      const toggleBtn = new ButtonBuilder()
        .setCustomId("toggle_log_avaliacao")
        .setLabel(t("logs_avaliacao_btn_sistema", guildId))
        .setStyle(
          avaliacaoConfig.ativo ? ButtonStyle.Success : ButtonStyle.Secondary,
        )
        .setEmoji(getEmoji(avaliacaoConfig.ativo ? emojis.on : emojis.off));

      const voltarBtn = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", guildId))
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      const rowButtons = new ActionRowBuilder().addComponents(
        toggleBtn,
        voltarBtn,
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_avaliacao_canal")
          .setPlaceholder(t("logs_avaliacao_canal_placeholder", guildId))
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(
            avaliacaoConfig.canal ? [avaliacaoConfig.canal] : [],
          ),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("logs_avaliacao_titulo", guildId)),
            new TextDisplayBuilder().setContent(t("logs_avaliacao_desc", guildId)),
            new TextDisplayBuilder().setContent(
              t("logs_avaliacao_status", guildId, {
                status: avaliacaoConfig.ativo ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
                canal: avaliacaoConfig.canal ? `<#${avaliacaoConfig.canal}>` : t("logs_canal_nenhum_definido", guildId),
              }),
            ),
          )
          .addActionRowComponents(rowButtons, rowSelect),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId === "set_log_fechamento_canal"
    ) {
      const guildId = interaction.guildId;
      const db = getConfigDB(guildId);
      const canalSelecionado = interaction.values[0];
      db.set("logs.log_fechamento.canal", canalSelecionado);

      const config = db.get("logs") || {};
      const canalAtual = config.log_fechamento?.canal || null;

      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("toggle_log_fechamento")
          .setLabel(t("logs_btn_fechamento", guildId))
          .setStyle(
            config.log_fechamento?.ativo
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(
            getEmoji(config.log_fechamento?.ativo ? emojis.on : emojis.off),
          ),
        new ButtonBuilder()
          .setCustomId("toggle_log_user")
          .setLabel(t("logs_btn_usuario", guildId))
          .setStyle(
            config.log_user?.ativo
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(getEmoji(config.log_user?.ativo ? emojis.on : emojis.off)),
        new ButtonBuilder()
          .setCustomId("configurar_ticket")
          .setLabel(t("btn_voltar", guildId))
          .setEmoji(getEmoji(emojis.home))
          .setStyle(ButtonStyle.Secondary),
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_fechamento_canal")
          .setPlaceholder(t("logs_fechamento_canal_placeholder", guildId))
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(canalAtual ? [canalAtual] : []),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("logs_titulo", guildId)),
            new TextDisplayBuilder().setContent(t("logs_desc", guildId)),
            new TextDisplayBuilder().setContent(
              t("logs_log_fechamento_status", guildId, {
                status: config.log_fechamento?.ativo ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
                canal: config.log_fechamento?.canal ? `<#${config.log_fechamento.canal}>` : t("logs_canal_nenhum", guildId),
              }),
            ),
            new TextDisplayBuilder().setContent(
              t("logs_log_usuario_status", guildId, {
                status: config.log_user?.ativo ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
              }),
            ),
          )
          .addActionRowComponents(rowButtons, rowSelect),
      ];

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
      const guildId = interaction.guildId;
      const campo = interaction.values[0];
      const selectId = interaction.customId.replace("editar_campo_select_", "");

      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];
      const selectObj = selects.find((s) => s.id === selectId);
      if (!selectObj) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("logs_select_nao_encontrado", guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (campo === "inicio") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_editar_inicio_select_${selectId}`)
          .setTitle(t("logs_editar_inicio_titulo", guildId));

        const valorAtual = selectObj.inicio || "";

        const inputInicio = new TextInputBuilder()
          .setCustomId("novo_inicio")
          .setLabel(t("logs_editar_inicio_label", guildId))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setPlaceholder(t("logs_editar_inicio_placeholder", guildId))
          .setRequired(true)
          .setValue(valorAtual);

        const row = new ActionRowBuilder().addComponents(inputInicio);
        modal.addComponents(row);

        return interaction.showModal(modal);
      }
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId === "set_log_avaliacao_canal"
    ) {
      const guildId = interaction.guildId;
      const db = getConfigDB(guildId);
      const canalSelecionado = interaction.values[0];

      const avaliacaoConfig = db.get("logs.log_avaliacao") || {
        ativo: false,
        canal: null,
      };
      avaliacaoConfig.canal = canalSelecionado;
      db.set("logs.log_avaliacao", avaliacaoConfig);

      const toggleBtn = new ButtonBuilder()
        .setCustomId("toggle_log_avaliacao")
        .setLabel(t("logs_avaliacao_btn_sistema", guildId))
        .setStyle(
          avaliacaoConfig.ativo ? ButtonStyle.Success : ButtonStyle.Secondary,
        )
        .setEmoji(getEmoji(avaliacaoConfig.ativo ? emojis.on : emojis.off));

      const voltarBtn = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", guildId))
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      const rowButtons = new ActionRowBuilder().addComponents(
        toggleBtn,
        voltarBtn,
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_avaliacao_canal")
          .setPlaceholder(t("logs_avaliacao_canal_placeholder", guildId))
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(
            avaliacaoConfig.canal ? [avaliacaoConfig.canal] : [],
          ),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("logs_avaliacao_titulo", guildId)),
            new TextDisplayBuilder().setContent(t("logs_avaliacao_desc", guildId)),
            new TextDisplayBuilder().setContent(
              t("logs_avaliacao_status", guildId, {
                status: avaliacaoConfig.ativo ? t("logs_ativado", guildId) : t("logs_desativado", guildId),
                canal: avaliacaoConfig.canal ? `<#${avaliacaoConfig.canal}>` : t("logs_canal_nenhum_definido", guildId),
              }),
            ),
          )
          .addActionRowComponents(rowButtons, rowSelect),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }
  },
};