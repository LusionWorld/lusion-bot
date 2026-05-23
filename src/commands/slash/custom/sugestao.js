const { ApplicationCommandType, ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } = require('discord.js')
const { JsonDatabase } = require('wio.db')
const path = require('path')

module.exports = {
    name: "sugestao",
    description: "⚙️ Configure o sistema de sugestões",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "configurar",
            description: "Configure o canal de sugestões",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "canal",
                    description: "Canal onde as sugestões serão enviadas",
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                }
            ]
        },
        {
            name: "desativar",
            description: "Desativa o sistema de sugestões",
            type: ApplicationCommandOptionType.Subcommand,
        },
        {
            name: "status",
            description: "Veja o status do sistema de sugestões",
            type: ApplicationCommandOptionType.Subcommand,
        }
    ],

    async run(client, interaction) {

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Você precisa ser **Administrador** para usar este comando.',
                flags: MessageFlags.Ephemeral
            })
        }

        const dbPath = path.join(
            __dirname,
            `../../../../banco/sugestao/${interaction.guild.id}/config.json`
        )
        const db = new JsonDatabase({ databasePath: dbPath })

        const subcommand = interaction.options.getSubcommand()

        if (subcommand === 'configurar') {
            const canal = interaction.options.getChannel('canal')

            // Verificar se o bot tem permissões no canal
            const permissions = canal.permissionsFor(interaction.guild.members.me)
            if (!permissions.has(['SendMessages', 'CreatePublicThreads', 'ManageThreads'])) {
                return interaction.reply({
                    content: '❌ **Erro:** Não tenho permissão para enviar mensagens, criar ou gerenciar tópicos nesse canal.',
                    flags: MessageFlags.Ephemeral
                })
            }

            db.set('canal_sugestao', canal.id)
            db.set('ativo', true)

            return interaction.reply({
                content: `✅ **Sistema de sugestões configurado!**\n\n📍 Canal: ${canal}\n\n💡 Agora quando alguém enviar uma mensagem nesse canal, um tópico será criado automaticamente com botões de votação!`,
                flags: MessageFlags.Ephemeral
            })
        }

        if (subcommand === 'desativar') {
            const ativo = db.get('ativo')

            if (!ativo) {
                return interaction.reply({
                    content: '❌ O sistema de sugestões já está desativado.',
                    flags: MessageFlags.Ephemeral
                })
            }

            db.set('ativo', false)

            return interaction.reply({
                content: '✅ **Sistema de sugestões desativado com sucesso!**',
                flags: MessageFlags.Ephemeral
            })
        }

        if (subcommand === 'status') {
            const ativo = db.get('ativo')
            const canalId = db.get('canal_sugestao')

            if (!ativo || !canalId) {
                return interaction.reply({
                    content: '❌ O sistema de sugestões não está configurado.\n\nUse `/sugestao configurar` para ativar.',
                    flags: MessageFlags.Ephemeral
                })
            }

            const canal = interaction.guild.channels.cache.get(canalId)

            return interaction.reply({
                content: `**📊 Status do Sistema de Sugestões**\n\n✅ **Status:** Ativo\n📍 **Canal:** ${canal || 'Canal não encontrado'}\n\n💡 Mensagens enviadas no canal serão transformadas em sugestões com tópicos automáticos.`,
                flags: MessageFlags.Ephemeral
            })
        }
    }
}