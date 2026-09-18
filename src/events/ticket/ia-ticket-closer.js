const path = require("path");
const { t } = require("../../utils/i18n");
const ticketRepo = require("../../utils/ticket/repository");
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  ChannelType,
  FileBuilder,
} = require("discord.js");
const discordTranscripts = require("discord-html-transcripts");

const PROJECT_ROOT = path.resolve(__dirname, "../../../");

function getConfigDB(guildId) {
  const { JsonDatabase } = require("wio.db");
  return new JsonDatabase({
    databasePath: path.join(
      PROJECT_ROOT,
      "banco/ticket",
      guildId,
      "config.json",
    ),
  });
}

function getPersonalizacaoDB(guildId) {
  const { JsonDatabase } = require("wio.db");
  return new JsonDatabase({
    databasePath: path.join(
      PROJECT_ROOT,
      "banco/ticket",
      guildId,
      "personalizacao.json",
    ),
  });
}

/**
 *
 * @param {Client} client
 * @param {string} guildId
 * @param {string} channelId
 */
async function fecharTicketPorIA(client, guildId, channelId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const canal = guild.channels.cache.get(channelId);
  if (!canal) return;

  const motivo = t("ia_motivo_encerrado", guildId);

  try {
    await ticketRepo.fecharTicketDB(guildId, channelId, client.user.id);

    const dbConfig = getConfigDB(guildId);
    const dbPersonalizacao = getPersonalizacaoDB(guildId);

    const logCfg = dbConfig.get("logs.log_fechamento") || {};
    const logUserCfg = dbConfig.get("logs.log_user") || {};
    const transcriptCfg = dbConfig.get("transcript") || { system: false, staff: true, user: true };

    const embedLogsData = dbPersonalizacao.get("embedlogs") || {};
    const embedLogsUserData = dbPersonalizacao.get("embedlogsuser") || {};

    const topic = canal.topic || "";
    const autorId = topic.split("Labz - ")[1];

    const canalTexto = `<#${canal.id}> (${canal.name})`;
    const staffTexto = `${client.user} (\`${client.user.id}\`)`;
    const autorTexto = autorId ? `<@${autorId}>` : t("ticket_nao_identificado", guildId);
    const abertoTimestamp = Math.floor(canal.createdTimestamp / 1000);
    const fechadoTimestamp = Math.floor(Date.now() / 1000);
    const abertura = `<t:${abertoTimestamp}:f>`;
    const fechamento = `<t:${fechadoTimestamp}:f>`;
    const msTotal = Date.now() - canal.createdTimestamp;
    const totalMinutos = Math.floor(msTotal / 60000);
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    const horatotal = `${horas > 0 ? `${horas} hora${horas > 1 ? "s" : ""}` : ""}${horas && minutos ? ", " : ""}${minutos} minuto${minutos !== 1 ? "s" : ""}`;

    const replace = (str) =>
      (str || "")
        .replaceAll("{canal}", canalTexto)
        .replaceAll("{staff}", staffTexto)
        .replaceAll("{motivo}", motivo)
        .replaceAll("{user}", autorTexto)
        .replaceAll("{abertura}", abertura)
        .replaceAll("{fechamento}", fechamento)
        .replaceAll("{horatotal}", horatotal);

    let transcriptAttachment = null;
    let transcriptFileName = null;
    try {
      const ticketId = Math.floor(
        1000000000 + Math.random() * 9000000000,
      ).toString();
      transcriptFileName = `transcript-labz${ticketId}.html`;

      transcriptAttachment = await discordTranscripts.createTranscript(canal, {
        limit: 1000,
        returnBuffer: false,
        filename: transcriptFileName,
        footerText: "Labz Application - Transcript",
        saveImages: false,
        poweredBy: false,
      });
    } catch {}

    if (logCfg.ativo === true && logCfg.canal) {
      const canalLog = guild.channels.cache.get(logCfg.canal);
      if (canalLog) {
        const descricao = replace(
          embedLogsData.descricao || "Registro de fechamento do ticket.",
        );
        const components = [
          new TextDisplayBuilder().setContent(
            `# ${embedLogsData.title || "📄 Registro de Logs"}`,
          ),
          new TextDisplayBuilder().setContent(descricao),
        ];

        if (Array.isArray(embedLogsData.fields)) {
          embedLogsData.fields.forEach((f) => {
            components.push(
              new TextDisplayBuilder().setContent(
                `**${f.name}**\n${replace(f.value || "")}`,
              ),
            );
          });
        }

        let containerLog = new ContainerBuilder().addTextDisplayComponents(
          ...components,
        );

        if (transcriptCfg.staff === true && transcriptAttachment) {
          containerLog.addFileComponents(
            new FileBuilder().setURL(`attachment://${transcriptFileName}`),
          );
        }

        await canalLog
          .send({
            flags: MessageFlags.IsComponentsV2,
            components: [containerLog],
            files:
              transcriptCfg.staff === true && transcriptAttachment
                ? [transcriptAttachment]
                : [],
          })
          .catch(() => {});
      }
    }

    if (logUserCfg.ativo === true && autorId) {
      try {
        const membro = await guild.members.fetch(autorId).catch(() => null);
        if (membro) {
          const descricaoUser = replace(
            embedLogsUserData.descricao || "Seu ticket foi encerrado.",
          );
          const userComponents = [
            new TextDisplayBuilder().setContent(
              `# ${embedLogsUserData.title || "📄 Registro do Ticket Encerrado"}`,
            ),
            new TextDisplayBuilder().setContent(descricaoUser),
          ];

          if (Array.isArray(embedLogsUserData.fields)) {
            embedLogsUserData.fields.forEach((f) => {
              userComponents.push(
                new TextDisplayBuilder().setContent(
                  `**${f.name}**\n${replace(f.value || "")}`,
                ),
              );
            });
          }

          let containerUser = new ContainerBuilder().addTextDisplayComponents(
            ...userComponents,
          );

          if (transcriptCfg.user === true && transcriptAttachment) {
            containerUser.addFileComponents(
              new FileBuilder().setURL(`attachment://${transcriptFileName}`),
            );
          }

          await membro
            .send({
              flags: MessageFlags.IsComponentsV2,
              components: [containerUser],
              files:
                transcriptCfg.user === true && transcriptAttachment
                  ? [transcriptAttachment]
                  : [],
            })
            .catch(() => {});
        }
      } catch {}
    }

    try {
      const canaisDaCategoria =
        canal.parent?.children?.cache || guild.channels.cache;
      const callExistente = canaisDaCategoria.find(
        (c) => c.type === ChannelType.GuildVoice && c.name === canal.name,
      );
      if (callExistente) await callExistente.delete().catch(() => {});
    } catch {}

    setTimeout(async () => {
      await canal.delete().catch(() => {});
    }, 3000);
  } catch (err) {
    console.error("Erro ao fechar ticket por IA:", err);
    throw err;
  }
}

module.exports = { fecharTicketPorIA };