const { PermissionFlagsBits } = require('discord.js')

const db = require('../../utils/moderacao/security-database')
const { sendSecurityAlert } = require('../../utils/moderacao/security-helpers')
const emojis = require('../../utils/emojis/emojis.json')

// ─── Suspicious patterns ───────────────────────────────────────────────────
const DISCORD_INVITE_RE = /discord(?:\.gg|\.com\/invite|app\.com\/invite)\/[a-zA-Z0-9-]+/i
const URL_RE = /https?:\/\/[^\s]+/gi
const SHORTENER_DOMAINS = [
  'bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'is.gd', 'buff.ly', 'goo.gl',
  'rb.gy', 'cutt.ly', 'shorturl.at', 'tiny.cc', 'bl.ink', 'rebrand.ly',
  'short.io', 'linktr.ee', 'hyperurl.co', 'urlzs.com', 'clck.ru', 's.id',
]

// ─── In-memory flood trackers ──────────────────────────────────────────────
const floodMap       = new Map() // guildId → userId → [timestamps]
const duplicateMap   = new Map() // guildId → userId → { content, count, firstSeen }
const crosspostMap   = new Map() // guildId → userId → { content, channels: Set, firstSeen }
const linkRepeatMap  = new Map() // guildId → userId → { url → { count, firstSeen } }
// infractionMap: guildId → userId → { count, lastAt } — progressive punishment tracker
const infractionMap  = new Map()

function getOrSet(map, key, defaultFn) {
  if (!map.has(key)) map.set(key, defaultFn())
  return map.get(key)
}

function isShortener(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return SHORTENER_DOMAINS.includes(host)
  } catch {
    return false
  }
}

function countEmojis(content) {
  const unicodeEmojis = [...content.matchAll(/\p{Emoji_Presentation}/gu)]
  const customEmojis  = [...content.matchAll(/<a?:[^:]+:\d+>/g)]
  return unicodeEmojis.length + customEmojis.length
}

// Minimum gap (ms) between two counted infractions. Any additional flood
// triggers that fire within this window are treated as the SAME burst —
// messages still get deleted but no new infraction/timeout is issued.
// This prevents double-counting when multiple messages from the same burst
// land before Discord actually applies the first timeout.
const SAME_BURST_GAP_MS = 10_000

function clearMemberFloodState(guildId, userId) {
  floodMap.get(guildId)?.delete(userId)
  duplicateMap.get(guildId)?.delete(userId)
  crosspostMap.get(guildId)?.delete(userId)
}

/**
 * Progressive flood punishment.
 * - Tracks infractions per user within `flood_escalation_window_sec`.
 * - Coalesces bursts: a second trigger within SAME_BURST_GAP_MS of the last
 *   infraction does NOT escalate — it's considered part of the same incident.
 * - Each real infraction level applies a longer timeout + higher alert priority.
 */
async function escalateInfraction(member, guild, cfg, reason, alertFields) {
  const now = Date.now()
  const windowMs = (cfg.flood_escalation_window_sec ?? 900) * 1000
  const gMap = getOrSet(infractionMap, guild.id, () => new Map())
  const entry = gMap.get(member.id)

  // ── Same-burst suppression ───────────────────────────────────────
  // If we just punished this member in the last few seconds, treat this
  // as part of the same incident: slide the cooldown forward, clear any
  // stale flood tracking state, and return without escalating.
  if (entry && (now - entry.lastAt) < SAME_BURST_GAP_MS) {
    entry.lastAt = now
    clearMemberFloodState(guild.id, member.id)
    return
  }

  let count
  if (!entry || (now - entry.lastAt) > windowMs) {
    count = 1
  } else {
    count = entry.count + 1
  }
  gMap.set(member.id, { count, lastAt: now })

  // Wipe per-user flood state so buffered timestamps/duplicates don't
  // immediately re-trigger a second escalation after this one.
  clearMemberFloodState(guild.id, member.id)

  // Map count to timeout level + alert priority
  let timeoutMin, priority
  if (count === 1) {
    timeoutMin = cfg.flood_timeout_level_1 ?? 5
    priority   = 'low'
  } else if (count === 2) {
    timeoutMin = cfg.flood_timeout_level_2 ?? 15
    priority   = 'medium'
  } else {
    timeoutMin = cfg.flood_timeout_level_3 ?? 60
    priority   = 'high'
  }

  // Apply timeout FIRST so additional in-flight messages get blocked ASAP
  if (member.moderatable) {
    await member.timeout(timeoutMin * 60 * 1000, reason).catch(() => {})
  }

  // DM the member (warning on level 1, stronger tone afterwards)
  if (count === 1) {
    await member.send(
      `${emojis.warning} **Warning** in **${guild.name}**\n` +
      `Reason: ${reason}\n` +
      `Timeout: **${timeoutMin} minute(s)**. Continued behaviour will increase the penalty.`
    ).catch(() => {})
  } else {
    await member.send(
      `${emojis.danger} **Repeated violation (#${count}) in ${guild.name}**\n` +
      `Reason: ${reason}\n` +
      `Timeout: **${timeoutMin} minute(s)**.`
    ).catch(() => {})
  }

  // Alert staff
  if (cfg.notify_flood) {
    await sendSecurityAlert(guild, cfg, {
      title: count >= 3 ? 'Flood — Repeat Offender' : 'Flood / Spam Detected',
      fields: {
        ...alertFields,
        Infraction: `#${count}`,
        Reason: reason,
        Action: `Timed out for ${timeoutMin} minute(s)`,
      },
      priority,
      footer: count >= 3 ? `${emojis.danger} This member has reached the **highest escalation level** — review manually.` : null,
    })
  }
}

