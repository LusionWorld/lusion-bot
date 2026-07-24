const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const { tLocale, getGuildLocale, DEFAULT, SUPPORTED } = require("../utils/i18n");

function localizeOptions(options, locale) {
  if (!Array.isArray(options)) return options;
  return options.map((opt) => {
    const localized = { ...opt };
    if (opt.descriptionKey) {
      localized.description = tLocale(opt.descriptionKey, locale);
    }
    if (Array.isArray(opt.choices)) {
      localized.choices = opt.choices.map((choice) => ({
        ...choice,
        name: choice.nameKey ? tLocale(choice.nameKey, locale) : choice.name,
      }));
    }
    if (Array.isArray(opt.options)) {
      localized.options = localizeOptions(opt.options, locale);
    }
    return localized;
  });
}

function localizedName(comando, locale) {
  return comando.nameKey ? tLocale(comando.nameKey, locale) : comando.name;
}

function buildRegisterObject(comando, locale) {
  const isContextMenu = comando.type === 2 || comando.type === 3;

  return {
    name: localizedName(comando, locale),
    ...(isContextMenu
      ? {}
      : {
          description: comando.descriptionKey
            ? tLocale(comando.descriptionKey, locale)
            : comando.description || "Sem descrição",
          options: localizeOptions(comando.options, locale) || [],
        }),
    ...(comando.type && { type: comando.type }),
    ...(comando.default_member_permissions !== undefined && {
      defaultMemberPermissions: comando.default_member_permissions,
    }),
  };
}

async function resyncGuildCommands(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild || !client._slashCommandsRaw) return;

  const locale = getGuildLocale(guildId);
  const localized = client._slashCommandsRaw.map((c) => buildRegisterObject(c, locale));
  await guild.commands.set(localized);
}

async function loadSlashCommands(client) {
  client.slashCommands = client.slashCommands || new Collection();

  const DEV_GUILD_ID = "";
  const commandsRaw = [];
  const devCommandsRaw = [];
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

        if (isDevFolder) {
          devCommandsRaw.push(comando);
        } else {
          commandsRaw.push(comando);
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

  client._slashCommandsRaw = commandsRaw;
  client._devSlashCommandsRaw = devCommandsRaw;

  client.slashCommandsByLocale = {};
  for (const locale of SUPPORTED) {
    const byName = new Map();
    for (const comando of [...commandsRaw, ...devCommandsRaw]) {
      byName.set(localizedName(comando, locale), comando);
    }
    client.slashCommandsByLocale[locale] = byName;
  }

  const commandsForRegister = commandsRaw.map((c) => buildRegisterObject(c, DEFAULT));
  const devCommandsForRegister = devCommandsRaw.map((c) => buildRegisterObject(c, DEFAULT));

  try {
    if (!client.application?.owner) {
      await client.application?.fetch();
    }

    if (DEV_GUILD_ID && devCommandsRaw.length > 0) {
      const devGuild = client.guilds.cache.get(DEV_GUILD_ID);
      if (devGuild) {
        const devLocale = getGuildLocale(DEV_GUILD_ID);
        await devGuild.commands.set([
          ...commandsRaw.map((c) => buildRegisterObject(c, devLocale)),
          ...devCommandsRaw.map((c) => buildRegisterObject(c, devLocale)),
        ]);
      }
    }

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        if (guild.id === DEV_GUILD_ID && devCommandsRaw.length > 0) {
          continue;
        }

        const locale = getGuildLocale(guildId);
        const localized = commandsRaw.map((c) => buildRegisterObject(c, locale));
        await guild.commands.set(localized);
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
}

module.exports = loadSlashCommands;
module.exports.resyncGuildCommands = resyncGuildCommands;
