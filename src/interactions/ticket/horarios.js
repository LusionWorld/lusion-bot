const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
} = require("discord.js");

const { getEmoji, getConfigDB } = require("./helpers");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const { t } = require("../../utils/i18n");

function safeUpdate(interaction, options) {
  if (interaction.replied || interaction.deferred) return;
  return interaction.update(options).catch((err) => {
    if (err?.code === 10062 || err?.code === 40060) return;
    throw err;
  });
}

function safeReply(interaction, options) {
  if (interaction.replied || interaction.deferred) return;
  return interaction.reply(options).catch((err) => {
    if (err?.code === 10062 || err?.code === 40060) return;
    throw err;
  });
}

function safeShowModal(interaction, modal) {
  if (interaction.replied || interaction.deferred) return;
  return interaction.showModal(modal).catch((err) => {
    if (err?.code === 10062 || err?.code === 40060) return;
    throw err;
  });
}

function applyEmoji(button, emojiValue) {
  const emoji = getEmoji(emojiValue);
  if (emoji != null) button.setEmoji(emoji);
  return button;
}

function getDiasSemana(guildId) {
  return {
    monday:    t("horario_segunda", guildId),
    tuesday:   t("horario_terca",   guildId),
    wednesday: t("horario_quarta",  guildId),
    thursday:  t("horario_quinta",  guildId),
    friday:    t("horario_sexta",   guildId),
    saturday:  t("horario_sabado",  guildId),
    sunday:    t("horario_domingo", guildId),
  };
}

