const {
  Events,
  ChannelType,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const path = require("path");
const fs = require("fs");
const { JsonDatabase } = require("wio.db");
const ticketRepo = require("../../utils/ticket/repository");

const { t } = require("../../utils/i18n");
const PROJECT_ROOT = path.resolve(__dirname, "../../../");

function getEmoji(raw) {
  if (!raw) return undefined;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return undefined;
  const [, name, id] = match;
  return { name, id };
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

const ultimaMensagem = new Map();

module.exports = {
  name: Events.MessageCreate,

  async execute(client, message) {
    if (!message.guild || !message.author || message.author.bot) return;
    const channel = message.channel;
    if (channel.type !== ChannelType.GuildText) return;
    if (!channel.topic || !channel.topic.startsWith("Labz - ")) return;

    ultimaMensagem.set(channel.id, Date.now());

    try {
      await ticketRepo.atualizarTicket(channel.id, {
        ultima_mensagem_em: Date.now(),
        aviso_inatividade: 0,
      });
    } catch {}
  },
};

module.exports.iniciarCronInatividade = function (client) {
  const cron = require("node-cron");

  cron.schedule("0 * * * *", async () => {
    try {
      await verificarInatividade(client);
    } catch (err) {
      console.error("[INATIVIDADE] Erro no cron:", err);
    }
  });
};

async function verificarInatividade(client) {
  const guilds = client.guilds.cache;

  for (const [guildId, guild] of guilds) {
    try {
      const configDB = getConfigDB(guildId);
      const inatividade_ativo = configDB.get("inatividade_ativo") ?? false;
      if (!inatividade_ativo) continue;

      const horas_aviso = configDB.get("inatividade_horas_aviso") ?? 24;
      const horas_fechar = configDB.get("inatividade_horas_fechar") ?? 48;

      const agora = Date.now();
      const msAviso = horas_aviso * 3600000;
      const msFechar = horas_fechar * 3600000;

      const tickets = await ticketRepo.listarTicketsAbertos(guildId).catch(() => []);

      for (const ticket of tickets) {
        const ultimaMens = ticket.ultima_mensagem_em || ticket.criado_em;
        const tempoSemResposta = agora - ultimaMens;

        const canal = guild.channels.cache.get(ticket.ticket_id);
        if (!canal) continue;

        if (tempoSemResposta >= msFechar) {
          try {
            await canal.send({
              components: [
                new ContainerBuilder().addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    t("inatividade_fechado", guildId),
                  ),
                ),
              ],
              flags: MessageFlags.IsComponentsV2,
            });
            await new Promise((r) => setTimeout(r, 3000));
            await canal.delete("Fechado por inatividade").catch(() => {});
            await ticketRepo.atualizarTicket(ticket.ticket_id, { fechado_em: agora });
          } catch {}
          continue;
        }

        if (tempoSemResposta >= msAviso && !ticket.aviso_inatividade) {
          try {
            const restante = Math.round(
              (msFechar - tempoSemResposta) / 3600000,
            );
            const mensagemInatividade =
              configDB.get("inatividade_mensagem") ||
              t("inatividade_aviso", guildId, {
                horas: "{horas}",
                restante: String(restante),
              });

            const horasSemResp = Math.floor(tempoSemResposta / 3600000);
            const msg = mensagemInatividade
              .replace(/{user}/g, ticket.user_id)
              .replace(/{horas}/g, horasSemResp.toString());

            await canal.send({
              components: [
                new ContainerBuilder()
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(msg),
                  )
                  .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                      new ButtonBuilder()
                        .setCustomId("_noop_inatividade")
                        .setLabel(t("inatividade_btn_aviso", guildId))
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true),
                    ),
                  ),
              ],
              flags: MessageFlags.IsComponentsV2,
            });
            await ticketRepo.atualizarTicket(ticket.ticket_id, { aviso_inatividade: 1 });
          } catch {}
        }
      }
    } catch (err) {
      console.error(`[INATIVIDADE] Erro na guild ${guildId}:`, err);
    }
  }
}

module.exports.verificarInatividade = verificarInatividade;
