const {
  ContainerBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js')

const db = require('../../utils/onboarding/database')

function isValidHexColor(color) {
  return /^#([0-9A-F]{3}){1,2}$/i.test(color)
}

function hexToDecimal(hex) {
  return parseInt(hex.replace('#', ''), 16)
}

function isValidURL(str) {
  try { new URL(str); return true } catch { return false }
}

async function assignAutoRoles(member, config) {
  if (!config || config.auto_roles_ativo !== 1) return
  const roleIds = config.auto_roles || []
  if (!roleIds.length) return

  const validRoleIds = roleIds.filter(id => member.guild.roles.cache.has(id))
  if (!validRoleIds.length) return

  try {
    await member.roles.add(validRoleIds)
  } catch (err) {
    console.error('[onboarding] Error assigning auto roles:', err.message)
  }
}

module.exports = {
  name: 'guildMemberAdd',

  async execute(client, member) {
    let config = null
    try {
      config = await db.getConfig(member.guild.id)
    } catch (err) {
      console.error('[onboarding] Error loading config:', err.message)
      return
    }

    await assignAutoRoles(member, config)

    try {
      if (!config || config.ativo !== 1) return

      const accentColor =
        config.cor && isValidHexColor(config.cor)
          ? hexToDecimal(config.cor)
          : null

      const container = new ContainerBuilder()

      if (accentColor !== null) container.setAccentColor(accentColor)

      if (config.descricao) {
        const content = config.descricao
          .replace(/\{user\}/g, member.user.username)
          .replace(/\{server\}/g, member.guild.name)
        container.addTextDisplayComponents(td => td.setContent(content))
      }

      if (config.imagem && isValidURL(config.imagem)) {
        container.addMediaGalleryComponents(gallery =>
          gallery.addItems({ media: { url: config.imagem } })
        )
      }

      if (config.thumbnail && isValidURL(config.thumbnail)) {
        container.addMediaGalleryComponents(gallery =>
          gallery.addItems({ media: { url: config.thumbnail } })
        )
      }

      if (config.footer) {
        container.addTextDisplayComponents(td => td.setContent(`-# ${config.footer}`))
      }

      if (config.links && config.links.length > 0) {
        container.addActionRowComponents(row => {
          for (const link of config.links) {
            row.addComponents(
              new ButtonBuilder()
                .setLabel(link.nome)
                .setURL(link.url)
                .setStyle(ButtonStyle.Link)
            )
          }
          return row
        })
      }

      await member.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      })
    } catch (err) {
      // DMs can fail if the user has them disabled — silently ignore
      if (err.code !== 50007) {
        console.error('[onboarding] Error sending welcome DM:', err.message)
      }
    }
  },
}
