const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");

module.exports = async (client) => {
  client.slashCommands = client.slashCommands || new Collection();

  const DEV_GUILD_ID = "";
  const commandsForRegister = [];
  const devCommandsForRegister = [];
  const basePath = path.join(__dirname, "../commands/slash");
  const devPath = path.join(__dirname, "../commands/dev");

  let loadedCommands = 0;

  if (!fs.existsSync(basePath)) {
    return { normal: [], dev: [], total: 0 };
  }

  const walk = (dir, isDevFolder = false) => {
    const itens = fs.readdirSync(dir);

    itens.forEach((item) => {
      const itemPath = path.join(dir, item);
      const stat = fs.lstatSync(itemPath);

      if (!isDevFolder && stat.isDirectory() && item === "dev") return;
      if (stat.isDirectory()) return walk(itemPath, isDevFolder);
      if (!item.endsWith(".js")) return;

      try {
        delete require.cache[require.resolve(itemPath)];
        const comando = require(itemPath);

        if (!comando?.name) return;

        client.slashCommands.set(comando.name, comando);

        // Context menu commands (User=2, Message=3) must NOT have description/options
        const isContextMenu = comando.type === 2 || comando.type === 3;

        const toRegister = {
          name: comando.name,
          ...(isContextMenu
            ? {}
            : {
                description: comando.description || "Sem descrição",
                options: comando.options || [],
              }),
          ...(comando.type && { type: comando.type }),
          ...(comando.default_member_permissions !== undefined && {
            defaultMemberPermissions: comando.default_member_permissions,
          }),
        };

        if (isDevFolder) {
          devCommandsForRegister.push(toRegister);
        } else {
          commandsForRegister.push(toRegister);
        }

        loadedCommands++;
      } catch (error) {
        console.error(`[commands] erro ao carregar ${item}: ${error.message}`);
      }
    });
  };

  walk(basePath, false);

  if (fs.existsSync(devPath)) {
    walk(devPath, true);
  }

  try {
    if (!client.application?.owner) {
      await client.application?.fetch();
    }

    if (DEV_GUILD_ID && devCommandsForRegister.length > 0) {
      const devGuild = client.guilds.cache.get(DEV_GUILD_ID);
      if (devGuild) {
        await devGuild.commands.set([
          ...commandsForRegister,
          ...devCommandsForRegister,
        ]);
      }
    }

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        if (guild.id === DEV_GUILD_ID && devCommandsForRegister.length > 0) {
          continue;
        }

        await guild.commands.set(commandsForRegister);
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[commands] erro ao sincronizar ${guild.name}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`[commands] erro no registro: ${error.message}`);
  }

  return {
    normal: commandsForRegister,
    dev: devCommandsForRegister,
    total: loadedCommands,
  };
};
