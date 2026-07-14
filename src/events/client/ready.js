const { bold } = require("colorette").createColors({ useColor: true });
const { log } = require("../../utils/logger");

module.exports = {
  name: "clientReady",
  once: true,
  execute: async (client) => {
    const membros = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    log("Bot", bold(client.user.tag));
    log("Bot", `${client.guilds.cache.size} servidores   ${membros} membros   ${client.slashCommands?.size || 0} comandos`);

    const updateStatus = () => {
      client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    };

    updateStatus();
    setInterval(updateStatus, 3 * 60 * 1000);
  },
};
