const {
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextDisplayBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
  ContainerBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  TextDisplayComponent,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const { JsonDatabase } = require("wio.db");
const discordTranscripts = require("discord-html-transcripts");
const fetch = require("node-fetch");
const FormData = require("form-data");
const { PassThrough } = require("stream");
const cron = require("node-cron");
const { parse, isAfter, isBefore } = require("date-fns");
const sqlite3 = require("sqlite3").verbose();

const { get } = require("http");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();
const { criarModalFormulario } = require("./formulario-estacao");
const { isBlacklisted } = require("./blacklist");

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}
function getOnOffEmojiId(status) {
  return status ? getEmoji(emojis.on) : getEmoji(emojis.off);
}

function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

function safeParseEstacoes(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

function getEstacao(guildId, estacaoId) {
  const db = getEstacoesDB(guildId);
  const estacoes = safeParseEstacoes(db.get("estacoes"));
  return estacoes.find((e) => e.id === estacaoId);
}

function getEstacoesDB(guildId) {
  const db = new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../banco/ticket/${guildId}/estacoes.json`,
    ),
  });

  if (!db.has("estacoes")) {
    db.set("estacoes", []);
  }

  return db;
}

async function enviarTranscriptParaAPI(buffer, filename, client) {
  const form = new FormData();
  const stream = new PassThrough();
  stream.end(buffer);

  form.append("file", stream, {
    filename,
    contentType: "text/html",
  });

  const botId = client?.user?.id;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(
      "https://labzapi.squareweb.app/transcript/upload",
      {
        method: "POST",
        body: form,
        headers: {
          ...form.getHeaders(),
          "x-bot-id": botId || "desconhecido",
        },
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timeout));

    const contentType = response.headers.get("content-type");

    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("❌ Resposta não é JSON:", text.substring(0, 200));
      return null;
    }

    const data = await response.json();

    if (response.ok && data.fileName) {
      const match = data.fileName.match(/transcript-(labz\d{10})\.html/);
      const cleanId = match ? match[1] : data.fileName.replace(".html", "");
      const url = `https://labzapi.squareweb.app/transcript/viewer/${cleanId}`;
      return url;
    } else {
      console.error("❌ Erro ao enviar transcript:", data);
      return null;
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("❌ Timeout ao enviar transcript (60s)");
    } else {
      console.error("❌ Erro de conexão com a API:", error.message);
    }
    return null;
  }
}

function getDBConnection(guildId) {
  const folderPath = path.resolve(
    __dirname,
    "../../../banco/ticket",
    guildId,
    "banco",
  );

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
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

    db.run(`CREATE TABLE IF NOT EXISTS avaliacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      estrelas INTEGER NOT NULL,
      comentario TEXT,
      avaliado_em INTEGER NOT NULL
    )`);
  });

  return db;
}

function closeDB(db) {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error("Erro ao fechar banco:", err);
      }
    });
  }
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

  let endString = daySchedule.end === "00:00" ? "23:59" : daySchedule.end;

  const startTime = parse(daySchedule.start, "HH:mm", nowDate);
  const endTime = parse(endString, "HH:mm", nowDate);

  if (endTime <= startTime) {
    endTime.setDate(endTime.getDate() + 1);
  }

  return nowDate >= startTime && nowDate <= endTime;
}

function getPersonalizacaoDB(guildId) {
  const db = new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../banco/ticket/${guildId}/personalizacao.json`,
    ),
  });

  const defaultConfigs = {
    embedavaliacao: {
      title: `${emojis.star} Avalie o Atendimento`,
      descricao: "Quantas estrelas você dá para o atendimento?",
      descricaoRecebida: `${emojis.check} **Obrigado pela sua avaliação!**\n\n{estrelas} **({avaliacao})**{comentario}\n\n${emojis.sparks} Seu feedback é muito importante para nós!`,
      color: "",
    },
    embedlogavaliacao: {
      title: `${emojis.star} Nova Avaliação`,
      descricao:
        "**Usuário:** {user}\n**Ticket ID:** {ticket_id}\n**Avaliação:** {estrelas} **({avaliacao})**\n**Comentário:** {comentario}\n**Data:** {data}",
      color: "",
    },
    embedassumido: {
      title: `${emojis.textc} Seu Ticket foi Assumido`,
      descricao:
        "Olá! O staff {staff} assumiu seu ticket.\n\nVocê será atendido em breve. Obrigado pela paciência!",
      color: "",
    },
  };

  for (const [key, defaultValue] of Object.entries(defaultConfigs)) {
    if (!db.get(key)) {
      db.set(key, defaultValue);
    }
  }

  return db;
}

function getConfigDB(guildId) {
  return new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../banco/ticket/${guildId}/config.json`,
    ),
  });
}

