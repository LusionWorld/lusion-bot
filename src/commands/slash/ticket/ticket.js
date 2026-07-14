const {
  ChannelType,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js')

const fs = require('fs')
const path = require('path')
const { JsonDatabase } = require('wio.db')

const PROJECT_ROOT = path.resolve(__dirname, '../../../../')

const { getEmojis } = require("../../../utils/emojis/emojiHelper");
const { t } = require("../../../utils/i18n");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

function getPersonalizacaoDB(guildId) {
  return new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../../banco/ticket/${guildId}/personalizacao.json`,
    ),
  })
}

async function garantirConfigsExistem(guildId) {
  try {
    const startTicketPath = path.join(__dirname, '../../../interactions/ticket/start-ticket.js')

    if (!fs.existsSync(startTicketPath)) {
      console.log('❌ start-ticket.js não encontrado!')
      return false
    }

    delete require.cache[require.resolve(startTicketPath)]
    const startTicket = require(startTicketPath)

    const basePath = path.join(PROJECT_ROOT, 'banco/ticket', guildId)
    const configPath = path.join(basePath, 'config.json')
    const personalizacaoPath = path.join(basePath, 'personalizacao.json')

    if (!fs.existsSync(configPath) || !fs.existsSync(personalizacaoPath)) {
      const resultado = await startTicket.criarEstruturaPadrao(guildId, false)
      return resultado.success
    }

    return true
  } catch (error) {
    console.error(
      `[ERRO] Falha ao garantir configs para guildId=${guildId}:`,
      error,
    )
    return false
  }
}

module.exports = {
  name: 'ticket',
  description: 'Enviar painel de tickets com botão ou select',
  name_localizations: {
    'en-US': 'ticket',
    'es-ES': 'ticket',
  },
  description_localizations: {
    'en-US': 'Send a ticket panel with button or select menu',
    'es-ES': 'Enviar un panel de tickets con botón o select',
  },
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),

  options: [
    {
      name: 'tipo',
      description: 'Tipo de painel para abrir ticket',
      nameLocalizations: { 'en-US': 'type', 'es-ES': 'tipo' },
      descriptionLocalizations: {
        'en-US': 'Panel type to open ticket',
        'es-ES': 'Tipo de panel para abrir ticket',
      },
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        {
          name: 'Botão',
          value: 'botao',
          nameLocalizations: { 'en-US': 'Button', 'es-ES': 'Botón' },
        },
        {
          name: 'Select',
          value: 'select',
          nameLocalizations: { 'en-US': 'Select', 'es-ES': 'Select' },
        },
      ],
    },
  ],

  run: async (client, interaction) => {
    const guildId = interaction.guild.id

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const criou = await garantirConfigsExistem(guildId)

    if (!criou) {
      return interaction.editReply({
        content: t('ticket_cmd_erro_config', guildId),
      })
    }

    const configPath = path.join(
      PROJECT_ROOT,
      'banco/ticket',
      guildId,
      'config.json',
    )

    let config = {}
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    } else {
      await new Promise((resolve) => setTimeout(resolve, 500))

      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      } else {
        return interaction.editReply({
          content: t('ticket_cmd_erro_config2', guildId),
        })
      }
    }

    const userId = interaction.user.id
    const isAdmin = interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator,
    )
    const hasConfigPerm =
      config.usersperms?.[userId]?.includes('Configurar bot')

    if (!isAdmin && !hasConfigPerm) {
      return interaction.editReply({
        content: t('ticket_cmd_sem_permissao', guildId),
      })
    }

    const tipo = interaction.options.getString('tipo')
    const db = getPersonalizacaoDB(guildId)
    const embedData = db.get('embedprincipal')

    if (!embedData) {
      return interaction.editReply({
        content: t('ticket_cmd_sem_personalizacao', guildId),
      })
    }

    function parseColor(colorString) {
      if (!colorString || colorString === '' || colorString === ' ') return null

      if (typeof colorString === 'number') return colorString

      const cleanColor = colorString.replace('#', '')
      const colorInt = parseInt(cleanColor, 16)

      return !isNaN(colorInt) ? colorInt : null
    }

    function parseEmoji(emojiString, guild) {
      if (!emojiString) return null
      if (/^[\u{1F000}-\u{1FFFF}]+$/u.test(emojiString))
        return { name: emojiString }
      const match = emojiString.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/)
      if (match) return { id: match[2], name: match[1] }
      const cleanName = emojiString.replace(/:/g, '')
      const foundEmoji = guild.emojis.cache.find((e) => e.name === cleanName)
      if (foundEmoji)
        return {
          id: foundEmoji.id,
          name: foundEmoji.name,
          animated: foundEmoji.animated,
        }
      return null
    }

    if (tipo === 'botao') {
      const botoes = embedData.botoes || []
      if (botoes.length === 0) {
        const containerConfig = new ContainerBuilder()
          .setAccentColor(parseColor(embedData.color))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t('ticket_cmd_painel_botao_titulo', guildId),
            ),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t('ticket_cmd_painel_botao_vazio', guildId),
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('botao_adicionar')
                .setLabel(t('ticket_cmd_btn_adicionar', guildId))
                .setEmoji(getEmoji(emojis.plus))
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('botao_remover')
                .setLabel(t('ticket_cmd_btn_remover', guildId))
                .setEmoji(getEmoji(emojis.minus))
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('botao_editar')
                .setLabel(t('ticket_cmd_btn_editar', guildId))
                .setEmoji(getEmoji(emojis.title))
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('sistema_ticket')
                .setLabel(t('ticket_cmd_btn_voltar', guildId))
                .setEmoji(getEmoji(emojis.arrowl))
                .setStyle(ButtonStyle.Secondary),
            ),
          )

        return interaction.editReply({
          components: [containerConfig],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      function getButtonStyle(cor) {
        if (!cor) return ButtonStyle.Primary
        const styleKey = cor.toUpperCase()
        const map = {
          PRIMARY: ButtonStyle.Primary,
          SECONDARY: ButtonStyle.Secondary,
          SUCCESS: ButtonStyle.Success,
          DANGER: ButtonStyle.Danger,
          LINK: ButtonStyle.Link,
        }
        return map[styleKey] || ButtonStyle.Primary
      }

      const containerTicket = new ContainerBuilder()

      const accentColor = parseColor(embedData.color)
      if (accentColor !== null) {
        containerTicket.setAccentColor(accentColor)
      }

      containerTicket.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**${embedData.title || '🎫 Painel de Tickets'}**`,
        ),
      )

      if (embedData.descricao) {
        containerTicket.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            embedData.descricao || 'Abra seu ticket usando o painel abaixo.',
          ),
        )
      }

      if (
        embedData.banner &&
        typeof embedData.banner === 'string' &&
        embedData.banner.startsWith('http')
      ) {
        containerTicket.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(embedData.banner),
          ),
        )
      }

      containerTicket.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small),
      )

      const botoesFormatados = botoes.map((botao) => {
        const button = new ButtonBuilder()
          .setCustomId(`ticket_botoes_${botao.id}`)
          .setLabel(botao.nome || 'Abrir')
          .setStyle(getButtonStyle(botao.cor))

        if (botao.emoji && typeof botao.emoji === 'string') {
          const parsedEmoji = parseEmoji(botao.emoji, interaction.guild)
          if (parsedEmoji) button.setEmoji(parsedEmoji)
        }

        return button
      })

      for (let i = 0; i < botoesFormatados.length; i += 5) {
        containerTicket.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            botoesFormatados.slice(i, i + 5),
          ),
        )
      }

      await interaction.editReply({
        content: t('ticket_cmd_enviado', guildId),
      })

      const mensagemEnviada = await interaction.channel.send({
        components: [containerTicket],
        flags: MessageFlags.IsComponentsV2,
      })

      db.set('embedprincipal.messageId', mensagemEnviada.id)
      db.set('embedprincipal.channelId', interaction.channel.id)

      return
    } else if (tipo === 'select') {
      const selects = embedData.selects || []
      if (selects.length === 0) {
        const containerConfig = new ContainerBuilder()
          .setAccentColor(parseColor(embedData.color))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t('ticket_cmd_painel_select_titulo', guildId),
            ),
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t('ticket_cmd_painel_select_vazio', guildId),
            ),
          )
          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('select_adicionar')
                .setLabel(t('ticket_cmd_btn_adicionar', guildId))
                .setEmoji(getEmoji(emojis.plus))
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('select_remover')
                .setLabel(t('ticket_cmd_btn_remover', guildId))
                .setEmoji(getEmoji(emojis.minus))
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('select_editar')
                .setLabel(t('ticket_cmd_btn_editar', guildId))
                .setEmoji(getEmoji(emojis.title))
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('sistema_ticket')
                .setLabel(t('ticket_cmd_btn_voltar', guildId))
                .setEmoji(getEmoji(emojis.arrowl))
                .setStyle(ButtonStyle.Secondary),
            ),
          )

        return interaction.editReply({
          components: [containerConfig],
          flags: MessageFlags.IsComponentsV2,
        })
      }

      const options = selects.map((sel) => {
        const option = {
          label: sel.nome || 'Ticket',
          value: `select_${sel.id}`,
        }

        if (sel.descricao && sel.descricao.trim() !== '') {
          option.description = sel.descricao
        } else {
          option.description = `Abrir ticket para: ${sel.nome || 'Atendimento'}`
        }

        if (sel.emoji && typeof sel.emoji === 'string') {
          const parsedEmoji = parseEmoji(sel.emoji, interaction.guild)

          if (parsedEmoji) {
            if (parsedEmoji.id) {
              const emojiExists = interaction.guild.emojis.cache.has(parsedEmoji.id)
              if (emojiExists) {
                option.emoji = parsedEmoji
              }
            } else {
              option.emoji = parsedEmoji
            }
          }
        }

        return option
      })

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select')
        .setPlaceholder(t('ticket_cmd_select_placeholder', guildId))
        .addOptions(options)

      const containerTicket = new ContainerBuilder()

      const accentColor = parseColor(embedData.color)
      if (accentColor !== null) {
        containerTicket.setAccentColor(accentColor)
      }

      containerTicket.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**${embedData.title || '🎫 Painel de Tickets'}**`,
        ),
      )

      if (embedData.descricao) {
        containerTicket.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            embedData.descricao || 'Abra seu ticket usando o painel abaixo.',
          ),
        )
      }

      if (
        embedData.banner &&
        typeof embedData.banner === 'string' &&
        embedData.banner.startsWith('http')
      ) {
        containerTicket.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(embedData.banner),
          ),
        )
      }

      containerTicket.addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small),
      )

      containerTicket.addActionRowComponents(
        new ActionRowBuilder().addComponents(selectMenu),
      )

      await interaction.editReply({
        content: t('ticket_cmd_enviado', guildId),
      })

      const mensagemEnviada = await interaction.channel.send({
        components: [containerTicket],
        flags: MessageFlags.IsComponentsV2,
      })

      db.set('embedprincipal.messageId', mensagemEnviada.id)
      db.set('embedprincipal.channelId', interaction.channel.id)

      return
    }
  },
}
