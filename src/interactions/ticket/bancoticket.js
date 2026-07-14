const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  ContainerBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  TextDisplayBuilder,
  MessageFlags,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const { getEmojis } = require("../../utils/emojis/emojiHelper");
const { t } = require("../../utils/i18n");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

function getOnOffEmojiId(status) {
  return status ? getEmoji(emojis.on) : getEmoji(emojis.off);
}

module.exports = {
  async execute(client, interaction) {
    const bancoTicketIds = [
      "banco_ticket",
      "gerar_lista",
      "todo_mes",
      "categoria_dado",
      "pesquisar_usuario",
      "voltar_inicio",
    ];

    const isBancoTicketInteraction =
      (interaction.isButton() &&
        bancoTicketIds.some(
          (id) =>
            interaction.customId === id ||
            interaction.customId.startsWith(id + ":"),
        )) ||
      (interaction.isStringSelectMenu() &&
        (interaction.customId === "select_banco_ticket" ||
          interaction.customId.startsWith("select_categoria:"))) ||
      (interaction.isUserSelectMenu() &&
        interaction.customId.startsWith("select_usuario_ticket:"));

    if (!isBancoTicketInteraction) return;

    if (interaction.isButton() && interaction.customId === "banco_ticket") {
      const guildId = interaction.guildId;
      const baseDir = path.join(
        __dirname,
        `../../../banco/ticket/${guildId}/banco`,
      );
      const semanalDir = path.join(baseDir, "semanal");
      const dbPath = path.join(baseDir, "tickets.db");

      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) return console.error("Erro ao abrir banco:", err.message);
      });

      const query = (sql, params = []) =>
        new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });

      let container;
      let containerData = {};

      try {
        const [contadores] =
          (await query(`SELECT * FROM contadores WHERE guild_id = ?`, [
            guildId,
          ])) || [];

        const abertos = contadores?.abertos ?? 0;
        const assumidos = contadores?.assumidos ?? 0;
        const fechados = contadores?.fechados ?? 0;

        const tickets = await query(
          `SELECT criado_em, assumido_em, fechado_em, primeira_resposta_em FROM tickets WHERE guild_id = ?`,
          [guildId],
        );

        let totalAssumir = 0,
          countAssumir = 0;
        let totalFechar = 0,
          countFechar = 0;
        let totalResponder = 0,
          countResponder = 0;

        for (const t of tickets) {
          if (t.assumido_em && t.criado_em) {
            totalAssumir += t.assumido_em - t.criado_em;
            countAssumir++;
          }
          if (t.fechado_em && t.criado_em) {
            totalFechar += t.fechado_em - t.criado_em;
            countFechar++;
          }
          if (t.primeira_resposta_em && t.criado_em) {
            totalResponder += t.primeira_resposta_em - t.criado_em;
            countResponder++;
          }
        }

        const tempoAssumir = countAssumir ? totalAssumir / countAssumir : 0;
        const tempoFechar = countFechar ? totalFechar / countFechar : 0;
        const tempoResponder = countResponder
          ? totalResponder / countResponder
          : 0;

        const formatar = (ms) => {
          const s = Math.floor(ms / 1000);
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = s % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(
            2,
            "0",
          )}:${String(sec).padStart(2, "0")}`;
        };

        const agora = new Date();
        const day = agora.getDay();
        const diffSegunda = (day === 0 ? -6 : 1) - day;
        const inicioSemana = new Date(agora);
        inicioSemana.setDate(agora.getDate() + diffSegunda);
        inicioSemana.setHours(0, 0, 0, 0);
        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(inicioSemana.getDate() + 6);
        const formatarData = (d) => d.toLocaleDateString("pt-BR");

        containerData = {
          title: t("banco_titulo", guildId),
          periodo: t("banco_periodo", guildId, {
            inicio: formatarData(inicioSemana),
            fim: formatarData(fimSemana),
          }),
          abertos: t("banco_abertos", guildId, { n: abertos }),
          assumidos: t("banco_assumidos", guildId, { n: assumidos }),
          fechados: t("banco_fechados", guildId, { n: fechados }),
          tempoResponder: t("banco_tempo_resposta", guildId, {
            t: formatar(tempoResponder),
          }),
          tempoAssumir: t("banco_tempo_assumir", guildId, {
            t: formatar(tempoAssumir),
          }),
          tempoFechar: t("banco_tempo_fechar", guildId, {
            t: formatar(tempoFechar),
          }),
        };
      } catch (err) {
        console.error("Erro ao consultar banco:", err);
        containerData = {
          title: t("banco_titulo", guildId),
          error: t("banco_erro_carregar", guildId),
        };
      } finally {
        db.close();
      }

      let arquivosSemana = [];
      try {
        arquivosSemana = fs
          .readdirSync(semanalDir)
          .filter((f) => f.startsWith("tickets_") && f.endsWith(".db"));
      } catch {}

      const selectOptions = [
        {
          label: t("banco_semana_atual_label", guildId),
          value: "atual",
          description: t("banco_semana_atual_desc", guildId),
          default: true,
        },
        ...arquivosSemana.map((file) => {
          const nome = file.replace(".db", "").replace("tickets_", "");
          const [inicio, fim] = nome.split("_a_");
          return {
            label: t("banco_semana_label", guildId, { inicio, fim }),
            value: nome,
          };
        }),
      ];

      const rowSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("select_banco_ticket")
          .setPlaceholder(t("banco_select_placeholder", guildId))
          .addOptions(selectOptions),
      );

      const selectedValue = "atual";
      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`pesquisar_usuario:${selectedValue}`)
          .setLabel(t("banco_btn_pesquisar", guildId))
          .setEmoji(getEmoji(emojis.lupa))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`gerar_lista:${selectedValue}`)
          .setLabel(t("banco_btn_lista", guildId))
          .setEmoji(getEmoji(emojis.file))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`todo_mes:${selectedValue}`)
          .setLabel(t("banco_btn_mes", guildId))
          .setEmoji(getEmoji(emojis.calendario))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`categoria_dado:${selectedValue}`)
          .setLabel(t("banco_btn_categoria", guildId))
          .setEmoji(getEmoji(emojis.textc))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("voltar_inicio")
          .setLabel(t("banco_btn_voltar", guildId))
          .setEmoji(getEmoji(emojis.home))
          .setStyle(ButtonStyle.Secondary),
      );

      if (containerData.error) {
        container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(containerData.title),
            new TextDisplayBuilder().setContent(containerData.error),
          )
          .addActionRowComponents(rowSelect, rowButtons);
      } else {
        container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(containerData.title),
            new TextDisplayBuilder().setContent(containerData.periodo),
            new TextDisplayBuilder().setContent(containerData.abertos),
            new TextDisplayBuilder().setContent(containerData.assumidos),
            new TextDisplayBuilder().setContent(containerData.fechados),
            new TextDisplayBuilder().setContent(containerData.tempoResponder),
            new TextDisplayBuilder().setContent(containerData.tempoAssumir),
            new TextDisplayBuilder().setContent(containerData.tempoFechar),
          )
          .addActionRowComponents(rowSelect, rowButtons);
      }

      await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [container],
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("gerar_lista")
    ) {
      const selectedSemana = interaction.customId.split(":")[1] || "atual";
      const guildId = interaction.guildId;
      const baseDir = path.join(
        __dirname,
        `../../../banco/ticket/${guildId}/banco`,
      );
      const semanalDir = path.join(baseDir, "semanal");
      const dbPath =
        selectedSemana === "atual"
          ? path.join(baseDir, "tickets.db")
          : path.join(semanalDir, `tickets_${selectedSemana}.db`);

      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
      const query = (sql, params = []) =>
        new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });

      try {
        const [contadores] =
          (await query(`SELECT * FROM contadores WHERE guild_id = ?`, [
            guildId,
          ])) || [];
        const abertos = contadores?.abertos ?? 0;
        const assumidos = contadores?.assumidos ?? 0;
        const fechados = contadores?.fechados ?? 0;
        const tickets = await query(
          `SELECT * FROM tickets WHERE guild_id = ?`,
          [guildId],
        );

        let totalAssumir = 0,
          countAssumir = 0;
        let totalFechar = 0,
          countFechar = 0;
        let totalResponder = 0,
          countResponder = 0;
        const desempenho = {};

        for (const t of tickets) {
          if (t.assumido_em && t.criado_em) {
            totalAssumir += t.assumido_em - t.criado_em;
            countAssumir++;
          }
          if (t.fechado_em && t.criado_em) {
            totalFechar += t.fechado_em - t.criado_em;
            countFechar++;
          }
          if (t.primeira_resposta_em && t.criado_em) {
            totalResponder += t.primeira_resposta_em - t.criado_em;
            countResponder++;
          }
          const addContagem = (coluna, userId) => {
            if (!userId) return;
            if (!desempenho[userId])
              desempenho[userId] = {
                assumidos: 0,
                fechados: 0,
                respondidos: 0,
              };
            desempenho[userId][coluna]++;
          };
          addContagem("assumidos", t.staff_id);
          addContagem("fechados", t.fechado_id);
          addContagem("respondidos", t.respondido_id);
        }

        const formatar = (ms) => {
          const s = Math.floor(ms / 1000);
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = s % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(
            2,
            "0",
          )}:${String(sec).padStart(2, "0")}`;
        };

        const tempoAssumir = countAssumir ? totalAssumir / countAssumir : 0;
        const tempoFechar = countFechar ? totalFechar / countFechar : 0;
        const tempoResponder = countResponder
          ? totalResponder / countResponder
          : 0;

        const nomeSemana =
          selectedSemana === "atual"
            ? (() => {
                const hoje = new Date();
                const dia = hoje.getDay();
                const diffSeg = (dia === 0 ? -6 : 1) - dia;
                const inicio = new Date(hoje);
                inicio.setDate(hoje.getDate() + diffSeg);
                const fim = new Date(inicio);
                fim.setDate(inicio.getDate() + 6);
                const fmt = (d) => d.toLocaleDateString("pt-BR");
                return `${fmt(inicio)} até ${fmt(fim)}`;
              })()
            : selectedSemana.replace(/_/g, " até ");

        const txt = [
          t("banco_relatorio_titulo", guildId, { semana: nomeSemana }),
          ``,
          t("banco_relatorio_secao_tickets", guildId),
          t("banco_relatorio_abertos", guildId, { n: abertos }),
          t("banco_relatorio_assumidos", guildId, { n: assumidos }),
          t("banco_relatorio_fechados", guildId, { n: fechados }),
          ``,
          t("banco_relatorio_secao_tempos", guildId),
          t("banco_relatorio_resp", guildId, { t: formatar(tempoResponder) }),
          t("banco_relatorio_assumir", guildId, { t: formatar(tempoAssumir) }),
          t("banco_relatorio_fechar", guildId, { t: formatar(tempoFechar) }),
          ``,
          t("banco_desempenho_staff", guildId),
        ];

        for (const [userId, dados] of Object.entries(desempenho)) {
          const member = interaction.guild.members.cache.get(userId);
          const nome =
            member?.nickname ||
            member?.user?.username ||
            "Usuário desconhecido";
          txt.push(
            t("banco_desempenho_linha", guildId, { nome, userId, assumidos: dados.assumidos, fechados: dados.fechados, respondidos: dados.respondidos }),
          );
        }

        const filePath = path.join(__dirname, `relatorio_${guildId}.txt`);
        fs.writeFileSync(filePath, txt.join("\n"), "utf-8");

        await interaction.reply({
          content:
            "✅ **Relatório gerado com sucesso!**\n\nConfira o arquivo anexado abaixo:",
          files: [filePath],
          flags: MessageFlags.Ephemeral,
        });

        fs.unlinkSync(filePath);
      } catch (err) {
        console.error("Erro ao gerar relatório:", err);
        const containerError = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(t("banco_relatorio_erro", guildId)),
        );

        await interaction.reply({
          components: [containerError],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      } finally {
        db.close();
      }
    }
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("todo_mes:")
    ) {
      const semanaSelecionada = interaction.customId.split(":")[1];
      const guildId = interaction.guildId;
      const baseDir = path.join(
        __dirname,
        `../../../banco/ticket/${guildId}/banco`,
      );
      const semanalDir = path.join(baseDir, "semanal");
      const [ano, mes] =
        semanaSelecionada !== "atual"
          ? semanaSelecionada.split("_a_")[0].split("-")
          : (() => {
              const agora = new Date();
              return [
                agora.getFullYear(),
                String(agora.getMonth() + 1).padStart(2, "0"),
              ];
            })();
      const arquivosMes = fs
        .readdirSync(semanalDir)
        .filter(
          (file) =>
            file.startsWith(`tickets_${ano}-${mes}-`) && file.endsWith(".db"),
        );
      const dbPaths = [
        path.join(baseDir, "tickets.db"),
        ...arquivosMes.map((f) => path.join(semanalDir, f)),
      ];
      let abertos = 0,
        assumidos = 0,
        fechados = 0;
      let totalAssumir = 0,
        countAssumir = 0;
      let totalFechar = 0,
        countFechar = 0;
      let totalResponder = 0,
        countResponder = 0;
      const desempenho = {};
      const queryDb = (dbPath, sql, params = []) => {
        return new Promise((resolve, reject) => {
          const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
          db.all(sql, params, (err, rows) => {
            db.close();
            if (err) reject(err);
            else resolve(rows);
          });
        });
      };
      for (const dbPath of dbPaths) {
        try {
          const [contador] =
            (await queryDb(
              dbPath,
              `SELECT * FROM contadores WHERE guild_id = ?`,
              [guildId],
            )) || [];
          abertos += contador?.abertos ?? 0;
          assumidos += contador?.assumidos ?? 0;
          fechados += contador?.fechados ?? 0;
        } catch {}
        try {
          const tickets = await queryDb(
            dbPath,
            `SELECT criado_em, assumido_em, fechado_em, primeira_resposta_em, staff_id, respondido_id, fechado_id 
             FROM tickets WHERE guild_id = ?`,
            [guildId],
          );
          for (const t of tickets) {
            if (t.assumido_em && t.criado_em) {
              totalAssumir += t.assumido_em - t.criado_em;
              countAssumir++;
            }
            if (t.fechado_em && t.criado_em) {
              totalFechar += t.fechado_em - t.criado_em;
              countFechar++;
            }
            if (t.primeira_resposta_em && t.criado_em) {
              totalResponder += t.primeira_resposta_em - t.criado_em;
              countResponder++;
            }
            const contar = (id, tipo) => {
              if (!id) return;
              if (!desempenho[id])
                desempenho[id] = { assumidos: 0, fechados: 0, respondidos: 0 };
              desempenho[id][tipo]++;
            };
            contar(t.staff_id, "assumidos");
            contar(t.fechado_id, "fechados");
            contar(t.respondido_id, "respondidos");
          }
        } catch {}
      }
      const formatar = (ms) => {
        const s = Math.floor(ms / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(
          2,
          "0",
        )}:${String(sec).padStart(2, "0")}`;
      };
      const agora = new Date();
      const day = agora.getDay();
      const diffSegunda = (day === 0 ? -6 : 1) - day;
      const inicioSemana = new Date(agora);
      inicioSemana.setDate(agora.getDate() + diffSegunda);
      inicioSemana.setHours(0, 0, 0, 0);
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 6);
      const formatarData = (d) => d.toLocaleDateString("pt-BR");
      const tempoAssumir = countAssumir ? totalAssumir / countAssumir : 0;
      const tempoFechar = countFechar ? totalFechar / countFechar : 0;
      const tempoResponder = countResponder
        ? totalResponder / countResponder
        : 0;

      const container = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(t("banco_titulo", guildId)),
        new TextDisplayBuilder().setContent(
          t("banco_periodo", guildId, {
            inicio: formatarData(inicioSemana),
            fim: formatarData(fimSemana),
          }),
        ),
        new TextDisplayBuilder().setContent(
          t("banco_abertos", guildId, { n: abertos }),
        ),
        new TextDisplayBuilder().setContent(
          t("banco_assumidos", guildId, { n: assumidos }),
        ),
        new TextDisplayBuilder().setContent(
          t("banco_fechados", guildId, { n: fechados }),
        ),
        new TextDisplayBuilder().setContent(
          t("banco_tempo_resposta", guildId, { t: formatar(tempoResponder) }),
        ),
        new TextDisplayBuilder().setContent(
          t("banco_tempo_assumir", guildId, { t: formatar(tempoAssumir) }),
        ),
        new TextDisplayBuilder().setContent(
          t("banco_tempo_fechar", guildId, { t: formatar(tempoFechar) }),
        ),
      );

      await interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("categoria_dado:")
    ) {
      const semanaSelecionada = interaction.customId.split(":")[1];
      const guildId = interaction.guildId;
      const baseDir = path.join(
        __dirname,
        `../../../banco/ticket/${guildId}/banco`,
      );
      const semanalDir = path.join(baseDir, "semanal");
      const dbPath =
        semanaSelecionada === "atual"
          ? path.join(baseDir, "tickets.db")
          : path.join(semanalDir, `tickets_${semanaSelecionada}.db`);
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
      const query = (sql, params = []) =>
        new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
      try {
        const rows = await query(
          `SELECT DISTINCT categoria FROM tickets WHERE guild_id = ? AND categoria IS NOT NULL`,
          [guildId],
        );
        if (!rows.length) {
          const containerError =
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t("banco_categoria_nenhuma", guildId),
              ),
            );

          await interaction.reply({
            components: [containerError],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
          return;
        }
        const guild = interaction.guild;
        const options = rows.map((r) => {
          const canal = guild.channels.cache.get(r.categoria);
          const nomeCategoria = canal?.name ?? `Categoria (${r.categoria})`;
          return {
            label:
              nomeCategoria.length > 100
                ? nomeCategoria.slice(0, 97) + "..."
                : nomeCategoria,
            value: r.categoria,
          };
        });
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_categoria:${semanaSelecionada}`)
          .setPlaceholder(t("banco_categoria_placeholder", guildId))
          .addOptions(options);

        const containerSelect = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("banco_categoria_desc", guildId),
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectMenu),
          );

        await interaction.update({
          components: [containerSelect],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      } catch (err) {
        console.error("Erro ao buscar categorias:", err);
        const containerError = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            t("banco_categoria_erro_buscar", guildId),
          ),
        );

        await interaction.reply({
          components: [containerError],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      } finally {
        db.close();
      }
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("pesquisar_usuario")
    ) {
      const guildId = interaction.guildId;
      const selectedSemana = interaction.customId.split(":")[1] || "atual";

      const containerUser = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            t("banco_usuario_desc", guildId),
          ),
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
              .setCustomId(`select_usuario_ticket:${selectedSemana}`)
              .setPlaceholder(t("banco_usuario_placeholder", guildId)),
          ),
        );

      await interaction.reply({
        components: [containerUser],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    if (
      interaction.isUserSelectMenu() &&
      interaction.customId.startsWith("select_usuario_ticket:")
    ) {
      const semanaSelecionada = interaction.customId.split(":")[1];
      const userId = interaction.values[0];
      const guildId = interaction.guildId;
      const baseDir = path.join(
        __dirname,
        `../../../banco/ticket/${guildId}/banco`,
      );
      const semanalDir = path.join(baseDir, "semanal");
      const dbPath =
        semanaSelecionada === "atual"
          ? path.join(baseDir, "tickets.db")
          : path.join(semanalDir, `tickets_${semanaSelecionada}.db`);
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error("Erro ao abrir banco:", err.message);
          const containerError =
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                t("banco_usuario_banco_erro", guildId),
              ),
            );

          return interaction.reply({
            components: [containerError],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }
      });
      const query = (sql, params = []) =>
        new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
      try {
        const counts = await query(
          `SELECT
            (SELECT COUNT(*) FROM tickets WHERE staff_id = ? AND guild_id = ?) AS assumidos,
            (SELECT COUNT(*) FROM tickets WHERE fechado_id = ? AND guild_id = ?) AS fechados,
            (SELECT COUNT(*) FROM tickets WHERE respondido_id = ? AND guild_id = ?) AS respondidos`,
          [userId, guildId, userId, guildId, userId, guildId],
        );
        const {
          assumidos = 0,
          fechados = 0,
          respondidos = 0,
        } = counts[0] || {};

        const containerResult = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Usuário:** <@${userId}> | **Semana:** \`${semanaSelecionada}\``,
          ),
          new TextDisplayBuilder().setContent(
            `🟡 **${t("banco_usuario_assumidos_label", guildId)}:** \`\`\`diff\n+ ${assumidos}\n\`\`\``,
          ),
          new TextDisplayBuilder().setContent(
            `🔴 **${t("banco_usuario_fechados_label", guildId)}:** \`\`\`diff\n+ ${fechados}\n\`\`\``,
          ),
          new TextDisplayBuilder().setContent(
            `👤 **${t("banco_usuario_respondidos_label", guildId)}:** \`\`\`diff\n+ ${respondidos}\n\`\`\``,
          ),
        );

        await interaction.update({
          components: [containerResult],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      } catch (err) {
        console.error("Erro ao buscar tickets por usuário:", err);
        const containerError = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            t("banco_usuario_erro", guildId),
          ),
        );

        await interaction.reply({
          components: [containerError],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      } finally {
        db.close();
      }
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("select_categoria:")
    ) {
      const [_, semanaSelecionada] = interaction.customId.split(":");
      const categoriaSelecionada = interaction.values[0];
      const guildId = interaction.guildId;

      const baseDir = path.join(
        __dirname,
        `../../../banco/ticket/${guildId}/banco`,
      );
      const semanalDir = path.join(baseDir, "semanal");

      const dbPath =
        semanaSelecionada === "atual"
          ? path.join(baseDir, "tickets.db")
          : path.join(semanalDir, `tickets_${semanaSelecionada}.db`);

      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
      const query = (sql, params = []) =>
        new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });

      let containerData = {};

      try {
        const tickets = await query(
          `
          SELECT criado_em, assumido_em, fechado_em, primeira_resposta_em
          FROM tickets
          WHERE guild_id = ? AND categoria = ?
        `,
          [guildId, categoriaSelecionada],
        );

        let abertos = 0,
          assumidos = 0,
          fechados = 0;
        let totalAssumir = 0,
          countAssumir = 0;
        let totalFechar = 0,
          countFechar = 0;
        let totalResponder = 0,
          countResponder = 0;

        for (const t of tickets) {
          abertos++;
          if (t.assumido_em) {
            assumidos++;
            totalAssumir += t.assumido_em - t.criado_em;
            countAssumir++;
          }
          if (t.fechado_em) {
            fechados++;
            totalFechar += t.fechado_em - t.criado_em;
            countFechar++;
          }
          if (t.primeira_resposta_em) {
            totalResponder += t.primeira_resposta_em - t.criado_em;
            countResponder++;
          }
        }

        const tempoAssumir = countAssumir ? totalAssumir / countAssumir : 0;
        const tempoFechar = countFechar ? totalFechar / countFechar : 0;
        const tempoResponder = countResponder
          ? totalResponder / countResponder
          : 0;

        const formatar = (ms) => {
          const s = Math.floor(ms / 1000);
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = s % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(
            2,
            "0",
          )}:${String(sec).padStart(2, "0")}`;
        };

        const agora = new Date();
        const day = agora.getDay();
        const diffSegunda = (day === 0 ? -6 : 1) - day;
        const inicioSemana = new Date(agora);
        inicioSemana.setDate(agora.getDate() + diffSegunda);
        inicioSemana.setHours(0, 0, 0, 0);

        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(inicioSemana.getDate() + 6);

        const formatarData = (d) => d.toLocaleDateString("pt-BR");

        const categoriasIds = categoriaSelecionada.split(",");

        const nomesCategorias = categoriasIds.map((id) => {
          const canal = interaction.guild.channels.cache.get(id.trim());
          return canal ? canal.name : `Categoria (${id.trim()})`;
        });

        const nomeCategoria = nomesCategorias.join(", ");

        containerData = {
          title: `# ${t("banco_categoria_titulo", guildId, { nome: nomeCategoria })}`,
          periodo: t("banco_periodo", guildId, {
            inicio: formatarData(inicioSemana),
            fim: formatarData(fimSemana),
          }),
          abertos: t("banco_abertos", guildId, { n: abertos }),
          assumidos: t("banco_assumidos", guildId, { n: assumidos }),
          fechados: t("banco_fechados", guildId, { n: fechados }),
          tempoResponder: t("banco_tempo_resposta", guildId, {
            t: formatar(tempoResponder),
          }),
          tempoAssumir: t("banco_tempo_assumir", guildId, {
            t: formatar(tempoAssumir),
          }),
          tempoFechar: t("banco_tempo_fechar", guildId, {
            t: formatar(tempoFechar),
          }),
        };
      } catch (err) {
        console.error("Erro ao buscar dados da categoria:", err);
        containerData = {
          title: "# Resumo da Categoria",
          error: t("banco_categoria_erro_dados", guildId),
        };
      } finally {
        db.close();
      }

      const rowVoltar = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("banco_ticket")
          .setLabel(t("banco_btn_voltar", guildId))
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary),
      );

      let container;
      if (containerData.error) {
        container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(containerData.title),
            new TextDisplayBuilder().setContent(containerData.error),
          )
          .addActionRowComponents(rowVoltar);
      } else {
        container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(containerData.title),
            new TextDisplayBuilder().setContent(containerData.periodo),
            new TextDisplayBuilder().setContent(containerData.abertos),
            new TextDisplayBuilder().setContent(containerData.assumidos),
            new TextDisplayBuilder().setContent(containerData.fechados),
            new TextDisplayBuilder().setContent(containerData.tempoResponder),
            new TextDisplayBuilder().setContent(containerData.tempoAssumir),
            new TextDisplayBuilder().setContent(containerData.tempoFechar),
          )
          .addActionRowComponents(rowVoltar);
      }

      await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [container],
        content: "",
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "select_banco_ticket"
    ) {
      const guildId = interaction.guildId;
      const selectedValue = interaction.values[0];

      const baseDir = path.join(
        __dirname,
        `../../banco/ticket/${guildId}/banco`,
      );
      const semanalDir = path.join(baseDir, "semanal");

      const dbFile =
        selectedValue === "atual"
          ? path.join(baseDir, "tickets.db")
          : path.join(semanalDir, `tickets_${selectedValue}.db`);

      const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (err) => {
        if (err) return console.error("Erro ao abrir banco:", err.message);
      });

      const query = (sql, params = []) =>
        new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });

      let containerData = {};

      try {
        const [contadores] =
          (await query(`SELECT * FROM contadores WHERE guild_id = ?`, [
            guildId,
          ])) || [];

        const abertos = contadores?.abertos ?? 0;
        const assumidos = contadores?.assumidos ?? 0;
        const fechados = contadores?.fechados ?? 0;

        const tickets = await query(
          `SELECT criado_em, assumido_em, fechado_em, primeira_resposta_em FROM tickets WHERE guild_id = ?`,
          [guildId],
        );

        let totalAssumir = 0,
          countAssumir = 0;
        let totalFechar = 0,
          countFechar = 0;
        let totalResponder = 0,
          countResponder = 0;

        for (const t of tickets) {
          if (t.assumido_em && t.criado_em) {
            totalAssumir += t.assumido_em - t.criado_em;
            countAssumir++;
          }
          if (t.fechado_em && t.criado_em) {
            totalFechar += t.fechado_em - t.criado_em;
            countFechar++;
          }
          if (t.primeira_resposta_em && t.criado_em) {
            totalResponder += t.primeira_resposta_em - t.criado_em;
            countResponder++;
          }
        }

        const tempoAssumir = countAssumir ? totalAssumir / countAssumir : 0;
        const tempoFechar = countFechar ? totalFechar / countFechar : 0;
        const tempoResponder = countResponder
          ? totalResponder / countResponder
          : 0;

        const formatar = (ms) => {
          const s = Math.floor(ms / 1000);
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = s % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(
            2,
            "0",
          )}:${String(sec).padStart(2, "0")}`;
        };

        const agora = new Date();
        const day = agora.getDay();
        const diffSegunda = (day === 0 ? -6 : 1) - day;
        const inicioSemana = new Date(agora);
        inicioSemana.setDate(agora.getDate() + diffSegunda);
        inicioSemana.setHours(0, 0, 0, 0);

        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(inicioSemana.getDate() + 6);

        const formatarData = (d) => d.toLocaleDateString("pt-BR");

        containerData = {
          title: t("banco_titulo", guildId),
          periodo: t("banco_periodo", guildId, {
            inicio: formatarData(inicioSemana),
            fim: formatarData(fimSemana),
          }),
          abertos: t("banco_abertos", guildId, { n: abertos }),
          assumidos: t("banco_assumidos", guildId, { n: assumidos }),
          fechados: t("banco_fechados", guildId, { n: fechados }),
          tempoResponder: t("banco_tempo_resposta", guildId, {
            t: formatar(tempoResponder),
          }),
          tempoAssumir: t("banco_tempo_assumir", guildId, {
            t: formatar(tempoAssumir),
          }),
          tempoFechar: t("banco_tempo_fechar", guildId, {
            t: formatar(tempoFechar),
          }),
        };
      } catch (err) {
        console.error("Erro ao consultar semana:", err);
        containerData = {
          title: t("banco_titulo", guildId),
          error: t("banco_erro_semana", guildId),
        };
      } finally {
        db.close();
      }

      let arquivosSemana = [];
      try {
        arquivosSemana = fs
          .readdirSync(semanalDir)
          .filter((f) => f.startsWith("tickets_") && f.endsWith(".db"));
      } catch {}

      const selectOptions = [
        {
          label: t("banco_semana_atual_label", guildId),
          value: "atual",
          description: t("banco_semana_atual_desc", guildId),
          default: selectedValue === "atual",
        },
        ...arquivosSemana.map((file) => {
          const nome = file.replace(".db", "").replace("tickets_", "");
          const [inicio, fim] = nome.split("_a_");
          return {
            label: t("banco_semana_label", guildId, { inicio, fim }),
            value: nome,
            default: nome === selectedValue,
          };
        }),
      ];

      const rowSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("select_banco_ticket")
          .setPlaceholder(t("banco_select_placeholder", guildId))
          .addOptions(selectOptions),
      );

      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`pesquisar_usuario:${selectedValue}`)
          .setLabel(t("banco_btn_pesquisar", guildId))
          .setEmoji(getEmoji(emojis.lupa))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`gerar_lista:${selectedValue}`)
          .setLabel(t("banco_btn_lista", guildId))
          .setEmoji(getEmoji(emojis.file))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`todo_mes:${selectedValue}`)
          .setLabel(t("banco_btn_mes", guildId))
          .setEmoji(getEmoji(emojis.calendario))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`categoria_dado:${selectedValue}`)
          .setLabel(t("banco_btn_categoria", guildId))
          .setEmoji(getEmoji(emojis.textc))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("voltar_inicio")
          .setLabel(t("banco_btn_voltar", guildId))
          .setEmoji(getEmoji(emojis.home))
          .setStyle(ButtonStyle.Secondary),
      );

      let container;
      if (containerData.error) {
        container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(containerData.title),
            new TextDisplayBuilder().setContent(containerData.error),
          )
          .addActionRowComponents(rowSelect, rowButtons);
      } else {
        container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(containerData.title),
            new TextDisplayBuilder().setContent(containerData.periodo),
            new TextDisplayBuilder().setContent(containerData.abertos),
            new TextDisplayBuilder().setContent(containerData.assumidos),
            new TextDisplayBuilder().setContent(containerData.fechados),
            new TextDisplayBuilder().setContent(containerData.tempoResponder),
            new TextDisplayBuilder().setContent(containerData.tempoAssumir),
            new TextDisplayBuilder().setContent(containerData.tempoFechar),
          )
          .addActionRowComponents(rowSelect, rowButtons);
      }

      await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [container],
      });
    }
  },
};
