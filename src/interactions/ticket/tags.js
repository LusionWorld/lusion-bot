const {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  MessageFlags,
  SectionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const { JsonDatabase } = require("wio.db");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const PROJECT_ROOT = path.resolve(__dirname, "../../../");
const dbConnections = new Map();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  return { name: match[1], id: match[2] };
}

function safeEmoji(raw) {
  return getEmoji(raw) || undefined;
}

function getDBConnection(guildId) {
  if (dbConnections.has(guildId)) return dbConnections.get(guildId);
  const folderPath = path.join(PROJECT_ROOT, "banco/ticket", guildId, "banco");
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  const db = new sqlite3.Database(path.join(folderPath, "tickets.db"));
  db.configure("busyTimeout", 10000);
  db.runAsync = promisify(db.run.bind(db));
  db.getAsync = promisify(db.get.bind(db));
  db.allAsync = promisify(db.all.bind(db));
  db.run("PRAGMA journal_mode = WAL;");

  db.all(`PRAGMA table_info(tickets)`, [], (err, rows) => {
    if (!err && rows && !rows.some((r) => r.name === "tags")) {
      db.run(`ALTER TABLE tickets ADD COLUMN tags TEXT DEFAULT '[]'`);
    }
  });

  dbConnections.set(guildId, db);
  return db;
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
    has(key) {
      return this.get(key) !== undefined;
    },
    delete(key) {
      const data = read();
      const keys = key.split(".");
      let o = data;
      for (let i = 0; i < keys.length - 1; i++) {
        o = o?.[keys[i]];
      }
      if (o) delete o[keys[keys.length - 1]];
      write(data);
    },
  };
}

const CORES_TAGS = {
  vermelho: emojis.red || "🔴",
  laranja: emojis.orange || "🟠",
  amarelo: emojis.orange || "🟡",
  verde: emojis.green || "🟢",
  azul: emojis.blue || "🔵",
  roxo: emojis.purple || "🟣",
  branco: emojis.color || "⚪",
  preto: emojis.color || "⚫",
};

function isStaffMember(member, guildId) {
  const db = getConfigDB(guildId);
  const teamRoles = db.get("team") || [];
  const usersPerms = db.get("usersperms") || {};
  return (
    member.roles.cache.some((r) => teamRoles.includes(r.id)) ||
    !!usersPerms[member.id]
  );
}

