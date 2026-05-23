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
  description: 'Envia um painel para configurar o sistema de tickets.',
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
  options: [],

  run: async (client, interaction) => {
    if (!interaction.guild || !interaction.guildId) {
      return interaction.reply({
        content: '❌ Este comando só pode ser usado em servidores.',
        flags: MessageFlags.Ephemeral,
      })
    }

    const guildId = interaction.guild.id

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const criou = await garantirConfigsExistem(guildId)

    if (!criou) {
      return interaction.editReply({
        content: '❌ Erro ao verificar/criar configurações. Tente novamente.',
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
          content:
            '❌ Erro ao criar configurações. Tente novamente em alguns segundos.',
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
        content: '❌ Você não tem permissão para usar este comando.',
      })
    }

    const buttonConfig = new ButtonBuilder()
      .setCustomId('configurar_ticket')
      .setLabel('Configurar')
      .setEmoji(getEmoji(emojis.settings))
      .setStyle(ButtonStyle.Primary)

    const buttonBanco = new ButtonBuilder()
      .setCustomId('banco_ticket')
      .setLabel('Banco de Dados')
      .setEmoji(getEmoji(emojis.cardbox))
      .setStyle(ButtonStyle.Primary)

    const buttonPix = new ButtonBuilder()
      .setCustomId('pix_ticket')
      .setLabel('Pix')
      .setEmoji(getEmoji(emojis.dollar))
      .setStyle(ButtonStyle.Primary)

    const enviarTicketBtn = new ButtonBuilder()
      .setCustomId('enviar_ticket_painel')
      .setLabel('Enviar Ticket')
      .setEmoji(getEmoji(emojis.embeds))
      .setStyle(ButtonStyle.Success)

    const iaSetupBtn = new ButtonBuilder()
      .setCustomId('ia_setup_inicial')
      .setLabel('Setup com IA')
      .setEmoji(getEmoji(emojis.bot))
      .setStyle(ButtonStyle.Success)

    const buttonSuporte = new ButtonBuilder()
      .setLabel('Suporte')
      .setEmoji(getEmoji(emojis.suporte))
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.gg/MmUB4H3uCM')

    const components = [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# Painel Principal | ${interaction.guild.name}`,
        ),
      ),
      new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `Use os botões abaixo para acessar as configurações e o banco de dados e muito mais!\n\n-# Ping do bot: ${client.ws.ping}ms`,
          ),
        )
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                '**Configurar Ticket**\nGerencie as configurações do sistema de tickets',
              ),
            )
            .setButtonAccessory(buttonConfig),
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                '**Banco de Dados**\nAcesse relatórios e estatísticas dos tickets',
              ),
            )
            .setButtonAccessory(buttonBanco),
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                '**Pix**\nConfigurações relacionadas ao sistema de pagamento',
              ),
            )
            .setButtonAccessory(buttonPix),
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                '**Enviar Ticket**\nEnvie o painel de tickets configurado em um canal específico',
              ),
            )
            .setButtonAccessory(enviarTicketBtn),
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                '**Setup com IA**\nDeixe a inteligência artificial configurar automaticamente seu sistema de tickets de forma rápida e personalizada',
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
                '**Suporte**\nPrecisa de ajuda? Entre em contato conosco!',
              ),
            )
            .setButtonAccessory(buttonSuporte),
        ),
    ]

    await interaction.editReply({
      components: components,
      flags: MessageFlags.IsComponentsV2,
      content: null,
    })
  },
}