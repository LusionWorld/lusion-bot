const {
  MessageFlags,
} = require('discord.js')

module.exports = {
  async execute(client, interaction) {
    const command = client.slashCommands.get(interaction.commandName);
    
    if (!command) {
      return interaction.reply({ 
        content: "❌ Comando não encontrado!", 
        flags: MessageFlags.Ephemeral, 
      });
    }

    // Verificar se é comando de owner
    if (command.ownerOnly && !client.config.ownerID?.includes(interaction.user.id)) {
      return interaction.reply({ 
        content: "🚫 Este comando é restrito ao dono do bot.", 
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await command.run(client, interaction);
    } catch (error) {
      console.error(`[ERRO] Erro no comando ${interaction.commandName}:`, error);
      
      const errorMessage = { 
        content: "❌ Ocorreu um erro ao executar este comando.", 
        flags: MessageFlags.Ephemeral,
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};