const {
  ChannelType,
  PermissionsBitField,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const path = require("path");
const { JsonDatabase } = require("wio.db");
const sqlite3 = require("sqlite3").verbose();
const discordTranscripts = require("discord-html-transcripts");
const Groq = require("groq-sdk");

const iaCooldowns = new Map();
let currentKeyIndex = 0;

const _dbConnectionPool = new Map();

function getDBConnection(guildId) {
  if (_dbConnectionPool.has(guildId)) return _dbConnectionPool.get(guildId);

  const folderPath = path.resolve(
    __dirname,
    "../../../banco/ticket",
    guildId,
    "banco",
  );

  if (!require("fs").existsSync(folderPath)) {
    require("fs").mkdirSync(folderPath, { recursive: true });
  }

  const dbPath = path.join(folderPath, "tickets.db");
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      ticket_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      staff_id TEXT DEFAULT NULL,
      categoria TEXT,
      criado_em INTEGER NOT NULL,
      assumido_em INTEGER DEFAULT NULL,
      fechado_em INTEGER DEFAULT NULL,
      ia_pausada_por_staff INTEGER DEFAULT 0,
      chat_historico TEXT DEFAULT '[]',
      primeira_resposta_em INTEGER DEFAULT NULL,
      respondido_id TEXT DEFAULT NULL,
      fechado_id TEXT DEFAULT NULL,
      message_id TEXT DEFAULT NULL,
      motivo_abertura TEXT DEFAULT NULL,
      nome_categoria TEXT DEFAULT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS contadores (
      guild_id TEXT PRIMARY KEY,
      abertos INTEGER DEFAULT 0,
      assumidos INTEGER DEFAULT 0,
      fechados INTEGER DEFAULT 0
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON tickets(ticket_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_guild_fechado ON tickets(guild_id, fechado_em)`);
    db.run(`PRAGMA journal_mode=WAL`);
    db.run(`ALTER TABLE tickets ADD COLUMN ia_pausada_por_staff INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE tickets ADD COLUMN chat_historico TEXT DEFAULT '[]'`, () => {});
    db.run(`ALTER TABLE tickets ADD COLUMN primeira_resposta_em INTEGER DEFAULT NULL`, () => {});
    db.run(`ALTER TABLE tickets ADD COLUMN respondido_id TEXT DEFAULT NULL`, () => {});
    db.run(`ALTER TABLE tickets ADD COLUMN fechado_id TEXT DEFAULT NULL`, () => {});
    db.run(`ALTER TABLE tickets ADD COLUMN message_id TEXT DEFAULT NULL`, () => {});
    db.run(`ALTER TABLE tickets ADD COLUMN motivo_abertura TEXT DEFAULT NULL`, () => {});
    db.run(`ALTER TABLE tickets ADD COLUMN nome_categoria TEXT DEFAULT NULL`, () => {});
  });

  _dbConnectionPool.set(guildId, db);
  return db;
}

function closeDB(_db) {
  // conexões são mantidas no pool — não fechar
}

function getConfigDB(guildId) {
  return new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../banco/ticket/${guildId}/config.json`,
    ),
  });
}

function getIAConfigDB(guildId) {
  const dbPath = path.resolve(
    __dirname,
    `../../../banco/ticket/${guildId}/iaconfig.json`,
  );

  const dir = path.dirname(dbPath);
  if (!require("fs").existsSync(dir)) {
    require("fs").mkdirSync(dir, { recursive: true });
  }

  const db = new JsonDatabase({ databasePath: dbPath });

  if (!db.has("sistema_ativo")) db.set("sistema_ativo", false);
  if (!db.has("parar_ao_assumir")) db.set("parar_ao_assumir", true);
  if (!db.has("parar_staff_responder")) db.set("parar_staff_responder", true);
  if (!db.has("prompt_base")) {
    db.set(
      "prompt_base",
      "Você é uma assistente de suporte em um servidor do Discord. Responda sempre em português brasileiro de forma educada, prestativa e profissional. Ajude os usuários com suas dúvidas e problemas de forma clara e direta.",
    );
  }
  if (!db.has("prompts_adicionais")) db.set("prompts_adicionais", []);

  return db;
}

