const { cyan, green, bold } = require("colorette");
const path = require("path");

module.exports = {
  name: "clientReady",
  once: true,
  execute: async (client) => {
    console.log("\n" + cyan("━".repeat(55)));
    console.log(bold(green("  BOT ONLINE E OPERACIONAL")));
    console.log(cyan("━".repeat(55)) + "\n");

    console.log(cyan("  ╭─ Informações do Bot"));
    console.log(cyan("  │"));
    console.log(cyan("  ├─ ") + "Usuário: " + bold(green(client.user.tag)));
    console.log(cyan("  ├─ ") + "ID: " + green(client.user.id));
    console.log(cyan("  ├─ ") + "Servidores: " + bold(green(client.guilds.cache.size)));
    console.log(cyan("  └─ ") + "Comandos: " + green(client.slashCommands.size));

    console.log("\n" + cyan("  ╭─ Sistema de Emojis"));
    console.log(cyan("  │"));

    const count = global.emojis ? Object.keys(global.emojis).length : 0;
    if (count > 0) {
      console.log(cyan("  └─ ") + bold(green(`${count} emojis carregados`)));
    } else {
      console.log(cyan("  └─ ") + green("⚠ Emojis não carregados ainda"));
    }

    console.log("\n" + cyan("━".repeat(55)));
    console.log(bold(green("  SISTEMA PRONTO PARA USO")));
    console.log(cyan("━".repeat(55)) + "\n");

    const updateStatus = () => {
      client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    };

    updateStatus();
    setInterval(updateStatus, 3 * 60 * 1000);
  },
};