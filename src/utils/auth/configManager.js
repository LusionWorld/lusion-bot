const fs = require("fs");
const path = require("path");
const axios = require("axios");

class ConfigManager {
  constructor() {
    this.configDir = path.join(__dirname, "../../../banco/auth");
    this.serverUrl = process.env.API_URL || "https://labzapi.squareweb.app";
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  getConfigPath(guildId) {
    const guildDir = path.join(this.configDir, guildId);
    if (!fs.existsSync(guildDir)) {
      fs.mkdirSync(guildDir, { recursive: true });
    }
    return path.join(guildDir, "config.json");
  }

  getConfig(guildId) {
    const configPath = this.getConfigPath(guildId);

    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        guildId,
        oauth: {
          clientId: "",
          clientSecret: "",
          redirectUri: "",
          serverUrl: this.serverUrl,
          enabled: false,
        },
        verification: {
          channelId: "",
          roleId: "",
          enabled: false,
          panelTitle: "",
          panelDescription: "",
          buttonText: "",
          buttonEmoji: "",
          bannerTop: "",
          bannerMiddle: "",
          footer: "",
        },
        webhook: null,
        pullEnabled: false,
        blockVpnUsers: false,
        color: "#5865F2",
      };
      this.saveConfig(guildId, defaultConfig);
      return defaultConfig;
    }

    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }

  updateBlockVpnUsers(guildId, blockVpnUsers) {
    const config = this.getConfig(guildId);
    config.blockVpnUsers = blockVpnUsers;
    this.saveConfig(guildId, config);
  }

  updateLogsChannel(guildId, channelId) {
    const config = this.getConfig(guildId);
    config.logsChannelId = channelId;
    this.saveConfig(guildId, config);
  }

  async saveConfig(guildId, config) {
    const configPath = this.getConfigPath(guildId);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    try {
      const response = await axios.post(
        `${this.serverUrl}/api/config/${guildId}`,
        config,
      );

      if (response.data.apiKey) {
        config.apiKey = response.data.apiKey;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }

      console.log(
        `✅ Config sincronizado com servidor web para guild ${guildId}`,
      );
    } catch (error) {
      console.error(
        `❌ Erro ao sincronizar config:`,
        error.response?.data || error.message,
      );
    }
  }

  async updateOAuth(guildId, oauthData, ownerId, guildName) {
    const config = this.getConfig(guildId);
    config.oauth = {
      ...oauthData,
      enabled: true,
    };
    config.ownerId = ownerId;
    config.guildName = guildName;
    await this.saveConfig(guildId, config);
  }

  async updateVerification(guildId, channelId, roleId) {
    const config = this.getConfig(guildId);
    config.verification = {
      channelId,
      roleId,
      enabled: true,
    };
    await this.saveConfig(guildId, config);
  }

  async togglePull(guildId, enabled) {
    const config = this.getConfig(guildId);
    config.pullEnabled = enabled;
    await this.saveConfig(guildId, config);
  }

  toggleRemoveRole(guildId, state) {
    const config = this.getConfig(guildId);
    config.removeRoleOnRevoke = state;
    this.saveConfig(guildId, config);
    return config;
  }

  updateWebhook(guildId, webhookUrl) {
    const config = this.getConfig(guildId);
    config.webhook = webhookUrl;
    this.saveConfig(guildId, config);
    return config;
  }

  isConfigured(guildId) {
    const config = this.getConfig(guildId);
    return config.oauth.enabled && config.verification.enabled;
  }

  updateVerificationChannel(guildId, channelId) {
    const config = this.getConfig(guildId);
    config.verification.channelId = channelId;
    config.verification.enabled = true;
    this.saveConfig(guildId, config);
  }

  updateVerificationRole(guildId, roleId) {
    const config = this.getConfig(guildId);
    config.verification.roleId = roleId;
    config.verification.enabled = true;
    this.saveConfig(guildId, config);
  }

  updatePanelTitle(guildId, title) {
    const config = this.getConfig(guildId);
    config.verification.panelTitle = title;
    this.saveConfig(guildId, config);
  }

  updatePanelDescription(guildId, description) {
    const config = this.getConfig(guildId);
    config.verification.panelDescription = description;
    this.saveConfig(guildId, config);
  }

  updatePanelBannerTop(guildId, bannerTop) {
    const config = this.getConfig(guildId);
    config.verification.bannerTop = bannerTop;
    this.saveConfig(guildId, config);
  }

  updatePanelBannerMiddle(guildId, bannerMiddle) {
    const config = this.getConfig(guildId);
    config.verification.bannerMiddle = bannerMiddle;
    this.saveConfig(guildId, config);
  }

  updatePanelFooter(guildId, footer) {
    const config = this.getConfig(guildId);
    config.verification.footer = footer;
    this.saveConfig(guildId, config);
  }

  updatePanelButton(guildId, buttonText, buttonEmoji) {
    const config = this.getConfig(guildId);
    config.verification.buttonText = buttonText;
    config.verification.buttonEmoji = buttonEmoji;
    this.saveConfig(guildId, config);
  }
}

module.exports = new ConfigManager();