function getPersonalizacaoDB(guildId) {
  return new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../banco/ticket/${guildId}/personalizacao.json`,
    ),
  });
}

function hexToDecimal(hex) {
  if (!hex) return null;
  const cleaned = hex.replace("#", "");
  return parseInt(cleaned, 16);
}

async function verificarPermissaoStaff(member, guildId) {
  try {
    const configDB = getConfigDB(guildId);
    const teamRoles = configDB.get("team") || [];
    const userPerms = configDB.get(`usersperms.${member.id}`) || [];

    const hasTeamRole = member.roles.cache.some((role) =>
      teamRoles.includes(role.id),
    );
    const hasPermission =
      userPerms.includes("Configurar bot") ||
      userPerms.includes("Atender ticket");

    return (
      hasTeamRole || hasPermission || member.permissions.has("Administrator")
    );
  } catch (error) {
    return false;
  }
}

async function chamarGroqAPI(
  messages,
  model = "llama-3.3-70b-versatile",
  temperature = 0.7,
  maxTokens = 1024,
) {
  const config = require("../../config");
  const keys = [config["key-ia"], config["key-ia2"]].filter(Boolean);

  for (let tentativa = 0; tentativa < keys.length; tentativa++) {
    try {
      const keyIndex = (currentKeyIndex + tentativa) % keys.length;
      const groq = new Groq({ apiKey: keys[keyIndex] });

      const resposta = await groq.chat.completions.create({
        messages,
        model,
        temperature,
        max_tokens: maxTokens,
      });

      currentKeyIndex = keyIndex;
      return resposta;
    } catch (erro) {
      if (erro.status === 429 && tentativa < keys.length - 1) {
        continue;
      }
      throw erro;
    }
  }
}

async function fecharTicketAutomaticamente(guild, channelId, motivo, client) {
  const canal = guild.channels.cache.get(channelId);
  if (!canal) return;

  const guildId = guild.id;
  const dbsql = getDBConnection(guildId);

  dbsql.run(
    `UPDATE tickets SET fechado_em = ?, fechado_id = ? WHERE ticket_id = ?`,
    [Date.now(), client.user.id, channelId],
    function (err) {
      if (err) {
        console.error("Erro ao fechar ticket automaticamente:", err);
        closeDB(dbsql);
        return;
      }

      dbsql.get(
        `SELECT * FROM contadores WHERE guild_id = ?`,
        [guildId],
        (err, row) => {
          if (err) {
            console.error("Erro ao buscar contadores:", err);
          } else {
            const novosFechados = (row?.fechados || 0) + 1;
            if (row) {
              dbsql.run(
                `UPDATE contadores SET fechados = ? WHERE guild_id = ?`,
                [novosFechados, guildId],
                (err) => {
                  if (err) console.error("Erro ao atualizar contadores:", err);
                },
              );
            } else {
              dbsql.run(
                `INSERT INTO contadores (guild_id, abertos, assumidos, fechados) VALUES (?, 0, 0, 1)`,
                [guildId],
                (err) => {
                  if (err) console.error("Erro ao inserir contador:", err);
                },
              );
            }
          }
          closeDB(dbsql);
        },
      );

      const dbConfig = getConfigDB(guildId);
      const logCfg = dbConfig.get("logs.log_fechamento") || {};
      const logUserCfg = dbConfig.get("logs.log_user") || {};
      const transcriptCfg = dbConfig.get("transcript") || {};
      const topic = canal.topic || "";
      const autorId = topic.split("Labz - ")[1];
      const dbPersonalizacao = getPersonalizacaoDB(guildId);
      const embedLogsData = dbPersonalizacao.get("embedlogs") || {};
      const embedLogsUserData = dbPersonalizacao.get("embedlogsuser") || {};

      const canalTexto = `<#${canal.id}> (${canal.name})`;
      const staffTexto = `${client.user} (\`${client.user.id}\`)`;
      const autorTexto = autorId ? `<@${autorId}>` : "Não identificado";
      const abertoTimestamp = Math.floor(canal.createdTimestamp / 1000);
      const fechadoTimestamp = Math.floor(Date.now() / 1000);
      const abertura = `<t:${abertoTimestamp}:f>`;
      const fechamento = `<t:${fechadoTimestamp}:f>`;
      const msTotal = Date.now() - canal.createdTimestamp;
      const totalMinutos = Math.floor(msTotal / 60000);
      const horas = Math.floor(totalMinutos / 60);
      const minutos = totalMinutos % 60;
      const horatotal = `${horas > 0 ? `${horas} hora${horas > 1 ? "s" : ""}` : ""}${horas && minutos ? ", " : ""}${minutos} minuto${minutos !== 1 ? "s" : ""}`;

      const descricaoProcessada = (
        embedLogsData.descricao || "Registro de fechamento do ticket."
      )
        .replaceAll("{canal}", canalTexto)
        .replaceAll("{staff}", staffTexto)
        .replaceAll("{motivo}", motivo)
        .replaceAll("{user}", autorTexto)
        .replaceAll("{abertura}", abertura)
        .replaceAll("{fechamento}", fechamento)
        .replaceAll("{horatotal}", horatotal);

      const descricaoUserProcessada = (
        embedLogsUserData.descricao || "Seu ticket foi encerrado."
      )
        .replaceAll("{canal}", canalTexto)
        .replaceAll("{staff}", staffTexto)
        .replaceAll("{motivo}", motivo)
        .replaceAll("{user}", autorTexto)
        .replaceAll("{abertura}", abertura)
        .replaceAll("{fechamento}", fechamento)
        .replaceAll("{horatotal}", horatotal);

      const processedFields = Array.isArray(embedLogsData.fields)
        ? embedLogsData.fields.map((field) => ({
            name: field.name,
            value: (field.value || "")
              .replaceAll("{canal}", canalTexto)
              .replaceAll("{staff}", staffTexto)
              .replaceAll("{motivo}", motivo)
              .replaceAll("{user}", autorTexto)
              .replaceAll("{abertura}", abertura)
              .replaceAll("{fechamento}", fechamento)
              .replaceAll("{horatotal}", horatotal),
            inline: field.inline ?? false,
          }))
        : [];

      const processedUserFields = Array.isArray(embedLogsUserData.fields)
        ? embedLogsUserData.fields.map((field) => ({
            name: field.name,
            value: (field.value || "")
              .replaceAll("{canal}", canalTexto)
              .replaceAll("{staff}", staffTexto)
              .replaceAll("{motivo}", motivo)
              .replaceAll("{user}", autorTexto)
              .replaceAll("{abertura}", abertura)
              .replaceAll("{fechamento}", fechamento)
              .replaceAll("{horatotal}", horatotal),
            inline: field.inline ?? false,
          }))
        : [];

      const containerLogComponents = [
        new TextDisplayBuilder().setContent(
          `# ${embedLogsData.title || "📄 Registro de Logs"}`,
        ),
        new TextDisplayBuilder().setContent(descricaoProcessada),
      ];

      if (processedFields.length > 0) {
        processedFields.forEach((field) => {
          containerLogComponents.push(
            new TextDisplayBuilder().setContent(
              `**${field.name}**\n${field.value}`,
            ),
          );
        });
      }

      const ticketId = Math.floor(
        1000000000 + Math.random() * 9000000000,
      ).toString();
      const fileName = `transcript-labz${ticketId}.html`;

      (async () => {
        try {
          const attachment = await discordTranscripts.createTranscript(canal, {
            limit: -1,
            returnBuffer: false,
            filename: fileName,
            footerText: "Labz Application - Transcript",
            saveImages: false,
            poweredBy: false,
          });

          const containerUserComponents = [
            new TextDisplayBuilder().setContent(
              `# ${embedLogsUserData.title || "📄 Registro do Ticket Encerrado"}`,
            ),
            new TextDisplayBuilder().setContent(descricaoUserProcessada),
          ];

          if (processedUserFields.length > 0) {
            processedUserFields.forEach((field) => {
              containerUserComponents.push(
                new TextDisplayBuilder().setContent(
                  `**${field.name}**\n${field.value}`,
                ),
              );
            });
          }

          let containerLog = new ContainerBuilder().addTextDisplayComponents(
            ...containerLogComponents,
          );
          let containerUser = new ContainerBuilder().addTextDisplayComponents(
            ...containerUserComponents,
          );

          if (logCfg.ativo === true && logCfg.canal) {
            const canalLog = guild.channels.cache.get(logCfg.canal);
            if (canalLog) {
              await canalLog
                .send({
                  flags: MessageFlags.IsComponentsV2,
                  components: [containerLog],
                  files: transcriptCfg.staff === true ? [attachment] : [],
                })
                .catch(console.error);
            }
          }

          if (logUserCfg.ativo === true && autorId) {
            try {
              const membro = await guild.members
                .fetch(autorId)
                .catch(() => null);
              if (membro) {
                await membro
                  .send({
                    flags: MessageFlags.IsComponentsV2,
                    components: [containerUser],
                    files: transcriptCfg.user === true ? [attachment] : [],
                  })
                  .catch(() => {});
              }
            } catch (err) {}
          }

          const canaisDaCategoria =
            canal.parent?.children?.cache || guild.channels.cache;
          const callExistente = canaisDaCategoria.find(
            (c) => c.type === ChannelType.GuildVoice && c.name === canal.name,
          );
          if (callExistente) {
            await callExistente.delete().catch(() => {});

            if (client.channels.cache.has(callExistente.id)) {
              client.channels.cache.delete(callExistente.id);
            }
          }

          setTimeout(() => {
            canal.delete().catch(() => {});

            if (client.channels.cache.has(canal.id)) {
              client.channels.cache.delete(canal.id);
            }

            const guild = client.guilds.cache.get(guildId);
            if (guild) {
              if (guild.channels.cache.has(canal.id)) {
                guild.channels.cache.delete(canal.id);
              }

              if (canal.parent?.children?.cache) {
                canal.parent.children.cache.delete(canal.id);
              }
            }

            if (global.gc && client.stats?.commandsExecuted % 5 === 0) {
              global.gc();
            }
          }, 5000);
        } catch (error) {
          console.error("Erro ao processar fechamento automático:", error);
        }
      })();
    },
  );
}

