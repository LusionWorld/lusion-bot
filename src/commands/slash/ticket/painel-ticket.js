const {
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  PermissionsBitField,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} = require('discord.js')

const fs = require('fs')
const path = require('path')

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
  name: 'painel-ticket',
  nameKey: 'cmd_painel_ticket_name',
  description: 'Envia um painel para configurar o sistema de tickets.',
  descriptionKey: 'cmd_painel_ticket_desc',
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
  options: [],

  run: async (client, interaction) => {
    const guildId = interaction.guild?.id

    if (!interaction.guild || !guildId) {
      return interaction.reply({
        content: t('painel_ticket_only_guild', guildId),
        flags: MessageFlags.Ephemeral,
      })
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const criou = await garantirConfigsExistem(guildId)

    if (!criou) {
      return interaction.editReply({
        content: t('painel_ticket_erro_config', guildId),
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
          content: t('painel_ticket_erro_config2', guildId),
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
        content: t('painel_ticket_sem_permissao', guildId),
      })
    }

    const buttonConfig = new ButtonBuilder()
      .setCustomId('configurar_ticket')
      .setLabel(t('btn_configurar', guildId))
      .setEmoji(getEmoji(emojis.settings))
      .setStyle(ButtonStyle.Primary)

    const buttonBanco = new ButtonBuilder()
      .setCustomId('banco_ticket')
      .setLabel(t('btn_banco', guildId))
      .setEmoji(getEmoji(emojis.cardbox))
      .setStyle(ButtonStyle.Primary)

    const buttonPix = new ButtonBuilder()
      .setCustomId('pix_ticket')
      .setLabel(t('btn_pix', guildId))
      .setEmoji(getEmoji(emojis.dollar))
      .setStyle(ButtonStyle.Primary)

    const enviarTicketBtn = new ButtonBuilder()
      .setCustomId('enviar_ticket_painel')
      .setLabel(t('btn_enviar_ticket', guildId))
      .setEmoji(getEmoji(emojis.embeds))
      .setStyle(ButtonStyle.Success)

    const iaSetupBtn = new ButtonBuilder()
      .setCustomId('ia_setup_inicial')
      .setLabel(t('btn_setup_ia', guildId))
      .setEmoji(getEmoji(emojis.bot))
      .setStyle(ButtonStyle.Success)

    const buttonSuporte = new ButtonBuilder()
      .setLabel(t('btn_suporte', guildId))
      .setEmoji(getEmoji(emojis.suporte))
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.gg/MmUB4H3uCM')

    const buttonIdioma = new ButtonBuilder()
      .setCustomId('config_idioma')
      .setLabel(t('btn_alterar_idioma', guildId))
      .setEmoji(getEmoji(emojis.world))
      .setStyle(ButtonStyle.Secondary)

    const components = [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          t('painel_ticket_titulo', guildId, { guild: interaction.guild.name }),
        ),
      ),
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            t('painel_ticket_desc', guildId, { ping: client.ws.ping }),
          ),
        )
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t('painel_ticket_sec_configurar', guildId),
              ),
            )
            .setButtonAccessory(buttonConfig),
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t('painel_ticket_sec_banco', guildId),
              ),
            )
            .setButtonAccessory(buttonBanco),
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t('painel_ticket_sec_pix', guildId),
              ),
            )
            .setButtonAccessory(buttonPix),
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t('painel_ticket_sec_enviar', guildId),
              ),
            )
            .setButtonAccessory(enviarTicketBtn),
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t('painel_ticket_sec_ia', guildId),
              ),
            )
            .setButtonAccessory(iaSetupBtn),
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
        )
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t('painel_ticket_sec_suporte', guildId),
              ),
            )
            .setButtonAccessory(buttonSuporte),
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t('painel_ticket_sec_idioma', guildId),
              ),
            )
            .setButtonAccessory(buttonIdioma),
        ),
    ]

    await interaction.editReply({
      components: components,
      flags: MessageFlags.IsComponentsV2,
      content: null,
    })
  },
}
