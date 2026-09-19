const { ApplicationCommandType, ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } = require('discord.js')
const sugestaoRepo = require('../../../utils/sugestao/repository')

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

        const guildId = interaction.guild.id
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

            await sugestaoRepo.setConfig(guildId, { canal_sugestao: canal.id, ativo: true })

            return interaction.reply({
                content: `✅ **Suggestions system configured!**\n\n📍 Channel: ${canal}\n\n💡 Now, whenever someone sends a message in that channel, a thread will be created automatically with voting buttons!`,
                flags: MessageFlags.Ephemeral
            })
        }

        if (subcommand === 'desativar') {
            const config = await sugestaoRepo.getConfig(guildId)

            if (!config?.ativo) {
                return interaction.reply({
                    content: '❌ The suggestions system is already disabled.',
                    flags: MessageFlags.Ephemeral
                })
            }

            await sugestaoRepo.setConfig(guildId, { ativo: false })

            return interaction.reply({
                content: '✅ **Suggestions system disabled successfully!**',
                flags: MessageFlags.Ephemeral
            })
        }

        if (subcommand === 'status') {
            const config = await sugestaoRepo.getConfig(guildId)
            const ativo = config?.ativo
            const canalId = config?.canal_sugestao

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