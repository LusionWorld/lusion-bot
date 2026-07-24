const {
  ContainerBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js')

const db = require('./database')
const { getEmojis } = require('../emojis/emojiHelper')
const emojis = getEmojis()

const activeTimers = new Map()   // pollId → { timeout, guildId }

function getEmoji(raw) {
  if (!raw) return null
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
  if (!match) return null
  const [, name, id] = match
  return { name, id }
}

function isValidURL(str) {
  try { new URL(str); return true } catch { return false }
}

function isValidHexColor(str) {
  return /^#([0-9A-F]{3}){1,2}$/i.test(str)
}

function hexToDecimal(hex) {
  return parseInt(hex.replace('#', ''), 16)
}

function resolveColor(poll, fallback = null) {
  return poll.color && isValidHexColor(poll.color) ? hexToDecimal(poll.color) : fallback
}

function addHeaderImage(container, poll) {
  const url = poll.header_image_url ?? poll.image_url ?? null
  if (!url || !isValidURL(url)) return
  container.addMediaGalleryComponents(g =>
    g.addItems({ media: { url } }),
  )
}

function addGalleryImages(container, poll) {
  const urls = (poll.image_urls ?? []).filter(isValidURL)
  if (urls.length === 0) return
  container.addMediaGalleryComponents(g =>
    g.addItems(...urls.map(url => ({ media: { url } }))),
  )
}

function formatPct(votes, total) {
  return total > 0 ? Math.round((votes / total) * 100) : 0
}

function endsLine(poll, style = 'R') {
  if (!poll.ends_at) return `${emojis.clock} No time limit`
  return `${emojis.clock} Ends: <t:${Math.floor(poll.ends_at / 1000)}:${style}>`
}

// ─── Tie detection ────────────────────────────────────────────────────────────

function resolveWinners(poll, voteCounts, total) {
  if (total === 0) return { winners: [], maxVotes: 0, isTie: false, noVotes: true }
  const maxVotes = Math.max(...poll.options.map((_, i) => voteCounts[i] ?? 0))
  const winners  = poll.options
    .map((opt, i) => ({ opt, i, votes: voteCounts[i] ?? 0 }))
    .filter(x => x.votes === maxVotes)
  return { winners, maxVotes, isTie: winners.length > 1, noVotes: false }
}

function buildResultLines(poll, voteCounts, total, winnerIndices = []) {
  return poll.options.map((opt, i) => {
    const votes    = voteCounts[i] ?? 0
    const pct      = formatPct(votes, total)
    const isWinner = winnerIndices.includes(i)
    return `${isWinner ? emojis.crown : '•'} **${opt}**: ${pct}% (${votes} ${votes === 1 ? 'vote' : 'votes'})`
  })
}

// ─── Active poll container (public channel message) ───────────────────────────

function buildActivePollContainer(poll) {
  const container = new ContainerBuilder()
  const color = resolveColor(poll)
  if (color !== null) container.setAccentColor(color)

  addHeaderImage(container, poll)

  container.addTextDisplayComponents(td =>
    td.setContent(`${emojis.crown} **${poll.title}**`),
  )

  if (poll.description) {
    container.addTextDisplayComponents(td =>
      td.setContent(`> ${poll.description}`),
    )
  }

  addGalleryImages(container, poll)

  container.addSeparatorComponents(sep =>
    sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  )

  if (poll.role_id) {
    container.addTextDisplayComponents(td =>
      td.setContent(`${emojis.lock} Restricted to <@&${poll.role_id}>`),
    )
  }

  container.addTextDisplayComponents(td =>
    td.setContent(endsLine(poll)),
  )

  container.addSeparatorComponents(sep =>
    sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  )

  container.addTextDisplayComponents(td =>
    td.setContent(`${emojis.users} Select an option to vote:`),
  )

  const buttons = poll.options.map((opt, i) =>
    new ButtonBuilder()
      .setCustomId(`poll_vote:${poll.id}:${i}`)
      .setLabel(opt.substring(0, 80))
      .setStyle(ButtonStyle.Secondary),
  )

  for (let i = 0; i < buttons.length; i += 5) {
    container.addActionRowComponents(row =>
      row.setComponents(...buttons.slice(i, i + 5)),
    )
  }

  return container
}

// ─── Voted (ephemeral) ────────────────────────────────────────────────────────

function buildVotedEphemeralContainer(poll, voteCounts, total, chosenIndex) {
  const { winners } = resolveWinners(poll, voteCounts, total)
  const lines = buildResultLines(poll, voteCounts, total, winners.map(w => w.i))

  return new ContainerBuilder()
    .setAccentColor(0x57F287)
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.success} **Vote registered!** You voted for **${poll.options[chosenIndex]}**.`,
      ),
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.chart} **Current Results** — ${total} ${total === 1 ? 'vote' : 'votes'}\n\n${lines.join('\n')}`,
      ),
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(td =>
      td.setContent(endsLine(poll)),
    )
}

