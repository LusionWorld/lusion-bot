const {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");

const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const { JsonDatabase } = require("wio.db");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const PROJECT_ROOT = path.resolve(__dirname, "../../../");
const dbConnections = new Map();

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

function getEstacoesDB(guildId) {
  return new JsonDatabase({
    databasePath: path.join(
      PROJECT_ROOT,
      "banco/ticket",
      guildId,
      "estacoes.json",
    ),
  });
}

function getEstacoes(guildId) {
  const db = getEstacoesDB(guildId);
  const raw = db.get("estacoes");
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "N/A";
  const mins = Math.floor(ms / 60000);
  const horas = Math.floor(mins / 60);
  const minutos = mins % 60;
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min`;
}

async function buildEstatisticasEstacao(guildId, estacaoId) {
  const db = getDBConnection(guildId);
  const estacoes = getEstacoes(guildId);
  const estacao = estacoes.find((e) => e.id === estacaoId);
  if (!estacao) return null;

  const nomeCategoria = estacao.nome;
  const whereBase = `guild_id = ? AND (nome_categoria = ? OR (nome_categoria IS NULL AND motivo_abertura LIKE ?))`;
  const paramsBase = [guildId, nomeCategoria, `%${nomeCategoria}%`];

  const [abertos, total, fechados, comStaff, semStaff] = await Promise.all([
    db
      .getAsync(
        `SELECT COUNT(*) as c FROM tickets WHERE ${whereBase} AND fechado_em IS NULL`,
        paramsBase,
      )
      .catch(() => ({ c: 0 })),
    db
      .getAsync(
        `SELECT COUNT(*) as c FROM tickets WHERE ${whereBase}`,
        paramsBase,
      )
      .catch(() => ({ c: 0 })),
    db
      .getAsync(
        `SELECT COUNT(*) as c FROM tickets WHERE ${whereBase} AND fechado_em IS NOT NULL`,
        paramsBase,
      )
      .catch(() => ({ c: 0 })),
    db
      .getAsync(
        `SELECT COUNT(*) as c FROM tickets WHERE ${whereBase} AND fechado_em IS NULL AND assumido_em IS NOT NULL`,
        paramsBase,
      )
      .catch(() => ({ c: 0 })),
    db
      .getAsync(
        `SELECT COUNT(*) as c FROM tickets WHERE ${whereBase} AND fechado_em IS NULL AND assumido_em IS NULL`,
        paramsBase,
      )
      .catch(() => ({ c: 0 })),
  ]);

  const tmResposta = await db
    .getAsync(
      `SELECT AVG(primeira_resposta_em - criado_em) as media FROM tickets WHERE ${whereBase} AND primeira_resposta_em IS NOT NULL`,
      paramsBase,
    )
    .catch(() => null);

  const tmResolucao = await db
    .getAsync(
      `SELECT AVG(fechado_em - criado_em) as media FROM tickets WHERE ${whereBase} AND fechado_em IS NOT NULL`,
      paramsBase,
    )
    .catch(() => null);

  const avalMedia = await db
    .getAsync(
      `SELECT AVG(media) as avg_media FROM avaliacoes_criterios ac 
     INNER JOIN tickets t ON ac.ticket_id = t.ticket_id 
     WHERE t.guild_id = ? AND t.nome_categoria = ?`,
      [guildId, nomeCategoria],
    )
    .catch(() => null);

  const avalSimples = await db
    .getAsync(
      `SELECT AVG(a.nota) as avg_nota FROM avaliacoes a
     INNER JOIN tickets t ON a.ticket_id = t.ticket_id
     WHERE t.guild_id = ? AND t.nome_categoria = ?`,
      [guildId, nomeCategoria],
    )
    .catch(() => null);

  const topStaff = await db
    .allAsync(
      `SELECT respondido_id, COUNT(*) as c FROM tickets WHERE guild_id = ? AND nome_categoria = ? AND respondido_id IS NOT NULL GROUP BY respondido_id ORDER BY c DESC LIMIT 3`,
      [guildId, nomeCategoria],
    )
    .catch(() => []);

  const mediaAval = avalMedia?.avg_media
    ? `${avalMedia.avg_media.toFixed(1)}/5.0 ⭐`
    : avalSimples?.avg_nota
      ? `${avalSimples.avg_nota.toFixed(1)}/5.0 ⭐`
      : "Sem avaliações";

  const topStaffText =
    topStaff.length > 0
      ? topStaff
          .map(
            (s, i) => `${i + 1}. <@${s.respondido_id}> — ${s.c} atendimento(s)`,
          )
          .join("\n")
      : "Nenhum dado ainda";

  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  return {
    estacao,
    stats: {
      abertos: abertos?.c || 0,
      total: total?.c || 0,
      fechados: fechados?.c || 0,
      comStaff: comStaff?.c || 0,
      semStaff: semStaff?.c || 0,
      tmResposta: formatDuration(tmResposta?.media),
      tmResolucao: formatDuration(tmResolucao?.media),
      mediaAval,
      topStaffText,
      agora,
    },
  };
}

module.exports = {
  customIds: ["stats_estacao_"],

  async execute(client, interaction) {
    const belongsToThis = module.exports.customIds.some(
      (id) =>
        interaction.customId && (interaction.customId === id || interaction.customId.startsWith(id)),
    );
    if (!belongsToThis) return;
    if (!interaction._fromPainel) return;
    const { customId, guildId } = interaction;
    if (!customId) return;

    if (customId.startsWith("stats_estacao_")) {
      const estacaoId = customId.replace("stats_estacao_", "");

      await interaction.deferUpdate().catch(() => {});

      const result = await buildEstatisticasEstacao(guildId, estacaoId);
      if (!result) {
        return interaction
          .editReply({
            content: "❌ Estação não encontrada.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }

      const { estacao, stats } = result;

      const btnVoltar = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel("Voltar")
        .setStyle(ButtonStyle.Secondary);
      {
        const e = emojis.arrowl?.match(/^<a?:([^:]+):(\d+)>$/);
        if (e) btnVoltar.setEmoji({ name: e[1], id: e[2] });
      }

      const btnAtualizar = new ButtonBuilder()
        .setCustomId(`stats_estacao_${estacaoId}`)
        .setLabel("Atualizar")
        .setStyle(ButtonStyle.Primary);
      {
        const e = emojis.refresh?.match(/^<a?:([^:]+):(\d+)>$/);
        if (e) btnAtualizar.setEmoji({ name: e[1], id: e[2] });
      }

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${emojis.graph || "📊"} # Estatísticas: ${estacao.nome}`,
            ),
            new TextDisplayBuilder().setContent(
              `${emojis.clock || "🕐"} *Atualizado em: ${stats.agora}*`,
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${emojis.clipboard || "📋"} Tickets**\n` +
                `> Abertos agora: **${stats.abertos}**\n` +
                `> Aguardando staff: **${stats.semStaff}**\n` +
                `> Em atendimento: **${stats.comStaff}**\n` +
                `> Total histórico: **${stats.total}**\n` +
                `> Fechados: **${stats.fechados}**`,
            ),
            new TextDisplayBuilder().setContent(
              `**${emojis.clock || "⏱️"} Tempos Médios**\n` +
                `> Primeira resposta: **${stats.tmResposta}**\n` +
                `> Resolução completa: **${stats.tmResolucao}**`,
            ),
            new TextDisplayBuilder().setContent(
              `**${emojis.star || "⭐"} Avaliação**\n> Média: **${stats.mediaAval}**`,
            ),
            new TextDisplayBuilder().setContent(
              `**${emojis.crown || "🏆"} Top Staff nesta Estação**\n${stats.topStaffText}`,
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAtualizar, btnVoltar),
          ),
      ];

      return interaction
        .editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        })
        .catch(() => {});
    }
  },

  buildEstatisticasEstacao,
};