function buildPainelConfigTags(guildId) {
  const db = getConfigDB(guildId);
  const tagsConfig = db.get("tags_config") || {};
  const ativo = tagsConfig.ativo ?? false;
  const tagsCadastradas = tagsConfig.tags || [];

  const btnToggle = new ButtonBuilder()
    .setCustomId("toggle_tags_sistema")
    .setLabel(`Tags: ${ativo ? "ON" : "OFF"}`)
    .setStyle(ativo ? ButtonStyle.Success : ButtonStyle.Secondary);

  const btnAdicionarTag = new ButtonBuilder()
    .setCustomId("config_tag_adicionar")
    .setLabel("Adicionar Tag")
    .setEmoji(getEmoji(emojis.plus) || undefined)
    .setStyle(ButtonStyle.Primary);

  const btnVoltar = new ButtonBuilder()
    .setCustomId("outros_ticket")
    .setLabel("Voltar")
    .setEmoji(getEmoji(emojis.home) || undefined)
    .setStyle(ButtonStyle.Secondary);

  const sections = tagsCadastradas.map((tag, i) =>
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${CORES_TAGS[tag.cor] || emojis.thread || "🏷️"} **${tag.nome}**`,
        ),
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`config_tag_remover_${i}`)
          .setLabel("Remover")
          .setEmoji(getEmoji(emojis.cancel) || undefined)
          .setStyle(ButtonStyle.Danger),
      ),
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.thread || "🏷️"} **Sistema de Tags**`,
      ),
      new TextDisplayBuilder().setContent(
        `Configure tags/etiquetas para que o staff possa categorizar tickets.\n\n` +
          `${ativo ? emojis.check || "✅" : emojis.cancel || "❌"} **Status:** ${ativo ? "Ativo" : "Inativo"}\n` +
          `${emojis.layers || "📋"} **Tags cadastradas:** ${tagsCadastradas.length}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder());

  if (sections.length > 0) {
    container.addSectionComponents(...sections);
    container.addSeparatorComponents(new SeparatorBuilder());
  }

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(btnToggle, btnAdicionarTag, btnVoltar),
  );

  return [container];
}

module.exports = {
  customIds: [
    "config_tags_sistema",
    "toggle_tags_sistema",
    "config_tag_adicionar",
    "modal_tag_adicionar",
    "config_tag_remover_",
    "ticket_tags_",
    "ticket_tag_aplicar_",
    "ticket_tag_remover_select_",
  ],

  async execute(client, interaction) {
    const { customId, guildId } = interaction;
    if (!customId) return;

    if (customId === "config_tags_sistema") {
      if (interaction.deferred || interaction.replied) return;
      await interaction.deferUpdate();
      return interaction.editReply({
        components: buildPainelConfigTags(guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "toggle_tags_sistema") {
      if (interaction.deferred || interaction.replied) return;
      await interaction.deferUpdate();
      const db = getConfigDB(guildId);
      const tagsConfig = db.get("tags_config") || {};
      tagsConfig.ativo = !(tagsConfig.ativo ?? false);
      db.set("tags_config", tagsConfig);
      return interaction.editReply({
        components: buildPainelConfigTags(guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "config_tag_adicionar") {
      if (interaction.deferred || interaction.replied) return;
      const modal = new ModalBuilder()
        .setCustomId("modal_tag_adicionar")
        .setTitle("Adicionar Tag");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("tag_nome")
            .setLabel("Nome da tag")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(30)
            .setRequired(true)
            .setPlaceholder("Ex: Urgente, Aguardando, Resolvido..."),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("tag_cor")
            .setLabel("Cor: vermelho/laranja/amarelo/verde/azul/roxo")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("verde"),
        ),
      );
      return interaction.showModal(modal);
    }

    if (customId === "modal_tag_adicionar") {
      if (interaction.deferred || interaction.replied) return;
      const nome = interaction.fields.getTextInputValue("tag_nome").trim();
      const cor =
        interaction.fields.getTextInputValue("tag_cor").trim().toLowerCase() ||
        "azul";

      const db = getConfigDB(guildId);
      const tagsConfig = db.get("tags_config") || { ativo: false, tags: [] };
      if (!tagsConfig.tags) tagsConfig.tags = [];

      tagsConfig.tags.push({ nome, cor: CORES_TAGS[cor] ? cor : "azul" });
      db.set("tags_config", tagsConfig);

      return interaction.reply({
        components: buildPainelConfigTags(guildId),
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("config_tag_remover_")) {
      if (interaction.deferred || interaction.replied) return;
      await interaction.deferUpdate();
      const idx = parseInt(customId.replace("config_tag_remover_", ""));
      const db = getConfigDB(guildId);
      const tagsConfig = db.get("tags_config") || { tags: [] };
      if (!isNaN(idx) && tagsConfig.tags[idx]) {
        tagsConfig.tags.splice(idx, 1);
        db.set("tags_config", tagsConfig);
      }
      return interaction.editReply({
        components: buildPainelConfigTags(guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("ticket_tags_")) {
      if (interaction.deferred || interaction.replied) return;
      const channelId = customId.replace("ticket_tags_", "");

      if (!isStaffMember(interaction.member, guildId)) {
        return interaction.reply({
          content: "❌ Sem permissão.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const db = getConfigDB(guildId);
      const tagsConfig = db.get("tags_config") || {};
      const tagsCadastradas = tagsConfig.tags || [];

      if (tagsCadastradas.length === 0) {
        return interaction.reply({
          content: "❌ Nenhuma tag cadastrada. Configure tags no painel admin.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const dbsql = getDBConnection(guildId);
      const ticket = await dbsql
        .getAsync("SELECT tags FROM tickets WHERE ticket_id = ?", [channelId])
        .catch(() => null);
      let tagsAtuais = [];
      try {
        tagsAtuais = JSON.parse(ticket?.tags || "[]");
      } catch {
        tagsAtuais = [];
      }

      const options = tagsCadastradas.map((tag, i) => ({
        label: tag.nome,
        value: `${i}`,
        emoji: getEmoji(CORES_TAGS[tag.cor]) || CORES_TAGS[tag.cor] || "🏷️",
        default: tagsAtuais.includes(tag.nome),
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId(`ticket_tag_aplicar_${channelId}`)
        .setPlaceholder("Selecione as tags")
        .setMinValues(0)
        .setMaxValues(Math.min(options.length, 5))
        .addOptions(options);

      return interaction.reply({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.thread || "🏷️"} **Gerenciar Tags do Ticket**`,
              ),
              new TextDisplayBuilder().setContent(
                `${emojis.pin || "📌"} Selecione as tags que se aplicam a este ticket:`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(select),
            ),
        ],
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
      });
    }

    if (customId.startsWith("ticket_tag_aplicar_")) {
      if (interaction.deferred || interaction.replied) return;
      const channelId = customId.replace("ticket_tag_aplicar_", "");

      const db = getConfigDB(guildId);
      const tagsConfig = db.get("tags_config") || {};
      const tagsCadastradas = tagsConfig.tags || [];

      const indices = interaction.values.map((v) => parseInt(v));
      const novasTags = indices
        .map((i) => tagsCadastradas[i]?.nome)
        .filter(Boolean);

      const dbsql = getDBConnection(guildId);
      await dbsql
        .runAsync("UPDATE tickets SET tags = ? WHERE ticket_id = ?", [
          JSON.stringify(novasTags),
          channelId,
        ])
        .catch(() => {});

      const canal = interaction.guild.channels.cache.get(channelId);
      if (canal && novasTags.length > 0) {
        const tagLabel = novasTags
          .map((t) => {
            const tagObj = tagsCadastradas.find((tc) => tc.nome === t);
            return `${CORES_TAGS[tagObj?.cor] || "🏷️"} ${t}`;
          })
          .join(" · ");

        await canal
          .send({
            components: [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${emojis.thread || "🏷️"} **Tags atualizadas por ${interaction.user}:** ${tagLabel}`,
                ),
              ),
            ],
            flags: MessageFlags.IsComponentsV2,
          })
          .catch(() => {});
      }

      return interaction.update({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              novasTags.length > 0
                ? `${emojis.check || "✅"} **Tags aplicadas:** ${novasTags
                    .map((t) => {
                      const tagObj = tagsCadastradas.find(
                        (tc) => tc.nome === t,
                      );
                      return `${CORES_TAGS[tagObj?.cor] || emojis.thread || "🏷️"} ${t}`;
                    })
                    .join("  ")}`
                : `${emojis.check || "✅"} Tags removidas.`,
            ),
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
