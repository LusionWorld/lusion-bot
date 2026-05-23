const ConfigManager = require('../../utils/auth/configManager');
const OAuthManager = require('../../utils/auth/oauthManager');
const axios = require('axios');

const NORMAL_CHECK_INTERVAL = 30 * 60 * 1000;
const RATE_LIMIT_DELAY = 2000;

let lastDiscordApiCall = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastCall = now - lastDiscordApiCall;
  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastDiscordApiCall = Date.now();
}

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    setInterval(async () => {
      await verifyAllTokens(client);
    }, NORMAL_CHECK_INTERVAL);
  }
};

async function verifyAllTokens(client) {
  for (const [guildId, guild] of client.guilds.cache) {
    const config = ConfigManager.getConfig(guildId);
    
    if (!config.removeRoleOnRevoke || !config.verification.enabled) continue;

    const verifiedUsers = await OAuthManager.getVerifiedUsers(guildId);

    for (const userData of verifiedUsers) {
      const member = await guild.members.fetch(userData.user_id).catch(() => null);
      
      if (member && member.roles.cache.has(config.verification.roleId)) {
        await checkUserToken(guild, member, config);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
}

async function checkUserToken(guild, member, config) {
  try {
    const userToken = await OAuthManager.getUserToken(guild.id, member.id);
    
    if (!userToken || !userToken.access_token) {
      await member.roles.remove(config.verification.roleId);
      await deleteUserToken(config.oauth.serverUrl, guild.id, member.id);
      
      if (config.webhook) {
        await sendRevokeWebhook(config.webhook, member, guild);
      }
      return;
    }

    await waitForRateLimit();
    const isValid = await checkTokenValidity(userToken.access_token);
    
    if (!isValid) {
      await member.roles.remove(config.verification.roleId);
      await deleteUserToken(config.oauth.serverUrl, guild.id, member.id);
      
      if (config.webhook) {
        await sendRevokeWebhook(config.webhook, member, guild);
      }
    }
  } catch (error) {
    // Silent error
  }
}

async function checkTokenValidity(accessToken) {
  try {
    const response = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000
    });
    return response.status === 200;
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return true;
    }
    
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 30;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return true;
    }
    
    return false;
  }
}

async function deleteUserToken(serverUrl, guildId, userId) {
  try {
    await axios.delete(`${serverUrl}/api/user/${guildId}/${userId}`);
  } catch (error) {
    // Silent error
  }
}

async function sendRevokeWebhook(webhookUrl, member, guild) {
  try {
    await axios.post(webhookUrl, {
      embeds: [{
        title: '🚫 Autorização Revogada',
        description: 
          `**Usuário:** ${member.user.tag} (${member.user.id})\n` +
          `**Servidor:** ${guild.name}\n` +
          `**Ação:** Role removida e token deletado automaticamente`,
        color: 0xff0000,
        timestamp: new Date().toISOString(),
        thumbnail: { url: member.user.displayAvatarURL() }
      }]
    });
  } catch (error) {
    // Silent error
  }
}