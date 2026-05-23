const {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  MessageFlags,
  SectionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  StringSelectMenuBuilder,
} = require("discord.js");

const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const { JsonDatabase } = require("wio.db");
const cron = require("node-cron");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const PROJECT_ROOT = path.resolve(__dirname, "../../../");
const dbConnections = new Map();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

function getDBConnection(guildId) {
  if (dbConnections.has(guildId)) return dbConnections.get(guildId);
  const folderPath = path.join(PROJECT_ROOT, "banco/ticket", guildId, "banco");
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  const db = new sqlite3.Database(path.join(folderPath, "tickets.db"));
  db.configure("busyTimeout", 10000);
  db.runAsync = promisify(db.run.bind(db));
  db.getAsync = promisify(db.get.bind(db));
  db.allAsync = promisify(db.all.bind(db));
  db.run("PRAGMA journal_mode = WAL;");
  dbConnections.set(guildId, db);
  return db;
}

function getConfigDB(guildId) {
  const filePath = path.join(
    PROJECT_ROOT,
    "banco/ticket",
    guildId,
    "config.json",
  );
  function read() {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return {};
    }
  }
  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf8");
  }
  return {
    get(key) {
      return key.split(".").reduce((o, k) => o?.[k], read());
    },
    set(key, value) {
      const data = read();
      const keys = key.split(".");
      let o = data;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!o[keys[i]]) o[keys[i]] = {};
        o = o[keys[i]];
      }
      o[keys[keys.length - 1]] = value;
      write(data);
    },
    has(key) {
      return this.get(key) !== undefined;
    },
  };
}

function formatarTempo(ms) {
  const seg = Math.floor(ms / 1000);
  const min = Math.floor(seg / 60);
  const hrs = Math.floor(min / 60);
  const dias = Math.floor(hrs / 24);
  if (dias > 0) return `${dias}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${min % 60}m`;
  if (min > 0) return `${min}m`;
  return `${seg}s`;
}

