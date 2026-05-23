const { handleDestroy } = require('./security-destroy')

module.exports = {
  name: 'channelDelete',
  async execute(client, channel) {
    if (!channel.guild) return
    await handleDestroy(client, channel.guild, 'channel', channel.name ?? 'Unknown')
  },
}
