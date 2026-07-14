const {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  ChannelType,
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { JsonDatabase } = require("wio.db");
const discordTranscripts = require("discord-html-transcripts");

const { t } = require("../i18n");
const { getEmojis } = require("../emojis/emojiHelper");

const emojis = getEmojis();

// ─── DB helpers ────────────────────────────────────────────────────────────

const _dbPool = new Map();

function getDBConnection(guildId) {
  if (_dbPool.has(guildId)) return _dbPool.get(guildId);

  const folderPath = path.resolve(
    __dirname,
    "../../../banco/ticket",
    guildId,
    "banco",
  );
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const db = new sqlite3.Database(path.join(folderPath, "tickets.db"));
  db.run("PRAGMA journal_mode=WAL");
  _dbPool.set(guildId, db);
  return db;
}

const _configCache = new Map();
function getConfigDB(guildId) {
  if (_configCache.has(guildId)) return _configCache.get(guildId);
  const db = new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      "../../../banco/ticket",
      guildId,
      "config.json",
    ),
  });
  _configCache.set(guildId, db);
  return db;
}

const _personalizacaoCache = new Map();
function getPersonalizacaoDB(guildId) {
  if (_personalizacaoCache.has(guildId))
    return _personalizacaoCache.get(guildId);
  const db = new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      "../../../banco/ticket",
      guildId,
      "personalizacao.json",
    ),
  });
  _personalizacaoCache.set(guildId, db);
  return db;
}

// ─── Função principal ──────────────────────────────────────────────────────

/**
 * Fecha um ticket pelo fluxo completo: DB → transcript local → log staff → DM usuário → delete canal.
 *
 * O transcript é gerado localmente com `discord-html-transcripts` e anexado diretamente
 * como arquivo do Discord (sem upload para nenhuma API externa e sem botão de link).
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId - ID do canal do ticket
 * @param {string} motivo
 * @param {import('discord.js').Client} client
 * @param {string} [staffId] - ID de quem fechou (padrão: bot)
 */
