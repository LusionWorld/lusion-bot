const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const PROJECT_ROOT = path.resolve(__dirname, "../../../");

function criarBancoDados(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.serialize(() => {
        db.run(
          `
          CREATE TABLE IF NOT EXISTS contadores (
            guild_id TEXT PRIMARY KEY,
            abertos INTEGER DEFAULT 0,
            assumidos INTEGER DEFAULT 0,
            fechados INTEGER DEFAULT 0
          )
        `,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
          },
        );

        db.run(
          `
          CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            ticket_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            staff_id TEXT,
            respondido_id TEXT,
            fechado_id TEXT,
            categoria TEXT,
            criado_em INTEGER NOT NULL,
            assumido_em INTEGER,
            primeira_resposta_em INTEGER,
            fechado_em INTEGER,
            motivo TEXT,
            ia_pausada_por_staff INTEGER DEFAULT 0,
            chat_historico TEXT DEFAULT '[]',
            message_id TEXT DEFAULT NULL,
            motivo_abertura TEXT DEFAULT NULL,
            nome_categoria TEXT DEFAULT NULL
          )
        `,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
          },
        );

        db.run(
          `
          CREATE TABLE IF NOT EXISTS avaliacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            estrelas INTEGER NOT NULL,
            comentario TEXT,
            avaliado_em INTEGER NOT NULL
          )
        `,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
          },
        );

        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
}