function criarPainelHorarios(db, guildId) {
  const horarioAtivo = db.get("horario_ativo") === true;
  const schedule = db.get("schedule") || {};
  const diasSemana = getDiasSemana(guildId);

  const sections = Object.entries(diasSemana).map(([key, nome]) => {
    const horario = schedule[key];
    return new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${emojis.calendar} **${nome}**`),
        new TextDisplayBuilder().setContent(
          horario
            ? `${emojis.clock} ${horario.start} — ${horario.end}`
            : `${emojis.cancel} ${t("horario_desativado_dia", guildId)}`,
        ),
      )
      .setButtonAccessory(
        applyEmoji(
          new ButtonBuilder()
            .setCustomId(`horario_editar_${key}`)
            .setLabel(t("horario_btn_editar", guildId))
            .setStyle(ButtonStyle.Secondary),
          emojis.pencil,
        ),
      );
  });

  const row1 = new ActionRowBuilder().addComponents(
    applyEmoji(
      new ButtonBuilder()
        .setCustomId("toggle_horario")
        .setLabel(horarioAtivo ? t("horario_btn_desativar", guildId) : t("horario_btn_ativar", guildId))
        .setStyle(horarioAtivo ? ButtonStyle.Danger : ButtonStyle.Success),
      horarioAtivo ? emojis.off : emojis.on,
    ),
  );

  const row2 = new ActionRowBuilder().addComponents(
    applyEmoji(
      new ButtonBuilder()
        .setCustomId("voltar_horario")
        .setLabel(t("btn_voltar", guildId))
        .setStyle(ButtonStyle.Secondary),
      emojis.arrowl,
    ),
  );

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${emojis.clock} **${t("horario_titulo_texto", guildId)}**`,
        ),
        new TextDisplayBuilder().setContent(
          horarioAtivo
            ? `${emojis.check} ${t("horario_ativo_texto", guildId)}`
            : `${emojis.cancel} ${t("horario_desativado_texto", guildId)}`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addSectionComponents(...sections)
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addActionRowComponents(row1, row2),
  ];
}

module.exports = {
  customIds: [
    "horarios_ticket",
    "toggle_horario",
    "horario_editar_",
    "modal_horario_",
    "voltar_horario",
  ],

  async execute(client, interaction) {
    const { customId } = interaction;
    if (!customId) return;

    const handled = ["horarios_ticket", "toggle_horario", "voltar_horario"];
    const isHandled =
      handled.includes(customId) ||
      customId.startsWith("horario_editar_") ||
      customId.startsWith("modal_horario_");

    if (!isHandled) return;
    if (!interaction._fromPainel) return;
    if (interaction.replied || interaction.deferred) {
      return;
    }

    const guildId = interaction.guildId;

    if (customId === "horarios_ticket") {
      const db = getConfigDB(interaction.guildId);

      return safeUpdate(interaction, {
        components: criarPainelHorarios(db, guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "toggle_horario") {
      const db = getConfigDB(interaction.guildId);
      const atual = db.get("horario_ativo") === true;

      db.set("horario_ativo", !atual);

      const depois = db.get("horario_ativo");

      return safeUpdate(interaction, {
        components: criarPainelHorarios(db, guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && customId.startsWith("horario_editar_")) {
      const dia = customId.replace("horario_editar_", "");
      const db = getConfigDB(interaction.guildId);
      const schedule = db.get("schedule") || {};
      const horario = schedule[dia] || {};
      const diasSemana = getDiasSemana(guildId);

      const startInput = new TextInputBuilder()
        .setCustomId("horario_start")
        .setLabel(t("horario_input_inicio_label", guildId))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(t("horario_input_inicio_placeholder", guildId))
        .setRequired(false);

      const endInput = new TextInputBuilder()
        .setCustomId("horario_end")
        .setLabel(t("horario_input_fim_label", guildId))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(t("horario_input_fim_placeholder", guildId))
        .setRequired(false);

      if (horario.start) startInput.setValue(horario.start);
      if (horario.end) endInput.setValue(horario.end);

      const modal = new ModalBuilder()
        .setCustomId(`modal_horario_${dia}`)
        .setTitle(t("horario_modal_titulo", guildId, { dia: diasSemana[dia] || dia }))
        .addComponents(
          new ActionRowBuilder().addComponents(startInput),
          new ActionRowBuilder().addComponents(endInput),
        );

      return safeShowModal(interaction, modal);
    }

    if (interaction.isModalSubmit() && customId.startsWith("modal_horario_")) {
      const dia = customId.replace("modal_horario_", "");
      const db = getConfigDB(interaction.guildId);
      const schedule = db.get("schedule") || {};

      const start = interaction.fields
        .getTextInputValue("horario_start")
        .trim();
      const end = interaction.fields.getTextInputValue("horario_end").trim();

      const regexHora = /^([01]\d|2[0-3]):[0-5]\d$/;

      if (start || end) {
        if (!regexHora.test(start) || !regexHora.test(end)) {
          return safeReply(interaction, {
            components: [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("horario_formato_invalido", guildId),
                ),
              ),
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }
        schedule[dia] = { start, end };
      } else {
        delete schedule[dia];
      }

      db.set("schedule", schedule);

      return safeUpdate(interaction, {
        components: criarPainelHorarios(db, guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "voltar_horario") {
      const db = getConfigDB(interaction.guildId);
      const systemStatus = db.get("system") ?? true;

      const row1 = new ActionRowBuilder().addComponents(
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("toggle_system")
            .setLabel("Sistema")
            .setStyle(
              systemStatus ? ButtonStyle.Success : ButtonStyle.Secondary,
            ),
          systemStatus ? emojis.on : emojis.off,
        ),
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("sistema_ticket")
            .setLabel("Painel")
            .setStyle(ButtonStyle.Secondary),
          emojis.laptop,
        ),
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("team_ticket")
            .setLabel("Equipe")
            .setStyle(ButtonStyle.Secondary),
          emojis.users,
        ),
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("horarios_ticket")
            .setLabel("Horários")
            .setStyle(ButtonStyle.Secondary),
          emojis.clock,
        ),
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("personalizar_ticket")
            .setLabel("Visual")
            .setStyle(ButtonStyle.Secondary),
          emojis.brush,
        ),
      );

      const row2 = new ActionRowBuilder().addComponents(
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("logs_ticket")
            .setLabel("Logs")
            .setStyle(ButtonStyle.Secondary),
          emojis.logs,
        ),
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("transcript_ticket")
            .setLabel("Transcript")
            .setStyle(ButtonStyle.Secondary),
          emojis.yaml,
        ),
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("avaliacao_ticket")
            .setLabel("Avaliação")
            .setStyle(ButtonStyle.Secondary),
          emojis.fav,
        ),
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("ia_ticket")
            .setLabel("IA")
            .setStyle(ButtonStyle.Secondary),
          emojis.bot,
        ),
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("outros_ticket")
            .setLabel("Outros")
            .setStyle(ButtonStyle.Secondary),
          emojis.settings,
        ),
      );

      const row3 = new ActionRowBuilder().addComponents(
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("ia_setup_inicial")
            .setLabel("Setup com IA")
            .setStyle(ButtonStyle.Secondary),
          emojis.bot,
        ),
        applyEmoji(
          new ButtonBuilder()
            .setCustomId("voltar_inicio")
            .setLabel("Voltar")
            .setStyle(ButtonStyle.Secondary),
          emojis.home,
        ),
      );

      return safeUpdate(interaction, {
        components: [
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
                `Personalize seu sistema de tickets clicando nos botões abaixo. Configure categorias, canais, botões e otimize o seu atendimento.\n\n-# Ping do bot: ${client.ws.ping}ms`,
              ),
            )
            .addActionRowComponents(row1, row2, row3),
        ],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }
  },
};
