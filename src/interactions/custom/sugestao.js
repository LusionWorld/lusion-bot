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
    em_analise: { label: 'Em análise', emoji: emojis.clock,   dbValue: 'em_analise' },
    aceito:     { label: 'Aceito',     emoji: emojis.success, dbValue: 'aceito'     },
    rejeitado:  { label: 'Rejeitado',  emoji: emojis.cancel,  dbValue: 'rejeitado'  },
    nao_agora:  { label: 'Não agora',  emoji: emojis.warning, dbValue: 'nao_agora'  },
}

module.exports = {
    async execute(_client, interaction) {
        // ── Botão "Equipe" na sugestão — abre modal com StringSelect ──────────
        if (interaction.isButton() && interaction.customId.startsWith('sugestao_equipe_')) {
            const sugestaoId = interaction.customId.replace('sugestao_equipe_', '')

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: '❌ Apenas **Administradores** podem gerenciar sugestões.',
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
                    content: '❌ Sugestão não encontrada.',
                    flags: MessageFlags.Ephemeral,
                })
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('sugestao_status_select')
                .setPlaceholder('Selecione o status...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Em análise')
                        .setValue(`em_analise__${sugestaoId}`)
                        .setEmoji(getEmoji(emojis.clock)),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Aceito')
                        .setValue(`aceito__${sugestaoId}`)
                        .setEmoji(getEmoji(emojis.success)),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Rejeitado')
                        .setValue(`rejeitado__${sugestaoId}`)
                        .setEmoji(getEmoji(emojis.cancel)),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Não agora')
                        .setValue(`nao_agora__${sugestaoId}`)
                        .setEmoji(getEmoji(emojis.warning)),
                )

            const label = new LabelBuilder()
                .setLabel('Status da Sugestão')
                .setDescription('Selecione o novo status para esta sugestão')
                .setStringSelectMenuComponent(selectMenu)

            const modal = new ModalBuilder()
                .setCustomId(`sugestao_status_modal_${sugestaoId}`)
                .setTitle('Definir Status')
                .addLabelComponents(label)

            return interaction.showModal(modal)
        }

        // ── Modal submit — aplica o status selecionado ─────────────────────────
        if (interaction.isModalSubmit() && interaction.customId.startsWith('sugestao_status_modal_')) {
            const sugestaoId = interaction.customId.replace('sugestao_status_modal_', '')

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: '❌ Apenas **Administradores** podem gerenciar sugestões.',
                    flags: MessageFlags.Ephemeral,
                })
            }

            const selectedValue = interaction.fields.getField('sugestao_status_select').values?.[0]
            if (!selectedValue) return

            // value format: <statusKey>__<sugestaoId>
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
                    content: '❌ Sugestão não encontrada.',
                    flags: MessageFlags.Ephemeral,
                })
            }

            db.set(`${sugestaoId}.status`, statusInfo.dbValue)

            // Atualiza a mensagem original da sugestão no canal
            try {
                const msg = await interaction.channel.messages.fetch(sugestao.mensagemId).catch(() => null)
                if (msg) {
                    const upCount = (sugestao.upvotes || []).length
                    const downCount = (sugestao.downvotes || []).length

                    const updatedContainer = new ContainerBuilder()
                        .addTextDisplayComponents((text) =>
                            text.setContent(`${emojis.message} **Sugestão de <@${sugestao.autorId}>**`)
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
                                        item.setURL(url).setDescription(`Imagem ${index + 1} da sugestão`)
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
                            text.setContent(`${emojis.sparks} **Votação**`)
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
                            text.setContent(`**Lusion**`)
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
                content: `${statusInfo.emoji} Status atualizado para **${statusInfo.label}**!`,
                flags: MessageFlags.Ephemeral,
            })
        }
    },
}
