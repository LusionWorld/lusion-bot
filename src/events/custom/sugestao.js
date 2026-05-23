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
            const conteudo = message.content || 'Sugestão por imagem'
            const hasImages = imageAttachments.size > 0

            const imageUrls = []
            if (hasImages) {
                imageAttachments.forEach(att => {
                    imageUrls.push(att.url)
                })
            }

            const container = new ContainerBuilder()
                .addTextDisplayComponents((text) =>
                    text.setContent(`${emojis.message} **Sugestão de ${message.author}**`)
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
                                item.setURL(url).setDescription(`Imagem ${index + 1} da sugestão`)
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
                    text.setContent(`${emojis.sparks} **Votação**`)
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
                    text.setContent(`**Lusion**`)
                )
                .addActionRowComponents((row) =>
                    row.setComponents(
                        new ButtonBuilder()
                            .setCustomId(`sugestao_equipe_${sugestaoId}`)
                            .setLabel('Equipe')
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
                reason: 'Tópico de sugestão criado automaticamente'
            })

            const threadContainer = new ContainerBuilder()
                .addTextDisplayComponents((text) =>
                    text.setContent(`${emojis.thread} **Tópico de Discussão**`)
                )
                .addSeparatorComponents((sep) =>
                    sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents((text) =>
                    text.setContent(`${emojis.user} **Autor:** ${message.author}`)
                )
                // .addSeparatorComponents((sep) =>
                //     sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small)
                // )
                // .addTextDisplayComponents((text) =>
                //     text.setContent(`Use este espaço para discutir essa sugestão!\n\n⚠️ Mantenha o respeito e a civilidade.`)
                // )

            await thread.send({
                components: [threadContainer],
                flags: MessageFlags.IsComponentsV2
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

            console.log(`✅ Sugestão criada: ${sugestaoId} com ${imageUrls.length} imagem(ns)`)

        } catch (error) {
            console.error('❌ Erro ao processar sugestão:', error)

            try {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addTextDisplayComponents((text) =>
                        text.setContent(`❌ **Erro**`)
                    )
                    .addSeparatorComponents((sep) =>
                        sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                    )
                    .addTextDisplayComponents((text) =>
                        text.setContent(`${message.author}, ocorreu um erro ao processar sua sugestão. Tente novamente.`)
                    )

                await message.channel.send({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                }).then(msg => setTimeout(() => msg.delete(), 5000))
            } catch { }
        }
    }
}