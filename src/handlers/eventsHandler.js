const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  const eventsPath = path.join(__dirname, '../events');
  const interactionsPath = path.join(__dirname, '../interactions');

  function loadEvents(dir, category = '') {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        loadEvents(fullPath, category ? `${category}/${item.name}` : item.name);
      } else if (item.isFile() && item.name.endsWith('.js')) {
        try {
          delete require.cache[require.resolve(fullPath)];
          const raw = require(fullPath);
          const eventos = Array.isArray(raw) ? raw : [raw];
          for (const event of eventos) {
            if (!event.name || typeof event.execute !== 'function') continue;
            if (event.once) {
              client.once(event.name, (...args) => event.execute(client, ...args));
            } else {
              client.on(event.name, (...args) => event.execute(client, ...args));
            }
          }
        } catch (error) {
          console.error(`[events] erro ao carregar ${item.name}: ${error.message}`);
        }
      }
    }
  }

  function loadInteractions(dir, category = '') {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        loadInteractions(fullPath, category ? `${category}/${item.name}` : item.name);
      } else if (item.isFile() && item.name.endsWith('.js')) {
        const ignoredFiles = ['ticketEvents.js', 'start-ticket.js'];
        if (ignoredFiles.includes(item.name)) continue;
        try {
          delete require.cache[require.resolve(fullPath)];
          const module = require(fullPath);
          if (typeof module.execute !== 'function') continue;
          client.on('interactionCreate', (...args) => module.execute(client, ...args));
        } catch (error) {
          console.error(`[interactions] erro ao carregar ${item.name}: ${error.message}`);
        }
      }
    }
  }

  loadEvents(eventsPath);
  loadInteractions(interactionsPath);
};
