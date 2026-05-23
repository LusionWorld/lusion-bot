const axios = require("axios");
const crypto = require("crypto");
const ConfigManager = require("./configManager");

const authSessions = new Map();

function cleanExpiredAuthSessions() {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000;

  for (const [key, session] of authSessions.entries()) {
    if (now - session.timestamp > maxAge) {
      authSessions.delete(key);
    }
  }
}

setInterval(cleanExpiredAuthSessions, 60 * 1000);

class OAuthManager {
  getAuthUrl(guildId, userId) {
    const config = ConfigManager.getConfig(guildId);
    if (!config || !config.oauth || !config.oauth.serverUrl) {
      console.error("Configuração OAuth não encontrada para guild:", guildId);
      return null;
    }

    const stateToken = crypto.randomBytes(32).toString("hex");

    authSessions.set(stateToken, {
      guildId,
      userId,
      timestamp: Date.now(),
    });

    setTimeout(() => authSessions.delete(stateToken), 10 * 60 * 1000);

    console.log(
      `🔐 State token gerado para user ${userId} na guild ${guildId}: ${stateToken.substring(
        0,
        16
      )}...`
    );

    return `https://discord.com/oauth2/authorize?client_id=${
      config.oauth.clientId
    }&redirect_uri=${encodeURIComponent(
      config.oauth.redirectUri
    )}&response_type=code&scope=identify%20email%20guilds%20guilds.join&state=${stateToken}`;
  }

  validateStateToken(stateToken) {
    const session = authSessions.get(stateToken);
    if (!session) {
      console.warn(
        `🚨 State token inválido ou expirado: ${stateToken.substring(0, 16)}...`
      );
      return null;
    }

    authSessions.delete(stateToken);

    console.log(
      `✅ State token validado para user ${session.userId} na guild ${session.guildId}`
    );

    return session;
  }

