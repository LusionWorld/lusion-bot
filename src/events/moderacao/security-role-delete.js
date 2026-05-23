const { handleDestroy } = require('./security-destroy')

module.exports = {
  name: 'roleDelete',
  async execute(client, role) {
    await handleDestroy(client, role.guild, 'role', role.name ?? 'Unknown')
  },
}
