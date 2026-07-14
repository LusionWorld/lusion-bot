const { bold, green, dim } = require("colorette").createColors({ useColor: true });

function timestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return dim(`[${h}:${m}:${s}]`);
}

function log(category, message) {
  console.log(`${timestamp()}  ${bold(green("INFO"))}  ${dim(`[${category}]`)}  ${message}`);
}

function error(category, message) {
  console.error(`${timestamp()}  ${bold(green("ERROR"))}  ${dim(`[${category}]`)}  ${message}`);
}

module.exports = { log, error };
