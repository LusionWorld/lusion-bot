const {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");

const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const Groq = require("groq-sdk");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

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
  return {
    get(key) {
      return key.split(".").reduce((o, k) => o?.[k], read());
    },
  };
}

async function verificarTicketRecorrente(guildId, userId, motivoAtual) {
  try {
    const db = getDBConnection(guildId);
    const config = require("../../../config.json");
    const iaKey = config["key-ia"] || config["key-ia2"];
    if (!iaKey) return null;

    const tickets = await db
      .allAsync(
        `SELECT ticket_id, motivo_abertura, criado_em FROM tickets WHERE guild_id = ? AND user_id = ? AND fechado_em IS NOT NULL AND motivo_abertura IS NOT NULL ORDER BY criado_em DESC LIMIT 5`,
        [guildId, userId],
      )
      .catch(() => []);

    if (tickets.length === 0) return null;

    if (!motivoAtual || motivoAtual.trim().length < 10) return null;

    const groq = new Groq({ apiKey: iaKey });
    const historicoTexto = tickets
      .map(
        (t, i) =>
          `Ticket ${i + 1} (${new Date(t.criado_em).toLocaleDateString("pt-BR")}): ${t.motivo_abertura?.substring(0, 100)}`,
      )
      .join("\n");

    const resp = await groq.chat.completions
      .create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_tokens: 50,
        messages: [
          {
            role: "system",
            content:
              'Você é um analisador de tickets. Responda APENAS com "sim" ou "nao".',
          },
          {
            role: "user",
            content: `O usuário abriu um ticket com o assunto: "${motivoAtual}"\n\nEle já abriu estes tickets anteriormente:\n${historicoTexto}\n\nAlgum ticket anterior trata de assunto similar ou relacionado?`,
          },
        ],
      })
      .catch(() => null);

    if (!resp) return null;
    const resposta = resp.choices[0]?.message?.content?.toLowerCase()?.trim();
    if (resposta?.includes("sim")) {
      return tickets[0];
    }
    return null;
  } catch {
    return null;
  }
}

async function avisoRecorrente(canal, ticketAnterior, userId) {
  try {
    const dataAnterior = new Date(ticketAnterior.criado_em).toLocaleDateString(
      "pt-BR",
    );
    await canal.send({
      components: [
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `🔁 **Ticket Recorrente Detectado**\n\n<@${userId}> já abriu um ticket sobre assunto similar em **${dataAnterior}**.\n\nID do ticket anterior: \`${ticketAnterior.ticket_id}\`\n\n> O staff pode verificar o histórico para agilizar o atendimento.`,
          ),
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch {}
}

module.exports = {
  verificarTicketRecorrente,
  avisoRecorrente,
};
