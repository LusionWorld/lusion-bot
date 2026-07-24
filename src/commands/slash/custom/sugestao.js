const { ApplicationCommandType, ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } = require('discord.js')
const { JsonDatabase } = require('wio.db')
const path = require('path')

module.exports = {
    name: "sugestao",
    nameKey: "cmd_sugestao_name",
    description: "⚙️ Configure o sistema de sugestões",
    descriptionKey: "cmd_sugestao_desc",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "configurar",
            description: "Configure o canal de sugestões",
            descriptionKey: "opt_sugestao_configurar_desc",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "canal",
                    description: "Canal onde as sugestões serão enviadas",
                    descriptionKey: "opt_sugestao_canal_desc",
                    type: ApplicationCommandOptionType.Channel,
                    required: true,
                }
            ]
        },
        {
            name: "desativar",
            description: "Desativa o sistema de sugestões",
            descriptionKey: "opt_sugestao_desativar_desc",
            type: ApplicationCommandOptionType.Subcommand,
        },
        {
            name: "status",
            description: "Veja o status do sistema de sugestões",
            descriptionKey: "opt_sugestao_status_desc",
            type: ApplicationCommandOptionType.Subcommand,
        }
    ],

    async run(client, interaction) {

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ You must be an **Administrator** to use this command.',
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

            const permissions = canal.permissionsFor(interaction.guild.members.me)
            if (!permissions.has(['SendMessages', 'CreatePublicThreads', 'ManageThreads'])) {
                return interaction.reply({
                    content: '❌ **Error:** I do not have permission to send messages, create or manage threads in that channel.',
                    flags: MessageFlags.Ephemeral
                })
            }

            db.set('canal_sugestao', canal.id)
            db.set('ativo', true)

            return interaction.reply({
                content: `✅ **Suggestions system configured!**\n\n📍 Channel: ${canal}\n\n💡 Now, whenever someone sends a message in that channel, a thread will be created automatically with voting buttons!`,
                flags: MessageFlags.Ephemeral
            })
        }

        if (subcommand === 'desativar') {
            const ativo = db.get('ativo')

            if (!ativo) {
                return interaction.reply({
                    content: '❌ The suggestions system is already disabled.',
                    flags: MessageFlags.Ephemeral
                })
            }

            db.set('ativo', false)

            return interaction.reply({
                content: '✅ **Suggestions system disabled successfully!**',
                flags: MessageFlags.Ephemeral
            })
        }

        if (subcommand === 'status') {
            const ativo = db.get('ativo')
            const canalId = db.get('canal_sugestao')

            if (!ativo || !canalId) {
                return interaction.reply({
                    content: '❌ The suggestions system is not configured.\n\nUse `/sugestao configurar` to enable it.',
                    flags: MessageFlags.Ephemeral
                })
            }

            const canal = interaction.guild.channels.cache.get(canalId)

            return interaction.reply({
                content: `**📊 Suggestions System Status**\n\n✅ **Status:** Active\n📍 **Channel:** ${canal || 'Channel not found'}\n\n💡 Messages sent in the channel will be turned into suggestions with automatic threads.`,
                flags: MessageFlags.Ephemeral
            })
        }
    }
}