async function fecharTicket(guild, channelId, motivo, client, staffId) {
  const canal = guild.channels.cache.get(channelId);
  if (!canal) return;

  const guildId = guild.id;
  const closerId = staffId || client.user.id;
  const dbsql = getDBConnection(guildId);

  // Atualiza banco
  await new Promise((resolve) => {
    dbsql.run(
      `UPDATE tickets SET fechado_em = ?, fechado_id = ? WHERE ticket_id = ?`,
      [Date.now(), closerId, channelId],
      () => {
        dbsql.get(
          `SELECT * FROM contadores WHERE guild_id = ?`,
          [guildId],
          (err, row) => {
            if (row) {
              dbsql.run(
                `UPDATE contadores SET fechados = ? WHERE guild_id = ?`,
                [(row.fechados || 0) + 1, guildId],
              );
            } else {
              dbsql.run(
                `INSERT INTO contadores (guild_id, abertos, assumidos, fechados) VALUES (?, 0, 0, 1)`,
                [guildId],
              );
            }
            resolve();
          },
        );
      },
    );
  });

  const dbConfig = getConfigDB(guildId);
  const logCfg = dbConfig.get("logs.log_fechamento") || {};
  const logUserCfg = dbConfig.get("logs.log_user") || {};
  const transcriptCfg = dbConfig.get("transcript") || {};
  const dbPersonalizacao = getPersonalizacaoDB(guildId);
  const embedLogsData = dbPersonalizacao.get("embedlogs") || {};
  const embedLogsUserData = dbPersonalizacao.get("embedlogsuser") || {};

  const topic = canal.topic || "";
  const autorId = topic.split("Labz - ")[1];

  const canalTexto = `<#${canal.id}> (${canal.name})`;
  const staffTexto = `<@${closerId}> (\`${closerId}\`)`;
  const autorTexto = autorId
    ? `<@${autorId}>`
    : t("ticket_nao_identificado", guildId);
  const abertoTimestamp = Math.floor(canal.createdTimestamp / 1000);
  const fechadoTimestamp = Math.floor(Date.now() / 1000);
  const abertura = `<t:${abertoTimestamp}:f>`;
  const fechamento = `<t:${fechadoTimestamp}:f>`;
  const msTotal = Date.now() - canal.createdTimestamp;
  const totalMinutos = Math.floor(msTotal / 60000);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  const horatotal =
    `${horas > 0 ? `${horas} hora${horas > 1 ? "s" : ""}` : ""}` +
    `${horas && minutos ? ", " : ""}` +
    `${minutos} minuto${minutos !== 1 ? "s" : ""}`;

  function substituir(str) {
    return (str || "")
      .replaceAll("{canal}", canalTexto)
      .replaceAll("{staff}", staffTexto)
      .replaceAll("{motivo}", motivo)
      .replaceAll("{user}", autorTexto)
      .replaceAll("{abertura}", abertura)
      .replaceAll("{fechamento}", fechamento)
      .replaceAll("{horatotal}", horatotal);
  }

  const descricaoLog = substituir(
    embedLogsData.descricao || "Registro de fechamento do ticket.",
  );
  const descricaoUser = substituir(
    embedLogsUserData.descricao || "Seu ticket foi encerrado.",
  );

  const fieldsLog = Array.isArray(embedLogsData.fields)
    ? embedLogsData.fields.map((f) => ({
        name: f.name,
        value: substituir(f.value || ""),
        inline: f.inline ?? false,
      }))
    : [];
  const fieldsUser = Array.isArray(embedLogsUserData.fields)
    ? embedLogsUserData.fields.map((f) => ({
        name: f.name,
        value: substituir(f.value || ""),
        inline: f.inline ?? false,
      }))
    : [];

  // Gera transcript localmente (discord-html-transcripts) e anexa direto como arquivo do Discord.
  // Nada é enviado a nenhuma API externa — apenas um attachment local na própria mensagem.
  const ticketId = Math.floor(
    1000000000 + Math.random() * 9000000000,
  ).toString();
  const fileName = `transcript-labz${ticketId}.html`;

  let transcriptAttachment = null;
  try {
    transcriptAttachment = await discordTranscripts.createTranscript(canal, {
      limit: 1000,
      returnBuffer: false,
      filename: fileName,
      footerText: "Labz Application - Transcript",
      saveImages: false,
      poweredBy: false,
    });
  } catch (err) {
    console.error(
      `[fecharTicket] Erro ao gerar transcript de ${canal.name}:`,
      err.message,
    );
  }

  // Monta container de log para staff
  const logComponents = [
    new TextDisplayBuilder().setContent(
      `# ${embedLogsData.title || `${emojis.file} Registro de Logs`}`,
    ),
    new TextDisplayBuilder().setContent(descricaoLog),
    ...fieldsLog.map((f) =>
      new TextDisplayBuilder().setContent(`**${f.name}**\n${f.value}`),
    ),
  ];

  const containerLog = new ContainerBuilder().addTextDisplayComponents(
    ...logComponents,
  );

  // Monta container de log para usuário
  const userComponents = [
    new TextDisplayBuilder().setContent(
      `# ${embedLogsUserData.title || `${emojis.file} Registro do Ticket Encerrado`}`,
    ),
    new TextDisplayBuilder().setContent(descricaoUser),
    ...fieldsUser.map((f) =>
      new TextDisplayBuilder().setContent(`**${f.name}**\n${f.value}`),
    ),
  ];

  const containerUser = new ContainerBuilder().addTextDisplayComponents(
    ...userComponents,
  );

  // Envia log para canal de staff (com transcript anexado localmente, se ativado)
  if (logCfg.ativo === true && logCfg.canal) {
    const canalLog = guild.channels.cache.get(logCfg.canal);
    if (canalLog) {
      await canalLog
        .send({
          flags: MessageFlags.IsComponentsV2,
          components: [containerLog],
          files:
            transcriptCfg.staff === true && transcriptAttachment
              ? [transcriptAttachment]
              : [],
          allowedMentions: { users: [], roles: [] },
        })
        .catch(() => {});
    }
  }

  // DM para o dono do ticket (com transcript anexado localmente, se ativado)
  if (logUserCfg.ativo === true && autorId) {
    const membro = await guild.members.fetch(autorId).catch(() => null);
    if (membro) {
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
  }

  // Deleta canal de voz vinculado
  const canaisDaCategoria =
    canal.parent?.children?.cache || guild.channels.cache;
  const callExistente = canaisDaCategoria.find(
    (c) => c.type === ChannelType.GuildVoice && c.name === canal.name,
  );
  if (callExistente) {
    await callExistente.delete().catch(() => {});
    client.channels.cache.delete(callExistente.id);
  }

  // Deleta canal de texto
  setTimeout(() => {
    canal.delete().catch(() => {});
    client.channels.cache.delete(canal.id);
    const g = client.guilds.cache.get(guildId);
    if (g) {
      g.channels.cache.delete(canal.id);
      canal.parent?.children?.cache?.delete(canal.id);
    }
  }, 5000);
}

module.exports = { fecharTicket };
