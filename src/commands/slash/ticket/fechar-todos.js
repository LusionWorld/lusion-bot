const {
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");

const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const { fecharTicket } = require("../../../utils/ticket/fecharTicket");
const { getEmojis } = require("../../../utils/emojis/emojiHelper");

const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  return { name: match[1], id: match[2] };
}

const _dbPool = new Map();

function getDB(guildId) {
  if (_dbPool.has(guildId)) return _dbPool.get(guildId);
  const dbPath = path.resolve(
    __dirname,
    "../../../../banco/ticket",
    guildId,
    "banco/tickets.db",
  );
  const db = new sqlite3.Database(dbPath);
  db.run("PRAGMA journal_mode=WAL");
  _dbPool.set(guildId, db);
  return db;
}

function getTicketsAbertosDB(guildId) {
  return new Promise((resolve, reject) => {
    const db = getDB(guildId);
    db.all(
      `SELECT ticket_id FROM tickets WHERE guild_id = ? AND fechado_em IS NULL`,
      [guildId],
      (err, rows) => (err ? reject(err) : resolve(rows || [])),
    );
  });
}

function getCanaisTicket(guild) {
  const ids = [];
  guild.channels.cache.forEach((c) => {
    if (
      c.type === ChannelType.GuildText &&
      typeof c.topic === "string" &&
      /^Labz - \d+/.test(c.topic)
    ) {
      ids.push(c.id);
    }
  });
  return ids;
}

async function getTicketsAbertos(guild) {
  const ids = new Set();
  try {
    const rows = await getTicketsAbertosDB(guild.id);
    for (const { ticket_id } of rows) {
      if (guild.channels.cache.has(ticket_id)) ids.add(ticket_id);
    }
  } catch (err) {
    console.error("[fechar-todos] Erro ao buscar tickets no DB:", err);
  }
  for (const id of getCanaisTicket(guild)) ids.add(id);
  return [...ids].map((ticket_id) => ({ ticket_id }));
}

module.exports = {
  name: "fechar-todos",
  nameKey: "cmd_fechar_todos_name",
  description: "Fecha todos os tickets abertos do servidor de uma vez.",
  descriptionKey: "cmd_fechar_todos_desc",
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
  options: [
    {
      name: "motivo",
      description: "Motivo do fechamento em massa (opcional)",
      descriptionKey: "opt_fechar_todos_motivo_desc",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],

  run: async (client, interaction) => {
    if (!interaction.guild) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const motivo =
      interaction.options.getString("motivo") ||
      "Fechamento em massa realizado pela administração.";

    let tickets;
    try {
      tickets = await getTicketsAbertos(interaction.guild);
    } catch (err) {
      console.error("[fechar-todos] Erro ao buscar tickets:", err);
      return interaction.editReply({
        content: `${emojis.cancel ?? "❌"} Ocorreu um erro ao buscar os tickets abertos.`,
      });
    }

    if (tickets.length === 0) {
      return interaction.editReply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${emojis.check ?? "✅"} Nenhum ticket aberto foi encontrado.`,
            ),
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const s = tickets.length !== 1 ? "s" : "";

    const btnConfirmar = new ButtonBuilder()
      .setCustomId(`ftodos_ok_${interaction.user.id}`)
      .setLabel(`Fechar ${tickets.length} ticket${s}`)
      .setStyle(ButtonStyle.Danger);

    const btnCancelar = new ButtonBuilder()
      .setCustomId(`ftodos_cancel_${interaction.user.id}`)
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Secondary);

    if (getEmoji(emojis.check)) btnConfirmar.setEmoji(getEmoji(emojis.check));
    if (getEmoji(emojis.cancel)) btnCancelar.setEmoji(getEmoji(emojis.cancel));

    await interaction.editReply({
      components: [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${emojis.warning ?? "⚠️"} **Confirmar fechamento em massa**`,
            ),
            new TextDisplayBuilder().setContent(
              `Você está prestes a fechar **${tickets.length}** ticket${s} aberto${s}.\nMotivo: **${motivo}**\n\nEssa ação não pode ser desfeita.`,
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnConfirmar, btnCancelar),
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    let confirm;
    try {
      confirm = await interaction.channel.awaitMessageComponent({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          [
            `ftodos_ok_${interaction.user.id}`,
            `ftodos_cancel_${interaction.user.id}`,
          ].includes(i.customId),
        time: 30_000,
      });
    } catch {
      return interaction.editReply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${emojis.cancel ?? "❌"} Tempo esgotado. Nenhum ticket foi fechado.`,
            ),
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (confirm.customId === `ftodos_cancel_${interaction.user.id}`) {
      return confirm.update({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${emojis.cancel ?? "❌"} Fechamento em massa cancelado.`,
            ),
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const sTickets = tickets.length !== 1 ? "s" : "";
    await confirm.update({
      components: [
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${emojis.dots ?? "⏳"} Fechando ${tickets.length} ticket${sTickets}, aguarde...`,
          ),
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    let fechados = 0;
    let erros = 0;

    for (const { ticket_id } of tickets) {
      try {
        await fecharTicket(interaction.guild, ticket_id, motivo, client, interaction.user.id);
        fechados++;
      } catch (err) {
        console.error(`[fechar-todos] Erro ao fechar ${ticket_id}:`, err.message);
        erros++;
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    const errosStr = erros > 0 ? ` (${erros} com erro)` : "";

    await interaction.editReply({
      components: [
        new ContainerBuilder()
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${emojis.check ?? "✅"} Fechamento em massa concluído`,
            ),
            new TextDisplayBuilder().setContent(
              `**${fechados}** ticket(s) fechado(s)${errosStr}.\nMotivo: **${motivo}**`,
            ),
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
