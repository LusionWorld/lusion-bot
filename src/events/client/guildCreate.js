module.exports = {
  name: 'guildCreate',
  once: false,

  async execute(client, guild) {
    if (!client.isReady()) return;

    console.log(`\n[GUILD] ➕ ${guild.name} (${guild.id}) | ${guild.memberCount} membros`);

    try {
      const commandsData = client.slashCommands
        .filter(cmd => !cmd.devOnly)
        .map(cmd => ({
          name: cmd.name,
          description: cmd.description || 'Sem descrição',
          options: cmd.options || [],
          ...(cmd.type && { type: cmd.type })
        }));

      await guild.commands.set(commandsData);

      console.log(`[GUILD] ✅ ${commandsData.length} comandos registrados\n`);

    } catch (error) {
      if (client.stats?.errorsCount) client.stats.errorsCount++;
      console.error(`[GUILD] ❌ Erro ao registrar comandos: ${error.message}\n`);
    }
  }
};