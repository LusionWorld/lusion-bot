const { Events } = require("discord.js");
const {
  criarEstruturaPadrao,
} = require("../../interactions/ticket/start-ticket");
const { green, yellow, red, bold, cyan } = require("colorette");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");

const guildsProcessadas = new Set();
const PROJECT_ROOT = path.resolve(__dirname, "../../../");

async function criarBancoSQLite(guildId) {
  const bancoPath = path.join(PROJECT_ROOT, "banco/ticket", guildId, "banco");

  if (!fs.existsSync(bancoPath)) {
    fs.mkdirSync(bancoPath, { recursive: true });
  }

  const dbPath = path.join(bancoPath, "tickets.db");
  const db = new sqlite3.Database(dbPath);
  const runAsync = promisify(db.run.bind(db));

  try {
    await runAsync(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        assumido_em INTEGER DEFAULT NULL,
        ia_pausada_por_staff INTEGER DEFAULT 0,
        chat_historico TEXT DEFAULT '[]',
        primeira_resposta_em INTEGER DEFAULT NULL,
        respondido_id TEXT DEFAULT NULL
      );
    `);

    await runAsync("PRAGMA journal_mode = WAL;");
  } catch (error) {
    console.error("Erro ao criar banco SQLite:", error);
    throw error;
  } finally {
    db.close();
  }
}

module.exports = {
  name: Events.GuildCreate,

  async execute(client, guild) {
    const guildData = guild || client;

    if (
      !guildData ||
      !guildData.id ||
      typeof guildData.id !== "string" ||
      guildData.constructor?.name === "Client"
    ) {
      console.error("❌ Guild inválida no evento");
      return;
    }

    if (guildsProcessadas.has(guildData.id)) {
      console.log("⏭️ Guild já está sendo processada");
      return;
    }

    guildsProcessadas.add(guildData.id);

    try {
      const basePath = path.join(PROJECT_ROOT, "banco/ticket", guildData.id);
      const configPath = path.join(basePath, "config.json");

      const jaExiste = fs.existsSync(configPath);

      if (jaExiste) {
        console.log(
          `⏭️ Guild ${guildData.name} (${guildData.id}) já está configurada`,
        );
        guildsProcessadas.delete(guildData.id);
        return;
      }

      console.log(
        bold(
          cyan(
            `\n🔄 Configurando nova guild: ${guildData.name} (${guildData.id})...\n`,
          ),
        ),
      );

      const resultado = await criarEstruturaPadrao(guildData.id, true);

      if (resultado.success) {
        await criarBancoSQLite(guildData.id);

        console.log(bold(green(`\n✓ Nova Guild Adicionada:`)));
        console.log(`${bold("Nome:")} ${cyan(guildData.name || "N/A")}`);
        console.log(`${bold("ID:")} ${cyan(guildData.id)}`);
        console.log(
          `${bold("Membros:")} ${yellow(guildData.memberCount || "N/A")}`,
        );
        console.log(bold(green(`✓ Configurações criadas com sucesso!\n`)));
      } else {
        throw new Error("Falha ao criar estrutura");
      }
    } catch (error) {
      console.log(bold(red(`\n✗ Erro ao configurar guild:`)));
      console.log(`${bold("Nome:")} ${cyan(guildData.name || "N/A")}`);
      console.log(`${bold("ID:")} ${cyan(guildData.id)}`);
      console.log(bold(red(`✗ Falha ao criar configurações\n`)));
      console.error(error);
    } finally {
      setTimeout(() => {
        guildsProcessadas.delete(guildData.id);
      }, 60000);
    }
  },
};
