const {
  ApplicationCommandType,
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionsBitField
} = require('discord.js')

const fs = require('fs')
const path = require('path')
const { JsonDatabase } = require('wio.db')

const { getEmojis } = require("../../../utils/emojis/emojiHelper");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

function getConfigDB(guildId) {
  return new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../../banco/ticket/${guildId}/config.json`,
    ),
  })
}

module.exports = {
  name: 'painel-staff',
  description: 'Abre o painel de gerenciamento do staff no ticket.',
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

    const canal = interaction.channel

    if (!canal.topic || !canal.topic.startsWith('Labz - ')) {
      return interaction.reply({
        content: '❌ Este comando só pode ser usado dentro de um ticket.',
        flags: MessageFlags.Ephemeral,
      })
    }

    const guildId = interaction.guild.id
    const configPath = path.resolve(
      __dirname,
      `../../../../banco/ticket/${guildId}/config.json`,
    )

    if (!fs.existsSync(configPath)) {
      return interaction.reply({
        content: '❌ Sistema de tickets não configurado neste servidor.',
        flags: MessageFlags.Ephemeral,
      })
    }

    const db = getConfigDB(guildId)
    const teamRoles = db.get('team') || []
    const usersPerms = db.get('usersperms') || {}

    const hasTeamRole = interaction.member.roles.cache.some((role) =>
      teamRoles.includes(role.id),
    )
    const hasUserPerm =
      usersPerms[interaction.user.id]?.includes('Atender ticket')

    if (!hasTeamRole && !hasUserPerm) {
      return interaction.reply({
        content: '❌ Você não tem permissão para acessar o Painel Staff.',
        flags: MessageFlags.Ephemeral,
      })
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('**Painel Staff**'),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          'Selecione uma ação abaixo para gerenciar este ticket:',
        ),
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('painel_staff_select')
            .setPlaceholder('Selecione uma ação')
            .addOptions([
              {
                label: 'Assumir ticket',
                value: 'assumir_ticket',
                emoji: getEmoji(emojis.check),
              },
              {
                label: 'Renomear ticket',
                value: 'renomear_ticket',
                emoji: getEmoji(emojis.title),
              },
              {
                label: 'Notificar usuário',
                value: 'notificar_usuario',
                emoji: getEmoji(emojis.send),
              },
              {
                label: 'Criar call',
                value: 'criar_call',
                emoji: getEmoji(emojis.mic),
              },
              {
                label: 'Deletar call',
                value: 'deletar_call',
                emoji: getEmoji(emojis.trashcan),
              },
              {
                label: 'Adicionar membro',
                value: 'adicionar_membro',
                emoji: getEmoji(emojis.invite),
              },
              {
                label: 'Remover membro',
                value: 'remover_membro',
                emoji: getEmoji(emojis.minus),
              },
              {
                label: 'Fechar ticket',
                value: 'fechar_ticket',
                emoji: getEmoji(emojis.lock),
              },
            ]),
        ),
      )

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    })
  },
}