module.exports = (client) => {
  client.on("guildMemberRemove", async (member) => {
    const guild = member.guild;
    const dbConfig = getConfigDB(guild.id);
    const fecharAoSair = dbConfig.get("fechar_ao_sair_servidor") ?? false;

    if (!fecharAoSair) return;

    const ticketsDoUsuario = guild.channels.cache.filter(
      (ch) =>
        ch.type === ChannelType.GuildText &&
        ch.topic?.startsWith("Labz - ") &&
        ch.topic.endsWith(member.id),
    );

    if (ticketsDoUsuario.size === 0) return;

    for (const [channelId] of ticketsDoUsuario) {
      await fecharTicketAutomaticamente(
        guild,
        channelId,
        "Usuário saiu do servidor",
        client,
      );
    }
  });

  const processandoChannelUpdate = new Set();

  client.on("channelUpdate", async (oldChannel, newChannel) => {
    if (newChannel.type !== ChannelType.GuildText) return;
    if (!newChannel.topic || !newChannel.topic.startsWith("Labz - ")) return;

    const chaveUnica = `${newChannel.guild.id}-${newChannel.id}`;
    if (processandoChannelUpdate.has(chaveUnica)) return;

    const guild = newChannel.guild;
    const dbConfig = getConfigDB(guild.id);
    const fecharAoSairTicket = dbConfig.get("fechar_ao_sair_ticket") ?? false;

    if (!fecharAoSairTicket) return;

    const autorId = newChannel.topic.split("Labz - ")[1];
    if (!autorId) return;

    const permissaoAutor = newChannel.permissionOverwrites.cache.get(autorId);

    if (!permissaoAutor) {
      processandoChannelUpdate.add(chaveUnica);
      await fecharTicketAutomaticamente(
        guild,
        newChannel.id,
        "Usuário saiu do ticket",
        client,
      );
      setTimeout(() => processandoChannelUpdate.delete(chaveUnica), 10000);
      return;
    }

    const podeVer = permissaoAutor.allow?.has(
      PermissionsBitField.Flags.ViewChannel,
    );

    if (!podeVer) {
      processandoChannelUpdate.add(chaveUnica);
      await fecharTicketAutomaticamente(
        guild,
        newChannel.id,
        "Usuário saiu do ticket",
        client,
      );
      setTimeout(() => processandoChannelUpdate.delete(chaveUnica), 10000);
    }
  });
};
