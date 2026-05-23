const { Events, ContainerBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js')
const db = require('../../utils/invite/database')
const fs = require('fs')
const path = require('path')

const { getEmojis } = require('../../utils/emojis/emojiHelper')
const emojis = getEmojis()

const INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

// ─── Criteria check ───────────────────────────────────────────────────────────

function meetsCriteria(membro, activity, config) {
  const now = Date.now()
  const minDays = config.min_days_qualified ?? 7

  // Must have been in server for min_days_qualified
  const daysInServer = (now - (membro.entrou || 0)) / 86400000
  if (daysInServer < minDays) return false

  // Min messages
  const minMessages = config.criteria_min_messages ?? 5
  if ((activity?.message_count || 0) < minMessages) return false

  // Min channels
  const minChannels = config.criteria_min_channels ?? 1
  const channelsUsed = (activity?.channels_used || []).length
  if (channelsUsed < minChannels) return false

  // Active on different days
  const diffDays = config.criteria_diff_days ?? 1
  if (diffDays) {
    const daysActive = (activity?.days_active || []).length
    if (daysActive < 2) return false
  }

  // Not flagged as spam
  const checkSpam = config.criteria_check_spam ?? 1
  if (checkSpam && activity?.flagged_spam) return false

  return true
}

// ─── Reward roles ─────────────────────────────────────────────────────────────

async function checkAndGrantRewards(_client, guild, userId, totalQualified, _config) {
  const rewardRoles = await db.getRewardRoles(guild.id)
  if (!rewardRoles.length) return

  const member = await guild.members.fetch(userId).catch(() => null)
  if (!member) return

  for (const reward of rewardRoles) {
    if (totalQualified < reward.min_qualified) continue
    if (member.roles.cache.has(reward.role_id)) continue

    await member.roles.add(reward.role_id).catch(() => {})

    if (!reward.permanent) {
      const expiresAt = Date.now() + reward.duration_days * 86400000
      await db.addActiveReward(guild.id, userId, reward.role_id, expiresAt)
    }
  }
}

// ─── Expired reward removal ───────────────────────────────────────────────────

async function removeExpiredRewards(client, guildId) {
  const expired = await db.getExpiredRewards(guildId)
  if (!expired.length) return

  const guild = client.guilds.cache.get(guildId)
  if (!guild) return

  for (const entry of expired) {
    const member = await guild.members.fetch(entry.user_id).catch(() => null)
    if (member) await member.roles.remove(entry.role_id).catch(() => {})
    await db.removeActiveReward(guildId, entry.user_id, entry.role_id)
  }
}

// ─── Milestone announcement ───────────────────────────────────────────────────

async function sendMilestone(guild, userId, total, canalId) {
  const canal = await guild.channels.fetch(canalId).catch(() => null)
  if (!canal) return

  const container = new ContainerBuilder()
    .addTextDisplayComponents(td =>
      td.setContent(`${emojis.celebration} **Milestone Reached!**`)
    )
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.invite} <@${userId}> just reached **${total} qualified invites!**\n` +
        `${emojis.star} Keep inviting to reach the next milestone!`
      )
    )

  await canal.send({ components: [container], flags: MessageFlags.IsComponentsV2 })
}

// ─── Update pinned ranking message ───────────────────────────────────────────

async function updatePinnedRanking(client, guildId) {
  const config = await db.getConfig(guildId)
  if (!config?.canal_ranking_pinned || !config?.ranking_message_id) return

  const guild = client.guilds.cache.get(guildId)
  if (!guild) return

  const canal = await guild.channels.fetch(config.canal_ranking_pinned).catch(() => null)
  if (!canal) return

  const rows   = await db.getLeaderboard(guildId, 10)
  const medals = [emojis.gold, emojis.star, emojis.achievement]

  const texto = rows.length === 0
    ? `${emojis.info} No invites recorded yet.`
    : rows.map((r, i) => {
        const m     = medals[i] ? `${medals[i]}` : `**${i + 1}.**`
        const bonus = r.bonus > 0 ? ` *(+${r.bonus} bonus)*` : ''
        return `${m} <@${r.user_id}> — **${r.total_real}** qualified invites${bonus}\n-# ${emojis.check} ${r.validos} qualified  ${emojis.cancel} ${r.saiu} removed`
      }).join('\n\n')

  const rankingContainer = new ContainerBuilder()
    .addTextDisplayComponents(td => td.setContent(`${emojis.graph} **Top 10 Inviters** | ${guild.name}`))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(texto))
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(`-# ${emojis.refresh} Updated <t:${Math.floor(Date.now() / 1000)}:R>`))

  const msg = await canal.messages.fetch(config.ranking_message_id).catch(() => null)
  if (msg) {
    await msg.edit({ components: [rankingContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {})
  }
}

// ─── Per-guild check ──────────────────────────────────────────────────────────

async function checkGuild(client, guildId) {
  const config = await db.getConfig(guildId)
  if (!config?.ativo) return

  const guild = client.guilds.cache.get(guildId)
  if (!guild) return

  // 1. Remove expired temporary reward roles
  await removeExpiredRewards(client, guildId)

  // 2. Check pending members
  const pending = await db.getPendingMembers(guildId)
  if (!pending.length) return

  const milestoneInterval = config.milestone_interval ?? 10
  const canalRanking      = config.canal_ranking

  for (const membro of pending) {
    try {
      const guildMember = await guild.members.fetch(membro.member_id).catch(() => null)
      if (!guildMember) continue

      const activity = await db.getActivity(guildId, membro.member_id)

      if (!meetsCriteria(membro, activity, config)) continue

      // Qualify the member
      const inviterId = await db.qualifyMember(guildId, membro.member_id)
      if (!inviterId) continue

      // Log in the invite logs channel
      if (config.canal_logs) {
        const canal = await guild.channels.fetch(config.canal_logs).catch(() => null)
        if (canal) {
          const stats = await db.getStats(guildId, inviterId)
          const totalQualified = Math.max(0, (stats?.validos || 0) + (stats?.bonus || 0) - (stats?.saiu || 0))

          const container = new ContainerBuilder()
            .addTextDisplayComponents(td => td.setContent(`${emojis.invite} **Invite Tracker** — Qualified`))
            .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(td =>
              td.setContent(
                `${emojis.user} **Member:** ${guildMember}\n` +
                `${emojis.users} **Invited by:** <@${inviterId}>\n` +
                `${emojis.check} **Status:** Qualified\n` +
                `${emojis.graph} **Total qualified invites:** ${totalQualified}\n` +
                `${emojis.clock} **Qualified at:** <t:${Math.floor(Date.now() / 1000)}:R>`
              )
            )

          await canal.send({ components: [container], flags: MessageFlags.IsComponentsV2 })

          // Milestone check
          if (canalRanking && milestoneInterval > 0 && totalQualified % milestoneInterval === 0) {
            await sendMilestone(guild, inviterId, totalQualified, canalRanking)
          }

          // Grant reward roles
          await checkAndGrantRewards(client, guild, inviterId, totalQualified, config)
        }
      }
    } catch (err) {
      console.error(`❌ Erro ao qualificar membro ${membro.member_id}:`, err.message)
    }
  }
}

// ─── Scheduler loop ───────────────────────────────────────────────────────────

async function runScheduler(client) {
  const conviteDir = path.join(__dirname, '../../../banco/convite')
  if (!fs.existsSync(conviteDir)) return

  const guildDirs = fs.readdirSync(conviteDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  for (const guildId of guildDirs) {
    await checkGuild(client, guildId).catch(err =>
      console.error(`❌ Erro no scheduler (guild ${guildId}):`, err.message)
    )
    await updatePinnedRanking(client, guildId).catch(err =>
      console.error(`❌ Erro ao atualizar ranking (guild ${guildId}):`, err.message)
    )
  }
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    setTimeout(async () => {
      await runScheduler(client)
      setInterval(() => runScheduler(client), INTERVAL_MS)
    }, 10000)
  },
}
