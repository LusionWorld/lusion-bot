const { Events, ChannelType } = require("discord.js");
const { JsonDatabase } = require("wio.db");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const Groq = require("groq-sdk");
const { promisify } = require("util");
const { t } = require("../../utils/i18n");

function safeJsonParse(value, fallback = []) {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const iaCooldowns = new Map();
const staffLastMessage = new Map();
let currentKeyIndex = 0;
const dbConnections = new Map();
const ticketWelcomeSent = new Set();

const PROJECT_ROOT = path.resolve(__dirname, "../../../");

function getDBConnection(guildId) {
  if (dbConnections.has(guildId)) {
    return dbConnections.get(guildId);
  }
  const folderPath = path.join(PROJECT_ROOT, "banco/ticket", guildId, "banco");
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  const dbPath = path.join(folderPath, "tickets.db");
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erro ao conectar ao banco:", err);
  });
  db.configure("busyTimeout", 10000);
  db.runAsync = promisify(db.run.bind(db));
  db.getAsync = promisify(db.get.bind(db));
  db.allAsync = promisify(db.all.bind(db));
  db.run("PRAGMA journal_mode = WAL;");
  dbConnections.set(guildId, db);
  initializeColumns(db).catch(console.error);
  return db;
}

async function initializeColumns(db) {
  try {
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS tickets (
        ticket_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        assumido_em INTEGER DEFAULT NULL,
        ia_pausada_por_staff INTEGER DEFAULT 0,
        chat_historico TEXT DEFAULT '[]',
        primeira_resposta_em INTEGER DEFAULT NULL,
        respondido_id TEXT DEFAULT NULL
      );
    `);
    const columns = await db.allAsync(`PRAGMA table_info(tickets);`);
    if (!columns.some((col) => col.name === "ia_pausada_por_staff"))
      await db.runAsync(
        `ALTER TABLE tickets ADD COLUMN ia_pausada_por_staff INTEGER DEFAULT 0;`,
      );
    if (!columns.some((col) => col.name === "chat_historico"))
      await db.runAsync(
        `ALTER TABLE tickets ADD COLUMN chat_historico TEXT DEFAULT '[]';`,
      );
    if (!columns.some((col) => col.name === "primeira_resposta_em"))
      await db.runAsync(
        `ALTER TABLE tickets ADD COLUMN primeira_resposta_em INTEGER DEFAULT NULL;`,
      );
    if (!columns.some((col) => col.name === "respondido_id"))
      await db.runAsync(
        `ALTER TABLE tickets ADD COLUMN respondido_id TEXT DEFAULT NULL;`,
      );
  } catch (error) {
    console.error("Erro ao inicializar colunas:", error);
  }
}

function getConfigDB(guildId) {
  return new JsonDatabase({
    databasePath: path.join(
      PROJECT_ROOT,
      "banco/ticket",
      guildId,
      "config.json",
    ),
  });
}

function getIAConfigDB(guildId) {
  const dbPath = path.join(
    PROJECT_ROOT,
    "banco/ticket",
    guildId,
    "iaconfig.json",
  );
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new JsonDatabase({ databasePath: dbPath });
  if (!db.has("sistema_ativo")) db.set("sistema_ativo", false);
  if (!db.has("parar_ao_assumir")) db.set("parar_ao_assumir", true);
  if (!db.has("parar_staff_responder")) db.set("parar_staff_responder", true);
  if (!db.has("prompt_base"))
    db.set(
      "prompt_base",
      "Você é uma assistente de suporte em um servidor do Discord. Responda sempre em português brasileiro de forma educada, prestativa e profissional. Ajude os usuários com suas dúvidas e problemas de forma clara e direta.",
    );
  if (!db.has("prompts_adicionais"))
    db.set("prompts_adicionais", JSON.stringify([]));
  if (!db.has("horario_ativo")) db.set("horario_ativo", false);
  if (!db.has("mensagem_fora_horario"))
    db.set(
      "mensagem_fora_horario",
      "Nosso atendimento não está disponível neste momento.",
    );
  if (!db.has("retomar_apos_inatividade"))
    db.set("retomar_apos_inatividade", false);
  if (!db.has("minutos_inatividade_staff"))
    db.set("minutos_inatividade_staff", 15);
  if (!db.has("encerramento_automatico"))
    db.set("encerramento_automatico", false);
  if (!db.has("palavras_encerramento"))
    db.set(
      "palavras_encerramento",
      JSON.stringify([
        "resolvido",
        "obrigado",
        "pode fechar",
        "pode encerrar",
        "era isso",
      ]),
    );
  if (!db.has("mensagem_boas_vindas_ativo"))
    db.set("mensagem_boas_vindas_ativo", false);
  if (!db.has("mensagem_boas_vindas")) db.set("mensagem_boas_vindas", " ");
  if (!db.has("prompts_cargos")) db.set("prompts_cargos", JSON.stringify([]));
  return db;
}

function isWithinSchedule(schedule, horarioAtivo) {
  if (!horarioAtivo) return true;
  if (!schedule) return true;
  const timeZone = "America/Sao_Paulo";
  const now = new Date().toLocaleString("en-US", { timeZone });
  const nowDate = new Date(now);
  const weekDayMap = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };
  const dayName = weekDayMap[nowDate.getDay()];
  const daySchedule = schedule[dayName];
  if (!daySchedule || !daySchedule.start || !daySchedule.end) return false;
  const { parse } = require("date-fns");
  let endString = daySchedule.end === "00:00" ? "23:59" : daySchedule.end;
  const startTime = parse(daySchedule.start, "HH:mm", nowDate);
  const endTime = parse(endString, "HH:mm", nowDate);
  if (endTime <= startTime) endTime.setDate(endTime.getDate() + 1);
  return nowDate >= startTime && nowDate <= endTime;
}

async function chamarGroqAPI(
  messages,
  model = "llama-3.3-70b-versatile",
  temperature = 0.7,
  maxTokens = 1024,
) {
  const config = require("../../../config.json");
  const keys = [
    config["key-ia"],
    config["key-ia2"],
    config["key-ia3"],
    config["key-ia4"],
    config["key-ia5"],
  ].filter(Boolean);
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
        currentKeyIndex = (currentKeyIndex + tentativa + 1) % keys.length;
        continue;
      }
      throw erro;
    }
  }
}

async function isStaffMember(member, guildId) {
  const dbConfig = getConfigDB(guildId);
  const teamRoles = dbConfig.get("team") || [];
  const usersPerms = dbConfig.get("usersperms") || {};
  const hasTeamRole = member.roles.cache.some((role) =>
    teamRoles.includes(role.id.toString()),
  );
  const hasUserPerm = usersPerms[member.id]?.includes("Atender ticket");
  return hasTeamRole || hasUserPerm;
}

async function processarCargosIA(client, message, member, iaDB, guildId) {
  try {
    const promptsCargos = safeJsonParse(iaDB.get("prompts_cargos"), []);
    if (!promptsCargos || promptsCargos.length === 0) return;
    const promptsAtivos = promptsCargos.filter((p) => p.ativo !== false);
    if (promptsAtivos.length === 0) return;

    for (const promptCargo of promptsAtivos) {
      if (!promptCargo.cargo_id || !promptCargo.prompt) continue;
      const role = message.guild.roles.cache.get(promptCargo.cargo_id);
      if (!role) continue;
      const membroTemCargo = member.roles.cache.has(promptCargo.cargo_id);

      const systemPrompt = `Você é um sistema de análise de mensagens para Discord. Analise a mensagem e determine se ela corresponde à situação descrita. Responda APENAS com "SIM" ou "NAO".

Situação a verificar: ${promptCargo.prompt}`;

      const resposta = await chamarGroqAPI(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: message.content },
        ],
        "llama-3.3-70b-versatile",
        0.1,
        10,
      );

      const resultado = resposta.choices[0]?.message?.content
        ?.trim()
        .toUpperCase();
      if (resultado !== "SIM") continue;

      const {
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
      } = require("discord.js");

      if (promptCargo.acao === "adicionar" && !membroTemCargo) {
        await member.roles.add(role).catch(() => {});
        try {
          iaDB.set(
            "stats_cargos_atribuidos",
            (iaDB.get("stats_cargos_atribuidos") || 0) + 1,
          );
        } catch {}
        if (promptCargo.mensagem_confirmacao) {
          const txt = promptCargo.mensagem_confirmacao
            .replace(/{cargo}/g, `<@&${promptCargo.cargo_id}>`)
            .replace(/{user}/g, `<@${member.id}>`);
          const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(txt),
          );
          await message.channel
            .send({
              flags: MessageFlags.IsComponentsV2,
              components: [container],
            })
            .catch(() => {});
        }
      } else if (promptCargo.acao === "remover" && membroTemCargo) {
        await member.roles.remove(role).catch(() => {});
        if (promptCargo.mensagem_confirmacao) {
          const txt = promptCargo.mensagem_confirmacao
            .replace(/{cargo}/g, `<@&${promptCargo.cargo_id}>`)
            .replace(/{user}/g, `<@${member.id}>`);
          const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(txt),
          );
          await message.channel
            .send({
              flags: MessageFlags.IsComponentsV2,
              components: [container],
            })
            .catch(() => {});
        }
      } else if (promptCargo.acao === "verificar") {
        const msgTxt = membroTemCargo
          ? promptCargo.mensagem_tem_cargo
          : promptCargo.mensagem_sem_cargo;
        if (msgTxt) {
          const txt = msgTxt
            .replace(/{cargo}/g, `<@&${promptCargo.cargo_id}>`)
            .replace(/{user}/g, `<@${member.id}>`);
          const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(txt),
          );
          await message.channel
            .send({
              flags: MessageFlags.IsComponentsV2,
              components: [container],
            })
            .catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("[IA-CARGOS] Erro:", err);
  }
}

async function enviarBoasVindasIA(channel, member, iaDB) {
  try {
    const boasVindasAtivo = iaDB.get("mensagem_boas_vindas_ativo");
    if (!boasVindasAtivo) return;

    const {
      ContainerBuilder,
      TextDisplayBuilder,
      MessageFlags,
    } = require("discord.js");
    const boasVindasTexto = (iaDB.get("mensagem_boas_vindas") || "").trim();

    let mensagem = "";

    if (boasVindasTexto) {
      mensagem = boasVindasTexto
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{nome}/g, member.displayName);
    } else {
      try {
        const promptBase =
          iaDB.get("prompt_base") || "Você é uma assistente de suporte.";
        const resposta = await chamarGroqAPI(
          [
            { role: "system", content: promptBase },
            {
              role: "user",
              content: `[SISTEMA] O usuário ${member.displayName} acabou de abrir um ticket. Gere uma mensagem de boas-vindas curta, educada e profissional em português. Mencione que você está disponível para ajudar. Máximo 2 frases.`,
            },
          ],
          "llama-3.3-70b-versatile",
          0.7,
          150,
        );
        mensagem = resposta.choices[0]?.message?.content?.trim() || "";
      } catch (e) {
        console.error("[IA-BOAS-VINDAS] Erro ao gerar com IA:", e);
        return;
      }
    }

    if (!mensagem) return;

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`<@${member.id}>
${mensagem}`),
    );
    await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    });
    try {
      iaDB.set(
        "stats_boas_vindas_enviadas",
        (iaDB.get("stats_boas_vindas_enviadas") || 0) + 1,
      );
    } catch {}
  } catch (err) {
    console.error("[IA-BOAS-VINDAS] Erro:", err);
  }
}

module.exports = {
  name: Events.MessageCreate,

  async execute(client, message) {
    if (!message.guild || !message.author || message.author.bot) return;

    const guildId = message.guild.id;
    const channelId = message.channel.id;
    const channel = message.channel;

    if (channel.type !== ChannelType.GuildText) return;
    if (!channel.topic || !channel.topic.startsWith("Labz - ")) return;

    const autorTicket = channel.topic.split("Labz - ")[1];
    if (!autorTicket) return;

    try {
      const dbsql = getDBConnection(guildId);
      const iaDB = getIAConfigDB(guildId);
      const pararStaffResponder = iaDB.get("parar_staff_responder");

      const member = await message.guild.members
        .fetch(message.author.id)
        .catch(() => null);
      const ehStaff = member ? await isStaffMember(member, guildId) : false;
      const ehDonoTicket = message.author.id === autorTicket;

      if (ehStaff && !ehDonoTicket) {
        const row = await dbsql.getAsync(
          `SELECT primeira_resposta_em FROM tickets WHERE ticket_id = ?`,
          [channelId],
        );
        if (row && !row.primeira_resposta_em) {
          await dbsql.runAsync(
            `UPDATE tickets SET primeira_resposta_em = ?, respondido_id = ? WHERE ticket_id = ?`,
            [Date.now(), message.author.id, channelId],
          );
        }
        if (pararStaffResponder) {
          await dbsql.runAsync(
            `UPDATE tickets SET ia_pausada_por_staff = 1 WHERE ticket_id = ?`,
            [channelId],
          );
        } else {
          await dbsql.runAsync(
            `UPDATE tickets SET ia_pausada_por_staff = 0 WHERE ticket_id = ?`,
            [channelId],
          );
        }
        const staffKey = `${guildId}-${channelId}`;
        staffLastMessage.set(staffKey, Date.now());
        return;
      }

      if (!ehDonoTicket) return;

      {
        const encerramentoAutomatico = iaDB.get("encerramento_automatico");
        const palavrasKw = safeJsonParse(iaDB.get("palavras_encerramento"), []);
        const msgLowerKw = message.content.toLowerCase();
        if (
          encerramentoAutomatico === true &&
          palavrasKw.length > 0 &&
          palavrasKw.some((p) => msgLowerKw.includes(p.toLowerCase()))
        ) {
          const {
            ContainerBuilder,
            TextDisplayBuilder,
            MessageFlags,
          } = require("discord.js");
          const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("ia_encerrar_aviso", guildId),
            ),
          );
          await message.channel
            .send({
              flags: MessageFlags.IsComponentsV2,
              components: [container],
            })
            .catch(() => {});
          setTimeout(async () => {
            try {
              const { fecharTicketPorIA } = require("./ia-ticket-closer");
              await fecharTicketPorIA(client, guildId, channelId);
              try {
                iaDB.set(
                  "stats_tickets_encerrados_ia",
                  (iaDB.get("stats_tickets_encerrados_ia") || 0) + 1,
                );
              } catch {}
            } catch (errFech) {
              console.error(`[PALAVRA-CHAVE] Erro:`, errFech);
              message.channel.delete().catch(() => {});
            }
          }, 30000);
          return;
        }
      }

      const cooldownKey = `${guildId}-${channelId}`;
      const agora = Date.now();
      const cooldownTime = 5000;

      if (iaCooldowns.has(cooldownKey)) {
        const ultimoUso = iaCooldowns.get(cooldownKey);
        if (agora - ultimoUso < cooldownTime) return;
      }

      const ticketData = await dbsql.getAsync(
        `SELECT * FROM tickets WHERE ticket_id = ? AND guild_id = ?`,
        [channelId, guildId],
      );
      if (!ticketData) return;

      const sistemaIAAtivo = iaDB.get("sistema_ativo");
      if (!sistemaIAAtivo) return;

      const boasVindasKey = `bv_${guildId}_${channelId}`;
      const historicoExistente = (() => {
        try {
          return JSON.parse(ticketData.chat_historico || "[]");
        } catch {
          return [];
        }
      })();
      if (
        !ticketWelcomeSent.has(boasVindasKey) &&
        historicoExistente.length === 0
      ) {
        ticketWelcomeSent.add(boasVindasKey);
        if (member) await enviarBoasVindasIA(channel, member, iaDB);
      } else {
        ticketWelcomeSent.add(boasVindasKey);
      }

      const iaHorarioAtivo = iaDB.get("horario_ativo");
      const iaSchedule = iaDB.get("schedule") || {};
      if (iaHorarioAtivo && !isWithinSchedule(iaSchedule, true)) {
        const msgFora = iaDB.get("mensagem_fora_horario");
        if (msgFora && msgFora.trim()) {
          const foraKey = `fora_${guildId}-${channelId}`;
          if (
            !iaCooldowns.has(foraKey) ||
            agora - iaCooldowns.get(foraKey) > 3600000
          ) {
            iaCooldowns.set(foraKey, agora);
            await message
              .reply({
                content: msgFora,
                allowedMentions: { repliedUser: false },
              })
              .catch(() => {});
          }
        }
        return;
      }

      const retomar = iaDB.get("retomar_apos_inatividade");
      if (retomar) {
        const minutosInatividade = iaDB.get("minutos_inatividade_staff") || 15;
        const staffKey = `${guildId}-${channelId}`;
        const ultimoStaff =
          staffLastMessage.get(staffKey) ||
          ticketData.primeira_resposta_em ||
          0;
        const msInatividade = minutosInatividade * 60 * 1000;
        if (ultimoStaff > 0 && Date.now() - ultimoStaff >= msInatividade) {
          await dbsql.runAsync(
            `UPDATE tickets SET ia_pausada_por_staff = 0, assumido_em = NULL WHERE ticket_id = ?`,
            [channelId],
          );
          ticketData.ia_pausada_por_staff = 0;
          ticketData.assumido_em = null;
        }
      }

      const mensagemUsuario = message.content;
      const pararAoAssumir = iaDB.get("parar_ao_assumir");
      if (pararAoAssumir && ticketData.assumido_em !== null) return;
      if (ticketData.ia_pausada_por_staff === 1) return;

      const memberCargo = member;
      if (memberCargo)
        await processarCargosIA(client, message, memberCargo, iaDB, guildId);

      let historicoChat = [];
      try {
        historicoChat = JSON.parse(ticketData.chat_historico || "[]");
      } catch (e) {
        historicoChat = [];
      }

      const ultimaMensagem =
        historicoChat.length > 0
          ? historicoChat[historicoChat.length - 1].content
          : "";
      if (ultimaMensagem === mensagemUsuario) return;

      historicoChat.push({ role: "user", content: mensagemUsuario });
      iaCooldowns.set(cooldownKey, agora);

      await message.channel.sendTyping();

      try {
        const promptBase = iaDB.get("prompt_base");
        const promptsAdicionais = safeJsonParse(
          iaDB.get("prompts_adicionais"),
          [],
        );

        let contextoCargos = "";
        if (memberCargo) {
          const promptsCargos = safeJsonParse(iaDB.get("prompts_cargos"), []);
          if (promptsCargos.length > 0) {
            const cargosMembro = memberCargo.roles.cache
              .filter((r) => !r.managed && r.id !== message.guild.id)
              .map((r) => r.name);
            if (cargosMembro.length > 0) {
              contextoCargos = `\n\nCargos do usuário: ${cargosMembro.join(", ")}`;
            }
            const regrasVisiveis = promptsCargos
              .filter((p) => p.ativo !== false && p.contexto_ia)
              .map((p) => p.contexto_ia);
            if (regrasVisiveis.length > 0) {
              contextoCargos += `\n\nRegras de cargos:\n${regrasVisiveis.join("\n")}`;
            }
          }
        }

        let promptCompleto = promptBase + contextoCargos;
        if (promptsAdicionais.length > 0) {
          promptCompleto += "\n\nInformações adicionais:\n";
          promptsAdicionais.forEach((p, i) => {
            promptCompleto += `${i + 1}. ${p}\n`;
          });
        }

        const historicoLimitado = historicoChat.slice(-10);
        const messagesParaAPI = [
          { role: "system", content: promptCompleto },
          ...historicoLimitado,
        ];

        const respostaIA = await chamarGroqAPI(messagesParaAPI);
        const mensagemIA =
          respostaIA.choices[0]?.message?.content ||
          "Desculpe, não consegui gerar uma resposta agora.";
        const usarContainer = iaDB.get("resposta_container") ?? false;

        if (usarContainer) {
          const {
            ContainerBuilder,
            TextDisplayBuilder,
            MessageFlags,
          } = require("discord.js");
          const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${mensagemIA}`),
          );
          await message.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        } else {
          await message.reply({
            content: mensagemIA,
            allowedMentions: { repliedUser: false },
          });
        }

        historicoChat.push({ role: "assistant", content: mensagemIA });
        await dbsql.runAsync(
          `UPDATE tickets SET chat_historico = ? WHERE ticket_id = ?`,
          [JSON.stringify(historicoChat), channelId],
        );
        try {
          iaDB.set(
            "stats_msgs_respondidas",
            (iaDB.get("stats_msgs_respondidas") || 0) + 1,
          );
        } catch {}

        try {
          const transferenciaAtiva =
            iaDB.get("transferencia_inteligente") ?? false;
          if (transferenciaAtiva) {
            const ultimasMsg = historicoChat.slice(-6);
            const checkResp = await chamarGroqAPI(
              [
                {
                  role: "system",
                  content:
                    "Você analisa conversas de suporte. Responda APENAS com a palavra SIM ou NAO, sem qualquer outro texto.",
                },
                {
                  role: "user",
                  content:
                    "O usuário pede atendente humano ou o problema exige staff (reembolso, frustração alta, pedido explícito)?\n\nConversa:\n" +
                    ultimasMsg
                      .map(
                        (m) =>
                          (m.role === "user" ? "Usuário" : "IA") +
                          ": " +
                          m.content,
                      )
                      .join("\n") +
                    "\n\nResponda apenas SIM ou NAO.",
                },
              ],
              "llama-3.3-70b-versatile",
              0.1,
              5,
            );
            const checkTxt =
              checkResp.choices[0]?.message?.content?.trim().toUpperCase() ||
              "NAO";
            if (checkTxt === "SIM") {
              const transferKey = `transfer_${guildId}_${channelId}`;
              const jaNotificou =
                global._iaTransferenciaNotificada?.has(transferKey);
              if (!jaNotificou) {
                if (!global._iaTransferenciaNotificada)
                  global._iaTransferenciaNotificada = new Set();
                global._iaTransferenciaNotificada.add(transferKey);
                const {
                  ContainerBuilder,
                  TextDisplayBuilder,
                  MessageFlags,
                } = require("discord.js");
                const emojis =
                  require("../../utils/emojis/emojiHelper").getEmojis();
                const safeEmojiStr = (raw) => {
                  if (!raw) return "";
                  const m = raw.match(/^<(a?:[^:]+:\d+)>$/);
                  return m ? `<${m[1]}>` : raw || "";
                };
                const staffCfg = iaDB.get("transferencia_cargo_staff") || null;
                let pingStaff = "";
                if (staffCfg) pingStaff = ` <@&${staffCfg}>`;
                const notifContainer =
                  new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                      t("ia_transferencia_msg", guildId, { ping: pingStaff }),
                    ),
                  );
                await message.channel
                  .send({
                    components: [notifContainer],
                    flags: MessageFlags.IsComponentsV2,
                  })
                  .catch(() => {});
              }
            }
          }
        } catch (_terr) {
          console.error("[IA-TRANSFER] Erro:", _terr.message);
        }
      } catch (erro) {
        console.error("Erro ao processar IA:", erro);
        let mensagemErro = t("ia_erro_resposta", guildId);
        if (erro.status === 429) {
          const retryAfter = erro.headers?.["retry-after"];
          const minutos = retryAfter ? Math.ceil(retryAfter / 60) : 30;
          mensagemErro = t("ia_erro_limite_uso", guildId, { minutos });
        }
        await message.reply({ content: mensagemErro }).catch(() => {});
      }
    } catch (error) {
      console.error("Erro no sistema de IA:", error);
      return;
    }
  },
};

module.exports.getIAConfigDB = getIAConfigDB;
module.exports.ticketWelcomeSent = ticketWelcomeSent;