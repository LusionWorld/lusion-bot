const {
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require('discord.js')
const { JsonDatabase } = require('wio.db')
const path = require('path')
const emojis = require('../../utils/emojis/emojis.json');
function getEmoji(raw) {
    if (!raw) return null;
    const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
    if (!match) return null;
    const [, name, id] = match;
    return { name, id };
}

module.exports = {
    name: Events.MessageCreate,
    async execute(client, message) {
        if (message.author.bot || !message.guild) return

        const dbPath = path.join(
            __dirname,
            `../../../banco/sugestao/${message.guild.id}/config.json`
        )

        let db
        try {
            db = new JsonDatabase({ databasePath: dbPath })
        } catch (err) {
            return
        }

        const ativo = db.get('ativo')
        const canalSugestao = db.get('canal_sugestao')

        if (!ativo || message.channel.id !== canalSugestao) return

        try {
            const sugestoesPath = path.join(
                __dirname,
                `../../../banco/sugestao/${message.guild.id}/sugestoes.json`
            )
            const dbSugestoes = new JsonDatabase({ databasePath: sugestoesPath })

            const sugestaoId = `sugestao_${Date.now()}`
            const imageAttachments = message.attachments.filter(att => att.contentType?.startsWith('image/'))
            const conteudo = message.content || 'Suggestion with image'
            const hasImages = imageAttachments.size > 0

            const imageUrls = []
            if (hasImages) {
                imageAttachments.forEach(att => {
                    imageUrls.push(att.url)
                })
            }

            const container = new ContainerBuilder()
                .addTextDisplayComponents((text) =>
                    text.setContent(`${emojis.message} **Suggestion from ${message.author}**`)
                )
                .addSeparatorComponents((sep) =>
                    sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents((text) =>
                    text.setContent(conteudo)
                )

            if (imageUrls.length > 0) {
                container
                    .addSeparatorComponents((sep) =>
                        sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
                    )
                    .addMediaGalleryComponents((gallery) => {
                        imageUrls.forEach((url, index) => {
                            gallery.addItems((item) =>
                                item.setURL(url).setDescription(`Suggestion image ${index + 1}`)
                            )
                        })
                        return gallery
                    })
            }

            container
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
                            .setLabel('0')
                            .setEmoji(getEmoji(emojis.check))
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`sugestao_downvote_${sugestaoId}`)
                            .setLabel('0')
                            .setEmoji(getEmoji(emojis.cancel))
                            .setStyle(ButtonStyle.Secondary)
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
                            .setLabel('Staff')
                            .setEmoji(getEmoji(emojis.settings))
                            .setStyle(ButtonStyle.Secondary)
                    )
                )
                .addSeparatorComponents((sep) =>
                    sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents((text) =>
                    text.setContent(`<t:${Math.floor(Date.now() / 1000)}:R> • ID: \`${sugestaoId}\``)
                )

            const sugestaoMsg = await message.channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            })

            await message.delete()

            const thread = await sugestaoMsg.startThread({
                name: `💡 ${conteudo.substring(0, 80)}`,
                autoArchiveDuration: 1440,
                reason: 'Suggestion discussion thread created automatically'
            })

            dbSugestoes.set(sugestaoId, {
                autorId: message.author.id,
                autorNome: message.author.username,
                conteudo: conteudo,
                hasImages: hasImages,
                imageUrls: imageUrls,
                mensagemId: sugestaoMsg.id,
                threadId: thread.id,
                upvotes: [],
                downvotes: [],
                status: 'pendente',
                criadaEm: Date.now()
            })

        } catch (error) {
            console.error('❌ Error processing suggestion:', error)

            try {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addTextDisplayComponents((text) =>
                        text.setContent(`❌ **Error**`)
                    )
                    .addSeparatorComponents((sep) =>
                        sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                    )
                    .addTextDisplayComponents((text) =>
                        text.setContent(`${message.author}, an error occurred while processing your suggestion. Please try again.`)
                    )

                await message.channel.send({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                }).then(msg => setTimeout(() => msg.delete(), 5000))
            } catch { }
        }
    }
}