async function migrarBancoDados(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.serialize(() => {
        db.all(`PRAGMA table_info(tickets);`, (err, columns) => {
          if (err) {
            db.close();
            return reject(err);
          }

          const existingColumns = columns.map((col) => col.name);
          const columnsToAdd = [
            { name: "message_id", type: "TEXT DEFAULT NULL" },
            { name: "motivo_abertura", type: "TEXT DEFAULT NULL" },
            { name: "nome_categoria", type: "TEXT DEFAULT NULL" },
          ];

          let added = 0;
          columnsToAdd.forEach((col) => {
            if (!existingColumns.includes(col.name)) {
              db.run(
                `ALTER TABLE tickets ADD COLUMN ${col.name} ${col.type}`,
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error(`Erro ao adicionar coluna ${col.name}:`, err);
                  } else if (!err) {
                    console.log(`✅ Coluna ${col.name} adicionada`);
                    added++;
                  }
                },
              );
            }
          });

          db.all(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='avaliacoes';`,
            (err, tables) => {
              if (err) {
                db.close();
                return reject(err);
              }

              if (tables.length === 0) {
                db.run(
                  `
                CREATE TABLE IF NOT EXISTS avaliacoes (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  ticket_id TEXT NOT NULL,
                  user_id TEXT NOT NULL,
                  estrelas INTEGER NOT NULL,
                  comentario TEXT,
                  avaliado_em INTEGER NOT NULL
                )
              `,
                  (err) => {
                    if (err) {
                      console.error("Erro ao criar tabela avaliacoes:", err);
                    } else {
                      console.log("✅ Tabela avaliacoes criada");
                    }
                    db.close();
                    resolve();
                  },
                );
              } else {
                db.close();
                resolve();
              }
            },
          );
        });
      });
    });
  });
}

async function criarEstruturaPadrao(guildId, isNewGuild = false) {
  if (
    !guildId ||
    guildId === "null" ||
    guildId === "undefined" ||
    guildId.length > 20 ||
    guildId.length < 17 ||
    !/^\d+$/.test(guildId)
  ) {
    console.error(`❌ GuildId inválido rejeitado: ${guildId}\n`);
    return { success: false, isNewGuild };
  }

  const basePath = path.join(PROJECT_ROOT, "banco/ticket", guildId);

  const configPath = path.join(basePath, "config.json");
  const personalizacaoPath = path.join(basePath, "personalizacao.json");
  const bancoPath = path.join(basePath, "banco");
  const dbPath = path.join(bancoPath, "tickets.db");

  if (
    fsSync.existsSync(configPath) &&
    fsSync.existsSync(personalizacaoPath) &&
    fsSync.existsSync(dbPath)
  ) {
    return { success: true, isNewGuild: false };
  }

  try {
    if (!fsSync.existsSync(basePath)) {
      await fs.mkdir(basePath, { recursive: true });
    }

    if (!fsSync.existsSync(bancoPath)) {
      await fs.mkdir(bancoPath, { recursive: true });
    }

    const semanalPath = path.join(bancoPath, "semanal");
    if (!fsSync.existsSync(semanalPath)) {
      await fs.mkdir(semanalPath, { recursive: true });
    }

    if (!fsSync.existsSync(dbPath)) {
      await criarBancoDados(dbPath);

      await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        db.run(
          `INSERT OR IGNORE INTO contadores (guild_id, abertos, assumidos, fechados) VALUES (?, 0, 0, 0)`,
          [guildId],
          (err) => {
            if (err) {
              console.error("Erro ao inserir contador inicial:", err);
              db.close();
              reject(err);
            } else {
              db.close();
              resolve();
            }
          },
        );
      });
    }

    if (!fsSync.existsSync(configPath)) {
      const configPadrao = {
        system: true,
        limit: 1,
        horario_ativo: false,
        schedule: {
          monday: { start: "10:00", end: "18:00" },
          tuesday: { start: "10:00", end: "18:00" },
          wednesday: { start: "10:00", end: "18:00" },
          thursday: { start: "10:00", end: "18:00" },
          friday: { start: "10:00", end: "18:00" },
          saturday: null,
          sunday: null,
        },
        team: [],
        usersperms: {},
        logs: {
          log_fechamento: { ativo: true, canal: "" },
          log_user: { ativo: true },
          log_avaliacao: { ativo: false, canal: "" },
        },
        transcript: { system: true, staff: true, user: true },
      };
      await fs.writeFile(configPath, JSON.stringify(configPadrao, null, 4));
    }

    if (!fsSync.existsSync(personalizacaoPath)) {
      const personalizacaoPadrao = {
        embedprincipal: {
          title: "Painel de Tickets",
          descricao: "Escolha uma opção para abrir seu ticket abaixo.",
          color: "#ffffff",
          botoes: [],
          selects: [],
        },
        embedticket: {
          title: "🎫 Suporte",
          descricao:
            "Explique sua solicitação abaixo e aguarde atendimento.\nStaff que assumiu: {staff}",
          color: "#ffffff",
          botoes: [
            {
              id: "sair_ticket",
              nome: "Sair do ticket",
              style: "Secondary",
              emoji: "<:arrowl:1404191458876985364>",
              cor: "Secondary",
            },
            {
              id: "painel_membro",
              nome: "Painel membro",
              style: "Secondary",
              emoji: "<:user:1404190157971656896>",
              cor: "Secondary",
            },
            {
              id: "painel_staff",
              nome: "Painel Staff",
              emoji: "<:education:1404190095359348766>",
              style: "Secondary",
            },
            {
              id: "assumir_ticket",
              nome: "Assumir Ticket",
              emoji: "<:check:1404161331317313537>",
              style: "Secondary",
            },
            {
              id: "fechar_ticket",
              nome: "Fechar Ticket",
              style: "Secondary",
              emoji: "<:lock:1404161355874828398>",
              cor: "Secondary",
            },
          ],
        },
        embedlogs: {
          title: "Registro de Logs",
          descricao:
            "O ticket {canal} foi fechado por {staff}.\nMotivo: {motivo}\nAutor: {user}",
          color: "#ffffff",
          fields: [
            { name: "Abertura", value: "{abertura}", inline: true },
            { name: "Fechamento", value: "{fechamento}", inline: true },
            { name: "Tempo total", value: "{horatotal}", inline: true },
          ],
          botoes: [
            {
              id: "ver_transcript",
              label: "Ver Transcript",
              emoji: "<:yaml:1404191568931455023>",
              nome: "Ver Transcript",
              style: "Link",
            },
          ],
        },
        embedlogsuser: {
          title: "Registro de Logs",
          descricao:
            "O ticket {canal} foi fechado por {staff}.\nMotivo: {motivo}\nAutor: {user}",
          color: "#ffffff",
          fields: [
            { name: "Abertura", value: "{abertura}", inline: true },
            { name: "Fechamento", value: "{fechamento}", inline: true },
            { name: "Tempo total", value: "{horatotal}", inline: true },
          ],
          botoes: [
            {
              id: "ver_transcript",
              label: "Ver Transcript",
              emoji: "<:yaml:1404191568931455023>",
              nome: "Ver Transcript",
              style: "Link",
            },
          ],
        },
        embednotificar: {
          title: "Ticket Respondido",
          descricao:
            "Olá {user}, você está sendo chamado neste ticket: {canal}.\nPor favor, verifique e responda assim que possível.",
          color: "#ffffff",
          botoes: [
            {
              id: "ir_ao_ticket",
              nome: "Ir ao Ticket",
              style: "Link",
              emoji: "<:Ticket:1403176727370268705>",
            },
          ],
        },
        embedavaliacao: {
          title: `${emojis.star} Avalie o Atendimento`,
          descricao: "Quantas estrelas você dá para o atendimento?",
          descricaoRecebida: `${emojis.check} **Obrigado pela sua avaliação!**\n\n{estrelas} **({avaliacao})**{comentario}\n\n${emojis.sparks} Seu feedback é muito importante para nós!`,
          color: "",
          banner: "",
        },
        embedlogavaliacao: {
          title: `${emojis.star} Nova Avaliação`,
          descricao:
            "**Usuário:** {user}\n**Ticket ID:** {ticket_id}\n**Avaliação:** {estrelas} **({avaliacao})**\n**Comentário:** {comentario}\n**Data:** {data}",
          color: "",
          banner: "",
        },
      };
      await fs.writeFile(
        personalizacaoPath,
        JSON.stringify(personalizacaoPadrao, null, 4),
      );
    }

    const iaConfigPath = path.join(basePath, "iaconfig.json");
    if (!fsSync.existsSync(iaConfigPath)) {
      const iaConfigPadrao = {
        sistema_ativo: false,
        parar_ao_assumir: true,
        parar_staff_responder: true,
        prompt_base:
          "Você é uma assistente de suporte em um servidor do Discord. Responda sempre em português brasileiro de forma educada, prestativa e profissional. Ajude os usuários com suas dúvidas e problemas de forma clara e direta.",
        prompts_adicionais: [],
      };
      await fs.writeFile(iaConfigPath, JSON.stringify(iaConfigPadrao, null, 4));
    }

    return { success: true, isNewGuild };
  } catch (error) {
    console.error(
      `[ERRO] Falha ao criar estrutura para guildId=${guildId}:`,
      error,
    );
    return { success: false, isNewGuild };
  }
}

async function verificarGuildsExistentes(client) {
  const guilds = Array.from(client.guilds.cache.values());
  const totalGuilds = guilds.length;

  if (totalGuilds === 0) return;

  console.log(`\n🔍 Verificando ${totalGuilds} guild(s)...\n`);

  const batchSize = 10;
  let configuradas = 0;
  let jaExistentes = 0;
  let erros = 0;

  for (let i = 0; i < guilds.length; i += batchSize) {
    const batch = guilds.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(async (guild) => {
        try {
          const basePath = path.join(PROJECT_ROOT, "banco/ticket", guild.id);
          const configPath = path.join(basePath, "config.json");
          const personalizacaoPath = path.join(basePath, "personalizacao.json");
          const bancoPath = path.join(basePath, "banco");
          const dbPath = path.join(bancoPath, "tickets.db");

          const needsSetup =
            !fsSync.existsSync(configPath) ||
            !fsSync.existsSync(personalizacaoPath) ||
            !fsSync.existsSync(dbPath);

          if (needsSetup) {
            const resultado = await criarEstruturaPadrao(guild.id, false);
            if (resultado.success) {
              configuradas++;
              return { status: "configured", guild };
            } else {
              erros++;
              return { status: "error", guild };
            }
          } else {
            jaExistentes++;
            return { status: "existing", guild };
          }
        } catch (error) {
          erros++;
          return { status: "error", guild, error };
        }
      }),
    );

    if (i + batchSize < guilds.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`✅ Verificação concluída:`);
  console.log(`   ├─ Já configuradas: ${jaExistentes}`);
  console.log(`   ├─ Configuradas agora: ${configuradas}`);
  if (erros > 0) {
    console.log(`   └─ Erros: ${erros}`);
  } else {
    console.log(`   └─ Erros: 0`);
  }
  console.log("");
}

module.exports = {
  criarEstruturaPadrao,
  verificarGuildsExistentes,
  migrarBancoDados,
  criarBancoDados,
};
