const {
  Client,
  GatewayIntentBits,
  Collection,
  Options,
  Partials,
} = require("discord.js");
require("dotenv").config();
const { token } = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
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

client.commands = new Collection();
client.aliases = new Collection();
client.slashCommands = new Collection();
client.config = require("./config");

client.stats = {
  commandsExecuted: 0,
  errorsCount: 0,
  startTime: Date.now(),
  memoryLeaks: 0,
};

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
  const uptime = formatUptime(Date.now() - client.stats.startTime);
  const processMemory = process.memoryUsage();

  let totalMessages = 0;
  let totalMembers = 0;
  client.guilds.cache.forEach((guild) => {
    guild.channels.cache.forEach((channel) => {
      if (channel.messages) {
        totalMessages += channel.messages.cache.size;
      }
    });
    totalMembers += guild.members.cache.size;
  });

  const heapUsedMB = parseFloat(formatBytes(processMemory.heapUsed));
  if (heapUsedMB > 200) {
    client.stats.memoryLeaks++;
    console.warn(`⚠️  ALERTA: Uso de memória alto (${heapUsedMB} MB)!\n`);
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
        const after = process.memoryUsage().heapUsed;
        const freed = ((before - after) / 1024 / 1024).toFixed(2);
      }
    }
  }, 300000);
}

process.setMaxListeners(15);
process.removeAllListeners();

process.on("uncaughtException", (err) => {
  client.stats.errorsCount++;
  console.error("\n❌ ════════ UNCAUGHT EXCEPTION ════════");
  console.error(`🕐 Timestamp: ${new Date().toISOString()}`);
  console.error(`📛 Tipo: ${err.name}`);
  console.error(`📝 Mensagem: ${err.message}`);
  console.error(`📍 Stack:\n${err.stack}`);
  console.error("═══════════════════════════════════════\n");
});

process.on("unhandledRejection", (reason, promise) => {
  client.stats.errorsCount++;
  console.error("\n❌ ════════ UNHANDLED REJECTION ════════");
  console.error(`🕐 Timestamp: ${new Date().toISOString()}`);
  console.error(`📛 Tipo: Promise Rejection`);
  console.error(`📝 Reason:`, reason);
  if (reason?.stack) {
    console.error(`📍 Stack:\n${reason.stack}`);
  }
  console.error("════════════════════════════════════════\n");
});

process.on("uncaughtExceptionMonitor", (error, origin) => {
  console.error("\n⚠️  ════════ EXCEPTION MONITOR ════════");
  console.error(`🕐 Timestamp: ${new Date().toISOString()}`);
  console.error(`📛 Origin: ${origin}`);
  console.error(`📝 Error:`, error);
  console.error("═══════════════════════════════════════\n");
});

process.on("warning", (warning) => {
  if (warning.name === "MaxListenersExceededWarning") {
    console.warn("\n⚠️  ALERTA: Muitos event listeners detectados!");
    console.warn(`   Isso pode indicar memory leak!\n`);
    client.stats.memoryLeaks++;
    return;
  }

  console.warn("\n⚠️  ════════ NODE WARNING ════════");
  console.warn(`🕐 Timestamp: ${new Date().toISOString()}`);
  console.warn(`📛 Name: ${warning.name}`);
  console.warn(`📝 Message: ${warning.message}`);
  if (warning.stack) {
    console.warn(`📍 Stack:\n${warning.stack}`);
  }
  console.warn("═════════════════════════════════════\n");
});

process.on("SIGINT", () => {
  console.log("\n🛑 Encerrando bot gracefully...");
  clearInterval(memoryCheckInterval);
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Encerrando bot gracefully...");
  clearInterval(memoryCheckInterval);
  client.destroy();
  process.exit(0);
});

(async () => {
  try {
    await client.login(token);

    await new Promise((resolve) => client.once("clientReady", resolve));

    const ApplicationEmojiManager = require("./src/utils/emojis/emojiManager");
    const path = require("path");
    const emojiManager = new ApplicationEmojiManager(client);
    await emojiManager.uploadAndUpdateEmojis();
    const emojisPath = path.join(__dirname, "src/utils/emojis/emojis.json");
    delete require.cache[require.resolve(emojisPath)];
    global.emojis = require(emojisPath);
    console.log(`   ╰─ Emojis carregados globalmente (${Object.keys(global.emojis).length})`);

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