async function buildOverviewComponents(guildId, guild, options = {}) {
  const db = getDBConnection(guildId);
  const configDB = getConfigDB(guildId);
  const tagsConfig = configDB.get("tags_config") || {};
  const tagsCadastradas = tagsConfig.tags || [];

  const { filtroTag = null, pagina = 0 } = options;
  const POR_PAGINA = 5;
  const agora = Date.now();

  const [totalRow, assumidosRow, semStaffRow] = await Promise.all([
    db
      .getAsync(
        "SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND fechado_em IS NULL",
        [guildId],
      )
      .catch(() => ({ c: 0 })),
    db
      .getAsync(
        "SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND fechado_em IS NULL AND assumido_em IS NOT NULL",
        [guildId],
      )
      .catch(() => ({ c: 0 })),
    db
      .getAsync(
        "SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND fechado_em IS NULL AND assumido_em IS NULL",
        [guildId],
      )
      .catch(() => ({ c: 0 })),
  ]);

  let ticketsQuery =
    "SELECT ticket_id, user_id, staff_id, nome_categoria, criado_em, assumido_em, tags, ultima_mensagem_em, respondido_id FROM tickets WHERE guild_id = ? AND fechado_em IS NULL ORDER BY criado_em ASC";
  let allTickets = await db.allAsync(ticketsQuery, [guildId]).catch(() => []);

  if (filtroTag) {
    allTickets = allTickets.filter((t) => {
      try {
        return JSON.parse(t.tags || "[]").includes(filtroTag);
      } catch {
        return false;
      }
    });
  }

  const deletados = allTickets.filter(
    (t) => !guild.channels.cache.has(t.ticket_id),
  );
  if (deletados.length > 0) {
    const agora2 = Date.now();
    for (const t of deletados) {
      await db
        .runAsync(
          `UPDATE tickets SET fechado_em = ? WHERE ticket_id = ? AND fechado_em IS NULL`,
          [agora2, t.ticket_id],
        )
        .catch(() => {});
    }
  }
  const ticketsValidos = allTickets.filter((t) =>
    guild.channels.cache.has(t.ticket_id),
  );
  const total = ticketsValidos.length;
  const assumidosN = ticketsValidos.filter(
    (t) => t.assumido_em !== null,
  ).length;
  const semStaffN = ticketsValidos.filter((t) => t.assumido_em === null).length;

  const totalPaginas = Math.max(
    1,
    Math.ceil(ticketsValidos.length / POR_PAGINA),
  );
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const ticketsPagina = ticketsValidos.slice(
    paginaAtual * POR_PAGINA,
    (paginaAtual + 1) * POR_PAGINA,
  );

  const horaBR = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.graph} # Visão Geral — Tickets`,
      ),
      new TextDisplayBuilder().setContent(
        `${emojis.clock} Atualizado às **${horaBR}**${filtroTag ? `\n${emojis.layers} Filtrando por tag: **${filtroTag}**` : ""}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${emojis.ticket || emojis.clipboard} **Total Abertos**\n${total} ticket${total !== 1 ? "s" : ""} ativos`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId("_ov1")
            .setLabel(`${total}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        ),
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${emojis.check} **Assumidos**\n${assumidosN} com staff`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId("_ov2")
            .setLabel(`${assumidosN}`)
            .setStyle(
              assumidosN > 0 ? ButtonStyle.Success : ButtonStyle.Secondary,
            )
            .setDisabled(true),
        ),
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${emojis.spinning} **Aguardando Staff**\n${semStaffN} sem assumir`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId("_ov3")
            .setLabel(`${semStaffN}`)
            .setStyle(
              semStaffN > 0 ? ButtonStyle.Danger : ButtonStyle.Secondary,
            )
            .setDisabled(true),
        ),
    )
    .addSeparatorComponents(new SeparatorBuilder());

  if (ticketsPagina.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        filtroTag
          ? `${emojis.info} Nenhum ticket aberto com a tag **${filtroTag}**.`
          : `${emojis.check} Nenhum ticket aberto no momento.`,
      ),
    );
  } else {
    for (const t of ticketsPagina) {
      const canal = guild.channels.cache.get(t.ticket_id);
      const tempoAberto = formatarTempo(agora - (t.criado_em || agora));
      const assumido = !!t.assumido_em;

      let tagsTexto = "";
      try {
        const tagsArr = JSON.parse(t.tags || "[]");
        if (tagsArr.length > 0) {
          const CORES = {
            vermelho: "🔴",
            laranja: "🟠",
            amarelo: "🟡",
            verde: "🟢",
            azul: "🔵",
            roxo: "🟣",
          };
          tagsTexto = tagsArr
            .map((nome) => {
              const tagObj = tagsCadastradas.find((tc) => tc.nome === nome);
              const emoji = tagObj ? CORES[tagObj.cor] || "⚫" : "⚫";
              return `${emoji} ${nome}`;
            })
            .join(" ");
        }
      } catch {}

      let ultimaMsgTexto = "";
      if (t.respondido_id) {
        const isStaff = t.respondido_id !== t.user_id;
        ultimaMsgTexto = isStaff
          ? `${emojis.suporte || emojis.users} última msg: **staff**`
          : `${emojis.user} última msg: **autor**`;
      }

      const horaAbertura = t.criado_em
        ? new Date(t.criado_em).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          })
        : "?";

      const statusEmoji = assumido ? emojis.check : emojis.spinning;
      const statusTexto = assumido ? "Assumido" : "Aguardando";

      const linha1 = `${statusEmoji} **${canal?.name || t.ticket_id}** — ${t.nome_categoria || "Sem categoria"}`;
      const linha2 = [
        `${emojis.clock} ${tempoAberto}`,
        `${emojis.calendar} ${horaAbertura}`,
        ultimaMsgTexto,
        tagsTexto,
      ]
        .filter(Boolean)
        .join("  ·  ");

      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${linha1}\n${linha2}`),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`overview_ir_ticket_${t.ticket_id}`)
              .setLabel("Ir ao Ticket")
              .setEmoji(getEmoji(emojis.arrowr))
              .setStyle(assumido ? ButtonStyle.Success : ButtonStyle.Primary),
          ),
      );
    }
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  const botoesRodape = [];

  if (tagsCadastradas.length > 0) {
    botoesRodape.push(
      new ButtonBuilder()
        .setCustomId(`overview_filtro_tags_${filtroTag || ""}`)
        .setLabel(filtroTag ? "Limpar Filtro" : "Filtrar Tag")
        .setEmoji(getEmoji(emojis.layers))
        .setStyle(filtroTag ? ButtonStyle.Danger : ButtonStyle.Secondary),
    );
  }

  botoesRodape.push(
    new ButtonBuilder()
      .setCustomId(`atualizar_overview_`)
      .setEmoji(getEmoji(emojis.refresh))
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Atualizar"),
  );

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(...botoesRodape),
  );

  return container;
}

let overviewCron = null;

