const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const { cyan, green, bold } = require("colorette");

module.exports = async (client) => {
  client.slashCommands = client.slashCommands || new Collection();

  const DEV_GUILD_ID = "";
  const commandsForRegister = [];
  const devCommandsForRegister = [];
  const basePath = path.join(__dirname, "../commands/slash");
  const devPath = path.join(__dirname, "../commands/dev");

  let loadedCommands = 0;
  let failedCommands = 0;

  console.log(cyan("  ╭─ Carregando Comandos"));
  console.log(cyan("  │"));

  if (!fs.existsSync(basePath)) {
    console.log(cyan("  ├─ ") + green("Pasta slash não encontrada"));
    console.log(cyan("  ╰─\n"));
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

        if (!comando?.name) {
          console.log(
            cyan("  ├─ ") + item + " " + green("(ignorado: sem nome)"),
          );
          failedCommands++;
          return;
        }

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
          console.log(
            cyan("  ├─ ") + green(comando.name) + " " + cyan("(dev)"),
          );
        } else {
          commandsForRegister.push(toRegister);
          console.log(cyan("  ├─ ") + green(comando.name));
        }

        loadedCommands++;
      } catch (error) {
        failedCommands++;
        console.log(
          cyan("  ├─ ") + item + " " + green(`(erro: ${error.message})`),
        );
      }
    });
  };

  walk(basePath, false);

  if (fs.existsSync(devPath)) {
    walk(devPath, true);
  }

  console.log(cyan("  │"));
  console.log(
    cyan("  ├─ ") + "Normal: " + bold(green(commandsForRegister.length)),
  );
  console.log(
    cyan("  ├─ ") + "Dev: " + bold(green(devCommandsForRegister.length)),
  );
  if (failedCommands > 0) {
    console.log(cyan("  ├─ ") + "Falhas: " + green(failedCommands));
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
        console.log(
          cyan("  ├─ ") + green(`Comandos dev registrados em ${devGuild.name}`),
        );
      } else {
        console.log(
          cyan("  ├─ ") + green(`Guild dev não encontrada: ${DEV_GUILD_ID}`),
        );
      }
    }

    let synced = 0;
    let failed = 0;

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        if (guild.id === DEV_GUILD_ID && devCommandsForRegister.length > 0) {
          continue;
        }

        await guild.commands.set(commandsForRegister);
        synced++;

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        failed++;
        console.log(
          cyan("  ├─ ") + guild.name + " " + green(`(erro: ${error.message})`),
        );
      }
    }

    if (synced > 0) {
      console.log(cyan("  ├─ ") + green(`Sincronizados em ${synced} guilds`));
    }
  } catch (error) {
    console.log(cyan("  ├─ ") + green(`Erro no registro: ${error.message}`));
  }

  console.log(cyan("  ╰─ ") + bold(green("✓ Comandos prontos")));
  console.log("");

  return {
    normal: commandsForRegister,
    dev: devCommandsForRegister,
    total: loadedCommands,
  };
};
