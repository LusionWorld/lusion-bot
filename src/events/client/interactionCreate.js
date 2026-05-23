const {
  MessageFlags,
} = require('discord.js')

module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    if (interaction.isButton() && interaction.customId.startsWith('copia_')) {
      return;
    }

    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

    const startTime = Date.now();
    const command = client.slashCommands.get(interaction.commandName);

    if (!command) {
      console.warn(`\n⚠️  Comando não encontrado: ${interaction.commandName}`);
      console.warn(`   Usuário: ${interaction.user.tag} (${interaction.user.id})`);
      console.warn(`   Guild: ${interaction.guild?.name || 'DM'}\n`);

      return interaction.reply({
        content: "❌ Comando não encontrado!",
        flags: MessageFlags.Ephemeral,

      });
    }

    if (command.ownerOnly && !client.config.ownerID?.includes(interaction.user.id)) {
      console.warn(`\n🚫 Tentativa de uso de comando owner:`);
      console.warn(`   Comando: ${interaction.commandName}`);
      console.warn(`   Usuário: ${interaction.user.tag} (${interaction.user.id})`);
      console.warn(`   Guild: ${interaction.guild?.name || 'DM'}\n`);

      return interaction.reply({
        content: "🚫 Este comando é restrito ao dono do bot.",
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await command.run(client, interaction);

      const executionTime = Date.now() - startTime;
      client.stats.commandsExecuted++;

      console.log(`\n✅ Comando executado com sucesso:`);
      console.log(`   📝 Comando: /${interaction.commandName}`);
      console.log(`   👤 Usuário: ${interaction.user.tag} (${interaction.user.id})`);
      console.log(`   🏰 Guild: ${interaction.guild?.name || 'DM'} (${interaction.guild?.id || 'N/A'})`);
      console.log(`   ⏱️  Tempo: ${executionTime}ms`);
      console.log(`   📊 Total executados: ${client.stats.commandsExecuted}\n`);

    } catch (error) {
      client.stats.errorsCount++;
      const executionTime = Date.now() - startTime;

      console.error(`\n❌ ════════ ERRO NO COMANDO ════════`);
      console.error(`🕐 Timestamp: ${new Date().toISOString()}`);
      console.error(`📝 Comando: /${interaction.commandName}`);
      console.error(`👤 Usuário: ${interaction.user.tag} (${interaction.user.id})`);
      console.error(`🏰 Guild: ${interaction.guild?.name || 'DM'} (${interaction.guild?.id || 'N/A'})`);
      console.error(`⏱️  Tempo até erro: ${executionTime}ms`);
      console.error(`📛 Tipo: ${error.name}`);
      console.error(`💬 Mensagem: ${error.message}`);
      console.error(`📍 Stack:\n${error.stack}`);
      console.error(`📊 Total de erros: ${client.stats.errorsCount}`);
      console.error('═══════════════════════════════════════\n');

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