  async getVerifiedUsers(guildId) {
    try {
      const config = ConfigManager.getConfig(guildId);
      if (!config || !config.oauth || !config.oauth.serverUrl) {
        console.error("Configuração OAuth não encontrada para guild:", guildId);
        return [];
      }

      const apiKey = config.apiKey;
      if (!apiKey) {
        console.error("API Key não encontrada na configuração");
        return [];
      }

      const apiUrl = config.oauth.serverUrl;
      const response = await axios.get(`${apiUrl}/api/verified/${guildId}`, {
        headers: {
          "x-api-key": apiKey,
        },
      });

      console.log(`[DEBUG] Verified users response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(
        "Erro ao buscar usuários verificados:",
        error.response?.data || error.message
      );
      return [];
    }
  }

  async refreshUserToken(guildId, userId, refreshToken) {
    try {
      console.log(`[REFRESH] Tentando renovar token do user ${userId}`);
      const config = ConfigManager.getConfig(guildId);
      if (!config || !config.oauth) {
        console.log("[REFRESH] Config não encontrada");
        return null;
      }

      const response = await axios.post(
        "https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id: config.oauth.clientId,
          client_secret: config.oauth.clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const {
        access_token,
        refresh_token: new_refresh_token,
        expires_in,
      } = response.data;
      const expiresAt = Math.floor(Date.now() / 1000) + expires_in;

      await axios.put(
        `${config.oauth.serverUrl}/api/user/${guildId}/${userId}`,
        {
          access_token,
          refresh_token: new_refresh_token,
          expires_at: expiresAt,
        }
      );

      console.log(`[REFRESH] Token renovado com sucesso para user ${userId}`);
      return access_token;
    } catch (error) {
      console.error(
        `[REFRESH] Erro ao renovar token do user ${userId}:`,
        error.response?.data || error.message
      );
      return null;
    }
  }

  async getAuthStats(guildId) {
    try {
      const config = ConfigManager.getConfig(guildId);
      if (!config || !config.oauth || !config.oauth.serverUrl) {
        console.error("Configuração OAuth não encontrada para guild:", guildId);
        return { totalUsers: 0, activeUsers: 0 };
      }

      const apiKey = config.apiKey;
      if (!apiKey) {
        console.error("API Key não encontrada na configuração");
        return { totalUsers: 0, activeUsers: 0 };
      }

      const response = await axios.get(
        `${config.oauth.serverUrl}/api/stats/${guildId}`,
        {
          headers: {
            "x-api-key": apiKey,
          },
        }
      );

      return {
        totalUsers: response.data.totalUsers || 0,
        activeUsers: response.data.activeUsers || 0,
        expiredUsers: response.data.expiredUsers || 0,
        revokedUsers: response.data.revokedUsers || 0,
      };
    } catch (error) {
      console.error(
        "Erro ao buscar stats:",
        error.response?.data || error.message
      );
      return {
        totalUsers: 0,
        activeUsers: 0,
        expiredUsers: 0,
        revokedUsers: 0,
      };
    }
  }

  async getUserToken(guildId, userId) {
    try {
      const config = ConfigManager.getConfig(guildId);
      if (!config || !config.oauth || !config.oauth.serverUrl) {
        console.error(
          "[GET TOKEN] Configuração OAuth não encontrada para guild:",
          guildId
        );
        return null;
      }
      const apiUrl = config.oauth.serverUrl;
      console.log(
        `[GET TOKEN] Fazendo request para: ${apiUrl}/api/user/${guildId}/${userId}`
      );

      const response = await axios.get(
        `${apiUrl}/api/user/${guildId}/${userId}`
      );
      const userData = response.data;

      console.log(`[GET TOKEN] User token data for ${userId}:`, {
        hasAccessToken: !!userData.access_token,
        hasRefreshToken: !!userData.refresh_token,
        expiresAt: userData.expires_at,
        guildId: userData.guild_id,
      });

      const now = Math.floor(Date.now() / 1000);
      if (
        userData.expires_at &&
        userData.expires_at < now &&
        userData.refresh_token
      ) {
        console.log(`[GET TOKEN] Token expirado, tentando refresh...`);
        const newToken = await this.refreshUserToken(
          guildId,
          userId,
          userData.refresh_token
        );
        if (newToken) {
          return { ...userData, access_token: newToken };
        }
      }

      return userData;
    } catch (error) {
      console.error(`[GET TOKEN] Erro ao buscar token do usuário ${userId}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      return null;
    }
  }

  async addMemberToGuild(guildId, userId, accessToken, botToken) {
    try {
      const config = ConfigManager.getConfig(guildId);
      const tokenToUse = config.oauth.botToken || botToken;

      console.log("[ADD MEMBER] Guild:", guildId);
      console.log("[ADD MEMBER] User:", userId);
      console.log(
        "[ADD MEMBER] Usando token:",
        tokenToUse.substring(0, 20) + "..."
      );

      const payload = {
        access_token: accessToken,
      };

      if (config.verification.roleId) {
        payload.roles = [config.verification.roleId];
        console.log(
          "[ADD MEMBER] Role a ser adicionada:",
          config.verification.roleId
        );
      }

      const response = await axios.put(
        `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
        payload,
        {
          headers: {
            Authorization: `Bot ${tokenToUse}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("[ADD MEMBER] Sucesso! Status:", response.status);

      if (config.verification.roleId) {
        try {
          await axios.put(
            `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${config.verification.roleId}`,
            {},
            {
              headers: {
                Authorization: `Bot ${tokenToUse}`,
                "Content-Type": "application/json",
              },
            }
          );
          console.log("[ADD MEMBER] Cargo adicionado com sucesso!");
        } catch (roleError) {
          console.error("[ADD MEMBER] Erro ao adicionar cargo:", {
            status: roleError.response?.status,
            data: roleError.response?.data,
          });
        }
      }

      const readyEvent = require("../events/ready");
      if (readyEvent.addToIntensiveMonitoring) {
        readyEvent.addToIntensiveMonitoring(guildId, userId);
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.error("[ADD MEMBER] Erro detalhado:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  getActiveSessionsCount() {
    return authSessions.size;
  }

  clearExpiredSessions() {
    cleanExpiredAuthSessions();
    return authSessions.size;
  }
}

module.exports = new OAuthManager();
