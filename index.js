const {
  Client,
  GatewayIntentBits,
  Collection,
  Options,
  Partials,
  REST,
} = require("discord.js");
const path = require("path");
const NODE_ENV = process.env.NODE_ENV === "production" ? "production" : "dev";
require("dotenv").config({ path: path.join(__dirname, `.env.${NODE_ENV}`), quiet: true });

const token = process.env.DISCORD_TOKEN;

const APP_FLAGS = {
  presence: (1 << 12) | (1 << 13),
  members: (1 << 14) | (1 << 15),
  messageContent: (1 << 18) | (1 << 19),
};

async function detectPrivilegedIntents(botToken) {
  try {
    const rest = new REST({ version: "10" }).setToken(botToken);
    const app = await rest.get("/applications/@me");
    const flags = app.flags || 0;
    return {
      presence: (flags & APP_FLAGS.presence) !== 0,
      members: (flags & APP_FLAGS.members) !== 0,
      messageContent: (flags & APP_FLAGS.messageContent) !== 0,
    };
  } catch (err) {
    logError(
      "Intents",
      `Falha ao detectar intents privilegiados (${err.message}). Assumindo apenas os essenciais.`,
    );
    return { presence: false, members: true, messageContent: true };
  }
}

function buildIntents(detected) {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildExpressions ?? GatewayIntentBits.GuildEmojisAndStickers,
  ];

  if (detected.members) intents.push(GatewayIntentBits.GuildMembers);
  if (detected.messageContent) intents.push(GatewayIntentBits.MessageContent);
  if (detected.presence) intents.push(GatewayIntentBits.GuildPresences);

  return intents;
}

function createClient(intents) {
  return new Client({
    intents,
    partials: [
      Partials.User,
      Partials.Channel,
      Partials.GuildMember,
      Partials.Message,
      Partials.Reaction,
    ],
    sweepers: {
      messages: {
        interval: 3600,
        lifetime: 3600,
      },
      users: {
        interval: 7200,
        filter: () => (user) => user.bot && user.id !== client.user.id,
      },
      guildMembers: {
        interval: 7200,
        filter: () => (member) =>
          member.id !== client.user.id && !member.user.bot,
      },
      presences: {
        interval: 1800,
        filter: () => () => true,
      },
      voiceStates: {
        interval: 3600,
        filter: () => (state) => !state.channelId,
      },
    },
    makeCache: Options.cacheWithLimits({
      MessageManager: 100,
      GuildMemberManager: 500,
      PresenceManager: 0,
      ReactionManager: 0,
      ReactionUserManager: 0,
      StageInstanceManager: 0,
      ThreadManager: 400,
      ThreadMemberManager: 0,
      VoiceStateManager: 0,
    }),
  });
}

let client;

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

function logStats() {
  const processMemory = process.memoryUsage();
  const heapUsedMB = parseFloat(formatBytes(processMemory.heapUsed));
  if (heapUsedMB > 200) {
    client.stats.memoryLeaks++;
  }
}

let memoryCheckInterval;

function startMemoryMonitoring() {
  memoryCheckInterval = setInterval(() => {
    if (client.isReady()) {
      logStats();

      const before = process.memoryUsage().heapUsed;

      client.guilds.cache.forEach((guild) => {
        if (guild.memberCount > guild.members.cache.size * 2) {
          guild.members.cache.clear();
        }

        guild.channels.cache.forEach((channel) => {
          if (channel.messages && channel.messages.cache.size > 100) {
            const messagesToDelete = channel.messages.cache
              .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
              .filter((msg, index) => index > 50);
            messagesToDelete.forEach((msg) =>
              channel.messages.cache.delete(msg.id),
            );
          }
        });

        guild.presences?.cache.clear();
        guild.voiceStates?.cache.sweep((state) => !state.channelId);
      });

      if (global.gc) {
        global.gc();
      }
    }
  }, 300000);
}

process.setMaxListeners(15);

const { log, error: logError } = require("./src/utils/logger");

process.on("uncaughtException", (err) => {
  if (client?.stats) client.stats.errorsCount++;
  logError("Exception", `${err.name}: ${err.message}\n${err.stack}`);
});

process.on("unhandledRejection", (reason) => {
  if (client?.stats) client.stats.errorsCount++;
  logError("Rejection", reason?.message || String(reason));
});

process.on("warning", (warning) => {
  if (warning.name === "MaxListenersExceededWarning" && client?.stats) {
    client.stats.memoryLeaks++;
  }
});

process.on("SIGINT", () => {
  clearInterval(memoryCheckInterval);
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  clearInterval(memoryCheckInterval);
  client.destroy();
  process.exit(0);
});

(async () => {
  try {
    if (!token) {
      throw new Error("DISCORD_TOKEN não definido — configure .env.dev / .env.production");
    }

    const detected = await detectPrivilegedIntents(token);
    const intents = buildIntents(detected);

    const statusIntent = (ok) => (ok ? "ativo" : "desligado");
    log(
      "Intents",
      `Privilegiados detectados -> MessageContent: ${statusIntent(
        detected.messageContent,
      )} | Members: ${statusIntent(detected.members)} | Presence: ${statusIntent(
        detected.presence,
      )}`,
    );

    client = createClient(intents);
    client.setMaxListeners(0);
    client.commands = new Collection();
    client.aliases = new Collection();
    client.slashCommands = new Collection();
    client.config = require("./config.json");
    client.stats = {
      commandsExecuted: 0,
      errorsCount: 0,
      startTime: Date.now(),
      memoryLeaks: 0,
    };

    const readyPromise = new Promise((resolve) => client.once("clientReady", resolve));
    await client.login(token);
    await readyPromise;

    // ╔══════════════════════════════════════════════════════════╗
    // ║              SISTEMA DE EMOJI                            ║
    // ╚══════════════════════════════════════════════════════════╝
    const ApplicationEmojiManager = require("./src/utils/emojis/emojiManager");
    const emojisPath = path.join(__dirname, "src/utils/emojis/emojis.json");
    const emojiManager = new ApplicationEmojiManager(client);
    await emojiManager.uploadAndUpdateEmojis();
    delete require.cache[require.resolve(emojisPath)];
    global.emojis = require(emojisPath);
    require("./src/utils/emojis/emojiHelper").installSafeEmoji();
    // ══════════════════════════════════════════════════════════

    require("./src/handlers/eventsHandler")(client);
    require("./src/handlers/descriptionHandler")(client);

    const slashHandler = require("./src/handlers/slashHandler");
    await slashHandler(client);

    client.emit("clientReady", client);

    startMemoryMonitoring();

    if (!global.gc) {
      console.warn("⚠️  AVISO: Garbage Collector manual não disponível!");
      console.warn(
        "   Para melhor performance, reinicie com: node --expose-gc index.js\n",
      );
    }
  } catch (error) {
    console.error("\n❌ ════════ ERRO NO STARTUP ════════");
    console.error(`🕐 Timestamp: ${new Date().toISOString()}`);
    console.error(`📝 Error:`, error);
    console.error("════════════════════════════════════\n");
    process.exit(1);
  }
})();
