const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");

const PROJECT_ROOT = path.resolve(__dirname, "../../../");

const E = {
  clipboard: "<:clipboard:1454657428384780494>",
  info: "<:info:1454657645251264678>",
  textc: "<:textc:1454657532646658090>",
  check: "<:check:1454657386278158397>",
};

function getDBConnection(guildId) {
  const folderPath = path.join(PROJECT_ROOT, "banco/ticket", guildId, "banco");
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  const dbPath = path.join(folderPath, "tickets.db");
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("[RESUMO] Erro ao conectar:", err);
  });
  db.configure("busyTimeout", 10000);
  db.getAsync = promisify(db.get.bind(db));
  return db;
}

async function chamarGroqAPI(messages) {
  const config = require("../../../config.json");
  const keys = [config["key-ia"], config["key-ia2"]].filter(Boolean);
  if (keys.length === 0) throw new Error("Nenhuma chave de IA configurada.");
  const Groq = require("groq-sdk");
  for (let i = 0; i < keys.length; i++) {
    try {
      const groq = new Groq({ apiKey: keys[i] });
      return await groq.chat.completions.create({
        messages,
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        max_tokens: 400,
      });
    } catch (erro) {
      if (erro.status === 429 && i < keys.length - 1) continue;
      throw erro;
    }
  }
}

/**
 * @returns {ContainerBuilder|null}
 */
async function gerarResumoAoAssumir(client, guildId, channelId, staffId) {
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return null;

    const dbsql = getDBConnection(guildId);
    let ticketData;
    try {
      ticketData = await dbsql.getAsync(
        `SELECT chat_historico FROM tickets WHERE ticket_id = ?`,
        [channelId],
      );
    } finally {
      try {
        dbsql.close();
      } catch {}
    }

    let mensagensTexto = "";

    if (ticketData?.chat_historico) {
      try {
        const historico = JSON.parse(ticketData.chat_historico || "[]");
        if (historico.length > 0) {
          mensagensTexto = historico
            .slice(-20)
            .map((m) => `${m.role === "user" ? "Usuário" : "IA"}: ${m.content}`)
            .join("\n");
        }
      } catch {}
    }

    if (!mensagensTexto) {
      try {
        const msgs = await channel.messages.fetch({ limit: 40 });
        mensagensTexto = [...msgs.values()]
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
          .filter(
            (m) => !m.author.bot && m.content && m.content.trim().length > 2,
          )
          .map((m) => `${m.author.username}: ${m.content}`)
          .join("\n");
      } catch {
        return null;
      }
    }

    if (!mensagensTexto || mensagensTexto.trim().length < 5) {
      return new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${E.clipboard} **Resumo do Ticket**`,
          ),
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${E.info} Nenhuma mensagem do usuário registrada ainda.`,
          ),
        );
    }

    // Chama IA para resumo
    const resposta = await chamarGroqAPI([
      {
        role: "system",
        content:
          "Você resume conversas de suporte em português brasileiro de forma direta. " +
          "Responda EXATAMENTE neste formato, sem introduções ou saudações:\n\n" +
          "**Problema:** [o que o usuário relatou ou precisa resolver]\n" +
          "**Contexto:** [informações relevantes ditas pelo usuário, se houver]\n\n" +
          "Máximo 3 linhas por campo. Se o usuário não enviou mensagens reais, escreva:\n" +
          "**Problema:** Usuário ainda não descreveu o motivo do ticket.",
      },
      {
        role: "user",
        content: `Conversa do ticket:\n\n${mensagensTexto}`,
      },
    ]);

    const resumo = resposta.choices[0]?.message?.content?.trim();
    if (!resumo) return null;

    return new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${E.clipboard} **Resumo do Ticket**`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(resumo));
  } catch (err) {
    console.error("[RESUMO] Erro ao gerar resumo:", err);
    return null;
  }
}

module.exports = { gerarResumoAoAssumir };
