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
const { JsonDatabase } = require("wio.db");
const ticketRepo = require("../../utils/ticket/repository");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const PROJECT_ROOT = path.resolve(__dirname, "../../../");

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
  const estacoes = getEstacoes(guildId);
  const estacao = estacoes.find((e) => e.id === estacaoId);
  if (!estacao) return null;

  const nomeCategoria = estacao.nome;
  const stats = await ticketRepo.estatisticasEstacao(guildId, nomeCategoria).catch(() => null);

  const topStaff = stats?.topStaff ?? [];

  const mediaAval = stats?.avalMedia
    ? `${Number(stats.avalMedia).toFixed(1)}/5.0 ⭐`
    : stats?.avalSimples
      ? `${Number(stats.avalSimples).toFixed(1)}/5.0 ⭐`
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
      abertos: stats?.abertos || 0,
      total: stats?.total || 0,
      fechados: stats?.fechados || 0,
      comStaff: stats?.comStaff || 0,
      semStaff: stats?.semStaff || 0,
      tmResposta: formatDuration(stats?.tmResposta),
      tmResolucao: formatDuration(stats?.tmResolucao),
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