// ─── Already voted (ephemeral) ────────────────────────────────────────────────

function buildAlreadyVotedContainer(poll, voteCounts, total, originalIndex) {
  const { winners } = resolveWinners(poll, voteCounts, total)
  const lines = buildResultLines(poll, voteCounts, total, winners.map(w => w.i))

  return new ContainerBuilder()
    .setAccentColor(0xFEE75C)
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.warning} You already voted in this poll.\n> Your vote: **${poll.options[originalIndex]}**`,
      ),
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.chart} **Current Results** — ${total} ${total === 1 ? 'vote' : 'votes'}\n\n${lines.join('\n')}`,
      ),
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(td =>
      td.setContent(endsLine(poll)),
    )
}

// ─── Closed poll (replaces original message) ──────────────────────────────────

function buildClosedPollContainer(poll, voteCounts, total) {
  const { winners, isTie, noVotes } = resolveWinners(poll, voteCounts, total)
  const winnerIndices = winners.map(w => w.i)
  const lines = buildResultLines(poll, voteCounts, total, winnerIndices)

  let footer
  if (noVotes) {
    footer = `${emojis.warning} No votes were cast.`
  } else if (isTie) {
    const names = winners.map(w => `**${w.opt}**`).join(' and ')
    footer = `${emojis.warning} It's a tie! ${names} tied at ${formatPct(winners[0].votes, total)}%.`
  } else {
    const w = winners[0]
    footer = `${emojis.celebration} **${w.opt}** won with **${formatPct(w.votes, total)}%** of the votes!`
  }

  const defaultColor = noVotes ? 0x99AAB5 : isTie ? 0xFEE75C : 0x57F287
  const accentColor  = resolveColor(poll, defaultColor)

  const container = new ContainerBuilder()
    .setAccentColor(accentColor)

  addHeaderImage(container, poll)

  container.addTextDisplayComponents(td =>
    td.setContent(`${emojis.crown} **${poll.title}** — Closed`),
  )

  if (poll.description) {
    container.addTextDisplayComponents(td =>
      td.setContent(`> ${poll.description}`),
    )
  }

  addGalleryImages(container, poll)

  container
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(td =>
      td.setContent(
        `${emojis.chart} **Final Results** — ${total} ${total === 1 ? 'vote' : 'votes'}\n\n${lines.join('\n')}\n\n${footer}`,
      ),
    )
    .addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(td => {
      const endTs = Math.floor((poll.ends_at ?? Date.now()) / 1000)
      return td.setContent(`${emojis.clock} Ended: <t:${endTs}:F>`)
    })

  return container
}

// ─── Poll close logic ─────────────────────────────────────────────────────────

