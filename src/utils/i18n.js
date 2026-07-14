const path = require("path");
const fs = require("fs");
const { JsonDatabase } = require("wio.db");

const SUPPORTED = ["pt-BR", "pt-PT", "en", "es"];
const DEFAULT = "pt-BR";

const LOCALE_LABELS = {
  "pt-BR": "🇧🇷 Português (Brasil)",
  "pt-PT": "🇵🇹 Português (Portugal)",
  "en":    "🇺🇸 English",
  "es":    "🇪🇸 Español",
};

const _cache = {};

function loadLocale(locale) {
  if (_cache[locale]) return _cache[locale];
  const baseDir = path.resolve(__dirname, "../locales");
  const merged = {};

  const flatPath = path.join(baseDir, `${locale}.json`);
  if (fs.existsSync(flatPath)) {
    Object.assign(merged, JSON.parse(fs.readFileSync(flatPath, "utf-8")));
  }

  if (fs.existsSync(baseDir)) {
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const subPath = path.join(baseDir, entry.name, `${locale}.json`);
      if (fs.existsSync(subPath)) {
        Object.assign(merged, JSON.parse(fs.readFileSync(subPath, "utf-8")));
      }
    }
  }

  _cache[locale] = merged;
  return merged;
}

SUPPORTED.forEach(loadLocale);

function getEmojiVars() {
  try {
    const { getEmojis } = require("./emojis/emojiHelper");
    const e = getEmojis();
    return {
      cancel:    e.cancel    ?? "❌",
      check:     e.check     ?? "✅",
      block:     e.block     ?? "🚫",
      success:   e.success   ?? "✅",
      lock:      e.lock      ?? "🔒",
      clock:     e.clock     ?? "⏰",
      bell:      e.bell      ?? "🔔",
      arrowl:    e.arrowl    ?? "◀",
      message:   e.message   ?? "💬",
      clipboard: e.clipboard ?? "📋",
      settings:  e.settings  ?? "⚙️",
      sparks:    e.sparks    ?? "✨",
      thread:    e.thread    ?? "🏷️",
      chart:     e.chart     ?? "📊",
      star:      e.star      ?? "⭐",
      world:     e.world     ?? "🌐",
      role:      e.role      ?? "",
      users:     e.users     ?? "",
      user:      e.user      ?? "",
    };
  } catch {
    return {
      cancel: "❌", check: "✅", block: "🚫", success: "✅",
      lock: "🔒", clock: "⏰", bell: "🔔", arrowl: "◀",
      role: "", users: "", user: "",
    };
  }
}

function getConfigDB(guildId) {
  return new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../banco/ticket/${guildId}/config.json`,
    ),
  });
}

function getGuildLocale(guildId) {
  try {
    const db = getConfigDB(guildId);
    const lang = db.get("language");
    return SUPPORTED.includes(lang) ? lang : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function setGuildLocale(guildId, locale) {
  if (!SUPPORTED.includes(locale)) return;
  const db = getConfigDB(guildId);
  db.set("language", locale);
}

function t(key, guildId, vars = {}) {
  const locale = getGuildLocale(guildId);
  const strings = loadLocale(locale);
  const fallback = loadLocale(DEFAULT);
  let str = strings[key] ?? fallback[key] ?? key;
  const all = { ...getEmojiVars(), ...vars };
  for (const [k, v] of Object.entries(all)) {
    str = str.replaceAll(`{{${k}}}`, v);
  }
  return str;
}

function tLocale(key, locale, vars = {}) {
  const safe = SUPPORTED.includes(locale) ? locale : DEFAULT;
  const strings = loadLocale(safe);
  const fallback = loadLocale(DEFAULT);
  let str = strings[key] ?? fallback[key] ?? key;
  const all = { ...getEmojiVars(), ...vars };
  for (const [k, v] of Object.entries(all)) {
    str = str.replaceAll(`{{${k}}}`, v);
  }
  return str;
}

module.exports = { t, tLocale, getGuildLocale, setGuildLocale, SUPPORTED, DEFAULT, LOCALE_LABELS };
