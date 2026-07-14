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
const { t } = require("../../../utils/i18n");
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
  name_localizations: {
    'en-US': 'staff-panel',
    'es-ES': 'panel-staff',
  },
  description_localizations: {
    'en-US': 'Opens the staff management panel for tickets.',
    'es-ES': 'Abre el panel de gestión del staff en el ticket.',
  },
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
  options: [],

  run: async (client, interaction) => {
    const guildId = interaction.guildId;

    if (!interaction.guild || !guildId) {
      return interaction.reply({
        content: t('painel_staff_erro_servidor', guildId),
        flags: MessageFlags.Ephemeral,
      })
    }

    const canal = interaction.channel

    if (!canal.topic || !canal.topic.startsWith('Labz - ')) {
      return interaction.reply({
        content: t('painel_staff_erro_ticket', guildId),
        flags: MessageFlags.Ephemeral,
      })
    }

    const configPath = path.resolve(
      __dirname,
      `../../../../banco/ticket/${guildId}/config.json`,
    )

    if (!fs.existsSync(configPath)) {
      return interaction.reply({
        content: t('painel_staff_erro_config', guildId),
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
        content: t('painel_staff_erro_permissao', guildId),
        flags: MessageFlags.Ephemeral,
      })
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(t('painel_staff_titulo', guildId)),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(t('painel_staff_desc', guildId)),
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('painel_staff_select')
            .setPlaceholder(t('painel_staff_placeholder', guildId))
            .addOptions([
              {
                label: t('painel_staff_assumir', guildId),
                value: 'assumir_ticket',
                emoji: getEmoji(emojis.check),
              },
              {
                label: t('painel_staff_renomear', guildId),
                value: 'renomear_ticket',
                emoji: getEmoji(emojis.title),
              },
              {
                label: t('painel_staff_notificar', guildId),
                value: 'notificar_usuario',
                emoji: getEmoji(emojis.send),
              },
              {
                label: t('painel_staff_criar_call', guildId),
                value: 'criar_call',
                emoji: getEmoji(emojis.mic),
              },
              {
                label: t('painel_staff_deletar_call', guildId),
                value: 'deletar_call',
                emoji: getEmoji(emojis.trashcan),
              },
              {
                label: t('painel_staff_adicionar_membro', guildId),
                value: 'adicionar_membro',
                emoji: getEmoji(emojis.invite),
              },
              {
                label: t('painel_staff_remover_membro', guildId),
                value: 'remover_membro',
                emoji: getEmoji(emojis.minus),
              },
              {
                label: t('painel_staff_fechar_ticket', guildId),
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
