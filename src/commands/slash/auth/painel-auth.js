const {
  ApplicationCommandType,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require("discord.js");
const ConfigManager = require("../../../utils/auth/configManager");
const axios = require("axios");

const API_URL = process.env.API_URL || "https://labzapi.squareweb.app";

const { getEmojis } = require("../../../utils/emojis/emojiHelper");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

async function getAuthStats(guildId) {
  try {
    const config = ConfigManager.getConfig(guildId);

    if (!config.oauth.clientId) {
      console.log(`⚠️ Client ID não encontrado para guild ${guildId}`);
      return { totalUsers: 0, activeUsers: 0 };
    }

    if (!config.apiKey) {
      console.log(
        `⚠️ API Key não encontrada para clientId ${config.oauth.clientId}`,
      );
      console.log(`💡 Reconfigure o Auth para gerar a API Key`);
      return { totalUsers: 0, activeUsers: 0 };
    }

    console.log(`📊 Buscando estatísticas para guild: ${guildId}`);
    console.log(`🔑 Usando API Key do clientId: ${config.oauth.clientId}`);
    console.log(`📡 URL da requisição: ${API_URL}/api/stats/${guildId}`);

    const response = await axios.get(`${API_URL}/api/stats/${guildId}`, {
      headers: {
        "x-api-key": config.apiKey,
      },
    });

    console.log(`✅ Resposta recebida:`, response.data);
    console.log(`👥 Total de usuários: ${response.data.totalUsers || 0}`);
    console.log(`✅ Usuários ativos: ${response.data.activeUsers || 0}`);

    return {
      totalUsers: response.data.totalUsers || 0,
      activeUsers: response.data.activeUsers || 0,
    };
  } catch (error) {
    console.error(
      `❌ Erro ao buscar stats para guild ${guildId}:`,
      error.message,
    );
    console.error(`❌ Status do erro:`, error.response?.status);
    console.error(`❌ Dados do erro:`, error.response?.data);

    return { totalUsers: 0, activeUsers: 0 };
  }
}

module.exports = {
  name: "painel-auth",
  description: "Painel de configuração do sistema de autenticação",
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dmPermission: false,

  async run(client, interaction) {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        content: "❌ Você precisa ser administrador para usar este comando.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const config = ConfigManager.getConfig(interaction.guild.id);
      const stats = await getAuthStats(interaction.guild.id);

      if (!client.authStatsCache) client.authStatsCache = new Map();
      client.authStatsCache.set(interaction.guild.id, stats);

      const components = buildMainPanel(config, stats, interaction.guild.id);

      await interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error("Erro ao carregar painel:", error);

      const errorComponents = buildErrorMessage(
        "Não foi possível carregar o painel de autenticação.",
      );
      await interaction.editReply({
        components: errorComponents,
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};

function buildMainPanel(config, stats, guildId) {
  const labzIcon = getEmoji(emojis.labz);
  const cloudIcon = getEmoji(emojis.cloud);
  const successIcon = getEmoji(emojis.success);
  const usersIcon = getEmoji(emojis.users);
  const shieldIcon = getEmoji(emojis.cloud);
  const keyIcon = getEmoji(emojis.key);
  const paletteIcon = getEmoji(emojis.colorpicker);
  const activityIcon = getEmoji(emojis.activity);

  const oauthConfigured = config.oauth.enabled
    ? "Configurado"
    : "Não configurado";
  const totalUsers = stats?.totalUsers || 0;
  const activeUsers = stats?.activeUsers || 0;

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(
            "https://cdn.discordapp.com/attachments/1336038554723160096/1410695553985151006/labz_banner_1.png",
          )
          .setDescription("Labz Cloud Banner"),
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        labzIcon && cloudIcon
          ? `# <:${cloudIcon.name}:${cloudIcon.id}> **Labz Cloud**`
          : "# ☁️ Labz Cloud",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Gerencie o sistema de autenticação e customize completamente seu site de forma profissional e segura.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        activityIcon
          ? `### <:${activityIcon.name}:${activityIcon.id}> Estatísticas do Sistema`
          : "### 📊 Estatísticas do Sistema",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          usersIcon ? `<:${usersIcon.name}:${usersIcon.id}>` : "👥"
        } **Total de Usuários**\n${totalUsers} ${
          totalUsers === 1 ? "usuário cadastrado" : "usuários cadastrados"
        }`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          successIcon ? `<:${successIcon.name}:${successIcon.id}>` : "✅"
        } **Usuários Ativos**\n${activeUsers} ${
          activeUsers === 1 ? "usuário ativo" : "usuários ativos"
        }`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${
          shieldIcon ? `<:${shieldIcon.name}:${shieldIcon.id}>` : "🔐"
        } **Status da Autenticação**\n${oauthConfigured}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`auth_open_config_${guildId}`)
          .setLabel("Configurar")
          .setStyle(ButtonStyle.Primary)
          .setEmoji(keyIcon ? { name: keyIcon.name, id: keyIcon.id } : "🔑"),
        new ButtonBuilder()
          .setCustomId(`auth_open_customizar_${guildId}`)
          .setLabel("Customizar")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(
            paletteIcon ? { name: paletteIcon.name, id: paletteIcon.id } : "🎨",
          ),
      ),
    );

  return [container];
}

function buildErrorMessage(message) {
  const dangerIcon = getEmoji(emojis.danger);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        dangerIcon
          ? `<:${dangerIcon.name}:${dangerIcon.id}> **ERRO**`
          : "❌ **ERRO**",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(message));

  return [container];
}