// avaliacao-criterios.js
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
  LabelBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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

function safeEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  return { name: match[1], id: match[2] };
}

function be(btn, emojiKey) {
  const e = safeEmoji(emojis[emojiKey]);
  if (e) btn.setEmoji(e);
  return btn;
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
  dbConnections.set(guildId, db);
  db.run(`CREATE TABLE IF NOT EXISTS avaliacoes_criterios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    staff_id TEXT,
    nota_velocidade INTEGER,
    nota_qualidade INTEGER,
    nota_simpatia INTEGER,
    media REAL,
    comentario TEXT,
    avaliado_em INTEGER NOT NULL
  )`);
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
  };
}

function getPersonalizacaoDB(guildId) {
  return new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../banco/ticket/${guildId}/personalizacao.json`,
    ),
  });
}

function estrelas(n) {
  const full = Math.round(n || 0);
  return "⭐".repeat(full) + "☆".repeat(5 - full);
}

function medalha(pos) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return `${pos}°`;
}

function getInicioSemana() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - diff);
  return now.getTime();
}

async function safeDefer(interaction) {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferUpdate();
    return true;
  } catch (err) {
    console.error("[AVAL-CRITERIOS] deferUpdate falhou:", err?.message);
    return false;
  }
}

function buildConfigAvaliacaoComponents(guildId) {
  const configDB = getConfigDB(guildId);
  const criteriosAtivo = configDB.get("avaliacao_criterios_ativo") ?? false;
  const metaNota = configDB.get("meta_avaliacao") ?? 0;

  const btnToggle = new ButtonBuilder()
    .setCustomId("toggle_aval_criterios")
    .setLabel(`Critérios: ${criteriosAtivo ? "ON" : "OFF"}`)
    .setStyle(criteriosAtivo ? ButtonStyle.Success : ButtonStyle.Secondary);
  be(btnToggle, criteriosAtivo ? "check" : "cancel");

  const btnMeta = new ButtonBuilder()
    .setCustomId("config_meta_avaliacao")
    .setLabel("Definir Meta")
    .setStyle(ButtonStyle.Secondary);
  be(btnMeta, "graph");

  const statusTexto = criteriosAtivo
    ? `${emojis.check || "✅"} Ativo`
    : `${emojis.cancel || "❌"} Inativo`;

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${emojis.fav || "⭐"} **Configurações de Avaliação**`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${emojis.star || "⭐"} Avaliação por Critérios**\nUsuários avaliam velocidade, qualidade e simpatia separadamente.\n${emojis.signal || "🔔"} **Status:** ${statusTexto}`,
            ),
          )
          .setButtonAccessory(btnToggle),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${emojis.graph || "📊"} Meta de Avaliação**\nNota mínima esperada. Alerta no log quando staff fica abaixo.\n${emojis.pin || "📌"} **Meta atual:** ${metaNota > 0 ? `${metaNota}/5` : "Desativada"}`,
            ),
          )
          .setButtonAccessory(btnMeta),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          be(
            new ButtonBuilder()
              .setCustomId("ranking_staff_")
              .setLabel("Ranking por Nota")
              .setStyle(ButtonStyle.Secondary),
            "star",
          ),
          be(
            new ButtonBuilder()
              .setCustomId("ranking_semanal_")
              .setLabel("Ranking Semanal")
              .setStyle(ButtonStyle.Secondary),
            "calendar",
          ),
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

