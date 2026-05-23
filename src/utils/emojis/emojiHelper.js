const path = require('path');

/**
 * @returns {Object}
 */
function getEmojis() {
  const emojisPath = path.join(__dirname, 'emojis.json');
  
  delete require.cache[require.resolve(emojisPath)];
  
  return require(emojisPath);
}

/**
 * Busca um emoji específico pelo nome
 * 
 * @param {string} name - Nome do emoji
 * @returns {string|null}
 */
function getEmoji(name) {
  const emojis = getEmojis();
  return emojis[name] || null;
}

module.exports = {
  getEmojis,
  getEmoji
};