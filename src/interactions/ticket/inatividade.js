const {
  Events,
  ChannelType,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const { JsonDatabase } = require("wio.db");

const { t } = require("../../utils/i18n");
const PROJECT_ROOT = path.resolve(__dirname, "../../../");
const dbConnections = new Map();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
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
  db.all("PRAGMA table_info(tickets)", (err, cols) => {
    if (err || !cols) return;
    const names = cols.map((c) => c.name);
    if (!names.includes("ultima_mensagem_em"))
      db.run(
        "ALTER TABLE tickets ADD COLUMN ultima_mensagem_em INTEGER DEFAULT NULL",
      );
    if (!names.includes("aviso_inatividade"))
      db.run(
        "ALTER TABLE tickets ADD COLUMN aviso_inatividade INTEGER DEFAULT 0",
      );
  });
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

const ultimaMensagem = new Map();

module.exports = {
  name: Events.MessageCreate,

  async execute(client, message) {
    if (!message.guild || !message.author || message.author.bot) return;
    const channel = message.channel;
    if (channel.type !== ChannelType.GuildText) return;
    if (!channel.topic || !channel.topic.startsWith("Labz - ")) return;

    ultimaMensagem.set(channel.id, Date.now());

    try {
      const db = getDBConnection(message.guild.id);
      await db.runAsync(
        "UPDATE tickets SET ultima_mensagem_em = ?, aviso_inatividade = 0 WHERE ticket_id = ?",
        [Date.now(), channel.id],
      );
    } catch {}
  },
};

module.exports.iniciarCronInatividade = function (client) {
  const cron = require("node-cron");

  cron.schedule("0 * * * *", async () => {
    try {
      await verificarInatividade(client);
    } catch (err) {
      console.error("[INATIVIDADE] Erro no cron:", err);
    }
  });
};

async function verificarInatividade(client) {
  const guilds = client.guilds.cache;

  for (const [guildId, guild] of guilds) {
    try {
      const configDB = getConfigDB(guildId);
      const inatividade_ativo = configDB.get("inatividade_ativo") ?? false;
      if (!inatividade_ativo) continue;

      const horas_aviso = configDB.get("inatividade_horas_aviso") ?? 24;
      const horas_fechar = configDB.get("inatividade_horas_fechar") ?? 48;

      const db = getDBConnection(guildId);
      const agora = Date.now();
      const msAviso = horas_aviso * 3600000;
      const msFechar = horas_fechar * 3600000;

      const tickets = await db
        .allAsync(
          `SELECT ticket_id, user_id, ultima_mensagem_em, criado_em, aviso_inatividade FROM tickets WHERE guild_id = ? AND fechado_em IS NULL`,
          [guildId],
        )
        .catch(() => []);

      for (const ticket of tickets) {
        const ultimaMens = ticket.ultima_mensagem_em || ticket.criado_em;
        const tempoSemResposta = agora - ultimaMens;

        const canal = guild.channels.cache.get(ticket.ticket_id);
        if (!canal) continue;

        if (tempoSemResposta >= msFechar) {
          try {
            await canal.send({
              components: [
                new ContainerBuilder().addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    t("inatividade_fechado", guildId),
                  ),
                ),
              ],
              flags: MessageFlags.IsComponentsV2,
            });
            await new Promise((r) => setTimeout(r, 3000));
            await canal.delete("Fechado por inatividade").catch(() => {});
            await db.runAsync(
              "UPDATE tickets SET fechado_em = ? WHERE ticket_id = ?",
              [agora, ticket.ticket_id],
            );
          } catch {}
          continue;
        }

        if (tempoSemResposta >= msAviso && !ticket.aviso_inatividade) {
          try {
            const restante = Math.round(
              (msFechar - tempoSemResposta) / 3600000,
            );
            const mensagemInatividade =
              configDB.get("inatividade_mensagem") ||
              t("inatividade_aviso", guildId, {
                horas: "{horas}",
                restante: String(restante),
              });

            const horasSemResp = Math.floor(tempoSemResposta / 3600000);
            const msg = mensagemInatividade
              .replace(/{user}/g, ticket.user_id)
              .replace(/{horas}/g, horasSemResp.toString());

            await canal.send({
              components: [
                new ContainerBuilder()
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(msg),
                  )
                  .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                      new ButtonBuilder()
                        .setCustomId("_noop_inatividade")
                        .setLabel(t("inatividade_btn_aviso", guildId))
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true),
                    ),
                  ),
              ],
              flags: MessageFlags.IsComponentsV2,
            });
            await db.runAsync(
              "UPDATE tickets SET aviso_inatividade = 1 WHERE ticket_id = ?",
              [ticket.ticket_id],
            );
          } catch {}
        }
      }
    } catch (err) {
      console.error(`[INATIVIDADE] Erro na guild ${guildId}:`, err);
    }
  }
}

module.exports.verificarInatividade = verificarInatividade;
