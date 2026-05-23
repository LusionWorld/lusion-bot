// config-inatividade.js — Configuração de inatividade automática
const {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SectionBuilder,
} = require("discord.js");

const path = require("path");
const fs = require("fs");
const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const PROJECT_ROOT = path.resolve(__dirname, "../../../");

function be(btn, key) {
  if (!emojis[key]) return btn;
  const m = emojis[key].match(/^<a?:([^:]+):(\d+)>$/);
  if (m) btn.setEmoji({ name: m[1], id: m[2] });
  return btn;
}

function ei(key) {
  return emojis[key] || "";
}

function getConfigDB(guildId) {
  const filePath = path.join(
    PROJECT_ROOT,
    "banco/ticket",
    guildId,
    "config.json",
  );
  function read() {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return {};
    }
  }
  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf8");
  }
  return {
    get(key) {
      return key.split(".").reduce((o, k) => o?.[k], read());
    },
    set(key, value) {
      const data = read();
      const keys = key.split(".");
      let o = data;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!o[keys[i]]) o[keys[i]] = {};
        o = o[keys[i]];
      }
      o[keys[keys.length - 1]] = value;
      write(data);
    },
  };
}

function timestampRelativo(horas) {
  const ts = Math.floor((Date.now() + horas * 3600 * 1000) / 1000);
  return `<t:${ts}:R>`;
}

function buildPainelInatividade(guildId) {
  const db = getConfigDB(guildId);
  const ativo = db.get("inatividade_ativo") ?? false;
  const horasAviso = db.get("inatividade_horas_aviso") ?? 24;
  const horasFechar = db.get("inatividade_horas_fechar") ?? 48;
  const mensagem =
    db.get("inatividade_mensagem") ||
    "⏰ <@{user}> Seu ticket está inativo há {horas}h. Responda ou será encerrado.";

  const statusTexto = ativo
    ? `${ei("check")} Ativado`
    : `${ei("cancel")} Desativado`;

  const btnToggle = be(
    new ButtonBuilder()
      .setCustomId("toggle_inatividade_auto")
      .setLabel(`Inatividade: ${ativo ? "ON" : "OFF"}`)
      .setStyle(ativo ? ButtonStyle.Success : ButtonStyle.Secondary),
    ativo ? "check" : "cancel",
  );

  const btnHoras = be(
    new ButtonBuilder()
      .setCustomId("config_inatividade_horas")
      .setLabel("Configurar Horas")
      .setStyle(ButtonStyle.Secondary),
    "clock",
  );

  const btnMensagem = be(
    new ButtonBuilder()
      .setCustomId("config_inatividade_mensagem")
      .setLabel("Mensagem de Aviso")
      .setStyle(ButtonStyle.Secondary),
    "message",
  );

  const msgPreview =
    mensagem.length > 80 ? mensagem.substring(0, 80) + "..." : mensagem;

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${ei("clock")} **Inatividade Automática**`,
        ),
        new TextDisplayBuilder().setContent(
          `${ei("info")} Tickets sem atividade serão avisados e encerrados automaticamente.`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${ei("signal")} Status**\n${statusTexto}`,
            ),
          )
          .setButtonAccessory(btnToggle),

        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${ei("clock")} Horas para aviso:** \`${horasAviso}h\`  ·  ${timestampRelativo(horasAviso)}\n` +
                `**${ei("cancel")} Horas para fechar:** \`${horasFechar}h\`  ·  ${timestampRelativo(horasFechar)}\n\n` +
                `${ei("lightning")} Aviso em **${horasAviso}h** → fechar em **${horasFechar}h** sem resposta`,
            ),
          )
          .setButtonAccessory(btnHoras),

        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${ei("message")} Mensagem de aviso:**\n> ${msgPreview}\n\n` +
                `${ei("clipboard")} Variáveis: \`{user}\` = menção · \`{horas}\` = horas sem atividade`,
            ),
          )
          .setButtonAccessory(btnMensagem),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          be(
            new ButtonBuilder()
              .setCustomId("outros_ticket")
              .setLabel("Voltar")
              .setStyle(ButtonStyle.Secondary),
            "arrowl",
          ),
        ),
      ),
  ];
}

async function safeDefer(interaction) {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferUpdate();
    return true;
  } catch (e) {
    console.error("[INATIVIDADE] deferUpdate falhou:", e?.message);
    return false;
  }
}

module.exports = {
  customIds: [
    "config_inatividade_auto",
    "toggle_inatividade_auto",
    "config_inatividade_horas",
    "modal_inatividade_horas",
    "config_inatividade_mensagem",
    "modal_inatividade_mensagem",
  ],

  async execute(client, interaction) {
    const { customId, guildId } = interaction;
    if (!guildId) return;
    const db = getConfigDB(guildId);

    if (customId === "config_inatividade_auto") {
      const ok = await safeDefer(interaction);
      if (!ok) return;
      return interaction.editReply({
        components: buildPainelInatividade(guildId),
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "toggle_inatividade_auto") {
      const ok = await safeDefer(interaction);
      if (!ok) return;
      db.set("inatividade_ativo", !(db.get("inatividade_ativo") ?? false));
      return interaction.editReply({
        components: buildPainelInatividade(guildId),
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "config_inatividade_horas") {
      const modal = new ModalBuilder()
        .setCustomId("modal_inatividade_horas")
        .setTitle("Configurar Horas de Inatividade");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("horas_aviso")
            .setLabel("Horas para enviar aviso")
            .setStyle(TextInputStyle.Short)
            .setValue(String(db.get("inatividade_horas_aviso") ?? 24))
            .setRequired(true)
            .setPlaceholder("Ex: 24"),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("horas_fechar")
            .setLabel("Horas para fechar ticket")
            .setStyle(TextInputStyle.Short)
            .setValue(String(db.get("inatividade_horas_fechar") ?? 48))
            .setRequired(true)
            .setPlaceholder("Ex: 48"),
        ),
      );
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === "modal_inatividade_horas") {
      const horasAviso = Math.max(
        1,
        parseInt(interaction.fields.getTextInputValue("horas_aviso")) || 24,
      );
      const horasFechar = Math.max(
        horasAviso + 1,
        parseInt(interaction.fields.getTextInputValue("horas_fechar")) || 48,
      );
      db.set("inatividade_horas_aviso", horasAviso);
      db.set("inatividade_horas_fechar", horasFechar);
      return interaction.update({
        components: buildPainelInatividade(guildId),
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "config_inatividade_mensagem") {
      const modal = new ModalBuilder()
        .setCustomId("modal_inatividade_mensagem")
        .setTitle("Mensagem de Aviso de Inatividade");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("mensagem")
            .setLabel("Mensagem (use {user} e {horas})")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(
              db.get("inatividade_mensagem") ||
                "⏰ <@{user}> Seu ticket está inativo há {horas}h. Responda ou será encerrado.",
            )
            .setRequired(true)
            .setMaxLength(500),
        ),
      );
      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId === "modal_inatividade_mensagem"
    ) {
      db.set(
        "inatividade_mensagem",
        interaction.fields.getTextInputValue("mensagem"),
      );
      return interaction.update({
        components: buildPainelInatividade(guildId),
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