module.exports = {
  customIds: [
    "aval_criterios_",
    "aval_c_velocidade_",
    "aval_c_qualidade_",
    "aval_c_simpatia_",
    "modal_aval_criterios_",
    "submit_aval_criterios_",
    "ranking_staff_",
    "ranking_semanal_",
    "config_avaliacao_criterios",
    "config_meta_avaliacao",
    "modal_meta_avaliacao",
    "toggle_aval_criterios",
  ],

  async execute(client, interaction) {
    const { customId } = interaction;
    if (!customId) return;

    let guildId = interaction.guildId;
    let guild = interaction.guild;

    if (!guildId && customId.startsWith("aval_criterios_")) {
      const parts = customId.replace("aval_criterios_", "").split("_");
      guildId = parts[2] || null;
      if (guildId) guild = client.guilds.cache.get(guildId) || null;
    }
    if (!guildId && customId.startsWith("submit_aval_criterios_")) {
      const parts = customId.replace("submit_aval_criterios_", "").split("_");
      guildId = parts[2] || null;
      if (guildId) guild = client.guilds.cache.get(guildId) || null;
    }

    if (!guildId) return;

    const db = getDBConnection(guildId);

    if (customId.startsWith("aval_criterios_")) {
      const parts = customId.replace("aval_criterios_", "").split("_");
      const ticketId = parts[0];
      const staffId = parts[1] || "none";

      const makeSelect = (customIdSuffix, labelText, descText) => {
        const select = new StringSelectMenuBuilder()
          .setCustomId(customIdSuffix)
          .setRequired(true)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("1 estrela")
              .setValue("1")
              .setDescription("Muito ruim"),
            new StringSelectMenuOptionBuilder()
              .setLabel("2 estrelas")
              .setValue("2")
              .setDescription("Ruim"),
            new StringSelectMenuOptionBuilder()
              .setLabel("3 estrelas")
              .setValue("3")
              .setDescription("Regular"),
            new StringSelectMenuOptionBuilder()
              .setLabel("4 estrelas")
              .setValue("4")
              .setDescription("Bom"),
            new StringSelectMenuOptionBuilder()
              .setLabel("5 estrelas")
              .setValue("5")
              .setDescription("Excelente"),
          );
        return new LabelBuilder()
          .setLabel(labelText)
          .setDescription(descText)
          .setStringSelectMenuComponent(select);
      };

      const comentarioLabel = new LabelBuilder()
        .setLabel("Comentário (opcional)")
        .setDescription("Deixe um feedback para o staff")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("comentario")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500)
            .setPlaceholder("Escreva seu comentário aqui..."),
        );

      const modal = new ModalBuilder()
        .setCustomId(`submit_aval_criterios_${ticketId}_${staffId}_${guildId}`)
        .setTitle("Avaliar Atendimento")
        .addLabelComponents(
          makeSelect(
            "aval_velocidade",
            "Velocidade",
            "Quão rápido foi o atendimento?",
          ),
          makeSelect(
            "aval_qualidade",
            "Qualidade",
            "O problema foi resolvido?",
          ),
          makeSelect("aval_simpatia", "Simpatia", "O staff foi atencioso?"),
          comentarioLabel,
        );

      return interaction.showModal(modal);
    }

    if (customId.startsWith("ranking_staff_")) {
      const ok = await safeDefer(interaction);
      if (!ok) return;

      const configDB = getConfigDB(guildId);
      const metaNota = configDB.get("meta_avaliacao") ?? 0;

      const rows = await db
        .allAsync(
          `
        SELECT staff_id,
          AVG(media) as media_geral,
          AVG(nota_velocidade) as media_velocidade,
          AVG(nota_qualidade) as media_qualidade,
          AVG(nota_simpatia) as media_simpatia,
          COUNT(*) as total_avals
        FROM avaliacoes_criterios
        WHERE staff_id IS NOT NULL
        GROUP BY staff_id
        ORDER BY media_geral DESC
        LIMIT 10
      `,
        )
        .catch(() => []);

      if (rows.length === 0) {
        return interaction.editReply({
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${emojis.fav || "⭐"} **Ranking — Notas**`,
                ),
                new TextDisplayBuilder().setContent(
                  `${emojis.info || "ℹ️"} Nenhuma avaliação registrada ainda.`,
                ),
              )
              .addSeparatorComponents(new SeparatorBuilder())
              .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                  be(
                    new ButtonBuilder()
                      .setCustomId("ranking_semanal_")
                      .setLabel("Ranking Semanal")
                      .setStyle(ButtonStyle.Secondary),
                    "calendar",
                  ),
                  be(
                    new ButtonBuilder()
                      .setCustomId("config_avaliacao_criterios")
                      .setLabel("Voltar")
                      .setStyle(ButtonStyle.Secondary),
                    "arrowl",
                  ),
                ),
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const sections = await Promise.all(
        rows.map(async (row, i) => {
          let nome = row.staff_id;
          try {
            const m = await guild.members.fetch(row.staff_id).catch(() => null);
            nome = m ? m.nickname || m.user.username : `<@${row.staff_id}>`;
          } catch {}

          const mediaStr = parseFloat(row.media_geral).toFixed(1);
          const abaixoMeta =
            metaNota > 0 && parseFloat(row.media_geral) < metaNota;

          return new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**${medalha(i + 1)} ${nome}**\n` +
                  `${estrelas(row.media_geral)} **${mediaStr}/5** · ${emojis.users || "👥"} ${row.total_avals} avaliações` +
                  `${abaixoMeta ? `\n${emojis.warning || "⚠️"} Abaixo da meta` : ""}\n` +
                  `${emojis.lightning || "⚡"} ${parseFloat(row.media_velocidade || 0).toFixed(1)} · ` +
                  `${emojis.check || "✅"} ${parseFloat(row.media_qualidade || 0).toFixed(1)} · ` +
                  `${emojis.hearth || "💙"} ${parseFloat(row.media_simpatia || 0).toFixed(1)}`,
              ),
            )
            .setButtonAccessory(
              new ButtonBuilder()
                .setCustomId(`_rk_nota_${i}`)
                .setLabel(mediaStr)
                .setStyle(abaixoMeta ? ButtonStyle.Danger : ButtonStyle.Success)
                .setDisabled(true),
            );
        }),
      );

      return interaction.editReply({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.fav || "⭐"} **Ranking — Notas**`,
              ),
              new TextDisplayBuilder().setContent(
                `${emojis.graph || "📈"} Critérios: velocidade, qualidade e simpatia.` +
                  `${metaNota > 0 ? `\n${emojis.pin || "📌"} Meta mínima: **${metaNota}/5**` : ""}`,
              ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addSectionComponents(...sections)
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                be(
                  new ButtonBuilder()
                    .setCustomId("ranking_semanal_")
                    .setLabel("Ranking Semanal")
                    .setStyle(ButtonStyle.Secondary),
                  "calendar",
                ),
                be(
                  new ButtonBuilder()
                    .setCustomId("config_avaliacao_criterios")
                    .setLabel("Voltar")
                    .setStyle(ButtonStyle.Secondary),
                  "arrowl",
                ),
              ),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId.startsWith("ranking_semanal_")) {
      const ok = await safeDefer(interaction);
      if (!ok) return;

      const inicioSemana = getInicioSemana();

      let rowsFinal = await db
        .allAsync(
          `
        SELECT fechado_id as staff_id, COUNT(*) as tickets_fechados
        FROM tickets
        WHERE guild_id = ? AND fechado_em IS NOT NULL AND fechado_em >= ? AND fechado_id IS NOT NULL
        GROUP BY fechado_id ORDER BY tickets_fechados DESC LIMIT 10
      `,
          [guildId, inicioSemana],
        )
        .catch(() => []);

      if (rowsFinal.length === 0) {
        rowsFinal = await db
          .allAsync(
            `
          SELECT staff_id, COUNT(*) as tickets_fechados
          FROM tickets
          WHERE guild_id = ? AND fechado_em IS NOT NULL AND fechado_em >= ? AND staff_id IS NOT NULL
          GROUP BY staff_id ORDER BY tickets_fechados DESC LIMIT 10
        `,
            [guildId, inicioSemana],
          )
          .catch(() => []);
      }

      const inicioStr = new Date(inicioSemana).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
      });
      const hojeStr = new Date().toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
      });
      const horaStr = new Date().toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      });

      if (rowsFinal.length === 0) {
        return interaction.editReply({
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${emojis.crown || "🏆"} **Ranking Semanal**`,
                ),
                new TextDisplayBuilder().setContent(
                  `${emojis.calendar || "📅"} **${inicioStr}** até **${hojeStr}**\n\n` +
                    `${emojis.info || "ℹ️"} Nenhum ticket fechado nesta semana ainda.`,
                ),
              )
              .addSeparatorComponents(new SeparatorBuilder())
              .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                  be(
                    new ButtonBuilder()
                      .setCustomId("ranking_semanal_")
                      .setLabel("Atualizar")
                      .setStyle(ButtonStyle.Secondary),
                    "refresh",
                  ),
                  be(
                    new ButtonBuilder()
                      .setCustomId("ranking_staff_")
                      .setLabel("Ranking por Nota")
                      .setStyle(ButtonStyle.Secondary),
                    "star",
                  ),
                  be(
                    new ButtonBuilder()
                      .setCustomId("config_avaliacao_criterios")
                      .setLabel("Voltar")
                      .setStyle(ButtonStyle.Secondary),
                    "arrowl",
                  ),
                ),
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const sections = await Promise.all(
        rowsFinal.map(async (row, i) => {
          let nome = row.staff_id;
          try {
            const m = await guild.members.fetch(row.staff_id).catch(() => null);
            nome = m ? m.nickname || m.user.username : `<@${row.staff_id}>`;
          } catch {}

          return new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**${medalha(i + 1)} ${nome}**\n` +
                  `${emojis.check || "✅"} **${row.tickets_fechados}** ticket${row.tickets_fechados !== 1 ? "s" : ""} fechado${row.tickets_fechados !== 1 ? "s" : ""} esta semana`,
              ),
            )
            .setButtonAccessory(
              new ButtonBuilder()
                .setCustomId(`_rk_sem_${i}`)
                .setLabel(`${row.tickets_fechados}`)
                .setStyle(i === 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(true),
            );
        }),
      );

      return interaction.editReply({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.crown || "🏆"} **Ranking Semanal**`,
              ),
              new TextDisplayBuilder().setContent(
                `${emojis.calendar || "📅"} **${inicioStr}** até **${hojeStr}** · ` +
                  `${emojis.clock || "🕐"} atualizado às **${horaStr}**`,
              ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addSectionComponents(...sections)
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                be(
                  new ButtonBuilder()
                    .setCustomId("ranking_semanal_")
                    .setLabel("Atualizar")
                    .setStyle(ButtonStyle.Secondary),
                  "refresh",
                ),
                be(
                  new ButtonBuilder()
                    .setCustomId("ranking_staff_")
                    .setLabel("Ranking por Nota")
                    .setStyle(ButtonStyle.Secondary),
                  "star",
                ),
                be(
                  new ButtonBuilder()
                    .setCustomId("config_avaliacao_criterios")
                    .setLabel("Voltar")
                    .setStyle(ButtonStyle.Secondary),
                  "arrowl",
                ),
              ),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "config_avaliacao_criterios") {
      const ok = await safeDefer(interaction);
      if (!ok) return;
      return interaction.editReply({
        components: buildConfigAvaliacaoComponents(guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "toggle_aval_criterios") {
      const ok = await safeDefer(interaction);
      if (!ok) return;
      const configDB = getConfigDB(guildId);
      configDB.set(
        "avaliacao_criterios_ativo",
        !(configDB.get("avaliacao_criterios_ativo") ?? false),
      );
      return interaction.editReply({
        components: buildConfigAvaliacaoComponents(guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "config_meta_avaliacao") {
      const modal = new ModalBuilder()
        .setCustomId("modal_meta_avaliacao")
        .setTitle("Meta de Avaliação do Staff");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("meta")
            .setLabel("Meta mínima (1-5, ou 0 para desativar)")
            .setStyle(TextInputStyle.Short)
            .setValue(String(getConfigDB(guildId).get("meta_avaliacao") ?? 0))
            .setRequired(true)
            .setPlaceholder("Ex: 4"),
        ),
      );
      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("submit_aval_criterios_")
    ) {
      await interaction.deferReply().catch(() => {});

      const parts = customId.replace("submit_aval_criterios_", "").split("_");
      const ticketId = parts[0];
      const staffId = parts[1] === "none" ? null : parts[1];

      let velocidade, qualidade, simpatia;
      try {
        const fields = interaction.fields.fields;
        const getSelectValue = (id) => {
          const field = fields.get(id);
          if (field && field.values && field.values.length > 0)
            return parseInt(field.values[0]);
          return null;
        };
        velocidade = getSelectValue("aval_velocidade");
        qualidade = getSelectValue("aval_qualidade");
        simpatia = getSelectValue("aval_simpatia");
      } catch (e) {
        console.error("[AVAL-CRITERIOS] erro ao ler selects:", e?.message);
      }

      const comentario = (() => {
        try {
          return interaction.fields.getTextInputValue("comentario") || null;
        } catch {
          return null;
        }
      })();

      if (!velocidade || !qualidade || !simpatia) {
        return interaction.editReply({
          content: "Avalie todos os critérios antes de enviar.",
        });
      }

      const submitGuildId = guildId;
      if (!submitGuildId) return;
      const submitDb = getDBConnection(submitGuildId);
      const submitGuild =
        guild || client.guilds.cache.get(submitGuildId) || null;

      const media = (velocidade + qualidade + simpatia) / 3;
      await submitDb.runAsync(
        "INSERT INTO avaliacoes_criterios (ticket_id, user_id, staff_id, nota_velocidade, nota_qualidade, nota_simpatia, media, comentario, avaliado_em) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          ticketId,
          interaction.user.id,
          staffId,
          velocidade,
          qualidade,
          simpatia,
          media,
          comentario,
          Date.now(),
        ],
      );

      try {
        const configDB = getConfigDB(submitGuildId);
        const logAvaliacaoCfg = configDB.get("logs.log_avaliacao") || {};

        if (
          logAvaliacaoCfg.ativo === true &&
          logAvaliacaoCfg.canal &&
          submitGuild
        ) {
          const canalLog = submitGuild.channels.cache.get(
            logAvaliacaoCfg.canal,
          );
          if (canalLog) {
            const dbPersonalizacao = getPersonalizacaoDB(submitGuildId);
            const config = dbPersonalizacao.get("embedlogavaliacao") || {};

            const staffTexto = staffId ? `<@${staffId}>` : "Sem Staff";
            const estrelinhas = estrelas(media);
            const mediaStr = media.toFixed(1);
            const comentarioTexto = comentario
              ? `
**Comentário:** ${comentario}`
              : "";

            const descricao = config.descricao
              ? config.descricao
                  .replace(
                    "{user}",
                    `${interaction.user} (\`${interaction.user.id}\`)`,
                  )
                  .replace("{ticket_id}", `\`${ticketId}\``)
                  .replace("{estrelas}", estrelinhas)
                  .replace("{avaliacao}", `${mediaStr}/5`)
                  .replace("{comentario}", comentario || "Sem comentário")
                  .replace("{data}", `<t:${Math.floor(Date.now() / 1000)}:f>`)
                  .replace("{staff}", staffTexto)
                  .replace("{velocidade}", `${velocidade}/5`)
                  .replace("{qualidade}", `${qualidade}/5`)
                  .replace("{simpatia}", `${simpatia}/5`)
              : `**Usuário:** ${interaction.user} (\`${interaction.user.id}\`)\n**Ticket ID:** \`${ticketId}\`\n**Staff:** ${staffTexto}\n` +
                `**Velocidade:** ${velocidade}/5 · **Qualidade:** ${qualidade}/5 · **Simpatia:** ${simpatia}/5\n` +
                `**Média:** ${estrelinhas} **(${mediaStr}/5)**${comentarioTexto}\n**Data:** <t:${Math.floor(Date.now() / 1000)}:f>`;

            const containerLog =
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `# ${config.title || `${emojis.star || "⭐"} Nova Avaliação`}`,
                ),
                new TextDisplayBuilder().setContent(descricao),
              );

            if (config.color) {
              const hex = config.color.replace("#", "");
              const decimal = parseInt(hex, 16);
              if (!isNaN(decimal)) containerLog.setAccentColor(decimal);
            }

            await canalLog
              .send({
                flags: MessageFlags.IsComponentsV2,
                components: [containerLog],
              })
              .catch((err) =>
                console.error(
                  "[AVAL-CRITERIOS] erro ao enviar log:",
                  err?.message,
                ),
              );
          }
        }

        const metaNota = configDB.get("meta_avaliacao") ?? 0;
        if (staffId && metaNota > 0 && media < metaNota && submitGuild) {
          const logFechamentoCfg = configDB.get("logs.log_fechamento") || {};
          const canalAlerta = logFechamentoCfg.canal
            ? submitGuild.channels.cache.get(logFechamentoCfg.canal)
            : null;
          if (canalAlerta) {
            await canalAlerta
              .send({
                components: [
                  new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                      `${emojis.warning || "⚠️"} **Alerta de Meta**\n` +
                        `<@${staffId}> recebeu **${media.toFixed(1)}/5** abaixo da meta (**${metaNota}/5**).\n` +
                        `Ticket: \`${ticketId}\``,
                    ),
                  ),
                ],
                flags: MessageFlags.IsComponentsV2,
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        console.error("[AVAL-CRITERIOS] erro ao enviar log:", err?.message);
      }

      const barra = (n) => "🟩".repeat(n) + "⬜".repeat(5 - n);
      const medalhaFn = (n) =>
        n >= 5
          ? emojis.crown || "🏆"
          : n >= 4
            ? "🥇"
            : n >= 3
              ? "🥈"
              : n >= 2
                ? "🥉"
                : "❌";
      const eCheck = emojis.check || "✅";
      const eLight = emojis.lightning || "⚡";
      const eHearth = emojis.hearth || "💙";
      const eGraph = emojis.graph || "📊";

      const containerResultado = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${eCheck} **Avaliação enviada! Obrigado.**\n\n` +
            `${eLight} **Velocidade** ${medalhaFn(velocidade)} ${barra(velocidade)} **${velocidade}/5**\n` +
            `${eCheck} **Qualidade** ${medalhaFn(qualidade)} ${barra(qualidade)} **${qualidade}/5**\n` +
            `${eHearth} **Simpatia** ${medalhaFn(simpatia)} ${barra(simpatia)} **${simpatia}/5**\n\n` +
            `${eGraph} **Média geral: ${media.toFixed(1)}/5**`,
        ),
      );

      try {
        const configDB = getConfigDB(submitGuildId);
        const avalMsgId = configDB.get(`aval_dm_msg_${ticketId}`);
        if (avalMsgId) {
          const dmChannel = await interaction.user.createDM();
          const msg = await dmChannel.messages
            .fetch(avalMsgId)
            .catch(() => null);
          if (msg) {
            function contemBotaoCriterios(comp) {
              if (!comp || !comp.components) return false;
              for (const c of comp.components) {
                const cid = c.customId || c.data?.custom_id || "";
                if (cid.startsWith("aval_criterios_")) return true;
                if (c.components && contemBotaoCriterios(c)) return true;
              }
              return false;
            }

            const novosComponents = msg.components.map((comp) => {
              if (contemBotaoCriterios(comp)) return containerResultado;
              return comp;
            });

            await msg
              .edit({
                flags: MessageFlags.IsComponentsV2,
                components: novosComponents,
              })
              .catch((err) =>
                console.error("[AVAL-CRITERIOS] erro ao editar msg DM:", err?.message),
              );
          }
          configDB.set(`aval_dm_msg_${ticketId}`, null);
        }
      } catch (err) {
        console.error("[AVAL-CRITERIOS] erro ao buscar/editar DM:", err?.message);
      }

      await interaction.deleteReply().catch(() => {});
    }

    if (interaction.isModalSubmit() && customId === "modal_meta_avaliacao") {
      const val = Math.max(
        0,
        Math.min(
          5,
          parseFloat(interaction.fields.getTextInputValue("meta")) || 0,
        ),
      );
      getConfigDB(guildId).set("meta_avaliacao", val);
      return interaction.update({
        components: buildConfigAvaliacaoComponents(guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }
  },
};