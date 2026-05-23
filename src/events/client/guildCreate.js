const pollDb      = require('../../utils/votacao/database')
const translateDb = require('../../utils/tradutor/database')
const aaqDb       = require('../../utils/askaquestions/database')

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

    // Pre-initialize per-guild databases
    try {
      const conn = pollDb.getConnection(guild.id)
      await conn.ready
    } catch (err) {
      console.error(`[GUILD] ❌ Erro ao inicializar poll DB: ${err.message}`)
    }

    try {
      const conn = translateDb.getConnection(guild.id)
      await conn.ready
    } catch (err) {
      console.error(`[GUILD] ❌ Erro ao inicializar translate DB: ${err.message}`)
    }

    try {
      const conn = aaqDb.getConnection(guild.id)
      await conn.ready
    } catch (err) {
      console.error(`[GUILD] ❌ Erro ao inicializar aaq DB: ${err.message}`)
    }
  }
};