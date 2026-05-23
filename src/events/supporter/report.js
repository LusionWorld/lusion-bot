const cron = require('node-cron')
const db   = require('../../utils/supporter/database')
const { buildReportContainer } = require('../../utils/supporter/manager')
const { MessageFlags } = require('discord.js')

async function sendMonthlyReport(client) {
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const conn = db.getConnection(guildId)
      await conn.ready

      const reportEnabled = await conn.getConfig('report_enabled', 'false')
      if (reportEnabled !== 'true') continue

      const reportChannelId = await conn.getConfig('report_channel_id')
      if (!reportChannelId) continue

      const ch = guild.channels.cache.get(reportChannelId)
      if (!ch) continue

      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      const lastMonth  = d.toISOString().slice(0, 7)
      const monthLabel = d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
      const stats      = await conn.getMonthlyStats(lastMonth)

      // Count current tier role holders
      const tierRoles = await conn.getTierRoles()
      let totalNow = 0
      try {
        await guild.members.fetch()
        for (const [, member] of guild.members.cache) {
          if (tierRoles.some(t => member.roles.cache.has(t.role_id))) totalNow++
        }
      } catch {}

      await ch.send({
        components: [buildReportContainer(stats, monthLabel, totalNow)],
        flags: [MessageFlags.IsComponentsV2],
      }).catch(err => console.error(`[Supporter] Report send failed (${guildId}):`, err.message))

      console.log(`[Supporter] Monthly report sent for ${guild.name} (${lastMonth})`)
    } catch (err) {
      console.error(`[Supporter] Report error for guild ${guildId}:`, err.message)
    }
  }
}

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    // Every day at midnight, check if today is the configured report day
    cron.schedule('0 0 * * *', async () => {
      const today = new Date().getDate()

      for (const [guildId] of client.guilds.cache) {
        try {
          const conn = db.getConnection(guildId)
          await conn.ready
          const reportDay = parseInt(await conn.getConfig('report_day', '1')) || 1
          if (today === reportDay) {
            await sendMonthlyReport(client)
            break // sendMonthlyReport already iterates all guilds
          }
        } catch {}
      }
    })

    console.log('[Supporter] Monthly report cron scheduled.')
  },
}
