const { Events } = require("discord.js");
const {
  criarEstruturaPadrao,
} = require("../../interactions/ticket/start-ticket");
const { green, yellow, red, bold, cyan } = require("colorette");
const fs = require("fs");
const path = require("path");

const guildsProcessadas = new Set();
const PROJECT_ROOT = path.resolve(__dirname, "../../../");

/**
 * O schema de tickets já vive no Postgres (Supabase) via migration —
 * não há mais banco SQLite por guild pra criar aqui.
 */
async function criarBancoSQLite(_guildId) {}

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