async function closePoll(client, guildId, pollId) {
  activeTimers.delete(pollId)

  const poll = await db.getPoll(guildId, pollId)
  if (!poll || poll.ended) return

  const [voteCounts, total] = await Promise.all([
    db.getVoteCounts(guildId, pollId),
    db.getTotalVotes(guildId, pollId),
  ])

  const { winners, isTie, noVotes } = resolveWinners(poll, voteCounts, total)
  const winnerIndex = !noVotes && !isTie ? winners[0].i : null
  await db.endPoll(guildId, pollId, winnerIndex)

  try {
    const guild   = client.guilds.cache.get(poll.guild_id)
    if (!guild) return
    const channel = guild.channels.cache.get(poll.channel_id)
    if (!channel) return

    if (poll.message_id) {
      const message = await channel.messages.fetch(poll.message_id).catch(() => null)
      if (message) {
        await message.edit({
          components: [buildClosedPollContainer(poll, voteCounts, total)],
          flags: [MessageFlags.IsComponentsV2],
        }).catch(() => {})
      }
    }

    const target = poll.thread_id
      ? guild.channels.cache.get(poll.thread_id)
      : channel

    const lines = buildResultLines(poll, voteCounts, total, winners.map(w => w.i))
    let msg

    if (noVotes) {
      msg = `${emojis.warning} **Poll Closed — ${poll.title}**\n\nNo votes were cast.`
    } else if (isTie) {
      const names = winners.map(w => `**${w.opt}**`).join(' and ')
      const pct = formatPct(winners[0].votes, total)
      msg =
        `${emojis.celebration} **Poll Closed — ${poll.title}**\n\n` +
        `${emojis.warning} It's a tie! ${names} tied at **${pct}%** each.\n\n` +
        `**Breakdown:**\n${lines.join('\n')}`
    } else {
      const w = winners[0]
      msg =
        `${emojis.celebration} **Poll Closed — ${poll.title}**\n\n` +
        `${emojis.crown} **${w.opt}** won with **${formatPct(w.votes, total)}%** of the votes (${w.votes} of ${total}).\n\n` +
        `**Breakdown:**\n${lines.join('\n')}`
    }

    if (target) await target.send(msg).catch(() => {})

    // Send final results container to the dedicated results channel if configured
    if (poll.results_channel_id && poll.results_channel_id !== poll.channel_id) {
      const resultsChannel = guild.channels.cache.get(poll.results_channel_id)
      if (resultsChannel) {
        await resultsChannel.send({
          components: [buildClosedPollContainer(poll, voteCounts, total)],
          flags: [MessageFlags.IsComponentsV2],
        }).catch(() => {})
      }
    }
  } catch (err) {
    console.error('[Poll:close]', err.message)
  }
}

// ─── Timer management ─────────────────────────────────────────────────────────

function schedulePoll(client, guildId, pollId, msRemaining) {
  if (msRemaining == null || activeTimers.has(pollId)) return
  const timeout = setTimeout(() => closePoll(client, guildId, pollId), Math.max(msRemaining, 0))
  activeTimers.set(pollId, { timeout, guildId })
}

async function extendPoll(client, guildId, pollId, addMs) {
  const existing = activeTimers.get(pollId)
  if (existing) {
    clearTimeout(existing.timeout)
    activeTimers.delete(pollId)
  }

  const poll       = await db.getPoll(guildId, pollId)
  if (!poll || poll.ended) return null

  const newEndsAt  = (poll.ends_at ?? Date.now()) + addMs
  await db.updateEndsAt(guildId, pollId, newEndsAt)

  const msRemaining = newEndsAt - Date.now()
  schedulePoll(client, guildId, pollId, msRemaining)

  // Edit public message to reflect new end time
  try {
    const guild   = client.guilds.cache.get(guildId)
    const channel = guild?.channels.cache.get(poll.channel_id)
    if (channel && poll.message_id) {
      const msg = await channel.messages.fetch(poll.message_id).catch(() => null)
      if (msg) {
        const updated = { ...poll, ends_at: newEndsAt }
        await msg.edit({
          components: [buildActivePollContainer(updated)],
          flags: [MessageFlags.IsComponentsV2],
        }).catch(() => {})
      }
    }
  } catch {}

  return newEndsAt
}

async function rescheduleActivePolls(client) {
  try {
    const guildIds = db.getAllGuildIds()
    const now = Date.now()
    let total = 0

    for (const guildId of guildIds) {
      const polls = await db.getActivePolls(guildId).catch(() => [])
      for (const poll of polls) {
        if (poll.ends_at == null) continue
        const ms = poll.ends_at - now
        ms <= 0
          ? closePoll(client, guildId, poll.id).catch(() => {})
          : schedulePoll(client, guildId, poll.id, ms)
        total++
      }
    }

    if (total > 0) console.log(`[Poll] Rescheduled ${total} active poll(s)`)
  } catch (err) {
    console.error('[Poll:reschedule]', err.message)
  }
}

module.exports = {
  buildActivePollContainer,
  buildVotedEphemeralContainer,
  buildAlreadyVotedContainer,
  buildClosedPollContainer,
  schedulePoll,
  extendPoll,
  closePoll,
  rescheduleActivePolls,
}
