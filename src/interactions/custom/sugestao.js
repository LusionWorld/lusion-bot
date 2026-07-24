const {
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits,
    ModalBuilder,
    LabelBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js')
const { JsonDatabase } = require('wio.db')
const path = require('path')
const emojis = require('../../utils/emojis/emojis.json')

function getEmoji(raw) {
    if (!raw) return null
    const match = raw.match(/^<a?:([^:]+):(\d+)>$/)
    if (!match) return null
    const [, name, id] = match
    return { name, id }
}

const STATUS_MAP = {
    em_analise:      { label: 'In Review',       emoji: emojis.clock,     dbValue: 'em_analise' },
    aceito:          { label: 'Accepted',        emoji: emojis.success,   dbValue: 'aceito' },
    rejeitado:       { label: 'Rejected',        emoji: emojis.cancel,    dbValue: 'rejeitado' },
    nao_agora:       { label: 'Not Now',         emoji: emojis.warning,   dbValue: 'nao_agora' },
    planejado:       { label: 'Planned',         emoji: emojis.calendar,  dbValue: 'planejado' },
    em_progresso:    { label: 'In Progress',     emoji: emojis.refresh,   dbValue: 'em_progresso' },
    ja_existe:       { label: 'Already Exists',  emoji: emojis.info,      dbValue: 'ja_existe' },
    implementado:    { label: 'Implemented',     emoji: emojis.check,     dbValue: 'implementado' },
}

module.exports = {
    async execute(_client, interaction) {
        if (interaction.isButton() && interaction.customId.startsWith('sugestao_equipe_')) {
            const sugestaoId = interaction.customId.replace('sugestao_equipe_', '')

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: '❌ Only **Administrators** can manage suggestions.',
                    flags: MessageFlags.Ephemeral,
                })
            }

            const dbPath = path.join(
                __dirname,
                `../../../banco/sugestao/${interaction.guild.id}/sugestoes.json`
            )
            const db = new JsonDatabase({ databasePath: dbPath })
            const sugestao = db.get(sugestaoId)

            if (!sugestao) {
                return interaction.reply({
                    content: '❌ Suggestion not found.',
                    flags: MessageFlags.Ephemeral,
                })
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('sugestao_status_select')
                .setPlaceholder('Select a status...')
                .addOptions(
                    Object.values(STATUS_MAP).map(status =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(status.label)
                            .setValue(`${status.dbValue}__${sugestaoId}`)
                            .setEmoji(getEmoji(status.emoji))
                    )
                )

            const label = new LabelBuilder()
                .setLabel('Suggestion Status')
                .setDescription('Select the new status for this suggestion')
                .setStringSelectMenuComponent(selectMenu)

            const modal = new ModalBuilder()
                .setCustomId(`sugestao_status_modal_${sugestaoId}`)
                .setTitle('Set Status')
                .addLabelComponents(label)

            return interaction.showModal(modal)
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('sugestao_status_modal_')) {
            const sugestaoId = interaction.customId.replace('sugestao_status_modal_', '')

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: '❌ Only **Administrators** can manage suggestions.',
                    flags: MessageFlags.Ephemeral,
                })
            }

            const selectedValue = interaction.fields.getField('sugestao_status_select').values?.[0]
            if (!selectedValue) return

            const [statusKey] = selectedValue.split('__')
            const statusInfo = STATUS_MAP[statusKey]
            if (!statusInfo) return

            const dbPath = path.join(
                __dirname,
                `../../../banco/sugestao/${interaction.guild.id}/sugestoes.json`
            )
            const db = new JsonDatabase({ databasePath: dbPath })
            const sugestao = db.get(sugestaoId)

            if (!sugestao) {
                return interaction.reply({
                    content: '❌ Suggestion not found.',
                    flags: MessageFlags.Ephemeral,
                })
            }

            db.set(`${sugestaoId}.status`, statusInfo.dbValue)

            try {
                const msg = await interaction.channel.messages.fetch(sugestao.mensagemId).catch(() => null)
                if (msg) {
                    const upCount = (sugestao.upvotes || []).length
                    const downCount = (sugestao.downvotes || []).length

                    const updatedContainer = new ContainerBuilder()
                        .addTextDisplayComponents((text) =>
                            text.setContent(`${emojis.message} **Suggestion from <@${sugestao.autorId}>**`)
                        )
                        .addSeparatorComponents((sep) =>
                            sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                        )
                        .addTextDisplayComponents((text) =>
                            text.setContent(sugestao.conteudo)
                        )

                    if (sugestao.hasImages && sugestao.imageUrls?.length > 0) {
                        updatedContainer
                            .addSeparatorComponents((sep) =>
                                sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
                            )
                            .addMediaGalleryComponents((gallery) => {
                                sugestao.imageUrls.forEach((url, index) => {
                                    gallery.addItems((item) =>
                                        item.setURL(url).setDescription(`Suggestion image ${index + 1}`)
                                    )
                                })
                                return gallery
                            })
                    }

                    updatedContainer
                        .addSeparatorComponents((sep) =>
                            sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                        )
                        .addTextDisplayComponents((text) =>
                            text.setContent(`🚀 **Voting**`)
                        )
                        .addActionRowComponents((row) =>
                            row.setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`sugestao_upvote_${sugestaoId}`)
                                    .setLabel(`${upCount}`)
                                    .setEmoji(getEmoji(emojis.check))
                                    .setStyle(ButtonStyle.Secondary)
                                    .setDisabled(true),
                                new ButtonBuilder()
                                    .setCustomId(`sugestao_downvote_${sugestaoId}`)
                                    .setLabel(`${downCount}`)
                                    .setEmoji(getEmoji(emojis.cancel))
                                    .setStyle(ButtonStyle.Secondary)
                                    .setDisabled(true)
                            )
                        )
                        .addSeparatorComponents((sep) =>
                            sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                        )
                        .addTextDisplayComponents((text) =>
                            text.setContent(`**Suggestion Status**`)
                        )
                        .addActionRowComponents((row) =>
                            row.setComponents(
                                new ButtonBuilder()
                                    .setCustomId(`sugestao_equipe_${sugestaoId}`)
                                    .setLabel(statusInfo.label)
                                    .setEmoji(getEmoji(statusInfo.emoji))
                                    .setStyle(ButtonStyle.Secondary)
                            )
                        )
                        .addSeparatorComponents((sep) =>
                            sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
                        )
                        .addTextDisplayComponents((text) =>
                            text.setContent(`<t:${Math.floor(sugestao.criadaEm / 1000)}:R> • ID: \`${sugestaoId}\``)
                        )

                    await msg.edit({
                        components: [updatedContainer],
                        flags: MessageFlags.IsComponentsV2,
                    })
                }
            } catch { }

            return interaction.reply({
                content: `${statusInfo.emoji} Status updated to **${statusInfo.label}**!`,
                flags: MessageFlags.Ephemeral,
            })
        }
    },
}