function enviarMensagemMotivoTicket(channel, nomeOpcao, guildId, estacaoId) {
  const estacao = getEstacao(guildId, estacaoId);
  if (!estacao) return;

  const enviarMotivo = estacao.embedprincipal.enviar_motivo ?? false;

  if (!enviarMotivo) return;

  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${emojis.success} Motivo da Abertura`,
    ),
    new TextDisplayBuilder().setContent(
      `Este ticket foi aberto através da opção: **${nomeOpcao}**`,
    ),
  );

  channel
    .send({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    })
    .catch(console.error);
}

function listarGuilds(basePath) {
  const fullPath = path.resolve(__dirname, basePath);
  return fs
    .readdirSync(fullPath)
    .filter((name) =>
      fs.existsSync(path.join(fullPath, name, "banco", "tickets.db")),
    );
}

function obterNomeArquivoSemana() {
  const agora = new Date();
  const agoraSP = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const diaSemana = agoraSP.getDay();
  const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const inicio = new Date(agoraSP);
  inicio.setDate(agoraSP.getDate() + diffSegunda);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  fim.setHours(23, 59, 59, 999);
  const pad = (n) => n.toString().padStart(2, "0");
  const formatar = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const inicioStr = formatar(inicio);
  const fimStr = formatar(fim);
  return `tickets_${inicioStr}_a_${fimStr}.db`;
}

cron.schedule("0 21 * * 0", () => {
  console.log("Cron disparou:", new Date().toLocaleString());
  const basePath = "../../../banco/ticket";
  const guilds = listarGuilds(basePath);
  const nomeArquivo = obterNomeArquivoSemana();
  console.log("Guilds encontradas:", guilds);
  if (guilds.length === 0) {
    console.warn(
      "Nenhuma guild encontrada no caminho:",
      path.resolve(__dirname, basePath),
    );
  }
  guilds.forEach((guildId) => {
    const pastaGuild = path.resolve(__dirname, basePath, guildId, "banco");
    const dbPath = path.join(pastaGuild, "tickets.db");
    const destinoDir = path.join(pastaGuild, "semanal");
    if (!fs.existsSync(destinoDir)) {
      fs.mkdirSync(destinoDir, { recursive: true });
    }
    const destinoFinal = path.join(destinoDir, nomeArquivo);
    fs.copyFileSync(dbPath, destinoFinal);
    console.log(`[✔] Backup semanal salvo: ${destinoFinal}`);
    const db = new sqlite3.Database(dbPath);
    db.serialize(() => {
      db.run("DELETE FROM tickets");
      db.run("UPDATE contadores SET abertos = 0, assumidos = 0, fechados = 0");
    });
    db.close();
  });
});

function hexToDecimal(hex) {
  if (!hex) return null;
  const cleaned = hex.replace("#", "");
  return parseInt(cleaned, 16);
}

function parseEmoji(emojiString, guild) {
  if (!emojiString) return null;

  const unicodeRegex =
    /^[\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u;
  if (unicodeRegex.test(emojiString)) {
    return { name: emojiString };
  }

  const match = emojiString.match(/<(a)?:(\w+):(\d+)>/);
  if (match) {
    return {
      id: match[3],
      name: match[2],
      animated: !!match[1],
    };
  }

  const cleanName = emojiString.replace(/:/g, "").trim();
  const foundEmoji = guild.emojis.cache.find((e) => e.name === cleanName);
  if (foundEmoji) {
    return {
      id: foundEmoji.id,
      name: foundEmoji.name,
      animated: foundEmoji.animated,
    };
  }

  return { name: emojiString };
}

function gerarBotoesContainer(configBotoes = [], transcriptURL) {
  if (!Array.isArray(configBotoes) || configBotoes.length === 0) return null;
  const row = new ActionRowBuilder();
  for (const botao of configBotoes) {
    const button = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(transcriptURL || "");
    if (botao.label) {
      button.setLabel(
        botao.label.replaceAll("{transcript}", transcriptURL || ""),
      );
    }
    if (botao.emoji) {
      button.setEmoji(botao.emoji);
    }
    row.addComponents(button);
  }
  return row.components.length > 0 ? row : null;
}

async function criarTicketComMotivo(interaction, ticketData, motivo) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction
      .deferReply({ flags: MessageFlags.Ephemeral })
      .catch(() => {});
  }

  const guild = interaction.guild;
  const configDB = getConfigDB(guild.id);
  const limitTickets = configDB.get("limit") ?? 1;

  if (isBlacklisted(guild.id, interaction.user.id, interaction.member?.roles)) {
    return interaction.editReply({
      content: `${emojis.block} Você está na blacklist e não pode abrir tickets neste servidor.`,
    });
  }

  const ticketsDoUsuario = guild.channels.cache.filter(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.topic?.startsWith("Labz - ") &&
      ch.topic.endsWith(interaction.user.id),
  );

  if (ticketsDoUsuario.size >= limitTickets) {
    return interaction.editReply({
      content: `${emojis.cancel} Você atingiu o limite de ${limitTickets} ticket(s) aberto(s).`,
    });
  }

  if (ticketData.estacaoId) {
    const estacao = getEstacao(guild.id, ticketData.estacaoId);
    if (estacao) {
      if (estacao.horario_ativo && !isWithinSchedule(estacao.schedule, true)) {
        const msg =
          estacao.mensagem_fora_horario ||
          `${emojis.cancel} Esta área de suporte está fechada neste horário. Tente novamente mais tarde.`;
        return interaction.editReply({ content: msg });
      }

      if (estacao.limite_tickets && estacao.limite_tickets > 0) {
        const ticketsCategorias = (estacao.embedprincipal.botoes || [])
          .concat(estacao.embedprincipal.selects || [])
          .map((item) => (item.categoria || "").split(",").map((c) => c.trim()))
          .flat()
          .filter(Boolean);

        const ticketsNaEstacao = guild.channels.cache.filter(
          (ch) =>
            ch.type === ChannelType.GuildText &&
            ch.topic?.startsWith("Labz - ") &&
            ch.topic.endsWith(interaction.user.id) &&
            ticketsCategorias.includes(ch.parentId),
        );

        if (ticketsNaEstacao.size >= estacao.limite_tickets) {
          return interaction.editReply({
            content: `${emojis.cancel} Você atingiu o limite de ${estacao.limite_tickets} ticket(s) para esta área de suporte.`,
          });
        }
      }
    }
  }

  const categoriasIds = ticketData.categoria
    ? ticketData.categoria
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [];

  const limitePorCategoria = 50;

  let categoriaParaCriar = null;
  let categoriaOriginalRef = null;

  for (const catId of categoriasIds) {
    const category = guild.channels.cache.get(catId);
    if (!category) continue;
    if (category.type !== ChannelType.GuildCategory) continue;
    if (
      category.children.cache.filter((ch) => ch.type === ChannelType.GuildText)
        .size < limitePorCategoria
    ) {
      categoriaParaCriar = catId;
      break;
    }
    if (!categoriaOriginalRef) {
      categoriaOriginalRef = category;
    }
  }

  if (!categoriaParaCriar && categoriaOriginalRef) {
    try {
      const permOverwritesClonados =
        categoriaOriginalRef.permissionOverwrites.cache.map((overwrite) => ({
          id: overwrite.id,
          allow: overwrite.allow,
          deny: overwrite.deny,
          type: overwrite.type,
        }));

      const novaCategoria = await guild.channels.create({
        name: categoriaOriginalRef.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: permOverwritesClonados,
      });

      await novaCategoria
        .setPosition(categoriaOriginalRef.position + 1)
        .catch(() => {});

      categoriaParaCriar = novaCategoria.id;

      const personalizacaoDB_cat = getPersonalizacaoDB(guild.id);
      const embedprincipal = personalizacaoDB_cat.get("embedprincipal") || {};

      let atualizado = false;

      if (ticketData.estacaoId) {
        const estacoesDB_cat = getEstacoesDB(guild.id);
        const estacoes = safeParseEstacoes(estacoesDB_cat.get("estacoes"));
        const estacaoIdx = estacoes.findIndex(
          (e) => e.id === ticketData.estacaoId,
        );

        if (estacaoIdx !== -1) {
          const embed = estacoes[estacaoIdx].embedprincipal;

          if (embed.botoes) {
            const botaoIdx = embed.botoes.findIndex(
              (b) => b.id === ticketData.id,
            );
            if (botaoIdx !== -1) {
              const categoriaAtual = embed.botoes[botaoIdx].categoria || "";
              embed.botoes[botaoIdx].categoria = categoriaAtual
                ? `${categoriaAtual},${novaCategoria.id}`
                : novaCategoria.id;
              atualizado = true;
            }
          }

          if (!atualizado && embed.selects) {
            const selectIdx = embed.selects.findIndex(
              (s) => s.id === ticketData.id,
            );
            if (selectIdx !== -1) {
              const categoriaAtual = embed.selects[selectIdx].categoria || "";
              embed.selects[selectIdx].categoria = categoriaAtual
                ? `${categoriaAtual},${novaCategoria.id}`
                : novaCategoria.id;
              atualizado = true;
            }
          }

          if (atualizado) {
            estacoesDB_cat.set("estacoes", estacoes);
          }
        }
      } else {
        const personalizacaoDB_cat = getPersonalizacaoDB(guild.id);
        const embedprincipal = personalizacaoDB_cat.get("embedprincipal") || {};

        if (embedprincipal.botoes) {
          const botaoIdx = embedprincipal.botoes.findIndex(
            (b) => b.id === ticketData.id,
          );
          if (botaoIdx !== -1) {
            const categoriaAtual =
              embedprincipal.botoes[botaoIdx].categoria || "";
            embedprincipal.botoes[botaoIdx].categoria = categoriaAtual
              ? `${categoriaAtual},${novaCategoria.id}`
              : novaCategoria.id;
            atualizado = true;
          }
        }

        if (!atualizado && embedprincipal.selects) {
          const selectIdx = embedprincipal.selects.findIndex(
            (s) => s.id === ticketData.id,
          );
          if (selectIdx !== -1) {
            const categoriaAtual =
              embedprincipal.selects[selectIdx].categoria || "";
            embedprincipal.selects[selectIdx].categoria = categoriaAtual
              ? `${categoriaAtual},${novaCategoria.id}`
              : novaCategoria.id;
            atualizado = true;
          }
        }

        if (atualizado) {
          personalizacaoDB_cat.set("embedprincipal", embedprincipal);
        }
      }

      if (!atualizado) {
        console.warn(
          `⚠️ Nao foi possivel encontrar o botao/select ${ticketData.id} para salvar a nova categoria.`,
        );
      }
    } catch (err) {
      console.error(
        "❌ Erro ao criar nova categoria automaticamente:",
        err.message,
      );
    }
  }

  const prefixoRaw = ticketData.inicio || "";
  const prefixo = prefixoRaw.trimEnd();
  const temEspacoFinal = prefixoRaw.endsWith(" ");

  const nomeSanitizado = interaction.user.username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const nomeCanal = temEspacoFinal
    ? `${prefixo}-${nomeSanitizado}`
    : prefixo
      ? `${prefixo}${nomeSanitizado}`
      : nomeSanitizado;

  try {
    const dbConfig = getConfigDB(guild.id);

    let teamRoles = dbConfig.get("team") || [];
    let usersPerms = dbConfig.get("usersperms") || {};
    if (ticketData.estacaoId) {
      const estacaoParaTeam = getEstacao(guild.id, ticketData.estacaoId);
      if (estacaoParaTeam) {
        if (
          Array.isArray(estacaoParaTeam.team) &&
          estacaoParaTeam.team.length > 0
        ) {
          teamRoles = estacaoParaTeam.team;
        }
        if (
          estacaoParaTeam.usersperms &&
          Object.keys(estacaoParaTeam.usersperms).length > 0
        ) {
          usersPerms = estacaoParaTeam.usersperms;
        }
      }
    }
    const mencionarAoAbrir = dbConfig.get("mencionar_ao_abrir") ?? false;

    const usersAtender = Object.entries(usersPerms)
      .filter(([userId, perms]) => perms.includes("Atender ticket"))
      .map(([userId]) => userId);

    const permissionOverwrites = [
      {
        id: guild.roles.everyone,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
        ],
      },
    ];

    const permissaoTeam = [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.ManageMessages,
    ];

    for (const roleId of teamRoles) {
      try {
        permissionOverwrites.push({ id: roleId, allow: permissaoTeam });
      } catch (error) {
        console.warn(`⚠️ Erro ao processar role ${roleId}:`, error.message);
      }
    }

    const usuariosValidos = [];
    for (const userId of usersAtender) {
      try {
        const membro = await guild.members.fetch(userId).catch(() => null);
        if (membro) {
          usuariosValidos.push(userId);
        } else {
          console.warn(`⚠️ Usuário ${userId} não encontrado no servidor`);
        }
      } catch (error) {
        console.warn(`⚠️ Erro ao processar usuário ${userId}:`, error.message);
      }
    }

    for (const userId of usuariosValidos) {
      permissionOverwrites.push({
        id: userId,
        allow: permissaoTeam,
      });
    }

    const canalCriado = await guild.channels.create({
      name: nomeCanal,
      type: ChannelType.GuildText,
      parent: categoriaParaCriar || undefined,
      topic: `Labz - ${interaction.user.id}`,
      permissionOverwrites: permissionOverwrites,
    });

    const agora = Date.now();
    const dbsql = getDBConnection(guild.id);

    dbsql.serialize(() => {
      dbsql.run(
        `INSERT INTO tickets (
      guild_id, 
      ticket_id, 
      user_id, 
      staff_id, 
      categoria, 
      criado_em, 
      assumido_em, 
      fechado_em, 
      motivo_abertura,
      ia_pausada_por_staff,
      chat_historico
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 0, '[]')`,
        [
          guild.id,
          canalCriado.id,
          interaction.user.id,
          null,
          ticketData.categoria || null,
          agora,
          motivo || null,
        ],
        function (err) {
          if (err) {
            console.error("❌ Erro ao salvar ticket:", err);
            closeDB(dbsql);
            return;
          }

          dbsql.run(
            `INSERT INTO contadores (guild_id, abertos, assumidos, fechados)
         VALUES (?, 1, 0, 0)
         ON CONFLICT(guild_id) DO UPDATE SET abertos = abertos + 1`,
            [guild.id],
            function (err) {
              if (err) {
                console.error("❌ Erro ao atualizar contadores:", err);
              }
              closeDB(dbsql);
            },
          );
        },
      );
    });

    if (mencionarAoAbrir) {
      const mencoes = [];
      mencoes.push(`<@${interaction.user.id}>`);

      for (const roleId of teamRoles) {
        mencoes.push(`<@&${roleId}>`);
      }

      for (const userId of usersAtender) {
        mencoes.push(`<@${userId}>`);
      }

      const mensagemMencao = await canalCriado.send({
        content: mencoes.join(" "),
      });

      setTimeout(() => {
        mensagemMencao.delete().catch(() => {});
      }, 1000);
    }

    const dbInstance = getPersonalizacaoDB(guild.id);
    const embedTicket = dbInstance.get("embedticket") || {};

    const botoesEmbed = embedTicket.botoes || [];
    const botoesFormatados = botoesEmbed
      .map((btn) => {
        const button = new ButtonBuilder()
          .setCustomId(btn.id)
          .setLabel(btn.nome)
          .setStyle(
            ButtonStyle[btn.style?.toUpperCase()] || ButtonStyle.Secondary,
          );

        if (btn.emoji) {
          try {
            const emojiObj = parseEmoji(btn.emoji, interaction.guild);
            if (emojiObj) {
              if (emojiObj.id) {
                button.setEmoji({
                  id: emojiObj.id,
                  name: emojiObj.name,
                  animated: emojiObj.animated || false,
                });
              } else if (emojiObj.name) {
                button.setEmoji(emojiObj.name);
              }
            } else {
              button.setEmoji(btn.emoji);
            }
          } catch (error) {
            button.setEmoji(btn.emoji);
          }
        }

        return button;
      })
      .filter((btn) => btn.data.custom_id !== "fechar_ticket");

    const containerComponents = [
      new TextDisplayBuilder().setContent(
        `# ${embedTicket.title || "🎟️ Ticket Aberto"}`,
      ),
    ];

    const autorMention = interaction.user.toString();
    const aberturaTimestamp = `<t:${Math.floor(Date.now() / 1000)}:f>`;

    let descricaoProcessada =
      embedTicket.descricao ||
      `Olá ${interaction.user}, sua solicitação foi recebida! Aguarde a equipe de suporte.`;

    descricaoProcessada = descricaoProcessada
      .replace(/{staff}/g, "Ticket ainda não assumido")
      .replace(/{user}/g, autorMention)
      .replace(/{abertura}/g, aberturaTimestamp)
      .replace(/{motivo}/g, motivo || "Não informado")
      .replace(/{categoria}/g, ticketData.nome || "Não especificada");

    containerComponents.push(
      new TextDisplayBuilder().setContent(descricaoProcessada),
    );

    const welcomeContainer = new ContainerBuilder().addTextDisplayComponents(
      ...containerComponents,
    );

    if (embedTicket.color) {
      const colorDecimal = hexToDecimal(embedTicket.color);
      if (colorDecimal !== null) {
        welcomeContainer.setAccentColor(colorDecimal);
      }
    }

    if (
      embedTicket.banner &&
      typeof embedTicket.banner === "string" &&
      embedTicket.banner.startsWith("http")
    ) {
      welcomeContainer.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(embedTicket.banner),
        ),
      );
    }

    for (let i = 0; i < botoesFormatados.length; i += 5) {
      const buttonsSlice = botoesFormatados.slice(i, i + 5);
      welcomeContainer.addActionRowComponents(
        new ActionRowBuilder().addComponents(...buttonsSlice),
      );
    }

    const msgTicket = await canalCriado.send({
      flags: MessageFlags.IsComponentsV2,
      components: [welcomeContainer],
    });

    const dbsql2 = getDBConnection(guild.id);
    const _nomeCategoria = ticketData.estacaoId
      ? (() => {
          const _e = getEstacao(guild.id, ticketData.estacaoId);
          return _e ? _e.nome : ticketData.nome || null;
        })()
      : ticketData.nome || null;
    dbsql2.run(
      `UPDATE tickets SET message_id = ?, nome_categoria = ?, motivo_abertura = ? WHERE ticket_id = ?`,
      [msgTicket.id, _nomeCategoria, motivo || null, canalCriado.id],
      (err) => {
        if (err) {
          console.error("❌ Erro ao salvar message_id do ticket:", err);
        }
        closeDB(dbsql2);
      },
    );

    try {
      const _iaModule = require("../../events/ticket/ia-ticket");
      const _iaDB = _iaModule.getIAConfigDB(guild.id);
      const _iaAtivo = _iaDB.get("sistema_ativo");
      const _bvAtivo = _iaDB.get("mensagem_boas_vindas_ativo");
      if (_iaAtivo && _bvAtivo) {
        if (_iaModule.ticketWelcomeSent)
          _iaModule.ticketWelcomeSent.add(
            "bv_" + guild.id + "_" + canalCriado.id,
          );
        const _bvTexto = (_iaDB.get("mensagem_boas_vindas") || "").trim();
        const _member = interaction.member;
        let _mensagem = "";
        if (_bvTexto) {
          _mensagem = _bvTexto
            .replace(/{user}/g, "<@" + interaction.user.id + ">")
            .replace(
              /{nome}/g,
              _member?.displayName || interaction.user.username,
            );
        } else {
          try {
            const Groq = require("groq-sdk");
            const _cfg = require(
              require("path").join(__dirname, "../../../config.json"),
            );
            const _groq = new Groq({
              apiKey: _cfg["key-ia"] || _cfg["key-ia2"],
            });
            const _promptBase =
              _iaDB.get("prompt_base") || "Você é uma assistente de suporte.";
            const _resp = await _groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              max_tokens: 150,
              temperature: 0.7,
              messages: [
                { role: "system", content: _promptBase },
                {
                  role: "user",
                  content:
                    "[SISTEMA] O usuário " +
                    (_member?.displayName || interaction.user.username) +
                    " acabou de abrir um ticket. Gere uma mensagem de boas-vindas curta, educada e profissional em português. Máximo 2 frases.",
                },
              ],
            });
            _mensagem = _resp.choices[0]?.message?.content?.trim() || "";
          } catch (_ge) {
            console.error("[IA-BV] Erro groq:", _ge.message);
          }
        }
        if (_mensagem) {
          const _c = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "<@" +
                interaction.user.id +
                ">\
" +
                _mensagem,
            ),
          );
          canalCriado
            .send({ flags: MessageFlags.IsComponentsV2, components: [_c] })
            .catch(() => {});
        }
      }
    } catch (_bve) {
      console.error("[IA-BV] Erro:", _bve.message);
    }

    const containerResposta = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${emojis.success} Seu ticket foi aberto com sucesso!`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Ir ao Ticket")
            .setStyle(ButtonStyle.Link)
            .setURL(
              `https://discord.com/channels/${guild.id}/${canalCriado.id}`,
            ),
        ),
      );

    if (ticketData.estacaoId) {
      const _formData = global._formRespostas?.get(interaction.user.id);
      if (
        _formData &&
        _formData.estacaoId === ticketData.estacaoId &&
        _formData.respostas?.length > 0
      ) {
        global._formRespostas.delete(interaction.user.id);
        const _linhas = _formData.respostas
          .map((r) => `**${r.label}:**\n> ${r.valor || "*(não informado)*"}`)
          .join("\n\n");
        canalCriado
          .send({
            flags: MessageFlags.IsComponentsV2,
            components: [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `📋 **Informações do Ticket**\n\n${_linhas}`,
                ),
              ),
            ],
          })
          .catch(() => {});
      } else {
        enviarMensagemMotivoTicket(
          canalCriado,
          ticketData.nome,
          guild.id,
          ticketData.estacaoId,
        );
      }
    }

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        components: [containerResposta],
        flags: MessageFlags.IsComponentsV2,
      });
    } else {
      await interaction.reply({
        components: [containerResposta],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error("Erro ao criar canal de ticket:", error);
    return interaction
      .editReply({
        content:
          "${emojis.cancel} Ocorreu um erro ao tentar abrir seu ticket. Tente novamente mais tarde.",
      })
      .catch(() => {});
  }
}

module.exports = {
  async execute(client, interaction) {
    const ticketInteractionIds = [
      "painel_membro",
      "sair_ticket",
      "assumir_ticket",
      "painel_staff",
      "fechar_ticket",
      "painel_staff_select",
      "painel_membro_menu",
      "avaliar_atendimento_",
      "avaliacao_estrelas_",
      "modal_avaliacao_",
      "confirmar_adicionar",
      "recusar_adicionar",
      "confirmar_remover",
      "recusar_remover",
      "select_usuarios_adicionar",
      "select_usuarios_remover",
      "select_usuarios_adicionar_direto",
      "select_usuarios_remover_direto",
      "ticket_botoes_",
      "ticket_select",
      "modal_motivo_ticket_",
      "modal_fechar_ticket",
      "modal_sair_ticket_confirmar",
      "modal_renomear_ticket",
      "ticket_estacao_botoes_",
      "ticket_estacao_select_",
      "modal_motivo_estacao_",
      "submit_form_estacao_",
      "ticket_tags_",
      "ticket_tag_aplicar_",
    ];

    const isTicketInteraction =
      (interaction.isButton() &&
        ticketInteractionIds.some(
          (id) =>
            interaction.customId === id || interaction.customId.startsWith(id),
        )) ||
      (interaction.isStringSelectMenu() &&
        ticketInteractionIds.some(
          (id) =>
            interaction.customId === id || interaction.customId.startsWith(id),
        )) ||
      (interaction.isUserSelectMenu() &&
        ticketInteractionIds.some(
          (id) =>
            interaction.customId === id || interaction.customId.startsWith(id),
        )) ||
      (interaction.isModalSubmit() &&
        ticketInteractionIds.some(
          (id) =>
            interaction.customId === id || interaction.customId.startsWith(id),
        ));

    if (!isTicketInteraction) return;

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("avaliar_atendimento_")
    ) {
      const parts = interaction.customId
        .replace("avaliar_atendimento_", "")
        .split("_");
      const guildId = parts[0];
      const canalId = parts[1];

      const dbPersonalizacaoDM = getPersonalizacaoDB(guildId);
      const config = dbPersonalizacaoDM.get("embedavaliacao") || {};

      const container = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${config.title || `${emojis.star} Avalie o Atendimento`}`,
        ),
        new TextDisplayBuilder().setContent(
          config.descricao || "Quantas estrelas você dá para o atendimento?",
        ),
      );

      if (config.color) {
        const colorDecimal = hexToDecimal(config.color);
        if (colorDecimal !== null) {
          container.setAccentColor(colorDecimal);
        }
      }

      if (config.banner) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(config.banner),
          ),
        );
      }

      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`avaliacao_estrelas_${guildId}_${canalId}`)
            .setPlaceholder("Selecione de 1 a 5 estrelas")
            .addOptions([
              {
                label: "⭐ 1 Estrela",
                value: "1",
                description: "Péssimo atendimento",
                emoji: "😞",
              },
              {
                label: "⭐⭐ 2 Estrelas",
                value: "2",
                description: "Atendimento ruim",
                emoji: "😕",
              },
              {
                label: "⭐⭐⭐ 3 Estrelas",
                value: "3",
                description: "Atendimento regular",
                emoji: "😐",
              },
              {
                label: "⭐⭐⭐⭐ 4 Estrelas",
                value: "4",
                description: "Bom atendimento",
                emoji: "😊",
              },
              {
                label: "⭐⭐⭐⭐⭐ 5 Estrelas",
                value: "5",
                description: "Atendimento excelente",
                emoji: "🤩",
              },
            ]),
        ),
      );

      await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [container],
      });
      return;
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("avaliacao_estrelas_")
    ) {
      const estrelas = interaction.values[0];
      const parts = interaction.customId
        .replace("avaliacao_estrelas_", "")
        .split("_");
      const guildId = parts[0];
      const canalId = parts[1];

      try {
        const modal = new ModalBuilder()
          .setCustomId(`modal_avaliacao_${guildId}_${canalId}_${estrelas}`)
          .setTitle("Avaliação do Atendimento");

        const comentarioInput = new TextInputBuilder()
          .setCustomId("comentario")
          .setLabel("Como foi o atendimento? (Opcional)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Deixe seu comentário sobre o atendimento...")
          .setRequired(false)
          .setMaxLength(1000);

        modal.addComponents(
          new ActionRowBuilder().addComponents(comentarioInput),
        );

        await interaction.showModal(modal);
        return;
      } catch (error) {
        if (
          error.code === 10062 ||
          error.code === 40060 ||
          error.message?.includes("Unknown interaction")
        ) {
          await interaction.deferUpdate().catch(() => {});

          const estrelasNum = parseInt(estrelas);
          const dbsql = getDBConnection(guildId);

          dbsql.run(
            `INSERT INTO avaliacoes (ticket_id, user_id, estrelas, comentario, avaliado_em) VALUES (?, ?, ?, ?, ?)`,
            [
              canalId,
              interaction.user.id,
              estrelasNum,
              "Sem comentário",
              Date.now(),
            ],
            async function (err) {
              closeDB(dbsql);
              if (err) {
                console.error("Erro ao salvar avaliação:", err);
                return;
              }

              const estrelinhas = (emojis.star || "⭐").repeat(estrelasNum);
              const avaliacaoTexto =
                estrelasNum === 5
                  ? "Excelente"
                  : estrelasNum === 4
                    ? "Bom"
                    : estrelasNum === 3
                      ? "Regular"
                      : estrelasNum === 2
                        ? "Ruim"
                        : "Péssimo";

              const containerSucesso1 =
                new ContainerBuilder().addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `# ${emojis.star} Avaliação Recebida`,
                  ),
                  new TextDisplayBuilder().setContent(
                    `${emojis.check} **Obrigado pela sua avaliação!**\n\n${estrelinhas} **(${avaliacaoTexto})**\n\n${emojis.sparks} Seu feedback é muito importante para nós!`,
                  ),
                );

              await interaction
                .followUp({
                  components: [containerSucesso1],
                  flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                })
                .catch(() => {
                  interaction.user
                    .send({
                      components: [containerSucesso1],
                      flags: MessageFlags.IsComponentsV2,
                    })
                    .catch(console.error);
                });
            },
          );
          return;
        }

        console.error("Erro ao processar avaliação:", error);
        throw error;
      }
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_avaliacao_")
    ) {
      let deferFailed = false;
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      } catch (error) {
        if (
          error.code === 10062 ||
          error.message?.includes("Unknown interaction")
        ) {
          deferFailed = true;
        } else {
          throw error;
        }
      }

      const parts = interaction.customId
        .replace("modal_avaliacao_", "")
        .split("_");
      const guildId = parts[0];
      const ticketCanalId = parts[1];
      const estrelas = parts[2];
      const comentario =
        interaction.fields.getTextInputValue("comentario") || "Sem comentário";

      const estrelasNum = parseInt(estrelas);

      const dbPersonalizacaoModal = getPersonalizacaoDB(guildId);
      const config = dbPersonalizacaoModal.get("embedavaliacao") || {};

      const dbsql = getDBConnection(guildId);

      dbsql.get(
        `SELECT staff_id FROM tickets WHERE ticket_id = ?`,
        [ticketCanalId],
        async (err, ticketRow) => {
          const staffId = ticketRow?.staff_id || null;

          dbsql.run(
            `INSERT INTO avaliacoes (ticket_id, user_id, estrelas, comentario, avaliado_em) VALUES (?, ?, ?, ?, ?)`,
            [
              ticketCanalId,
              interaction.user.id,
              estrelasNum,
              comentario,
              Date.now(),
            ],
            async function (err) {
              closeDB(dbsql);
              if (err) {
                console.error("Erro ao salvar avaliação:", err);

                if (deferFailed) {
                  interaction.user
                    .send({
                      content: `${emojis.cancel} Erro ao salvar sua avaliação.`,
                    })
                    .catch(console.error);
                } else {
                  interaction
                    .editReply({
                      content: `${emojis.cancel} Erro ao salvar sua avaliação.`,
                      flags: MessageFlags.Ephemeral,
                    })
                    .catch(console.error);
                }
                return;
              }

              const estrelinhas = (emojis.star || "⭐").repeat(estrelasNum);
              const avaliacaoTexto =
                estrelasNum === 5
                  ? "Excelente"
                  : estrelasNum === 4
                    ? "Bom"
                    : estrelasNum === 3
                      ? "Regular"
                      : estrelasNum === 2
                        ? "Ruim"
                        : "Péssimo";

              const containerSucesso2 =
                new ContainerBuilder().addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `# ${emojis.star} Avaliação Recebida`,
                  ),
                  new TextDisplayBuilder().setContent(
                    config.descricaoRecebida
                      ? config.descricaoRecebida
                          .replace("{estrelas}", estrelinhas)
                          .replace("{avaliacao}", avaliacaoTexto)
                          .replace(
                            "{comentario}",
                            comentario !== "Sem comentário"
                              ? `\n\n${emojis.message} *"${comentario}"*`
                              : "",
                          )
                      : `${emojis.check} **Obrigado pela sua avaliação!**\n\n${estrelinhas} **(${avaliacaoTexto})**\n\n${emojis.sparks} Seu feedback é muito importante para nós!`,
                  ),
                );

              if (deferFailed) {
                await interaction.user
                  .send({
                    components: [containerSucesso2],
                    flags: MessageFlags.IsComponentsV2,
                  })
                  .catch(console.error);
              } else {
                await interaction
                  .editReply({
                    components: [containerSucesso2],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                  })
                  .catch(console.error);
              }

              try {
                const dbConfig = getConfigDB(guildId);
                const logAvaliacaoCfg =
                  dbConfig.get("logs.log_avaliacao") || {};

                if (logAvaliacaoCfg.ativo === true && logAvaliacaoCfg.canal) {
                  const guild = interaction.client.guilds.cache.get(guildId);
                  if (guild) {
                    const canalLog = guild.channels.cache.get(
                      logAvaliacaoCfg.canal,
                    );
                    if (canalLog) {
                      const dbPersonalizacaoLogAval =
                        getPersonalizacaoDB(guildId);
                      const config =
                        dbPersonalizacaoLogAval.get("embedlogavaliacao") || {};

                      const staffTexto = staffId
                        ? `<@${staffId}>`
                        : "Sem Staff";

                      const containerLogAvaliacao =
                        new ContainerBuilder().addTextDisplayComponents(
                          new TextDisplayBuilder().setContent(
                            `# ${config.title || `${emojis.star} Nova Avaliação`}`,
                          ),
                          new TextDisplayBuilder().setContent(
                            config.descricao
                              ? config.descricao
                                  .replace(
                                    "{user}",
                                    `${interaction.user} (\`${interaction.user.id}\`)`,
                                  )
                                  .replace(
                                    "{ticket_id}",
                                    `\`${ticketCanalId}\``,
                                  )
                                  .replace("{estrelas}", estrelinhas)
                                  .replace("{avaliacao}", `${estrelasNum}/5`)
                                  .replace("{comentario}", comentario)
                                  .replace(
                                    "{data}",
                                    `<t:${Math.floor(Date.now() / 1000)}:f>`,
                                  )
                                  .replace("{staff}", staffTexto)
                              : `**Usuário:** ${interaction.user} (\`${
                                  interaction.user.id
                                }\`)\n**Ticket ID:** \`${ticketCanalId}\`\n**Staff:** ${staffTexto}\n**Avaliação:** ${estrelinhas} **(${estrelasNum}/5)**\n**Comentário:** ${comentario}\n**Data:** <t:${Math.floor(
                                  Date.now() / 1000,
                                )}:f>`,
                          ),
                        );

                      if (config.color) {
                        const colorDecimal = hexToDecimal(config.color);
                        if (colorDecimal !== null) {
                          containerLogAvaliacao.setAccentColor(colorDecimal);
                        }
                      }

                      if (config.banner) {
                        containerLogAvaliacao.addMediaGalleryComponents(
                          new MediaGalleryBuilder().addItems(
                            new MediaGalleryItemBuilder().setURL(config.banner),
                          ),
                        );
                      }

                      await canalLog
                        .send({
                          flags: MessageFlags.IsComponentsV2,
                          components: [containerLogAvaliacao],
                        })
                        .catch(console.error);
                    }
                  }
                }
              } catch (error) {
                console.error(
                  "Erro ao enviar avaliação para o canal de logs:",
                  error,
                );
              }

              try {
                const user = interaction.user;
                const dmChannel = await user.createDM();
                const messages = await dmChannel.messages.fetch({ limit: 50 });

                const mensagemOriginal = messages.find((msg) => {
                  if (msg.author.id !== interaction.client.user.id)
                    return false;
                  if (msg.components.length === 0) return false;

                  for (const container of msg.components) {
                    if (!container.components) continue;

                    for (const comp of container.components) {
                      if (comp.type === 10) {
                        const text = comp.data?.text || "";
                        if (text.includes("Avalie o Atendimento")) {
                          return true;
                        }
                      }

                      if (comp.type === 1 && comp.components) {
                        for (const subComp of comp.components) {
                          const customId =
                            subComp.customId || subComp.data?.custom_id || "";
                          if (
                            customId.includes(`_${guildId}_${ticketCanalId}`)
                          ) {
                            return true;
                          }
                        }
                      }
                    }
                  }

                  return false;
                });

                if (!mensagemOriginal) {
                  return;
                }

                const dbPersonalizacaoAvaliacaoDM =
                  getPersonalizacaoDB(guildId);
                const config =
                  dbPersonalizacaoAvaliacaoDM.get("embedavaliacao") || {};

                const novosContainers = [];

                for (let i = 0; i < mensagemOriginal.components.length; i++) {
                  const container = mensagemOriginal.components[i];
                  let temAvaliacao = false;

                  if (container.components) {
                    for (const comp of container.components) {
                      if (comp.type === 10) {
                        const text = comp.data?.text || "";
                        if (text.includes("Avalie o Atendimento")) {
                          temAvaliacao = true;
                          break;
                        }
                      }

                      if (comp.type === 1 && comp.components) {
                        for (const subComp of comp.components) {
                          const customId =
                            subComp.customId || subComp.data?.custom_id || "";
                          if (
                            customId.startsWith("avaliar_atendimento_") ||
                            customId.startsWith("avaliacao_estrelas_")
                          ) {
                            temAvaliacao = true;
                            break;
                          }
                        }
                      }
                    }
                  }

                  if (temAvaliacao) {
                    const novoContainer =
                      new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                          `# ${config.title || `${emojis.star} Avaliação Recebida`}`,
                        ),
                        new TextDisplayBuilder().setContent(
                          config.descricaoRecebida
                            ? config.descricaoRecebida
                                .replace("{estrelas}", estrelinhas)
                                .replace("{avaliacao}", `${estrelasNum}/5`)
                                .replace(
                                  "{comentario}",
                                  comentario !== "Sem comentário"
                                    ? `\n\n${emojis.message} *"${comentario}"*`
                                    : "",
                                )
                            : `${emojis.check} **Obrigado pela sua avaliação!**\n\n${estrelinhas} **(${estrelasNum}/5)**${
                                comentario !== "Sem comentário"
                                  ? `\n\n${emojis.message} *"${comentario}"*`
                                  : ""
                              }\n\n${emojis.sparks} Seu feedback é muito importante para nós!`,
                        ),
                      );

                    if (config.color) {
                      const colorDecimal = hexToDecimal(config.color);
                      if (colorDecimal !== null) {
                        novoContainer.setAccentColor(colorDecimal);
                      }
                    }

                    if (config.banner) {
                      novoContainer.addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                          new MediaGalleryItemBuilder().setURL(config.banner),
                        ),
                      );
                    }

                    novosContainers.push(novoContainer);
                  } else {
                    novosContainers.push(container);
                  }
                }

                await mensagemOriginal.edit({
                  flags: MessageFlags.IsComponentsV2,
                  components: novosContainers,
                });
              } catch (error) {
                console.error("❌ Erro:", error.message);
                console.error(error.stack);
              }
            },
          );
        },
      );
      return;
    }

    if (!interaction.guild) return;

    const guild = interaction.guild;
    const guildId = guild.id;

    const personalizacaoPath = path.resolve(
      __dirname,
      `../../../banco/ticket/${guildId}/personalizacao.json`,
    );
    if (!fs.existsSync(personalizacaoPath)) return;

    const db = JSON.parse(fs.readFileSync(personalizacaoPath, "utf-8"));
    const embedData = db.embedprincipal || {};
    const botoes = embedData.botoes || [];
    const selects = embedData.selects || [];

    const configDB = getConfigDB(guildId);
    const systemAtivo = configDB.get("system") ?? false;
    const limitTickets = configDB.get("limit") ?? 1;
    const schedule = configDB.get("schedule");

    let ticketData;

    if (interaction.isButton() && interaction.customId === "painel_membro") {
      const donoTicketId = interaction.channel.topic?.split("Labz - ")[1];
      if (interaction.user.id !== donoTicketId) {
        return interaction.reply({
          content: `${emojis.cancel} Apenas quem abriu o ticket pode usar esse painel.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("**Painel do Membro**"),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "Escolha uma ação no menu abaixo:",
          ),
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("painel_membro_menu")
              .setPlaceholder("Escolha uma ação")
              .addOptions([
                {
                  label: "Sair do ticket",
                  value: "sair_ticket",
                  emoji: getEmoji(emojis.arrowl),
                },
                {
                  label: "Notificar staff",
                  value: "notificar_staff",
                  emoji: getEmoji(emojis.user),
                },
                {
                  label: "Adicionar membro",
                  value: "adicionar_membro",
                  emoji: getEmoji(emojis.invite),
                },
                {
                  label: "Remover membro",
                  value: "remover_membro",
                  emoji: getEmoji(emojis.minus),
                },
              ]),
          ),
        );
      await interaction.reply({
        components: [container],
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
      });
      return;
    }

    if (interaction.isButton()) {
      const { customId, member, guild, user, channel } = interaction;

      if (customId === "sair_ticket") {
        const canal = interaction.channel;
        const permissao = canal.permissionOverwrites.cache.get(
          interaction.user.id,
        );
        const podeVer = permissao?.allow?.has(
          PermissionsBitField.Flags.ViewChannel,
        );
        if (!podeVer) {
          return interaction.reply({
            content: `${emojis.cancel} Apenas quem abriu o ticket pode sair dele.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        const modal = new ModalBuilder()
          .setCustomId("modal_sair_ticket_confirmar")
          .setTitle(`Confirmar saída do ticket`)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("confirmacao")
                .setLabel("Digite 'CONFIRMAR' para sair")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder("CONFIRMAR"),
            ),
          );
        return interaction.showModal(modal);
      }

      if (customId === "assumir_ticket") {
        const guildId = guild.id;
        const dbsql = getDBConnection(guildId);
        const dbConfig = getConfigDB(guildId);
        const teamRoles = dbConfig.get("team") || [];
        const usersPerms = dbConfig.get("usersperms") || {};
        const notificarAutorAoAssumir =
          dbConfig.get("notificar_autor_ao_assumir") ?? false;

        if (!dbConfig.has("notificar_autor_ao_assumir")) {
          dbConfig.set("notificar_autor_ao_assumir", false);
        }

        const hasTeamRole = member.roles.cache.some((role) =>
          teamRoles.includes(role.id.toString()),
        );
        const hasUserPerm = usersPerms[user.id]?.includes("Atender ticket");
        if (!hasTeamRole && !hasUserPerm) {
          closeDB(dbsql);
          return interaction.reply({
            content: `${emojis.cancel} Você não tem permissão para assumir este ticket.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        dbsql.run(
          `UPDATE tickets SET assumido_em = ?, staff_id = ? WHERE ticket_id = ?`,
          [Date.now(), user.id, channel.id],
          async function (err) {
            if (err) {
              console.error("Erro ao atualizar ticket:", err);
              closeDB(dbsql);
              return interaction.reply({
                content: `${emojis.cancel} Ocorreu um erro ao assumir o ticket.`,
                flags: MessageFlags.Ephemeral,
              });
            }
            dbsql.run(
              `INSERT INTO contadores (guild_id, abertos, assumidos, fechados)
VALUES (?, 0, 1, 0)
ON CONFLICT(guild_id) DO UPDATE SET assumidos = assumidos + 1`,
              [guildId],
              function (err) {
                if (err) {
                  console.error(
                    "Erro ao atualizar contador de assumidos:",
                    err,
                  );
                }
              },
            );

            let _resumoContainer = null;
            try {
              const {
                getIAConfigDB,
              } = require("../../events/ticket/ia-ticket");
              const iaDB = getIAConfigDB(guildId);
              const resumoAtivo = iaDB.get("resumo_ao_assumir") ?? false;
              if (resumoAtivo) {
                const {
                  gerarResumoAoAssumir,
                } = require("../../events/ticket/resumo-assumir");
                _resumoContainer = await gerarResumoAoAssumir(
                  client,
                  guildId,
                  channel.id,
                  user.id,
                );
              }
            } catch {}

            if (notificarAutorAoAssumir) {
              try {
                const autorId = channel.topic?.split("Labz - ")[1];
                if (autorId) {
                  const autor = await guild.members
                    .fetch(autorId)
                    .catch(() => null);
                  if (autor) {
                    const dbPersonalizacao = getPersonalizacaoDB(guildId);
                    const configAssumido = dbPersonalizacao.get(
                      "embedassumido",
                    ) || {
                      title: `${emojis.textc} Seu Ticket foi Assumido`,
                      descricao:
                        "O staff {staff} assumiu seu ticket. Aguarde o atendimento.",
                    };

                    let descricaoProcessada = configAssumido.descricao || "";
                    descricaoProcessada = descricaoProcessada.replace(
                      /{staff}/g,
                      `<@${user.id}>`,
                    );

                    const containerAssumido =
                      new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                          `# ${
                            configAssumido.title ||
                            `${emojis.textc} Seu Ticket foi Assumido`
                          }`,
                        ),
                        new TextDisplayBuilder().setContent(
                          descricaoProcessada,
                        ),
                      );

                    if (configAssumido.color) {
                      const colorDecimal = hexToDecimal(configAssumido.color);
                      if (colorDecimal !== null) {
                        containerAssumido.setAccentColor(colorDecimal);
                      }
                    }

                    if (
                      configAssumido.banner &&
                      typeof configAssumido.banner === "string" &&
                      configAssumido.banner.startsWith("http")
                    ) {
                      containerAssumido.addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                          new MediaGalleryItemBuilder().setURL(
                            configAssumido.banner,
                          ),
                        ),
                      );
                    }

                    await autor
                      .send({
                        flags: MessageFlags.IsComponentsV2,
                        components: [containerAssumido],
                      })
                      .catch(() => {});
                  }
                }
              } catch (error) {
                console.error("Erro ao enviar DM ao autor:", error);
              }
            }

            const dbEmbed = getPersonalizacaoDB(guildId);
            const embedConfig = dbEmbed.get("embedticket") || {};

            if (!embedConfig.botoes) {
              embedConfig.botoes = [];
            }

            const fecharTicketBotaoIndex = embedConfig.botoes.findIndex(
              (btn) => btn.id === "fechar_ticket",
            );
            if (fecharTicketBotaoIndex === -1) {
              embedConfig.botoes.push({
                id: "fechar_ticket",
                nome: "Fechar Ticket",
                style: "Secondary",
                emoji: emojis.lock || "<:lock:1404161355874828398>",
                cor: "Secondary",
              });
              dbEmbed.set("embedticket", embedConfig);
            }

            dbsql.get(
              `SELECT message_id, motivo_abertura, nome_categoria FROM tickets WHERE ticket_id = ?`,
              [channel.id],
              async (err, row) => {
                closeDB(dbsql);
                if (err || !row?.message_id) {
                  return interaction.reply({
                    content:
                      "${emojis.cancel} Não foi possível localizar a mensagem principal do ticket.",
                    flags: MessageFlags.Ephemeral,
                  });
                }
                try {
                  const msgOriginal = await channel.messages.fetch(
                    row.message_id,
                  );
                  if (!msgOriginal) {
                    return interaction.reply({
                      content: `${emojis.cancel} Mensagem do ticket não encontrada.`,
                      flags: MessageFlags.Ephemeral,
                    });
                  }

                  const containerAtual = msgOriginal.components[0];
                  const textDisplayAtual = containerAtual?.components?.find(
                    (comp) => comp.type === "TEXT_DISPLAY",
                  );
                  const textoAtual = textDisplayAtual?.text || "";
                  const textoPadrao = embedConfig.descricao
                    ? embedConfig.descricao.replace(
                        /{staff}/g,
                        "Ticket ainda não assumido",
                      )
                    : "Ticket ainda não assumido";

                  if (textoAtual !== textoPadrao && textoAtual.includes("<@")) {
                    return interaction.reply({
                      content:
                        "${emojis.cancel} Este ticket já foi assumido por outra pessoa.",
                      flags: MessageFlags.Ephemeral,
                    });
                  }

                  const canal = channel;
                  const staffMention = user.toString();
                  const rawDescription = embedConfig.descricao || "";
                  const autorMention = `<@${canal.topic.split("Labz - ")[1]}>`;
                  const aberturaTimestamp = `<t:${Math.floor(
                    canal.createdTimestamp / 1000,
                  )}:f>`;

                  let novaDescricao = rawDescription
                    .replace(/{staff}/g, staffMention)
                    .replace(/{user}/g, autorMention)
                    .replace(/{abertura}/g, aberturaTimestamp)
                    .replace(
                      /{motivo}/g,
                      row.motivo_abertura || "Não informado",
                    )
                    .replace(
                      /{categoria}/g,
                      row.nome_categoria || "Não especificada",
                    );

                  function parseEmojiLocal(raw, guild) {
                    if (!raw) return null;

                    const unicodeRegex =
                      /^[\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u;
                    if (unicodeRegex.test(raw)) {
                      return { name: raw };
                    }

                    const match = raw.match(/<(a)?:(\w+):(\d+)>/);
                    if (match) {
                      const emojiId = match[3];
                      if (guild && guild.emojis.cache.has(emojiId)) {
                        return {
                          id: emojiId,
                          name: match[2],
                          animated: !!match[1],
                        };
                      }
                      return null;
                    }

                    const cleanName = raw.replace(/:/g, "").trim();
                    const foundEmoji = guild?.emojis.cache.find(
                      (e) => e.name === cleanName,
                    );
                    if (foundEmoji) {
                      return {
                        id: foundEmoji.id,
                        name: foundEmoji.name,
                        animated: foundEmoji.animated,
                      };
                    }

                    return null;
                  }

                  const botoesEmbed = embedConfig.botoes || [];
                  const botoesFormatados = botoesEmbed
                    .filter((btn) => btn.id !== "assumir_ticket")
                    .map((btn) => {
                      const button = new ButtonBuilder()
                        .setCustomId(btn.id)
                        .setLabel(btn.nome)
                        .setStyle(
                          ButtonStyle[btn.style?.toUpperCase()] ||
                            ButtonStyle.Secondary,
                        );

                      if (btn.emoji) {
                        try {
                          const emojiObj = parseEmojiLocal(
                            btn.emoji,
                            interaction.guild,
                          );
                          if (emojiObj) {
                            if (emojiObj.id) {
                              button.setEmoji({
                                id: emojiObj.id,
                                name: emojiObj.name,
                                animated: emojiObj.animated || false,
                              });
                            } else if (emojiObj.name) {
                              button.setEmoji(emojiObj.name);
                            }
                          } else {
                            button.setEmoji(btn.emoji);
                          }
                        } catch (error) {
                          console.error(
                            "Erro ao processar emoji do botão:",
                            error,
                          );
                          button.setEmoji(btn.emoji);
                        }
                      }

                      return button;
                    });

                  const containerComponents = [
                    new TextDisplayBuilder().setContent(
                      `# ${embedConfig.title || `${emojis.textc} Suporte`}`,
                    ),
                  ];

                  if (novaDescricao && novaDescricao.trim().length > 0) {
                    containerComponents.push(
                      new TextDisplayBuilder().setContent(novaDescricao),
                    );
                  }

                  const container =
                    new ContainerBuilder().addTextDisplayComponents(
                      ...containerComponents,
                    );

                  if (embedConfig.color) {
                    const colorDecimal = hexToDecimal(embedConfig.color);
                    if (colorDecimal !== null) {
                      container.setAccentColor(colorDecimal);
                    }
                  }

                  if (
                    embedConfig.banner &&
                    typeof embedConfig.banner === "string" &&
                    embedConfig.banner.startsWith("http")
                  ) {
                    container.addMediaGalleryComponents(
                      new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(
                          embedConfig.banner,
                        ),
                      ),
                    );
                  }

                  for (let i = 0; i < botoesFormatados.length; i += 5) {
                    container.addActionRowComponents(
                      new ActionRowBuilder().addComponents(
                        ...botoesFormatados.slice(i, i + 5),
                      ),
                    );
                  }

                  await msgOriginal.edit({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                  });

                  const _assumidoComponents = [
                    new ContainerBuilder().addTextDisplayComponents(
                      new TextDisplayBuilder().setContent(
                        `${emojis.check} **Ticket assumido.**`,
                      ),
                    ),
                  ];
                  if (_resumoContainer)
                    _assumidoComponents.push(_resumoContainer);

                  return interaction.reply({
                    components: _assumidoComponents,
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                  });
                } catch (error) {
                  console.error("Erro ao buscar ou editar mensagem:", error);
                  return interaction.reply({
                    content: `${emojis.cancel} Erro ao atualizar mensagem do ticket.`,
                    flags: MessageFlags.Ephemeral,
                  });
                }
              },
            );
          },
        );
      }

      if (customId === "painel_staff") {
        const db = getConfigDB(guild.id);
        const teamRoles = db.get("team") || [];
        const usersPerms = db.get("usersperms") || {};
        const hasTeamRole = member.roles.cache.some((role) =>
          teamRoles.includes(role.id),
        );
        const hasUserPerm = usersPerms[user.id]?.includes("Atender ticket");
        if (!hasTeamRole && !hasUserPerm) {
          return interaction.reply({
            content: `${emojis.cancel} Você não tem permissão para acessar o Painel Staff.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Painel Staff**"),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Selecione uma ação abaixo para gerenciar este ticket:",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("painel_staff_select")
                .setPlaceholder("Selecione uma ação")
                .addOptions([
                  {
                    label: "Assumir ticket",
                    value: "assumir_ticket",
                    emoji: getEmoji(emojis.check),
                  },
                  {
                    label: "Renomear ticket",
                    value: "renomear_ticket",
                    emoji: getEmoji(emojis.title),
                  },
                  {
                    label: "Notificar usuário",
                    value: "notificar_usuario",
                    emoji: getEmoji(emojis.send),
                  },
                  {
                    label: "Criar call",
                    value: "criar_call",
                    emoji: getEmoji(emojis.mic),
                  },
                  {
                    label: "Deletar call",
                    value: "deletar_call",
                    emoji: getEmoji(emojis.lixeira),
                  },
                  {
                    label: "Adicionar membro",
                    value: "adicionar_membro",
                    emoji: getEmoji(emojis.invite),
                  },
                  {
                    label: "Remover membro",
                    value: "remover_membro",
                    emoji: getEmoji(emojis.minus),
                  },
                  {
                    label: "Fechar ticket",
                    value: "fechar_ticket",
                    emoji: getEmoji(emojis.lock),
                  },
                  {
                    label: "Gerenciar tags",
                    value: "gerenciar_tags",
                    emoji: emojis.thread || "🏷️",
                  },
                ]),
            ),
          );
        return interaction.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (
        customId.startsWith("confirmar_adicionar") ||
        customId === "recusar_adicionar"
      ) {
        const guildId = guild.id;
        const dbConfig = getConfigDB(guildId);
        const teamRoles = dbConfig.get("team") || [];
        const usersPerms = dbConfig.get("usersperms") || {};
        const hasTeamRole = member.roles.cache.some((role) =>
          teamRoles.includes(role.id.toString()),
        );
        const hasUserPerm = usersPerms[user.id]?.includes("Atender ticket");
        if (!hasTeamRole && !hasUserPerm) {
          return interaction.reply({
            content: `${emojis.cancel} Você não tem permissão para usar essa ação.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        if (customId === "recusar_adicionar") {
          const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "🚫 A adição de usuários foi cancelada.",
            ),
          );
          return interaction.update({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        }
        if (customId.startsWith("confirmar_adicionar")) {
          const [, usuariosString] = customId.split("|");
          const usuariosIds = usuariosString.split(",");
          try {
            for (const userId of usuariosIds) {
              await channel.permissionOverwrites.edit(userId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
              });
            }
            const container = new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.check} Usuários adicionados: ${usuariosIds
                  .map((id) => `<@${id}>`)
                  .join(", ")}`,
              ),
            );
            return interaction.update({
              components: [container],
              flags: MessageFlags.IsComponentsV2,
            });
          } catch (error) {
            console.error("Erro ao adicionar membros:", error);
            return interaction.reply({
              content: `${emojis.cancel} Ocorreu um erro ao adicionar os usuários.`,
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      }

      if (
        customId.startsWith("confirmar_remover") ||
        customId === "recusar_remover"
      ) {
        const guildId = guild.id;
        const dbConfig = getConfigDB(guildId);
        const teamRoles = dbConfig.get("team") || [];
        const usersPerms = dbConfig.get("usersperms") || {};
        const canal = interaction.channel;
        const hasTeamRole = member.roles.cache.some((role) =>
          teamRoles.includes(role.id.toString()),
        );
        const hasUserPerm = usersPerms[user.id]?.includes("Atender ticket");
        if (!hasTeamRole && !hasUserPerm) {
          return interaction.reply({
            content: `${emojis.cancel} Você não tem permissão para usar essa ação.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        if (customId === "recusar_remover") {
          const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "🚫 A remoção de usuários foi cancelada.",
            ),
          );
          return interaction.update({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          });
        }
        if (customId.startsWith("confirmar_remover")) {
          const [, usuariosString] = customId.split("|");
          const usuariosIds = usuariosString.split(",");
          const autorId = canal.topic?.split("Labz - ")[1];
          const idsPermitidos = usuariosIds.filter((id) => id !== autorId);
          if (idsPermitidos.length === 0) {
            return interaction.reply({
              content: `${emojis.cancel} Não é possível remover o autor do ticket.`,
              flags: MessageFlags.Ephemeral,
            });
          }
          try {
            for (const userId of idsPermitidos) {
              await canal.permissionOverwrites.edit(userId, {
                ViewChannel: false,
                SendMessages: false,
                ReadMessageHistory: false,
                AttachFiles: false,
              });
            }
            const container = new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.check} Usuários removidos: ${idsPermitidos
                  .map((id) => `<@${id}>`)
                  .join(", ")}`,
              ),
            );
            return interaction.update({
              components: [container],
              flags: MessageFlags.IsComponentsV2,
            });
          } catch (error) {
            console.error("Erro ao remover membros:", error);
            return interaction.reply({
              content: `${emojis.cancel} Ocorreu um erro ao remover os usuários.`,
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      }
    }

    if (interaction.isButton() && interaction.customId === "fechar_ticket") {
      const guildId = interaction.guild.id;
      const dbConfig = getConfigDB(guildId);
      const teamRoles = dbConfig.get("team") || [];
      const usersPerms = dbConfig.get("usersperms") || {};
      const member = interaction.member;
      const user = interaction.user;
      const hasTeamRole = member.roles.cache.some((role) =>
        teamRoles.includes(role.id.toString()),
      );
      const permissoesValidas = ["Fechar ticket", "Atender ticket"];
      const hasUserPerm = usersPerms[user.id]?.some((perm) =>
        permissoesValidas.includes(perm),
      );
      if (!hasTeamRole && !hasUserPerm) {
        return interaction.reply({
          content: `${emojis.cancel} Você não tem permissão para fechar este ticket.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      const modal = new ModalBuilder()
        .setCustomId("modal_fechar_ticket")
        .setTitle("Fechar Ticket")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("motivo")
              .setLabel("Motivo do fechamento (opcional)")
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder("Descreva o motivo do fechamento (opcional)")
              .setRequired(false),
          ),
        );
      await interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_sair_ticket_confirmar"
    ) {
      const confirmText = interaction.fields.getTextInputValue("confirmacao");
      if (confirmText.toLowerCase() !== "confirmar") {
        return interaction.reply({
          content: `${emojis.cancel} Você não digitou 'CONFIRMAR'. Cancelado.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      try {
        await interaction.channel.permissionOverwrites.edit(
          interaction.user.id,
          {
            ViewChannel: false,
            SendMessages: false,
            ReadMessageHistory: false,
            AttachFiles: false,
          },
        );

        const dbConfig = getConfigDB(interaction.guild.id);
        const fecharAoSairTicket =
          dbConfig.get("fechar_ao_sair_ticket") ?? false;

        if (fecharAoSairTicket) {
          await fecharTicketAutomaticamente(
            interaction.guild,
            interaction.channel.id,
            "Usuário saiu do ticket",
            interaction.client,
          );
          return interaction.reply({
            content:
              "${emojis.check} Você saiu do ticket e ele foi fechado automaticamente.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const containerSaida = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${emojis.arrowl} **${interaction.user.tag}** saiu do ticket.`,
          ),
          new TextDisplayBuilder().setContent(
            `${emojis.calendario} **Data:** <t:${Math.floor(Date.now() / 1000)}:f>`,
          ),
        );

        await interaction.reply({
          content: `${emojis.check} Você saiu do ticket.`,
          flags: MessageFlags.Ephemeral,
        });

        await interaction.channel.send({
          flags: MessageFlags.IsComponentsV2,
          components: [containerSaida],
        });
      } catch (error) {
        console.error("Erro ao remover permissões:", error);
        return interaction.reply({
          content: `${emojis.cancel} Erro ao sair do ticket.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_renomear_ticket"
    ) {
      const novoNome = interaction.fields.getTextInputValue("novo_nome_ticket");
      const canal = interaction.channel;
      try {
        await canal.setName(novoNome);
        await interaction.reply({
          content: `${emojis.check} Canal renomeado para: \`${novoNome}\``,
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        console.error("Erro ao renomear canal:", err);
        await interaction.reply({
          content: `${emojis.cancel} Ocorreu um erro ao tentar renomear o canal.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_motivo_ticket_")
    ) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const ticketId = interaction.customId.replace("modal_motivo_ticket_", "");
      const motivo = interaction.fields.getTextInputValue("motivo_abertura");

      const guildId = interaction.guildId;
      const personalizacaoPath = path.resolve(
        __dirname,
        `../../../banco/ticket/${guildId}/personalizacao.json`,
      );

      if (!fs.existsSync(personalizacaoPath)) {
        return interaction.editReply({
          content: `${emojis.cancel} Configuração não encontrada.`,
        });
      }

      const db = JSON.parse(fs.readFileSync(personalizacaoPath, "utf-8"));
      const embedData = db.embedprincipal || {};
      const botoes = embedData.botoes || [];
      const selects = embedData.selects || [];

      let foundTicketData = botoes.find((b) => b.id === ticketId);
      if (!foundTicketData) {
        const selectId = ticketId.replace("select_", "");
        foundTicketData = selects.find((s) => s.id === selectId);
      }

      if (!foundTicketData) {
        return interaction.editReply({
          content: `${emojis.cancel} Dados do ticket não encontrados.`,
        });
      }

      await criarTicketComMotivo(interaction, foundTicketData, motivo);
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_fechar_ticket"
    ) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const motivo =
        interaction.fields.getTextInputValue("motivo") || "Não informado.";
      const canal = interaction.channel;
      const guild = interaction.guild;
      const guildId = guild.id;
      const canalId = interaction.channel.id;
      const dbsql = getDBConnection(guildId);

      dbsql.run(
        `UPDATE tickets SET fechado_em = ?, fechado_id = ? WHERE ticket_id = ?`,
        [Date.now(), interaction.user.id, canalId],
        function (err) {
          if (err) {
            console.error("Erro ao fechar ticket no banco:", err);
            closeDB(dbsql);

            const containerErro =
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  "Erro ao fechar o ticket no banco.",
                ),
              );

            return interaction.editReply({
              components: [containerErro],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
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
                      if (err)
                        console.error("Erro ao atualizar contadores:", err);
                    },
                  );
                } else {
                  dbsql.run(
                    `INSERT INTO contadores (guild_id, abertos, assumidos, fechados)
             VALUES (?, 0, 0, 1)`,
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
          const staffTexto = `${interaction.user} (\`${interaction.user.id}\`)`;
          const autorTexto = autorId ? `<@${autorId}>` : "Não identificado";
          const abertoTimestamp = Math.floor(canal.createdTimestamp / 1000);
          const fechadoTimestamp = Math.floor(Date.now() / 1000);
          const abertura = `<t:${abertoTimestamp}:f>`;
          const fechamento = `<t:${fechadoTimestamp}:f>`;
          const msTotal = Date.now() - canal.createdTimestamp;
          const totalMinutos = Math.floor(msTotal / 60000);
          const horas = Math.floor(totalMinutos / 60);
          const minutos = totalMinutos % 60;
          const horatotal = `${
            horas > 0 ? `${horas} hora${horas > 1 ? "s" : ""}` : ""
          }${horas && minutos ? ", " : ""}${minutos} minuto${
            minutos !== 1 ? "s" : ""
          }`;
          const horatotalInterativo = `<t:${abertoTimestamp}:R>`;
          const descricaoProcessada = (
            embedLogsData.descricao || "Registro de fechamento do ticket."
          )
            .replaceAll("{canal}", canalTexto)
            .replaceAll("{staff}", staffTexto)
            .replaceAll("{motivo}", motivo)
            .replaceAll("{user}", autorTexto)
            .replaceAll("{abertura}", abertura)
            .replaceAll("{fechamento}", fechamento)
            .replaceAll("{horatotal}", horatotalInterativo);
          const descricaoUserProcessada = (
            embedLogsUserData.descricao || "Seu ticket foi encerrado."
          )
            .replaceAll("{canal}", canalTexto)
            .replaceAll("{staff}", staffTexto)
            .replaceAll("{motivo}", motivo)
            .replaceAll("{user}", autorTexto)
            .replaceAll("{abertura}", abertura)
            .replaceAll("{fechamento}", fechamento)
            .replaceAll("{horatotal}", horatotalInterativo);
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
                  .replaceAll("{horatotal}", horatotalInterativo),
                inline: field.inline ?? false,
              }))
            : [];
          const containerLogComponents = [
            new TextDisplayBuilder().setContent(
              `# ${embedLogsData.title || `${emojis.file} Registro de Logs`}`,
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
              const attachment = await discordTranscripts.createTranscript(
                interaction.channel,
                {
                  limit: 1000,
                  returnBuffer: false,
                  filename: fileName,
                  footerText: "Labz Application - Transcript",
                  saveImages: false,
                  poweredBy: false,
                },
              );
              const transcriptBuffer = attachment.attachment;
              const transcriptURL = await enviarTranscriptParaAPI(
                transcriptBuffer,
                fileName,
                client,
              );
              const containerUserComponents = [
                new TextDisplayBuilder().setContent(
                  `# ${
                    embedLogsUserData.title ||
                    `${emojis.file} Registro do Ticket Encerrado`
                  }`,
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
              let containerLog =
                new ContainerBuilder().addTextDisplayComponents(
                  ...containerLogComponents,
                );
              let containerUser =
                new ContainerBuilder().addTextDisplayComponents(
                  ...containerUserComponents,
                );

              const dbPersonalizacaoAvaliacao = getPersonalizacaoDB(guildId);
              const config =
                dbPersonalizacaoAvaliacao.get("embedavaliacao") || {};

              const containerAvaliacao =
                new ContainerBuilder().addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `# ${config.title || `${emojis.star} Avalie o Atendimento`}`,
                  ),
                  new TextDisplayBuilder().setContent(
                    config.descricao ||
                      "Sua opinião é muito importante para nós! Selecione quantas estrelas você dá:",
                  ),
                );

              if (config.color) {
                const colorDecimal = hexToDecimal(config.color);
                if (colorDecimal !== null) {
                  containerAvaliacao.setAccentColor(colorDecimal);
                }
              }

              if (config.banner) {
                containerAvaliacao.addMediaGalleryComponents(
                  new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(config.banner),
                  ),
                );
              }

              containerAvaliacao.addActionRowComponents(
                new ActionRowBuilder().addComponents(
                  new StringSelectMenuBuilder()
                    .setCustomId(`avaliacao_estrelas_${guildId}_${canalId}`)
                    .setPlaceholder("Selecione de 1 a 5 estrelas")
                    .addOptions([
                      {
                        label: "⭐ 1 Estrela",
                        value: "1",
                        description: "Péssimo atendimento",
                        emoji: "😞",
                      },
                      {
                        label: "⭐⭐ 2 Estrelas",
                        value: "2",
                        description: "Atendimento ruim",
                        emoji: "😕",
                      },
                      {
                        label: "⭐⭐⭐ 3 Estrelas",
                        value: "3",
                        description: "Atendimento regular",
                        emoji: "😐",
                      },
                      {
                        label: "⭐⭐⭐⭐ 4 Estrelas",
                        value: "4",
                        description: "Bom atendimento",
                        emoji: "😊",
                      },
                      {
                        label: "⭐⭐⭐⭐⭐ 5 Estrelas",
                        value: "5",
                        description: "Atendimento excelente",
                        emoji: "🤩",
                      },
                    ]),
                ),
              );

              let rowLog = null;
              let rowUser = null;
              if (transcriptURL) {
                if (
                  transcriptCfg.staff === true &&
                  Array.isArray(embedLogsData.botoes)
                ) {
                  rowLog = gerarBotoesContainer(
                    embedLogsData.botoes,
                    transcriptURL,
                  );
                  if (rowLog) {
                    containerLog = containerLog.addActionRowComponents(rowLog);
                  }
                }
                if (
                  transcriptCfg.user === true &&
                  Array.isArray(embedLogsUserData.botoes)
                ) {
                  rowUser = gerarBotoesContainer(
                    embedLogsUserData.botoes,
                    transcriptURL,
                  );
                  if (rowUser) {
                    containerUser =
                      containerUser.addActionRowComponents(rowUser);
                  }
                }
              }
              if (logCfg.ativo === true && logCfg.canal) {
                const canalLog = guild.channels.cache.get(logCfg.canal);
                if (canalLog) {
                  await canalLog
                    .send({
                      flags: MessageFlags.IsComponentsV2,
                      components: [containerLog],
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
                    const logAvaliacaoCfg =
                      dbConfig.get("logs.log_avaliacao") || {};
                    const avaliacaoAtiva = logAvaliacaoCfg.ativo === true;

                    const criteriosAtivo =
                      dbConfig.get("avaliacao_criterios_ativo") ?? false;

                    const componentesUnificados = [];

                    const criteriosEAvaliacao = criteriosAtivo && avaliacaoAtiva;

                    if (criteriosEAvaliacao) {
                      const staffId = interaction.user.id;
                      const containerCriterios = new ContainerBuilder()
                        .addTextDisplayComponents(
                          new TextDisplayBuilder().setContent(
                            `${emojis.star || "⭐"} **Avaliação do Atendimento**`,
                          ),
                        )
                        .addSeparatorComponents(new SeparatorBuilder())
                        .addActionRowComponents(
                          new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                              .setCustomId(
                                `aval_criterios_${canalId}_${staffId}_${guildId}`,
                              )
                              .setLabel("Avaliar Atendimento")
                              .setStyle(ButtonStyle.Primary),
                          ),
                        );
                      componentesUnificados.push(containerUser, containerCriterios);
                    } else if (avaliacaoAtiva) {
                      componentesUnificados.push(containerUser, containerAvaliacao);
                    } else {
                      componentesUnificados.push(containerUser);
                    }

                    try {
                      const avalMsg = await membro.send({
                        flags: MessageFlags.IsComponentsV2,
                        components: componentesUnificados,
                      });
                      if (criteriosEAvaliacao || avaliacaoAtiva) {
                        dbConfig.set(`aval_dm_msg_${canalId}`, avalMsg.id);
                      }
                    } catch {}
                  }
                } catch (err) {
                  console.error("Erro ao enviar DM ao usuário:", err);
                }
              }

              const canaisDaCategoria =
                canal.parent?.children?.cache || guild.channels.cache;
              const callExistente = canaisDaCategoria.find(
                (c) =>
                  c.type === ChannelType.GuildVoice && c.name === canal.name,
              );
              if (callExistente) {
                await callExistente.delete().catch(() => {});
              }

              const containerFechamento =
                new ContainerBuilder().addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `${emojis.success} Ticket fechado com sucesso!`,
                  ),
                  new TextDisplayBuilder().setContent(
                    "O canal será deletado em **5 segundos**.",
                  ),
                );

              await interaction.editReply({
                components: [containerFechamento],
                flags: MessageFlags.IsComponentsV2,
              });

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

                if (global.gc && client.stats.commandsExecuted % 5 === 0) {
                  global.gc();
                }
              }, 5000);
            } catch (error) {
              console.error("Erro no processamento do fechamento:", error);

              const containerErroProcessamento =
                new ContainerBuilder().addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    "Erro ao processar fechamento do ticket.",
                  ),
                );

              await interaction.editReply({
                components: [containerErroProcessamento],
                flags: MessageFlags.IsComponentsV2,
              });
            }
          })();
        },
      );
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "painel_staff_select") {
        const selected = interaction.values[0];

        if (selected === "assumir_ticket") {
          const guildId = interaction.guild.id;
          const dbsql = getDBConnection(guildId);
          const member = interaction.member;
          const user = interaction.user;
          const dbConfig = getConfigDB(guildId);
          const teamRoles = dbConfig.get("team") || [];
          const usersPerms = dbConfig.get("usersperms") || {};
          const hasTeamRole = member.roles.cache.some((role) =>
            teamRoles.includes(role.id.toString()),
          );
          const hasUserPerm = usersPerms[user.id]?.includes("Atender ticket");
          if (!hasTeamRole && !hasUserPerm) {
            closeDB(dbsql);
            return interaction.reply({
              content: `${emojis.cancel} Você não tem permissão para assumir este ticket.`,
              flags: MessageFlags.Ephemeral,
            });
          }
          dbsql.run(
            `UPDATE tickets SET assumido_em = ?, staff_id = ? WHERE ticket_id = ?`,
            [Date.now(), user.id, interaction.channel.id],
            async function (err) {
              if (err) {
                console.error("❌ Erro ao atualizar ticket:", err);
                closeDB(dbsql);
                return interaction.reply({
                  content: `${emojis.cancel} Ocorreu um erro ao assumir o ticket.`,
                  flags: MessageFlags.Ephemeral,
                });
              }
              dbsql.run(
                `INSERT INTO contadores (guild_id, abertos, assumidos, fechados)
 VALUES (?, 0, 1, 0)
 ON CONFLICT(guild_id) DO UPDATE SET assumidos = assumidos + 1`,
                [interaction.guildId],
                function (err) {
                  if (err) {
                    console.error(
                      "❌ Erro ao atualizar contadores de assumidos:",
                      err,
                    );
                  }
                },
              );
              const db = getPersonalizacaoDB(guildId);
              const embedConfig = db.get("embedticket") || {};

              if (!embedConfig.botoes) {
                embedConfig.botoes = [];
              }

              const fecharTicketBotaoIndex = embedConfig.botoes.findIndex(
                (btn) => btn.id === "fechar_ticket",
              );
              if (fecharTicketBotaoIndex === -1) {
                embedConfig.botoes.push({
                  id: "fechar_ticket",
                  nome: "Fechar Ticket",
                  style: "Secondary",
                  emoji: emojis.lock || "<:lock:1404161355874828398>",
                  cor: "Secondary",
                });
                db.set("embedticket", embedConfig);
              }

              const canal = interaction.channel;
              dbsql.get(
                `SELECT message_id, motivo_abertura, nome_categoria FROM tickets WHERE ticket_id = ?`,
                [canal.id],
                async (err, row) => {
                  closeDB(dbsql);
                  if (err || !row?.message_id) {
                    return interaction.reply({
                      content:
                        "${emojis.cancel} Não foi possível localizar a mensagem principal do ticket.",
                      flags: MessageFlags.Ephemeral,
                    });
                  }
                  try {
                    const msgOriginal = await canal.messages.fetch(
                      row.message_id,
                    );
                    if (!msgOriginal) {
                      return interaction.reply({
                        content: `${emojis.cancel} Mensagem do ticket não encontrada.`,
                        flags: MessageFlags.Ephemeral,
                      });
                    }

                    const containerAtual = msgOriginal.components[0];
                    const textDisplays = containerAtual?.components?.filter(
                      (comp) => comp.type === "TEXT_DISPLAY",
                    );
                    let jaAssumido = false;
                    if (textDisplays) {
                      for (const textDisplay of textDisplays) {
                        if (
                          textDisplay.text &&
                          textDisplay.text.includes("<@") &&
                          !textDisplay.text.includes("ainda não assumido")
                        ) {
                          jaAssumido = true;
                          break;
                        }
                      }
                    }
                    if (jaAssumido) {
                      return interaction.reply({
                        content:
                          "${emojis.cancel} Este ticket já foi assumido por outra pessoa.",
                        flags: MessageFlags.Ephemeral,
                      });
                    }

                    const staffMention = user.toString();
                    const rawDescription = embedConfig.descricao || "";
                    const channel = interaction.channel;
                    const autorMention = `<@${
                      channel.topic.split("Labz - ")[1]
                    }>`;
                    const aberturaTimestamp = `<t:${Math.floor(
                      channel.createdTimestamp / 1000,
                    )}:f>`;

                    let novaDescricao = rawDescription
                      .replace(/{staff}/g, staffMention)
                      .replace(/{user}/g, autorMention)
                      .replace(/{abertura}/g, aberturaTimestamp)
                      .replace(
                        /{motivo}/g,
                        row.motivo_abertura || "Não informado",
                      )
                      .replace(
                        /{categoria}/g,
                        row.nome_categoria || "Não especificada",
                      );

                    function parseEmojiLocal(raw, guild) {
                      if (!raw) return null;

                      const unicodeRegex =
                        /^[\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u;
                      if (unicodeRegex.test(raw)) {
                        return { name: raw };
                      }

                      const match = raw.match(/<(a)?:(\w+):(\d+)>/);
                      if (match) {
                        const emojiId = match[3];
                        if (guild && guild.emojis.cache.has(emojiId)) {
                          return {
                            id: emojiId,
                            name: match[2],
                            animated: !!match[1],
                          };
                        }
                        return null;
                      }

                      const cleanName = raw.replace(/:/g, "").trim();
                      const foundEmoji = guild?.emojis.cache.find(
                        (e) => e.name === cleanName,
                      );
                      if (foundEmoji) {
                        return {
                          id: foundEmoji.id,
                          name: foundEmoji.name,
                          animated: foundEmoji.animated,
                        };
                      }

                      return null;
                    }

                    const botoesEmbed = embedConfig.botoes || [];
                    const botoesFormatados = botoesEmbed
                      .filter((btn) => btn.id !== "assumir_ticket")
                      .map((btn) => {
                        const button = new ButtonBuilder()
                          .setCustomId(btn.id)
                          .setLabel(btn.nome)
                          .setStyle(
                            ButtonStyle[btn.style?.toUpperCase()] ||
                              ButtonStyle.Secondary,
                          );

                        if (btn.emoji) {
                          try {
                            const emojiObj = parseEmojiLocal(
                              btn.emoji,
                              interaction.guild,
                            );
                            if (emojiObj) {
                              if (emojiObj.id) {
                                button.setEmoji({
                                  id: emojiObj.id,
                                  name: emojiObj.name,
                                  animated: emojiObj.animated || false,
                                });
                              } else if (emojiObj.name) {
                                button.setEmoji(emojiObj.name);
                              }
                            } else {
                              button.setEmoji(btn.emoji);
                            }
                          } catch (error) {
                            console.error(
                              "Erro ao processar emoji do botão:",
                              error,
                            );
                            button.setEmoji(btn.emoji);
                          }
                        }

                        return button;
                      });

                    const containerComponents = [
                      new TextDisplayBuilder().setContent(
                        `# ${embedConfig.title || `${emojis.textc} Suporte`}`,
                      ),
                    ];

                    if (novaDescricao && novaDescricao.trim().length > 0) {
                      containerComponents.push(
                        new TextDisplayBuilder().setContent(novaDescricao),
                      );
                    }

                    const container =
                      new ContainerBuilder().addTextDisplayComponents(
                        ...containerComponents,
                      );

                    if (embedConfig.color) {
                      const colorDecimal = hexToDecimal(embedConfig.color);
                      if (colorDecimal !== null) {
                        container.setAccentColor(colorDecimal);
                      }
                    }

                    if (
                      embedConfig.banner &&
                      typeof embedConfig.banner === "string" &&
                      embedConfig.banner.startsWith("http")
                    ) {
                      container.addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                          new MediaGalleryItemBuilder().setURL(
                            embedConfig.banner,
                          ),
                        ),
                      );
                    }

                    for (let i = 0; i < botoesFormatados.length; i += 5) {
                      container.addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                          ...botoesFormatados.slice(i, i + 5),
                        ),
                      );
                    }

                    await msgOriginal.edit({
                      components: [container],
                      flags: MessageFlags.IsComponentsV2,
                    });

                    let _resumoContainer2 = null;
                    try {
                      const {
                        getIAConfigDB,
                      } = require("../../events/ticket/ia-ticket");
                      const iaDB = getIAConfigDB(guildId);
                      const resumoAtivo =
                        iaDB.get("resumo_ao_assumir") ?? false;
                      if (resumoAtivo) {
                        const {
                          gerarResumoAoAssumir,
                        } = require("../../events/ticket/resumo-assumir");
                        _resumoContainer2 = await gerarResumoAoAssumir(
                          client,
                          guildId,
                          canal.id,
                          user.id,
                        );
                      }
                    } catch {}

                    const _assumidoComponents2 = [
                      new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                          `${emojis.check} **Ticket assumido.**`,
                        ),
                      ),
                    ];
                    if (_resumoContainer2)
                      _assumidoComponents2.push(_resumoContainer2);

                    return interaction.reply({
                      components: _assumidoComponents2,
                      flags:
                        MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                    });
                  } catch (error) {
                    console.error("Erro ao buscar ou editar mensagem:", error);
                    return interaction.reply({
                      content: `${emojis.cancel} Erro ao atualizar mensagem do ticket.`,
                      flags: MessageFlags.Ephemeral,
                    });
                  }
                },
              );
            },
          );
        }

        if (selected === "renomear_ticket") {
          const guildId = interaction.guild.id;
          const dbConfig = getConfigDB(guildId);
          const teamRoles = dbConfig.get("team") || [];
          const usersPerms = dbConfig.get("usersperms") || {};
          const member = interaction.member;
          const user = interaction.user;
          const hasTeamRole = member.roles.cache.some((role) =>
            teamRoles.includes(role.id.toString()),
          );
          const hasUserPerm = usersPerms[user.id]?.includes("Atender ticket");
          if (!hasTeamRole && !hasUserPerm) {
            return interaction.reply({
              content: `${emojis.cancel} Você não tem permissão para renomear este ticket.`,
              flags: MessageFlags.Ephemeral,
            });
          }
          const modal = new ModalBuilder()
            .setCustomId("modal_renomear_ticket")
            .setTitle("🏷️ Renomear Ticket")
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("novo_nome_ticket")
                  .setLabel("Novo nome do canal")
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder("Digite o novo nome do canal...")
                  .setRequired(true)
                  .setMaxLength(50),
              ),
            );
          await interaction.showModal(modal);
        }

        if (selected === "notificar_usuario") {
          const canal = interaction.channel;
          const guild = interaction.guild;
          const topic = canal.topic || "";
          const autorId = topic.split("Labz - ")[1];

          if (!autorId)
            return interaction.reply({
              content: `${emojis.cancel} Não foi possível identificar o autor do ticket.`,
              flags: MessageFlags.Ephemeral,
            });

          const membroAutor = await guild.members
            .fetch(autorId)
            .catch(() => null);

          if (!membroAutor)
            return interaction.reply({
              content:
                "${emojis.cancel} Não foi possível localizar o membro que abriu o ticket.",
              flags: MessageFlags.Ephemeral,
            });

          const staff = interaction.user;
          const db = getPersonalizacaoDB(guild.id);
          const config = db.get("embednotificar") || {};
          const title = config.title || "Sem título definido";
          const descricao = config.descricao || "Sem descrição definida";

          const containerComponents = [
            new TextDisplayBuilder().setContent(
              `# ${title
                .replace("{staff}", `<@${staff.id}>`)
                .replace("{canal}", `<#${canal.id}>`)
                .replace("{user}", `<@${membroAutor.id}>`)}`,
            ),
            new TextDisplayBuilder().setContent(
              descricao
                .replace("{staff}", `<@${staff.id}>`)
                .replace("{canal}", `<#${canal.id}>`)
                .replace("{user}", `<@${membroAutor.id}>`),
            ),
          ];

          const containerCanal =
            new ContainerBuilder().addTextDisplayComponents(
              ...containerComponents,
            );

          if (isValidUrl(config.banner)) {
            containerCanal.addMediaGalleryComponents(
              new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(config.banner.trim()),
              ),
            );
          }

          if (config.color) {
            const colorDecimal = hexToDecimal(config.color);
            if (colorDecimal !== null) {
              containerCanal.setAccentColor(colorDecimal);
            }
          }

          const containerDM = new ContainerBuilder().addTextDisplayComponents(
            ...containerComponents,
          );

          if (isValidUrl(config.banner)) {
            containerDM.addMediaGalleryComponents(
              new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(config.banner.trim()),
              ),
            );
          }

          if (config.color) {
            const colorDecimal = hexToDecimal(config.color);
            if (colorDecimal !== null) {
              containerDM.setAccentColor(colorDecimal);
            }
          }

          const botaoLink = new ButtonBuilder()
            .setLabel(config.botoes?.[0]?.nome || "Ir ao Ticket")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/channels/${guild.id}/${canal.id}`);

          if (config.botoes?.[0]?.emoji) {
            botaoLink.setEmoji(config.botoes[0].emoji);
          }

          containerDM.addActionRowComponents(
            new ActionRowBuilder().addComponents(botaoLink),
          );

          try {
            await canal.send({
              flags: MessageFlags.IsComponentsV2,
              components: [containerCanal],
            });
          } catch (err) {
            console.error("Erro ao enviar container no canal:", err);
            await interaction.reply({
              content: `${emojis.cancel} Falha ao enviar notificação no canal.`,
              flags: MessageFlags.Ephemeral,
            });
          }

          try {
            await membroAutor.send({
              flags: MessageFlags.IsComponentsV2,
              components: [containerDM],
            });
          } catch {
            canal.send(
              `⚠️ ${staff}, não foi possível enviar uma DM para <@${autorId}>.`,
            );
          }

          if (!interaction.replied)
            await interaction.deferUpdate().catch(() => {});
        }

        if (selected === "criar_call") {
          const canalTexto = interaction.channel;
          const guild = interaction.guild;
          const categoriaId = canalTexto.parentId;
          const nomeCall = canalTexto.name;
          const callExistente = guild.channels.cache.find(
            (c) =>
              c.type === ChannelType.GuildVoice &&
              c.name === nomeCall &&
              c.parentId === categoriaId,
          );
          if (callExistente) {
            return interaction.reply({
              content: `${emojis.cancel} Já existe uma call criada para este ticket.`,
              flags: MessageFlags.Ephemeral,
            });
          }

          const overwritesCall = [
            {
              id: guild.id,
              deny: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
              ],
            },
          ];

          const visualizadores = canalTexto.permissionOverwrites.cache.filter(
            (perm) => {
              return perm.allow.has(PermissionsBitField.Flags.ViewChannel);
            },
          );

          for (const [id, perm] of visualizadores) {
            overwritesCall.push({
              id,
              allow: [
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.Stream,
                PermissionsBitField.Flags.UseEmbeddedActivities,
                PermissionsBitField.Flags.UseVAD,
                PermissionsBitField.Flags.ViewChannel,
              ],
            });
          }

          const canalVoz = await guild.channels.create({
            name: nomeCall,
            type: ChannelType.GuildVoice,
            parent: categoriaId,
            permissionOverwrites: overwritesCall,
            reason: `Call criada para o ticket ${canalTexto.name}`,
          });

          await interaction.reply({
            content: `${emojis.voicec || "📞"} Call criada com sucesso: <#${canalVoz.id}>`,
          });
        }

        if (selected === "deletar_call") {
          const canalTexto = interaction.channel;
          const guild = interaction.guild;
          const nomeCall = canalTexto.name;
          const categoriaId = canalTexto.parentId;
          const call = guild.channels.cache.find(
            (c) =>
              c.type === ChannelType.GuildVoice &&
              c.name === nomeCall &&
              c.parentId === categoriaId,
          );
          if (!call) {
            return interaction.reply({
              content: `${emojis.cancel} Nenhuma call foi encontrada para este ticket.`,
              flags: MessageFlags.Ephemeral,
            });
          }
          await call.delete("Call do ticket removida pelo painel staff");
          return interaction.reply({
            content: `A call foi deletada com sucesso.`,
          });
        }

        if (selected === "adicionar_membro") {
          const canal = interaction.channel;
          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.user} Selecione os membros que você deseja adicionar diretamente ao ticket:`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId("select_usuarios_adicionar_direto")
                  .setPlaceholder("Selecione os usuários para adicionar")
                  .setMinValues(1)
                  .setMaxValues(25),
              ),
            );
          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [container],
          });
        }

        if (selected === "remover_membro") {
          const canal = interaction.channel;
          const topic = canal.topic || "";
          const autorId = topic.split("Labz - ")[1];
          if (!autorId) {
            return interaction.reply({
              content: `${emojis.cancel} Não foi possível identificar o autor do ticket.`,
              flags: MessageFlags.Ephemeral,
            });
          }
          const container = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.minus} Selecione os membros para remover do ticket (o autor <@${autorId}> não pode ser removido).`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId("select_usuarios_remover_direto")
                  .setPlaceholder("Selecione os usuários para remover")
                  .setMinValues(1)
                  .setMaxValues(25),
              ),
            );
          await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [container],
          });
        }

        if (selected === "fechar_ticket") {
          const modal = new ModalBuilder()
            .setCustomId("modal_fechar_ticket")
            .setTitle("Motivo do fechamento (opcional)")
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("motivo")
                  .setLabel("Descreva o motivo do fechamento (opcional)")
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(false)
                  .setPlaceholder("Ex: Ticket resolvido, sem resposta, etc."),
              ),
            );
          return await interaction.showModal(modal);
        }

        if (selected === "gerenciar_tags") {
          const channelId = interaction.channel.id;
          const tagsModule = require("./tags");
          const fakeInteraction = Object.create(interaction);
          fakeInteraction.customId = `ticket_tags_${channelId}`;
          return tagsModule.execute(client, fakeInteraction);
        }
      }
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "painel_membro_menu"
    ) {
      const selected = interaction.values[0];

      const permissao = interaction.channel.permissionOverwrites.cache.get(
        interaction.user.id,
      );
      const podeVer = permissao?.allow?.has(
        PermissionsBitField.Flags.ViewChannel,
      );

      if (!podeVer) {
        return interaction.reply({
          content: `${emojis.cancel} Apenas quem abriu o ticket pode usar esse painel.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (selected === "sair_ticket") {
        const modal = new ModalBuilder()
          .setCustomId("modal_sair_ticket_confirmar")
          .setTitle(`Confirmar saída do ticket`)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("confirmacao")
                .setLabel("Digite 'CONFIRMAR' para sair")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder("CONFIRMAR"),
            ),
          );

        return await interaction.showModal(modal);
      }

      if (selected === "notificar_staff") {
        const guildId = interaction.guild.id;
        const canalId = interaction.channel.id;
        const dbsql = getDBConnection(guildId);

        dbsql.get(
          `SELECT staff_id FROM tickets WHERE ticket_id = ?`,
          [canalId],
          async (err, row) => {
            closeDB(dbsql);

            if (err) {
              console.error("Erro ao buscar staff do ticket:", err);
              return interaction.reply({
                content: `${emojis.cancel} Erro ao buscar informações do ticket.`,
                flags: MessageFlags.Ephemeral,
              });
            }

            const staffId = row?.staff_id;

            if (!staffId) {
              return interaction.reply({
                content: `${emojis.cancel} Nenhum staff assumiu este ticket ainda.`,
                flags: MessageFlags.Ephemeral,
              });
            }

            const staffUser = await interaction.guild.members
              .fetch(staffId)
              .catch(() => null);

            if (!staffUser) {
              return interaction.reply({
                content:
                  "${emojis.cancel} Não foi possível encontrar o staff que assumiu o ticket.",
                flags: MessageFlags.Ephemeral,
              });
            }

            await interaction.reply({
              content: `${emojis.bell} <@${staffId}>, você foi notificado pelo usuário ${interaction.user} neste ticket.`,
            });
          },
        );
      }

      if (selected === "adicionar_membro") {
        const userSelectMenu = new UserSelectMenuBuilder()
          .setCustomId("select_usuarios_adicionar")
          .setPlaceholder("Selecione os usuários para adicionar")
          .setMinValues(1)
          .setMaxValues(25);

        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Selecione os usuários que deseja adicionar ao ticket:",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(userSelectMenu),
          );

        await interaction.update({
          flags: MessageFlags.IsComponentsV2,
          components: [container],
        });
      }

      if (selected === "remover_membro") {
        const canal = interaction.channel;

        const topic = canal.topic || "";
        const autorId = topic.split("Labz - ")[1];

        if (!autorId) {
          return interaction.reply({
            content: `${emojis.cancel} Não foi possível identificar o autor do ticket.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const select = new UserSelectMenuBuilder()
          .setCustomId("select_usuarios_remover")
          .setPlaceholder("Selecione os usuários para remover")
          .setMinValues(1)
          .setMaxValues(5);

        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Selecione os membros que você deseja remover (o autor do ticket <@${autorId}> não pode ser removido).`,
            ),
          )
          .addActionRowComponents(new ActionRowBuilder().addComponents(select));

        await interaction.update({
          flags: MessageFlags.IsComponentsV2,
          components: [container],
        });
      }
    }

    if (
      interaction.isUserSelectMenu() &&
      interaction.customId === "select_usuarios_adicionar"
    ) {
      const usuariosSelecionados = interaction.values;

      if (usuariosSelecionados.length === 0) {
        return interaction.reply({
          content: `${emojis.cancel} Você deve selecionar pelo menos um usuário.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const descricao = usuariosSelecionados.map((id) => `<@${id}>`).join("\n");

      const btnAdicionar = new ButtonBuilder()
        .setCustomId(`confirmar_adicionar|${usuariosSelecionados.join(",")}`)
        .setLabel("Adicionar usuários")
        .setStyle(ButtonStyle.Success);

      const btnRecusar = new ButtonBuilder()
        .setCustomId("recusar_adicionar")
        .setLabel("Recusar usuários")
        .setStyle(ButtonStyle.Danger);

      const containerConfirm = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "**Confirmação de usuários a adicionar**\n\n" +
              descricao +
              `\n\n*Selecionados por ${interaction.user.tag}*`,
          ),
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(btnAdicionar, btnRecusar),
        );

      await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Solicitação de adição de membro enviada.",
            ),
          ),
        ],
      });

      await interaction.channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Confirme se deseja adicionar os seguintes usuários:",
            ),
          ),
          containerConfirm,
        ],
      });
    }

    if (
      interaction.isUserSelectMenu() &&
      interaction.customId === "select_usuarios_remover"
    ) {
      const usuariosSelecionados = interaction.values;
      const canal = interaction.channel;

      const topic = canal.topic || "";
      const autorId = topic.split("Labz - ")[1];

      const paraRemover = usuariosSelecionados.filter((id) => id !== autorId);

      if (paraRemover.length === 0) {
        return interaction.reply({
          content: `${emojis.cancel} Você não pode remover o autor do ticket.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const dbConfig = getConfigDB(interaction.guild.id);
      const teamRoles = dbConfig.get("team") || [];
      const usersPerms = dbConfig.get("usersperms") || {};

      const descricao = paraRemover.map((id) => `<@${id}>`).join("\n");

      const btnRemover = new ButtonBuilder()
        .setCustomId(`confirmar_remover|${paraRemover.join(",")}`)
        .setLabel("Remover usuários")
        .setStyle(ButtonStyle.Danger);

      const btnRecusar = new ButtonBuilder()
        .setCustomId("recusar_remover")
        .setLabel("Cancelar")
        .setStyle(ButtonStyle.Secondary);

      const containerConfirm = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "**Confirmação de remoção de usuários**\n\n" +
              descricao +
              `\n\n*Solicitado por ${interaction.user.tag}*`,
          ),
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(btnRemover, btnRecusar),
        );

      await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "${emojis.check} Solicitação de remoção enviada para aprovação...",
            ),
          ),
        ],
      });

      await canal.send({
        flags: MessageFlags.IsComponentsV2,
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "${emojis.bell} Uma solicitação de remoção foi enviada. Apenas membros autorizados podem aprovar ou recusar.",
            ),
          ),
          containerConfirm,
        ],
      });
    }

    if (
      interaction.isUserSelectMenu() &&
      interaction.customId === "select_usuarios_adicionar_direto"
    ) {
      const usuariosSelecionados = interaction.values;
      const canal = interaction.channel;

      if (!usuariosSelecionados.length) {
        return interaction.reply({
          content: `${emojis.cancel} Você precisa selecionar pelo menos um usuário.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const permissoes = {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      };

      try {
        for (const userId of usuariosSelecionados) {
          await canal.permissionOverwrites.edit(userId, permissoes);
        }

        const containerConfirm =
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${emojis.check} Membros adicionados ao ticket**\n\nOs seguintes usuários foram adicionados ao ticket:\n\n${usuariosSelecionados
                .map((id) => `<@${id}>`)
                .join("\n")}\n\n*Adicionados por ${interaction.user}*`,
            ),
          );

        await interaction.update({
          flags: MessageFlags.IsComponentsV2,
          components: [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.check} Membros adicionados com sucesso ao ticket.`,
              ),
            ),
          ],
        });

        await canal.send({
          flags: MessageFlags.IsComponentsV2,
          components: [containerConfirm],
        });
      } catch (err) {
        console.error("Erro ao adicionar membros:", err);
        return interaction.reply({
          content: `${emojis.cancel} Ocorreu um erro ao adicionar os usuários ao ticket.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    if (
      interaction.isUserSelectMenu() &&
      interaction.customId === "select_usuarios_remover_direto"
    ) {
      const usuariosSelecionados = interaction.values;
      const canal = interaction.channel;

      const topic = canal.topic || "";
      const autorId = topic.split("Labz - ")[1];

      const paraRemover = usuariosSelecionados.filter((id) => id !== autorId);

      if (paraRemover.length === 0) {
        return interaction.reply({
          content: `${emojis.cancel} Você não pode remover o autor do ticket.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        for (const userId of paraRemover) {
          await canal.permissionOverwrites.edit(userId, {
            ViewChannel: false,
            SendMessages: false,
            ReadMessageHistory: false,
            AttachFiles: false,
            Connect: false,
            Speak: false,
            Stream: false,
          });
        }

        const containerConfirm =
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${emojis.minus} Membros removidos do ticket**\n\nOs seguintes usuários foram removidos:\n\n${paraRemover
                .map((id) => `<@${id}>`)
                .join("\n")}\n\n*Removidos por ${interaction.user}*`,
            ),
          );

        await interaction.update({
          flags: MessageFlags.IsComponentsV2,
          components: [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.check} Membros removidos com sucesso do ticket.`,
              ),
            ),
          ],
        });

        await canal.send({
          flags: MessageFlags.IsComponentsV2,
          components: [containerConfirm],
        });
      } catch (err) {
        console.error("Erro ao remover usuários:", err);
        return interaction.reply({
          content: `${emojis.cancel} Ocorreu um erro ao remover os usuários.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // === FIM SELECTMENU ===

    // === PROCESSO CRIAÇÃO DE TICKET ===

    async function fecharTicketAutomaticamente(
      guild,
      channelId,
      motivo,
      client,
    ) {
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
                      if (err)
                        console.error("Erro ao atualizar contadores:", err);
                    },
                  );
                } else {
                  dbsql.run(
                    `INSERT INTO contadores (guild_id, abertos, assumidos, fechados)
             VALUES (?, 0, 0, 1)`,
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
          const horatotal = `${
            horas > 0 ? `${horas} hora${horas > 1 ? "s" : ""}` : ""
          }${horas && minutos ? ", " : ""}${minutos} minuto${
            minutos !== 1 ? "s" : ""
          }`;

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
              `# ${embedLogsData.title || `${emojis.file} Registro de Logs`}`,
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
              const attachment = await discordTranscripts.createTranscript(
                canal,
                {
                  limit: 1000,
                  returnBuffer: false,
                  filename: fileName,
                  footerText: "Labz Application - Transcript",
                  saveImages: false,
                  poweredBy: false,
                },
              );

              const transcriptBuffer = attachment.attachment;
              const transcriptURL = await enviarTranscriptParaAPI(
                transcriptBuffer,
                fileName,
                client,
              );

              const containerUserComponents = [
                new TextDisplayBuilder().setContent(
                  `# ${
                    embedLogsUserData.title ||
                    `${emojis.file} Registro do Ticket Encerrado`
                  }`,
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

              let containerLog =
                new ContainerBuilder().addTextDisplayComponents(
                  ...containerLogComponents,
                );
              let containerUser =
                new ContainerBuilder().addTextDisplayComponents(
                  ...containerUserComponents,
                );

              let rowLog = null;
              let rowUser = null;

              if (transcriptURL) {
                if (
                  transcriptCfg.staff === true &&
                  Array.isArray(embedLogsData.botoes)
                ) {
                  rowLog = gerarBotoesContainer(
                    embedLogsData.botoes,
                    transcriptURL,
                  );
                  if (rowLog) {
                    containerLog = containerLog.addActionRowComponents(rowLog);
                  }
                }

                if (
                  transcriptCfg.user === true &&
                  Array.isArray(embedLogsUserData.botoes)
                ) {
                  rowUser = gerarBotoesContainer(
                    embedLogsUserData.botoes,
                    transcriptURL,
                  );
                  if (rowUser) {
                    containerUser =
                      containerUser.addActionRowComponents(rowUser);
                  }
                }
              }

              if (logCfg.ativo === true && logCfg.canal) {
                const canalLog = guild.channels.cache.get(logCfg.canal);
                if (canalLog) {
                  await canalLog
                    .send({
                      flags: MessageFlags.IsComponentsV2,
                      components: [containerLog],
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
                      })
                      .catch(() => {});
                  }
                } catch (err) {}
              }

              const canaisDaCategoria =
                canal.parent?.children?.cache || guild.channels.cache;
              const callExistente = canaisDaCategoria.find(
                (c) =>
                  c.type === ChannelType.GuildVoice && c.name === canal.name,
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

                if (global.gc && client.stats.commandsExecuted % 5 === 0) {
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

    // === HANDLERS PARA ESTAÇÕES ===

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("ticket_estacao_botoes_")
    ) {
      const parts = interaction.customId.split("_");
      const estacaoId = parts[3];
      const botaoId = parts[4];

      const estacao = getEstacao(interaction.guildId, estacaoId);
      if (!estacao) {
        return interaction.reply({
          content: `${emojis.cancel} Estação não encontrada.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const botoes = estacao.embedprincipal.botoes || [];
      const botao = botoes.find((b) => b.id === botaoId);

      if (!botao) {
        return interaction.reply({
          content: `${emojis.cancel} Botão não encontrado.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      botao.estacaoId = estacaoId;

      const configDB = getConfigDB(interaction.guildId);
      const systemStatus = configDB.get("system") ?? true;

      if (!systemStatus) {
        return interaction.reply({
          content: `${emojis.cancel} O sistema de tickets está desativado no momento.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (isBlacklisted(interaction.guildId, interaction.user.id, interaction.member?.roles)) {
        return interaction.reply({
          content: `${emojis.block} Você está na blacklist e não pode abrir tickets neste servidor.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      let _horarioAtivo = configDB.get("horario_ativo");
      let _schedule = configDB.get("schedule") || {};
      const _estacaoCheck = getEstacao(interaction.guildId, estacaoId);
      if (_estacaoCheck && _estacaoCheck.horario_ativo) {
        _horarioAtivo = true;
        _schedule = _estacaoCheck.schedule || {};
      }

      if (!isWithinSchedule(_schedule, _horarioAtivo)) {
        const _msg =
          (_estacaoCheck && _estacaoCheck.mensagem_fora_horario) ||
          `${emojis.cancel} O sistema de tickets está fechado neste horário. Tente novamente durante o expediente.`;
        return interaction.reply({
          content: _msg,
          flags: MessageFlags.Ephemeral,
        });
      }

      const solicitarMotivo = configDB.get("solicitar_motivo") ?? false;

      const _modalFormulario = criarModalFormulario(
        estacao,
        `modal_form_estacao_${estacaoId}_${botaoId}`,
      );
      if (_modalFormulario) {
        _modalFormulario.setCustomId(
          `submit_form_estacao_${estacaoId}_${botaoId}`,
        );
        return interaction.showModal(_modalFormulario);
      }

      if (solicitarMotivo) {
        const modal = new ModalBuilder()
          .setCustomId(`modal_motivo_estacao_${estacaoId}_${botaoId}`)
          .setTitle("Motivo do Ticket");

        const motivoInput = new TextInputBuilder()
          .setCustomId("motivo_abertura")
          .setLabel("Por que você está abrindo este ticket?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
        return interaction.showModal(modal);
      }

      await criarTicketComMotivo(interaction, botao, null);
      return;
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("ticket_estacao_select_")
    ) {
      const estacaoId = interaction.customId.replace(
        "ticket_estacao_select_",
        "",
      );
      const selectId = interaction.values[0].replace("select_", "");

      const estacao = getEstacao(interaction.guildId, estacaoId);
      if (!estacao) {
        return interaction.reply({
          content: `${emojis.cancel} Estação não encontrada.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const selects = estacao.embedprincipal.selects || [];
      const selectObj = selects.find((s) => s.id === selectId);

      if (!selectObj) {
        return interaction.reply({
          content: `${emojis.cancel} Opção não encontrada.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      selectObj.estacaoId = estacaoId;

      const configDB = getConfigDB(interaction.guildId);
      const systemStatus = configDB.get("system") ?? true;

      if (!systemStatus) {
        return interaction.reply({
          content: `${emojis.cancel} O sistema de tickets está desativado no momento.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (isBlacklisted(interaction.guildId, interaction.user.id, interaction.member?.roles)) {
        return interaction.reply({
          content: `${emojis.block} Você está na blacklist e não pode abrir tickets neste servidor.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      let _horarioAtivoSel = configDB.get("horario_ativo");
      let _scheduleSel = configDB.get("schedule") || {};
      const _estacaoCheckSel = getEstacao(interaction.guildId, estacaoId);
      if (_estacaoCheckSel && _estacaoCheckSel.horario_ativo) {
        _horarioAtivoSel = true;
        _scheduleSel = _estacaoCheckSel.schedule || {};
      }

      if (!isWithinSchedule(_scheduleSel, _horarioAtivoSel)) {
        const _msgSel =
          (_estacaoCheckSel && _estacaoCheckSel.mensagem_fora_horario) ||
          `${emojis.cancel} O sistema de tickets está fechado neste horário. Tente novamente durante o expediente.`;
        return interaction.reply({
          content: _msgSel,
          flags: MessageFlags.Ephemeral,
        });
      }

      const solicitarMotivo = configDB.get("solicitar_motivo") ?? false;

      if (solicitarMotivo) {
        const modal = new ModalBuilder()
          .setCustomId(`modal_motivo_estacao_select_${estacaoId}_${selectId}`)
          .setTitle("Motivo do Ticket");

        const motivoInput = new TextInputBuilder()
          .setCustomId("motivo_abertura")
          .setLabel("Por que você está abrindo este ticket?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
        return interaction.showModal(modal);
      }

      await criarTicketComMotivo(interaction, selectObj, null);
      return;
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_motivo_estacao_")
    ) {
      const parts = interaction.customId.split("_");

      if (parts.includes("select")) {
        const estacaoId = parts[4];
        const selectId = parts[5];
        const motivo = interaction.fields.getTextInputValue("motivo_abertura");

        const estacao = getEstacao(interaction.guildId, estacaoId);
        if (!estacao) {
          return interaction.reply({
            content: `${emojis.cancel} Estação não encontrada.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const selects = estacao.embedprincipal.selects || [];
        const selectObj = selects.find((s) => s.id === selectId);

        if (!selectObj) {
          return interaction.reply({
            content: `${emojis.cancel} Opção não encontrada.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        await criarTicketComMotivo(interaction, selectObj, motivo);
      } else {
        const estacaoId = parts[3];
        const botaoId = parts[4];
        const motivo = interaction.fields.getTextInputValue("motivo_abertura");

        const estacao = getEstacao(interaction.guildId, estacaoId);
        if (!estacao) {
          return interaction.reply({
            content: `${emojis.cancel} Estação não encontrada.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const botoes = estacao.embedprincipal.botoes || [];
        const botao = botoes.find((b) => b.id === botaoId);

        if (!botao) {
          return interaction.reply({
            content: `${emojis.cancel} Botão não encontrado.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        await criarTicketComMotivo(interaction, botao, motivo);
      }
      return;
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("submit_form_estacao_")
    ) {
      const _parts = interaction.customId
        .replace("submit_form_estacao_", "")
        .split("_");
      const _estacaoIdForm = _parts[0];
      const _botaoIdForm = _parts[1];

      const _estacaoForm = getEstacao(interaction.guildId, _estacaoIdForm);
      if (!_estacaoForm) {
        return interaction.reply({
          content: `${emojis.cancel} Estação não encontrada.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const _botaoForm = (_estacaoForm.embedprincipal.botoes || []).find(
        (b) => b.id === _botaoIdForm,
      );
      if (!_botaoForm) {
        return interaction.reply({
          content: `${emojis.cancel} Botão não encontrado.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const _campos = _estacaoForm.formulario_campos || [];
      const _respostas = _campos.map((c) => ({
        label: c.label,
        valor: interaction.fields.getTextInputValue(`campo_${c.id}`).trim(),
      }));
      if (!global._formRespostas) global._formRespostas = new Map();
      global._formRespostas.set(interaction.user.id, {
        estacaoId: _estacaoIdForm,
        respostas: _respostas,
      });

      _botaoForm.estacaoId = _estacaoIdForm;
      await criarTicketComMotivo(interaction, _botaoForm, null);
      return;
    }

    // === FIM HANDLERS ESTAÇÕES ===

    if (interaction.isButton()) {
      if (!interaction.customId.startsWith("ticket_botoes_")) return;
      const botaoId = interaction.customId.replace("ticket_botoes_", "");
      ticketData = botoes.find((b) => b.id === botaoId);
      if (!ticketData) {
        return interaction.reply({
          content: `${emojis.cancel} Botão não encontrado.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ticket_select"
    ) {
      const selected = interaction.values[0];
      const selectId = selected.replace("select_", "");
      ticketData = selects.find((s) => s.id === selectId);
      if (!ticketData) {
        return interaction.reply({
          content: `${emojis.cancel} Select não encontrado.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    const dbsql = getDBConnection(interaction.guildId);

    if (ticketData) {
      if (!systemAtivo) {
        return interaction.reply({
          content: `${emojis.cancel} O sistema de tickets está desativado no momento.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const config = getConfigDB(interaction.guild.id);
      const horarioAtivo = config.get("horario_ativo");
      const schedule = config.get("schedule") || {};
      const mencionarAoAbrir = config.get("mencionar_ao_abrir") ?? false;
      const solicitarMotivo = config.get("solicitar_motivo") ?? false;

      if (!isWithinSchedule(schedule, horarioAtivo)) {
        return interaction.reply({
          content:
            "${emojis.cancel} O sistema de tickets está fechado neste horário. Tente novamente durante o expediente.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (isBlacklisted(interaction.guildId, interaction.user.id, interaction.member?.roles)) {
        return interaction.reply({
          content: `${emojis.block} Você está na blacklist e não pode abrir tickets neste servidor.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (solicitarMotivo) {
        const modal = new ModalBuilder()
          .setCustomId(`modal_motivo_ticket_${ticketData.id}`)
          .setTitle("Motivo da Abertura");

        const motivoInput = new TextInputBuilder()
          .setCustomId("motivo_abertura")
          .setLabel("Por que você está abrindo este ticket?")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Descreva o motivo da sua solicitação...")
          .setRequired(true)
          .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));

        await interaction.showModal(modal);
        return;
      }

      await criarTicketComMotivo(interaction, ticketData, null);
      return;
    }
  },
};

module.exports.enviarTranscriptParaAPI = enviarTranscriptParaAPI;