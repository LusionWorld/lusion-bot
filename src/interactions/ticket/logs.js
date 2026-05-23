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
      const db = getConfigDB(interaction.guildId);
      const config = db.get("logs") || {};
      const canalAtual = config.log_fechamento?.canal || null;

      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("toggle_log_fechamento")
          .setLabel("Log Fechamento")
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
          .setLabel("Log Usuário")
          .setStyle(
            config.log_user?.ativo
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(getEmoji(config.log_user?.ativo ? emojis.on : emojis.off)),
        new ButtonBuilder()
          .setCustomId("configurar_ticket")
          .setLabel("Voltar")
          .setEmoji(getEmoji(emojis.home))
          .setStyle(ButtonStyle.Secondary),
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_fechamento_canal")
          .setPlaceholder("Selecione o canal de log de fechamento")
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(canalAtual ? [canalAtual] : []),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Configuração de Logs"),
            new TextDisplayBuilder().setContent(
              "Ative ou desative os logs abaixo:",
            ),
            new TextDisplayBuilder().setContent(
              `**Log de Fechamento**\n${
                config.log_fechamento?.ativo
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }\nCanal: ${
                config.log_fechamento?.canal
                  ? `<#${config.log_fechamento.canal}>`
                  : "Nenhum"
              }`,
            ),
            new TextDisplayBuilder().setContent(
              `**Log de Usuário**\n${
                config.log_user?.ativo
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }`,
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
      const db = getConfigDB(interaction.guildId);
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
          .setLabel("Log Fechamento")
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
          .setLabel("Log Usuário")
          .setStyle(
            config.log_user?.ativo
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(getEmoji(config.log_user?.ativo ? emojis.on : emojis.off)),
        new ButtonBuilder()
          .setCustomId("configurar_ticket")
          .setLabel("Voltar")
          .setEmoji(getEmoji(emojis.home))
          .setStyle(ButtonStyle.Secondary),
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_fechamento_canal")
          .setPlaceholder("Selecione o canal de log de fechamento")
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(canalAtual ? [canalAtual] : []),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Configuração de Logs"),
            new TextDisplayBuilder().setContent(
              "Ative ou desative os logs abaixo:",
            ),
            new TextDisplayBuilder().setContent(
              `**Log de Fechamento**\n${
                config.log_fechamento?.ativo
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }\nCanal: ${
                config.log_fechamento?.canal
                  ? `<#${config.log_fechamento.canal}>`
                  : "Nenhum"
              }`,
            ),
            new TextDisplayBuilder().setContent(
              `**Log de Usuário**\n${
                config.log_user?.ativo
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }`,
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
      const db = getConfigDB(interaction.guildId);
      const valorAtual = db.get("limit") ?? "1";

      const modal = new ModalBuilder()
        .setCustomId("modal_limite_ticket")
        .setTitle("Configurar limite de tickets");

      const input = new TextInputBuilder()
        .setCustomId("input_limite")
        .setLabel("Quantidade máxima de por usuário (mínimo 1)")
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setPlaceholder("Digite um número inteiro maior ou igual a 1")
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
      const db = getConfigDB(interaction.guildId);
      const transcriptConfig = db.get("transcript") ?? {
        system: false,
        staff: true,
        user: true,
      };

      const systemBtn = new ButtonBuilder()
        .setCustomId("toggle_transcript_system")
        .setLabel("Sistema")
        .setStyle(
          transcriptConfig.system ? ButtonStyle.Success : ButtonStyle.Danger,
        )
        .setEmoji(getEmoji(transcriptConfig.system ? emojis.on : emojis.off));

      const staffBtn = new ButtonBuilder()
        .setCustomId("toggle_transcript_staff")
        .setLabel("Staff")
        .setStyle(
          transcriptConfig.staff ? ButtonStyle.Success : ButtonStyle.Danger,
        )
        .setEmoji(getEmoji(transcriptConfig.staff ? emojis.on : emojis.off));

      const userBtn = new ButtonBuilder()
        .setCustomId("toggle_transcript_user")
        .setLabel("Usuário")
        .setStyle(
          transcriptConfig.user ? ButtonStyle.Success : ButtonStyle.Danger,
        )
        .setEmoji(getEmoji(transcriptConfig.user ? emojis.on : emojis.off));

      const voltarBtn = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel("Voltar")
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
            new TextDisplayBuilder().setContent("Configuração de Transcript"),
            new TextDisplayBuilder().setContent(
              "Use os botões abaixo para ativar ou desativar as opções de transcript conforme sua preferência.\n\n" +
                "**Sistema:** Desativa o transcript para *staff* e *usuário* ao mesmo tempo.\n" +
                "**Staff:** Desativa apenas o envio do transcript no canal de fechamento.\n" +
                "**Usuário:** Desativa o envio do transcript via mensagem privada ao autor.\n\n" +
                "_Obs: Essa configuração desativa apenas os botões, **não** a geração das mensagens em si._",
            ),
            new TextDisplayBuilder().setContent(
              `**Sistema**: ${
                transcriptConfig.system
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }`,
            ),
            new TextDisplayBuilder().setContent(
              `**Staff**: ${
                transcriptConfig.staff
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }`,
            ),
            new TextDisplayBuilder().setContent(
              `**Usuário**: ${
                transcriptConfig.user
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }`,
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
      const db = getConfigDB(interaction.guildId);

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
          .setLabel("Sistema")
          .setStyle(
            transcriptConfig.system ? ButtonStyle.Success : ButtonStyle.Danger,
          )
          .setEmoji(getEmoji(transcriptConfig.system ? emojis.on : emojis.off));

        const staffBtn = new ButtonBuilder()
          .setCustomId("toggle_transcript_staff")
          .setLabel("Staff")
          .setStyle(
            transcriptConfig.staff ? ButtonStyle.Success : ButtonStyle.Danger,
          )
          .setEmoji(getEmoji(transcriptConfig.staff ? emojis.on : emojis.off));

        const userBtn = new ButtonBuilder()
          .setCustomId("toggle_transcript_user")
          .setLabel("Usuário")
          .setStyle(
            transcriptConfig.user ? ButtonStyle.Success : ButtonStyle.Danger,
          )
          .setEmoji(getEmoji(transcriptConfig.user ? emojis.on : emojis.off));

        const voltarBtn = new ButtonBuilder()
          .setCustomId("configurar_ticket")
          .setLabel("Voltar")
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
              new TextDisplayBuilder().setContent("Configuração de Transcript"),
              new TextDisplayBuilder().setContent(
                "Use os botões abaixo para ativar ou desativar as opções de transcript conforme sua preferência.\n\n" +
                  "**Sistema:** Desativa o transcript para *staff* e *usuário* ao mesmo tempo.\n" +
                  "**Staff:** Desativa apenas o envio do transcript no canal de fechamento.\n" +
                  "**Usuário:** Desativa o envio do transcript via mensagem privada ao autor.\n\n" +
                  "_Obs: Essa configuração desativa apenas os botões, **não** a geração das mensagens em si._",
              ),
              new TextDisplayBuilder().setContent(
                `**Sistema**: ${
                  transcriptConfig.system
                    ? "```diff\n+ Ativado```"
                    : "```diff\n- Desativado```"
                }`,
              ),
              new TextDisplayBuilder().setContent(
                `**Staff**: ${
                  transcriptConfig.staff
                    ? "```diff\n+ Ativado```"
                    : "```diff\n- Desativado```"
                }`,
              ),
              new TextDisplayBuilder().setContent(
                `**Usuário**: ${
                  transcriptConfig.user
                    ? "```diff\n+ Ativado```"
                    : "```diff\n- Desativado```"
                }`,
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
      const db = getConfigDB(interaction.guildId);
      const avaliacaoConfig = db.get("logs.log_avaliacao") || {
        ativo: false,
        canal: null,
      };

      const toggleBtn = new ButtonBuilder()
        .setCustomId("toggle_log_avaliacao")
        .setLabel("Sistema de Avaliação")
        .setStyle(
          avaliacaoConfig.ativo ? ButtonStyle.Success : ButtonStyle.Secondary,
        )
        .setEmoji(getEmoji(avaliacaoConfig.ativo ? emojis.on : emojis.off));

      const voltarBtn = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      const rowButtons = new ActionRowBuilder().addComponents(
        toggleBtn,
        voltarBtn,
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_avaliacao_canal")
          .setPlaceholder("Selecione o canal de avaliações")
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(
            avaliacaoConfig.canal ? [avaliacaoConfig.canal] : [],
          ),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Configuração de Avaliação"),
            new TextDisplayBuilder().setContent(
              "Configure o sistema de avaliações dos tickets:",
            ),
            new TextDisplayBuilder().setContent(
              `**Sistema de Avaliação**\n${
                avaliacaoConfig.ativo
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }\nCanal: ${
                avaliacaoConfig.canal
                  ? `<#${avaliacaoConfig.canal}>`
                  : "Nenhum canal definido"
              }`,
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
      const db = getConfigDB(interaction.guildId);
      const avaliacaoConfig = db.get("logs.log_avaliacao") || {
        ativo: false,
        canal: null,
      };

      avaliacaoConfig.ativo = !avaliacaoConfig.ativo;
      db.set("logs.log_avaliacao", avaliacaoConfig);

      const toggleBtn = new ButtonBuilder()
        .setCustomId("toggle_log_avaliacao")
        .setLabel("Sistema de Avaliação")
        .setStyle(
          avaliacaoConfig.ativo ? ButtonStyle.Success : ButtonStyle.Secondary,
        )
        .setEmoji(getEmoji(avaliacaoConfig.ativo ? emojis.on : emojis.off));

      const voltarBtn = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      const rowButtons = new ActionRowBuilder().addComponents(
        toggleBtn,
        voltarBtn,
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_avaliacao_canal")
          .setPlaceholder("Selecione o canal de avaliações")
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(
            avaliacaoConfig.canal ? [avaliacaoConfig.canal] : [],
          ),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Configuração de Avaliação"),
            new TextDisplayBuilder().setContent(
              "Configure o sistema de avaliações dos tickets:",
            ),
            new TextDisplayBuilder().setContent(
              `**Sistema de Avaliação**\n${
                avaliacaoConfig.ativo
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }\nCanal: ${
                avaliacaoConfig.canal
                  ? `<#${avaliacaoConfig.canal}>`
                  : "Nenhum canal definido"
              }`,
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
      const db = getConfigDB(interaction.guildId);
      const canalSelecionado = interaction.values[0];
      db.set("logs.log_fechamento.canal", canalSelecionado);

      const config = db.get("logs") || {};
      const canalAtual = config.log_fechamento?.canal || null;

      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("toggle_log_fechamento")
          .setLabel("Log Fechamento")
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
          .setLabel("Log Usuário")
          .setStyle(
            config.log_user?.ativo
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
          )
          .setEmoji(getEmoji(config.log_user?.ativo ? emojis.on : emojis.off)),
        new ButtonBuilder()
          .setCustomId("configurar_ticket")
          .setLabel("Voltar")
          .setEmoji(getEmoji(emojis.home))
          .setStyle(ButtonStyle.Secondary),
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_fechamento_canal")
          .setPlaceholder("Selecione o canal de log de fechamento")
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(canalAtual ? [canalAtual] : []),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Configuração de Logs"),
            new TextDisplayBuilder().setContent(
              "Ative ou desative os logs abaixo:",
            ),
            new TextDisplayBuilder().setContent(
              `**Log de Fechamento**\n${
                config.log_fechamento?.ativo
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }\nCanal: ${
                config.log_fechamento?.canal
                  ? `<#${config.log_fechamento.canal}>`
                  : "Nenhum"
              }`,
            ),
            new TextDisplayBuilder().setContent(
              `**Log de Usuário**\n${
                config.log_user?.ativo
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }`,
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
      const campo = interaction.values[0];
      const selectId = interaction.customId.replace("editar_campo_select_", "");

      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];
      const selectObj = selects.find((s) => s.id === selectId);
      if (!selectObj) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Select não encontrado."),
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
          .setTitle("Editar Início do Ticket");

        const valorAtual = selectObj.inicio || "";

        const inputInicio = new TextInputBuilder()
          .setCustomId("novo_inicio")
          .setLabel("Digite até 20 caracteres.")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setPlaceholder("Digite o novo valor")
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
      const db = getConfigDB(interaction.guildId);
      const canalSelecionado = interaction.values[0];

      const avaliacaoConfig = db.get("logs.log_avaliacao") || {
        ativo: false,
        canal: null,
      };
      avaliacaoConfig.canal = canalSelecionado;
      db.set("logs.log_avaliacao", avaliacaoConfig);

      const toggleBtn = new ButtonBuilder()
        .setCustomId("toggle_log_avaliacao")
        .setLabel("Sistema de Avaliação")
        .setStyle(
          avaliacaoConfig.ativo ? ButtonStyle.Success : ButtonStyle.Secondary,
        )
        .setEmoji(getEmoji(avaliacaoConfig.ativo ? emojis.on : emojis.off));

      const voltarBtn = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel("Voltar")
        .setEmoji(getEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      const rowButtons = new ActionRowBuilder().addComponents(
        toggleBtn,
        voltarBtn,
      );

      const rowSelect = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_log_avaliacao_canal")
          .setPlaceholder("Selecione o canal de avaliações")
          .addChannelTypes(ChannelType.GuildText)
          .setDefaultChannels(
            avaliacaoConfig.canal ? [avaliacaoConfig.canal] : [],
          ),
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Configuração de Avaliação"),
            new TextDisplayBuilder().setContent(
              "Configure o sistema de avaliações dos tickets:",
            ),
            new TextDisplayBuilder().setContent(
              `**Sistema de Avaliação**\n${
                avaliacaoConfig.ativo
                  ? "```diff\n+ Ativado```"
                  : "```diff\n- Desativado```"
              }\nCanal: ${
                avaliacaoConfig.canal
                  ? `<#${avaliacaoConfig.canal}>`
                  : "Nenhum canal definido"
              }`,
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