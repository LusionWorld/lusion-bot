const { rescheduleActivePolls } = require('../../utils/votacao/manager')

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    await rescheduleActivePolls(client)
  },
}
