const fs = require("fs");
const path = require("path");
const { cyan, green, bold } = require("colorette");

module.exports = (client) => {
  const eventsPath = path.join(__dirname, "../events");
  const interactionsPath = path.join(__dirname, "../interactions");

  let loadedEvents = 0;
  let loadedInteractions = 0;
  let failedEvents = 0;
  let failedInteractions = 0;

  function loadEvents(dir, category = "") {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        loadEvents(fullPath, category ? `${category}/${item.name}` : item.name);
      } else if (item.isFile() && item.name.endsWith(".js")) {
        try {
          delete require.cache[require.resolve(fullPath)];

          const event = require(fullPath);

          if (!event.name) {
            console.log(
              cyan("  ├─ ") + item.name + " " + green("(ignorado: sem nome)"),
            );
            failedEvents++;
            continue;
          }

          if (typeof event.execute !== "function") {
            console.log(
              cyan("  ├─ ") +
                item.name +
                " " +
                green("(ignorado: sem execute)"),
            );
            failedEvents++;
            continue;
          }

          if (event.once) {
            client.once(event.name, (...args) =>
              event.execute(client, ...args),
            );
          } else {
            client.on(event.name, (...args) => event.execute(client, ...args));
          }

          const logPath = category ? `${category}/${item.name}` : item.name;
          console.log(
            cyan("  ├─ ") + green(event.name) + " " + cyan(`(${logPath})`),
          );
          loadedEvents++;
        } catch (error) {
          failedEvents++;
          console.log(
            cyan("  ├─ ") + item.name + " " + green(`(erro: ${error.message})`),
          );
        }
      }
    }
  }

  function loadInteractions(dir, category = "") {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        loadInteractions(
          fullPath,
          category ? `${category}/${item.name}` : item.name,
        );
      } else if (item.isFile() && item.name.endsWith(".js")) {
        const ignoredFiles = ["ticketEvents.js", "start-ticket.js"];

        if (ignoredFiles.includes(item.name)) {
          if (item.name === "ticketEvents.js") {
            console.log(
              cyan("  ├─ ") +
                item.name +
                " " +
                green("(ignorado: event listener)"),
            );
          }
          continue;
        }

        try {
          delete require.cache[require.resolve(fullPath)];

          const module = require(fullPath);

          if (typeof module.execute !== "function") {
            console.log(
              cyan("  ├─ ") +
                item.name +
                " " +
                green("(ignorado: sem execute)"),
            );
            failedInteractions++;
            continue;
          }

          client.on("interactionCreate", (...args) =>
            module.execute(client, ...args),
          );

          const logPath = category ? `${category}/${item.name}` : item.name;
          console.log(cyan("  ├─ ") + green(logPath));
          loadedInteractions++;
        } catch (error) {
          failedInteractions++;
          console.log(
            cyan("  ├─ ") + item.name + " " + green(`(erro: ${error.message})`),
          );
        }
      }
    }
  }

  console.log("\n" + cyan("  ╭─ Carregando Eventos"));
  console.log(cyan("  │"));

  if (fs.existsSync(eventsPath)) {
    loadEvents(eventsPath);
  } else {
    console.log(cyan("  ├─ ") + green("Pasta events não encontrada"));
  }

  console.log(cyan("  │"));
  console.log(cyan("  ├─ ") + "Total: " + bold(green(loadedEvents)));
  if (failedEvents > 0) {
    console.log(cyan("  ├─ ") + "Falhas: " + green(failedEvents));
  }
  console.log(cyan("  │"));

  console.log(cyan("  ├─ Carregando Interações"));
  console.log(cyan("  │"));

  if (fs.existsSync(interactionsPath)) {
    loadInteractions(interactionsPath);
  } else {
    console.log(cyan("  ├─ ") + green("Pasta interactions não encontrada"));
  }

  console.log(cyan("  │"));
  console.log(cyan("  ├─ ") + "Total: " + bold(green(loadedInteractions)));
  if (failedInteractions > 0) {
    console.log(cyan("  ├─ ") + "Falhas: " + green(failedInteractions));
  }
  console.log(cyan("  ╰─ ") + bold(green("✓ Carregamento concluído")));
  console.log("");
};
