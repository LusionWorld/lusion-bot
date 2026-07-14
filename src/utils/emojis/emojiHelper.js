const path = require("path");
const fs = require("fs");

/**
 */
let emojiCache = null;
let lastLoadTime = 0;
const CACHE_DURATION = 60000; // 1 minuto em ms

/**
 *
 * @param {boolean} forceReload
 * @returns {Object}
 */
function getEmojis(forceReload = false) {
  const now = Date.now();

  if (!forceReload && emojiCache && now - lastLoadTime < CACHE_DURATION) {
    return emojiCache;
  }

  try {
    const emojisPath = path.join(__dirname, "emojis.json");

    if (!fs.existsSync(emojisPath)) {
      console.error("❌ Arquivo emojis.json não encontrado!");
      return {};
    }

    delete require.cache[require.resolve(emojisPath)];
    emojiCache = require(emojisPath);
    lastLoadTime = now;

    return emojiCache;
  } catch (error) {
    console.error("❌ Erro ao carregar emojis:", error);
    return emojiCache || {};
  }
}

/**
 *
 * @param {string} name
 * @returns {string|null}
 */
function getEmoji(name) {
  if (!name || typeof name !== "string") return null;

  const emojis = getEmojis();
  return emojis[name] || null;
}

function parseEmoji(raw) {
  if (!raw || typeof raw !== "string") return null;

  const m = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!m) return null;

  return { name: m[1], id: m[2] };
}

let safeEmojiInstalled = false;

function installSafeEmoji() {
  if (safeEmojiInstalled) return;
  safeEmojiInstalled = true;

  let builders;
  try {
    builders = require("@discordjs/builders");
  } catch {
    return;
  }

  for (const name of ["ButtonBuilder", "SelectMenuOptionBuilder", "StringSelectMenuOptionBuilder"]) {
    const Builder = builders[name];
    if (!Builder || !Builder.prototype) continue;

    const original = Builder.prototype.setEmoji;
    if (typeof original !== "function") continue;

    Builder.prototype.setEmoji = function (emoji) {
      if (emoji == null) return this;
      return original.call(this, emoji);
    };
  }
}

module.exports = {
  getEmojis,
  getEmoji,
  parseEmoji,
  pe: parseEmoji,
  installSafeEmoji,
};