function iniciarCronOverview(client) {
  if (overviewCron) return;
  overviewCron = cron.schedule("*/5 * * * *", async () => {
    await atualizarTodosOverviews(client);
  });
}

async function atualizarTodosOverviews(client) {
  const guilds = client.guilds.cache;
  for (const [guildId, guild] of guilds) {
    try {
      const configDB = getConfigDB(guildId);
      const overviewData = configDB.get("overview_painel");
      if (!overviewData?.ativo) continue;

      const canal = guild.channels.cache.get(overviewData.canal_id);
      if (!canal) continue;

      const msg = await canal.messages
        .fetch(overviewData.message_id)
        .catch(() => null);
      if (!msg) continue;

      const container = await buildOverviewComponents(guildId, guild, {
        filtroTag: overviewData.filtro_tag_atual || null,
        pagina: overviewData.pagina_atual || 0,
      });

      await msg
        .edit({ components: [container], flags: MessageFlags.IsComponentsV2 })
        .catch(() => {});
    } catch {}
  }
}

module.exports = {
  customIds: [
    "config_overview_",
    "toggle_overview_",
    "overview_select_canal_",
    "atualizar_overview_",
    "atualizar_overview_now",
    "enviar_overview_",
    "overview_pag_",
    "overview_filtro_tags_",
    "overview_ir_ticket_",
    "overview_tag_choose_",
  ],
  iniciarCronOverview,
  atualizarTodosOverviews,

  async execute(client, interaction) {
    const { customId, guildId, guild } = interaction;
    if (!customId) return;

    const mine = this.customIds;
    if (!mine.some((id) => customId === id || customId.startsWith(id))) return;

    const publicos = [
      "atualizar_overview_",
      "overview_pag_",
      "overview_filtro_tags_",
      "overview_ir_ticket_",
      "overview_tag_choose_",
    ];
    const isPublico = publicos.some(
      (id) => customId === id || customId.startsWith(id),
    );
    if (!isPublico && !interaction._fromPainel) return;

    const configDB = getConfigDB(guildId);

    if (customId.startsWith("overview_ir_ticket_")) {
      const ticketId = customId.replace("overview_ir_ticket_", "");
      const canal = guild.channels.cache.get(ticketId);

      if (!canal) {
        return interaction.reply({
          content: `${emojis.danger} Este canal de ticket foi deletado.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const db = getDBConnection(guildId);
      const ticket = await db
        .getAsync(
          "SELECT user_id, staff_id, nome_categoria, criado_em, assumido_em, tags, respondido_id, ultima_mensagem_em FROM tickets WHERE ticket_id = ?",
          [ticketId],
        )
        .catch(() => null);

      if (!ticket) {
        return interaction.reply({
          content: `${emojis.danger} Ticket não encontrado no banco de dados.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const agora = Date.now();
      const tempoAberto = formatarTempo(agora - (ticket.criado_em || agora));
      const horaAbertura = ticket.criado_em
        ? new Date(ticket.criado_em).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "desconhecido";

      let tagsTexto = "Nenhuma";
      try {
        const tagsArr = JSON.parse(ticket.tags || "[]");
        const CORES = {
          vermelho: "🔴",
          laranja: "🟠",
          amarelo: "🟡",
          verde: "🟢",
          azul: "🔵",
          roxo: "🟣",
        };
        const tagsConfig = configDB.get("tags_config") || {};
        const tagsCadastradas = tagsConfig.tags || [];
        if (tagsArr.length > 0) {
          tagsTexto = tagsArr
            .map((nome) => {
              const tagObj = tagsCadastradas.find((tc) => tc.nome === nome);
              const emoji = tagObj ? CORES[tagObj.cor] || "⚫" : "⚫";
              return `${emoji} ${nome}`;
            })
            .join(", ");
        }
      } catch {}

      let ultimaMsgTexto = "Sem registro";
      if (ticket.respondido_id) {
        ultimaMsgTexto =
          ticket.respondido_id === ticket.user_id
            ? "👤 Autor"
            : `${emojis.suporte || "🛡️"} Staff`;
      }

      const assumidoTexto = ticket.assumido_em
        ? `${emojis.check} Sim — assumido há ${formatarTempo(agora - ticket.assumido_em)}`
        : `${emojis.spinning} Não assumido`;

      return interaction.reply({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.clipboard} **Informações do Ticket**\n${canal}`,
              ),
              new TextDisplayBuilder().setContent(
                `**Categoria:** ${ticket.nome_categoria || "Sem categoria"}\n` +
                  `**${emojis.clock} Aberto em:** ${horaAbertura} (${tempoAberto} atrás)\n` +
                  `**${emojis.check} Assumido:** ${assumidoTexto}\n` +
                  `**${emojis.message || "💬"} Última msg:** ${ultimaMsgTexto}\n` +
                  `**🏷️ Tags:** ${tagsTexto}`,
              ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setLabel("Abrir Canal")
                  .setURL(`https://discord.com/channels/${guildId}/${ticketId}`)
                  .setStyle(ButtonStyle.Link)
                  .setEmoji(getEmoji(emojis.arrowr)),
              ),
            ),
        ],
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
      });
    }

    if (customId.startsWith("overview_pag_")) {
      await interaction.deferUpdate().catch(() => {});
      const parts = customId.replace("overview_pag_", "").split("_");
      const novaPagina = parseInt(parts[0]) || 0;
      const filtroAtual = parts.slice(1).join("_") || null;

      const overviewData = configDB.get("overview_painel") || {};
      overviewData.pagina_atual = novaPagina;
      overviewData.filtro_tag_atual = filtroAtual || null;
      configDB.set("overview_painel", overviewData);

      const container = await buildOverviewComponents(guildId, guild, {
        filtroTag: filtroAtual || null,
        pagina: novaPagina,
      });
      return interaction
        .editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        })
        .catch(() => {});
    }

    if (customId.startsWith("overview_filtro_tags_")) {
      const filtroAtual = customId.replace("overview_filtro_tags_", "") || null;

      if (filtroAtual) {
        await interaction.deferUpdate().catch(() => {});
        const overviewData = configDB.get("overview_painel") || {};
        overviewData.filtro_tag_atual = null;
        overviewData.pagina_atual = 0;
        configDB.set("overview_painel", overviewData);
        const container = await buildOverviewComponents(guildId, guild, {
          filtroTag: null,
          pagina: 0,
        });
        return interaction
          .editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
          })
          .catch(() => {});
      }

      const tagsConfig = configDB.get("tags_config") || {};
      const tagsCadastradas = tagsConfig.tags || [];
      if (tagsCadastradas.length === 0) {
        return interaction.reply({
          content: `${emojis.info} Nenhuma tag cadastrada.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const CORES = {
        vermelho: "🔴",
        laranja: "🟠",
        amarelo: "🟡",
        verde: "🟢",
        azul: "🔵",
        roxo: "🟣",
      };
      const options = tagsCadastradas.map((tag, i) => ({
        label: tag.nome,
        value: tag.nome,
        emoji: CORES[tag.cor] || "⚫",
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId("overview_tag_choose_")
        .setPlaceholder("Selecione uma tag para filtrar")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(options);

      return interaction.reply({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.layers || "🏷️"} **Filtrar tickets por tag**`,
              ),
              new TextDisplayBuilder().setContent(
                `Selecione uma tag para filtrar o painel. O filtro será aplicado ao painel público.`,
              ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(select),
            ),
        ],
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
      });
    }

    if (customId === "overview_tag_choose_") {
      const filtroTag = interaction.values[0];
      const overviewData = configDB.get("overview_painel") || {};
      overviewData.filtro_tag_atual = filtroTag;
      overviewData.pagina_atual = 0;
      configDB.set("overview_painel", overviewData);

      const canal = guild.channels.cache.get(overviewData.canal_id);
      if (canal && overviewData.message_id) {
        const msg = await canal.messages
          .fetch(overviewData.message_id)
          .catch(() => null);
        if (msg) {
          const container = await buildOverviewComponents(guildId, guild, {
            filtroTag,
            pagina: 0,
          });
          await msg
            .edit({
              components: [container],
              flags: MessageFlags.IsComponentsV2,
            })
            .catch(() => {});
        }
      }

      return interaction
        .update({
          components: [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.success || "✅"} **Filtro aplicado: \`${filtroTag}\`**`,
              ),
              new TextDisplayBuilder().setContent(
                `O painel foi atualizado para mostrar apenas tickets com essa tag.\n\nClique em **Filtrar Tag** novamente no painel para limpar o filtro.`,
              ),
            ),
          ],
          flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
        })
        .catch(async () => {
          await interaction
            .reply({
              content: `${emojis.success || "✅"} Filtro **${filtroTag}** aplicado ao painel.`,
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        });
    }

    if (customId === "atualizar_overview_") {
      await interaction.deferUpdate().catch(() => {});
      const overviewData = configDB.get("overview_painel") || {};
      const container = await buildOverviewComponents(guildId, guild, {
        filtroTag: overviewData.filtro_tag_atual || null,
        pagina: overviewData.pagina_atual || 0,
      });
      return interaction
        .editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        })
        .catch(() => {});
    }

    if (customId === "atualizar_overview_now") {
      await interaction.deferUpdate().catch(() => {});
      const overviewData = configDB.get("overview_painel") || {};
      const container = await buildOverviewComponents(guildId, guild, {
        filtroTag: overviewData.filtro_tag_atual || null,
        pagina: overviewData.pagina_atual || 0,
      });
      return interaction
        .editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        })
        .catch(() => {});
    }

    if (customId === "config_overview_") {
      const overviewData = configDB.get("overview_painel") || {};
      const ativo = overviewData.ativo ?? false;
      const canalId = overviewData.canal_id;
      const canal = canalId ? guild.channels.cache.get(canalId) : null;

      const btnToggle = new ButtonBuilder()
        .setCustomId("toggle_overview_")
        .setLabel(`Painel: ${ativo ? "ON" : "OFF"}`)
        .setEmoji(getEmoji(ativo ? emojis.on : emojis.off))
        .setStyle(ativo ? ButtonStyle.Success : ButtonStyle.Secondary);

      const selectCanal = new ChannelSelectMenuBuilder()
        .setCustomId("overview_select_canal_")
        .setPlaceholder("Selecione o canal do painel")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);

      const btnEnviar = new ButtonBuilder()
        .setCustomId("enviar_overview_")
        .setLabel("Enviar/Atualizar Painel")
        .setEmoji(getEmoji(emojis.embeds))
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canalId);

      const statusTexto = ativo
        ? `${emojis.check || "✅"} Ativo`
        : `${emojis.cancel || "❌"} Inativo`;

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }
      return interaction.editReply({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.graph || "📊"} **Painel de Visão Geral**`,
              ),
              new TextDisplayBuilder().setContent(
                `Exibe um painel atualizado automaticamente a cada **5 minutos** com tickets abertos.\n\n` +
                  `${emojis.signal || "🔔"} **Status:** ${statusTexto}\n` +
                  `${emojis.pin || "📌"} **Canal:** ${canal ? canal.toString() : "*(não configurado)*"}`,
              ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(selectCanal),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                btnToggle,
                btnEnviar,
                new ButtonBuilder()
                  .setCustomId("outros_ticket")
                  .setLabel("Voltar")
                  .setEmoji(getEmoji(emojis.arrowl))
                  .setStyle(ButtonStyle.Secondary),
              ),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      customId === "overview_select_canal_"
    ) {
      const canalId = interaction.values[0];
      const data = configDB.get("overview_painel") || {};
      data.canal_id = canalId;
      configDB.set("overview_painel", data);
      return interaction.reply({
        content: `${emojis.check} Canal do painel de visão geral definido: <#${canalId}>`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (customId === "toggle_overview_") {
      const data = configDB.get("overview_painel") || {};
      data.ativo = !(data.ativo ?? false);
      configDB.set("overview_painel", data);
      interaction.customId = "config_overview_";
      return this.execute(client, interaction);
    }

    if (customId === "enviar_overview_") {
      await interaction.deferUpdate().catch(() => {});
      const data = configDB.get("overview_painel") || {};
      const canal = guild.channels.cache.get(data.canal_id);
      if (!canal)
        return interaction.followUp({
          content: `${emojis.danger} Canal não encontrado.`,
          flags: MessageFlags.Ephemeral,
        });

      const container = await buildOverviewComponents(guildId, guild, {
        filtroTag: null,
        pagina: 0,
      });

      if (data.message_id) {
        const old = await canal.messages
          .fetch(data.message_id)
          .catch(() => null);
        if (old) await old.delete().catch(() => {});
      }

      const msg = await canal.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
      data.message_id = msg.id;
      data.ativo = true;
      data.pagina_atual = 0;
      data.filtro_tag_atual = null;
      configDB.set("overview_painel", data);

      iniciarCronOverview(client);

      return interaction.editReply({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.check} Painel enviado em ${canal}!\nAtualização automática a cada 5 minutos.`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("config_overview_")
                  .setLabel("Configurar")
                  .setEmoji(getEmoji(emojis.settings))
                  .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId("outros_ticket")
                  .setLabel("Voltar")
                  .setEmoji(getEmoji(emojis.arrowl))
                  .setStyle(ButtonStyle.Secondary),
              ),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};