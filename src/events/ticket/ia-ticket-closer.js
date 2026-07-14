const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const { t } = require("../../utils/i18n");
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  ChannelType,
} = require("discord.js");
const discordTranscripts = require("discord-html-transcripts");

const PROJECT_ROOT = path.resolve(__dirname, "../../../");

function getDBConnection(guildId) {
  const folderPath = path.join(PROJECT_ROOT, "banco/ticket", guildId, "banco");
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const dbPath = path.join(folderPath, "tickets.db");
  const db = new sqlite3.Database(dbPath);
  db.configure("busyTimeout", 10000);
  db.runAsync = promisify(db.run.bind(db));
  db.getAsync = promisify(db.get.bind(db));
  db.allAsync = promisify(db.all.bind(db));
  db.run("PRAGMA journal_mode = WAL;");
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON tickets(ticket_id)`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_guild_fechado ON tickets(guild_id, fechado_em)`, () => {});
  db.run(`ALTER TABLE tickets ADD COLUMN ia_pausada_por_staff INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE tickets ADD COLUMN chat_historico TEXT DEFAULT '[]'`, () => {});
  db.run(`ALTER TABLE tickets ADD COLUMN primeira_resposta_em INTEGER DEFAULT NULL`, () => {});
  db.run(`ALTER TABLE tickets ADD COLUMN respondido_id TEXT DEFAULT NULL`, () => {});
  db.run(`ALTER TABLE tickets ADD COLUMN fechado_id TEXT DEFAULT NULL`, () => {});
  db.run(`ALTER TABLE tickets ADD COLUMN message_id TEXT DEFAULT NULL`, () => {});
  db.run(`ALTER TABLE tickets ADD COLUMN motivo_abertura TEXT DEFAULT NULL`, () => {});
  db.run(`ALTER TABLE tickets ADD COLUMN nome_categoria TEXT DEFAULT NULL`, () => {});
  return db;
}

function getConfigDB(guildId) {
  const { JsonDatabase } = require("wio.db");
  return new JsonDatabase({
    databasePath: path.join(
      PROJECT_ROOT,
      "banco/ticket",
      guildId,
      "config.json",
    ),
  });
}

function getPersonalizacaoDB(guildId) {
  const { JsonDatabase } = require("wio.db");
  return new JsonDatabase({
    databasePath: path.join(
      PROJECT_ROOT,
      "banco/ticket",
      guildId,
      "personalizacao.json",
    ),
  });
}

/**
 *
 * @param {Client} client
 * @param {string} guildId
 * @param {string} channelId
 */
