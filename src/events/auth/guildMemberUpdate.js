const ConfigManager = require('../../utils/auth/configManager');
const OAuthManager = require('../../utils/auth/oauthManager');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const config = ConfigManager.getConfig(newMember.guild.id);
    
    if (!config.removeRoleOnRevoke || !config.verification.enabled) return;

    try {
      const userToken = await OAuthManager.getUserToken(newMember.guild.id, newMember.id);
      
      if (!userToken || !userToken.access_token) {
        if (newMember.roles.cache.has(config.verification.roleId)) {
          await newMember.roles.remove(config.verification.roleId);
          console.log(`[REVOKE] Role removida de ${newMember.user.tag} por desautorização`);
        }
      }
    } catch (error) {
      console.error('[REVOKE] Erro ao verificar token:', error);
    }
  }
};