module.exports = {
  name: 'messageCreate',

  async execute(client, message) {
    try {
      if (!message.guild || message.author.bot) return

      const cfg = await db.getConfig(message.guild.id)
      if (!cfg || !cfg.system_enabled) return

      const { guild, member, channel, content } = message

      // ── Exempt check: admins and staff roles ───────────────────────
      if (member.permissions.has(PermissionFlagsBits.Administrator)) return

      const linkExemptRoles  = JSON.parse(cfg.link_exempt_roles  || '[]')
      const floodExemptRoles = JSON.parse(cfg.flood_exempt_roles || '[]')

      const memberRoleIds = member.roles.cache.map(r => r.id)
      const isLinkExempt  = linkExemptRoles.some(r => memberRoleIds.includes(r))
      const isFloodExempt = floodExemptRoles.some(r => memberRoleIds.includes(r))

      // ── Trust / new member status ──────────────────────────────────
      const joinedAt  = member.joinedTimestamp || Date.now()
      const daysSince = (Date.now() - joinedAt) / 86_400_000
      const isNewMember = daysSince < cfg.link_newmember_days

      // Track valid message for trust progression
      if (cfg.trust_enabled) {
        await db.upsertMemberTrust(guild.id, member.id, joinedAt)
      }

      const alertBase = {
        User:    `<@${message.author.id}> \`${message.author.id}\``,
        Channel: `<#${channel.id}>`,
      }

      // ── Link Security ──────────────────────────────────────────────
      if (!isLinkExempt) {
        const urls = content.match(URL_RE) || []
        const hasDiscordInvite = DISCORD_INVITE_RE.test(content)

        const whitelistChannels = JSON.parse(cfg.link_whitelist_channels || '[]')
        const isWhitelisted = whitelistChannels.includes(channel.id)

        // Block Discord invites
        if (cfg.link_block_invites && hasDiscordInvite) {
          await message.delete().catch(() => {})
          await db.flagMember(guild.id, member.id)

          if (cfg.notify_external_invite) {
            await sendSecurityAlert(guild, cfg, {
              title: 'External Invite Blocked',
              fields: {
                ...alertBase,
                Reason: 'External Discord invite detected',
                Content: content.slice(0, 100),
              },
              priority: 'medium',
            })
          }

          await member.send(
            `${emojis.block} Your message in **${guild.name}** was removed — external Discord invites are not allowed.`
          ).catch(() => {})
          return
        }

        // Block custom domains
        const customBlocked = JSON.parse(cfg.link_block_custom || '[]')
        if (customBlocked.length && !isWhitelisted) {
          for (const url of urls) {
            let host = ''
            try { host = new URL(url).hostname.replace(/^www\./, '') } catch {}
            if (host && customBlocked.includes(host)) {
              await message.delete().catch(() => {})
              await db.flagMember(guild.id, member.id)

              if (cfg.notify_suspicious_link) {
                await sendSecurityAlert(guild, cfg, {
                  title: 'Blocked Domain Detected',
                  fields: {
                    ...alertBase,
                    Reason: `Blocked domain: \`${host}\``,
                    URL: url,
                  },
                  priority: 'medium',
                })
              }

              await member.send(
                `${emojis.block} Your message in **${guild.name}** was removed — that domain is not allowed here.`
              ).catch(() => {})
              return
            }
          }
        }

        // Block shorteners
        if (cfg.link_block_shorteners && !isWhitelisted) {
          for (const url of urls) {
            if (isShortener(url)) {
              await message.delete().catch(() => {})
              await db.flagMember(guild.id, member.id)

              if (cfg.notify_suspicious_link) {
                await sendSecurityAlert(guild, cfg, {
                  title: 'URL Shortener Blocked',
                  fields: {
                    ...alertBase,
                    Reason: 'URL shortener detected',
                    URL: url,
                  },
                  priority: 'medium',
                })
              }

              await member.send(
                `${emojis.block} Your message in **${guild.name}** was removed — URL shorteners are not allowed.`
              ).catch(() => {})
              return
            }
          }
        }

        // Block links for new members in non-whitelisted channels
        if (cfg.link_enabled && isNewMember && urls.length > 0 && !isWhitelisted) {
          await message.delete().catch(() => {})

          const accountAgeDays = Math.floor((Date.now() - message.author.createdTimestamp) / 86_400_000)

          if (cfg.notify_new_account_link) {
            await sendSecurityAlert(guild, cfg, {
              title: 'New Member Sent Link',
              fields: {
                ...alertBase,
                Reason: `New member (${Math.floor(daysSince)}d in server) sent a link`,
                'Account Age': `${accountAgeDays} days`,
                URL: urls[0],
              },
              priority: 'medium',
            })
          }

          await member.send(
            `${emojis.lock} Your message in **${guild.name}** was removed — new members cannot send links yet.\n` +
            `You can send links after **${cfg.link_newmember_days} days** in the server.`
          ).catch(() => {})
          return
        }

        // Detect repeated links
        if (cfg.link_block_repeat && urls.length > 0) {
          const guildRepeat = getOrSet(linkRepeatMap, guild.id, () => new Map())
          const userRepeat  = getOrSet(guildRepeat, member.id, () => ({}))
          const now = Date.now()

          for (const url of urls) {
            const key = url.toLowerCase()

            if (!userRepeat[key] || (now - userRepeat[key].firstSeen) > cfg.link_repeat_window_sec * 1000) {
              userRepeat[key] = { count: 1, firstSeen: now }
            } else {
              userRepeat[key].count++
              if (userRepeat[key].count >= cfg.link_repeat_count) {
                userRepeat[key] = { count: 0, firstSeen: now }

                if (cfg.notify_suspicious_link) {
                  await sendSecurityAlert(guild, cfg, {
                    title: 'Repeated Link Detected',
                    fields: {
                      ...alertBase,
                      Reason: `Same link repeated ${cfg.link_repeat_count}× in ${cfg.link_repeat_window_sec}s`,
                      URL: url,
                    },
                    priority: 'medium',
                  })
                }
              }
            }
          }
        }
      }

      // ── Flood Detection ────────────────────────────────────────────
      if (!isFloodExempt && cfg.flood_enabled) {
        const now = Date.now()
        const windowMs = cfg.flood_msg_window_sec * 1000

        // Message rate flood
        const guildFlood = getOrSet(floodMap, guild.id, () => new Map())
        const userTimes  = getOrSet(guildFlood, member.id, () => [])

        // Clean old timestamps
        const recent = userTimes.filter(t => now - t < windowMs)
        recent.push(now)
        guildFlood.set(member.id, recent)

        if (recent.length >= cfg.flood_msg_count) {
          guildFlood.set(member.id, [])
          await message.delete().catch(() => {})
          await escalateInfraction(member, guild, cfg, 'Sending too many messages too quickly', alertBase)
          return
        }

        // Duplicate message detection
        if (cfg.flood_duplicate_enabled) {
          const guildDup = getOrSet(duplicateMap, guild.id, () => new Map())
          const dupData  = guildDup.get(member.id)
          const cleaned  = content.toLowerCase().trim()

          if (dupData && cleaned === dupData.content && (now - dupData.firstSeen) < windowMs * 3) {
            dupData.count++
            if (dupData.count >= 3) {
              guildDup.delete(member.id)
              await message.delete().catch(() => {})
              await escalateInfraction(member, guild, cfg, 'Sending duplicate messages', alertBase)
              return
            }
          } else {
            guildDup.set(member.id, { content: cleaned, count: 1, firstSeen: now })
          }
        }

        // Mass mention detection
        const mentionCount = message.mentions.users.size + message.mentions.roles.size
        if (mentionCount > cfg.flood_mention_limit) {
          await message.delete().catch(() => {})
          await escalateInfraction(member, guild, cfg, `Excessive mentions (${mentionCount})`, {
            ...alertBase,
            Mentions: mentionCount,
          })
          return
        }

        // Emoji spam detection
        const emojiCount = countEmojis(content)
        if (emojiCount > cfg.flood_emoji_limit) {
          await message.delete().catch(() => {})
          await escalateInfraction(member, guild, cfg, `Emoji spam (${emojiCount} emojis)`, {
            ...alertBase,
            Emojis: emojiCount,
          })
          return
        }

        // Cross-channel spam
        if (cfg.flood_crosspost_enabled) {
          const guildCross = getOrSet(crosspostMap, guild.id, () => new Map())
          const crossData  = guildCross.get(member.id)
          const cleaned    = content.toLowerCase().trim()

          if (crossData && cleaned === crossData.content && (now - crossData.firstSeen) < windowMs * 4) {
            crossData.channels.add(channel.id)
            if (crossData.channels.size >= 3) {
              guildCross.delete(member.id)
              await message.delete().catch(() => {})
              await escalateInfraction(member, guild, cfg, 'Cross-channel spam detected', {
                ...alertBase,
                Channels: crossData.channels.size,
              })
              return
            }
          } else {
            guildCross.set(member.id, { content: cleaned, channels: new Set([channel.id]), firstSeen: now })
          }
        }
      }
    } catch (err) {
      console.error('[Security:messageCreate]', err.message)
    }
  },
}