async function fecharTicketPorIA(client, guildId, channelId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const canal = guild.channels.cache.get(channelId);
  if (!canal) return;

  const dbsql = getDBConnection(guildId);
  const motivo = t("ia_motivo_encerrado", guildId);

  try {
    await dbsql.runAsync(
      `UPDATE tickets SET fechado_em = ?, fechado_id = ? WHERE ticket_id = ?`,
      [Date.now(), client.user.id, channelId],
    );

    try {
      const row = await dbsql.getAsync(
        `SELECT * FROM contadores WHERE guild_id = ?`,
        [guildId],
      );
      if (row) {
        await dbsql.runAsync(
          `UPDATE contadores SET fechados = fechados + 1 WHERE guild_id = ?`,
          [guildId],
        );
      } else {
        await dbsql.runAsync(
          `INSERT INTO contadores (guild_id, abertos, assumidos, fechados) VALUES (?, 0, 0, 1)`,
          [guildId],
        );
      }
    } catch {}

    const dbConfig = getConfigDB(guildId);
    const dbPersonalizacao = getPersonalizacaoDB(guildId);

    const logCfg = dbConfig.get("logs.log_fechamento") || {};
    const logUserCfg = dbConfig.get("logs.log_user") || {};
    const transcriptCfg = dbConfig.get("transcript") || {};

    const embedLogsData = dbPersonalizacao.get("embedlogs") || {};
    const embedLogsUserData = dbPersonalizacao.get("embedlogsuser") || {};

    const topic = canal.topic || "";
    const autorId = topic.split("Labz - ")[1];

    const canalTexto = `<#${canal.id}> (${canal.name})`;
    const staffTexto = `${client.user} (\`${client.user.id}\`)`;
    const autorTexto = autorId ? `<@${autorId}>` : t("ticket_nao_identificado", guildId);
    const abertoTimestamp = Math.floor(canal.createdTimestamp / 1000);
    const fechadoTimestamp = Math.floor(Date.now() / 1000);
    const abertura = `<t:${abertoTimestamp}:f>`;
    const fechamento = `<t:${fechadoTimestamp}:f>`;
    const msTotal = Date.now() - canal.createdTimestamp;
    const totalMinutos = Math.floor(msTotal / 60000);
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    const horatotal = `${horas > 0 ? `${horas} hora${horas > 1 ? "s" : ""}` : ""}${horas && minutos ? ", " : ""}${minutos} minuto${minutos !== 1 ? "s" : ""}`;

    const replace = (str) =>
      (str || "")
        .replaceAll("{canal}", canalTexto)
        .replaceAll("{staff}", staffTexto)
        .replaceAll("{motivo}", motivo)
        .replaceAll("{user}", autorTexto)
        .replaceAll("{abertura}", abertura)
        .replaceAll("{fechamento}", fechamento)
        .replaceAll("{horatotal}", horatotal);

    let transcriptAttachment = null;
    try {
      const ticketId = Math.floor(
        1000000000 + Math.random() * 9000000000,
      ).toString();
      const fileName = `transcript-labz${ticketId}.html`;

      transcriptAttachment = await discordTranscripts.createTranscript(canal, {
        limit: 1000,
        returnBuffer: false,
        filename: fileName,
        footerText: "Labz Application - Transcript",
        saveImages: false,
        poweredBy: false,
      });
    } catch {}

    if (logCfg.ativo === true && logCfg.canal) {
      const canalLog = guild.channels.cache.get(logCfg.canal);
      if (canalLog) {
        const descricao = replace(
          embedLogsData.descricao || "Registro de fechamento do ticket.",
        );
        const components = [
          new TextDisplayBuilder().setContent(
            `# ${embedLogsData.title || "📄 Registro de Logs"}`,
          ),
          new TextDisplayBuilder().setContent(descricao),
        ];

        if (Array.isArray(embedLogsData.fields)) {
          embedLogsData.fields.forEach((f) => {
            components.push(
              new TextDisplayBuilder().setContent(
                `**${f.name}**\n${replace(f.value || "")}`,
              ),
            );
          });
        }

        let containerLog = new ContainerBuilder().addTextDisplayComponents(
          ...components,
        );

        await canalLog
          .send({
            flags: MessageFlags.IsComponentsV2,
            components: [containerLog],
            files:
              transcriptCfg.staff === true && transcriptAttachment
                ? [transcriptAttachment]
                : [],
          })
          .catch(() => {});
      }
    }

    if (logUserCfg.ativo === true && autorId) {
      try {
        const membro = await guild.members.fetch(autorId).catch(() => null);
        if (membro) {
          const descricaoUser = replace(
            embedLogsUserData.descricao || "Seu ticket foi encerrado.",
          );
          const userComponents = [
            new TextDisplayBuilder().setContent(
              `# ${embedLogsUserData.title || "📄 Registro do Ticket Encerrado"}`,
            ),
            new TextDisplayBuilder().setContent(descricaoUser),
          ];

          if (Array.isArray(embedLogsUserData.fields)) {
            embedLogsUserData.fields.forEach((f) => {
              userComponents.push(
                new TextDisplayBuilder().setContent(
                  `**${f.name}**\n${replace(f.value || "")}`,
                ),
              );
            });
          }

          let containerUser = new ContainerBuilder().addTextDisplayComponents(
            ...userComponents,
          );

          await membro
            .send({
              flags: MessageFlags.IsComponentsV2,
              components: [containerUser],
              files:
                transcriptCfg.user === true && transcriptAttachment
                  ? [transcriptAttachment]
                  : [],
            })
            .catch(() => {});
        }
      } catch {}
    }

    try {
      const canaisDaCategoria =
        canal.parent?.children?.cache || guild.channels.cache;
      const callExistente = canaisDaCategoria.find(
        (c) => c.type === ChannelType.GuildVoice && c.name === canal.name,
      );
      if (callExistente) await callExistente.delete().catch(() => {});
    } catch {}

    setTimeout(async () => {
      await canal.delete().catch(() => {});
    }, 3000);
  } finally {
    try {
      dbsql.close();
    } catch {}
  }
}

module.exports = { fecharTicketPorIA };