const {
  MessageFlags,
} = require('discord.js')
const { dim } = require('colorette').createColors({ useColor: true });
const { log, error: logError } = require('../../utils/logger');
const { getGuildLocale } = require('../../utils/i18n');

function formatGuildTag(guild) {
  if (!guild) return 'DM';
  const count = guild.memberCount ?? 0;
  const tag = count >= 1000 ? `${Math.floor(count / 1000)}k` : `${count}`;
  return `${guild.name} | #${tag}`;
}

module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    if (interaction.isButton() && interaction.customId.startsWith('copia_')) {
      return;
    }

    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

    const startTime = Date.now();
    const locale = interaction.guildId ? getGuildLocale(interaction.guildId) : null;
    const command =
      (locale && client.slashCommandsByLocale?.[locale]?.get(interaction.commandName)) ||
      client.slashCommands.get(interaction.commandName);
    const guildTag = formatGuildTag(interaction.guild);

    if (!command) {
      logError("CMD", `/${interaction.commandName} não encontrado no client.slashCommands  ${dim(interaction.user.tag)}  ${dim(guildTag)}`);

      return interaction.reply({
        content: "❌ Comando não encontrado!",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (command.ownerOnly && !client.config.ownerID?.includes(interaction.user.id)) {
      logError("CMD", `Tentativa de uso de comando owner: /${interaction.commandName}  ${dim(interaction.user.tag)}  ${dim(guildTag)}`);

      return interaction.reply({
        content: "🚫 Este comando é restrito ao dono do bot.",
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await command.run(client, interaction);

      const executionTime = Date.now() - startTime;
      client.stats.commandsExecuted++;

      log("CMD", `/${interaction.commandName}  ${dim(interaction.user.tag)}  ${dim(guildTag)}  ${executionTime}ms  ${dim("executados " + client.stats.commandsExecuted)}`);

    } catch (error) {
      if (error?.code === 10062 || error?.code === 40060) return;

      client.stats.errorsCount++;
      const executionTime = Date.now() - startTime;

      logError("CMD", `/${interaction.commandName}  ${dim(interaction.user.tag)}  ${dim(guildTag)}  ${executionTime}ms\n${error.stack}`);

      const errorMessage = {
        content: "❌ Ocorreu um erro ao executar este comando.",
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(() => { });
      } else {
        await interaction.reply(errorMessage).catch(() => { });
      }
    }
  }
};
