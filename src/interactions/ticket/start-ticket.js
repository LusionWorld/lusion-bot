const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();
const ticketRepo = require("../../utils/ticket/repository");

const PROJECT_ROOT = path.resolve(__dirname, "../../../");

/**
 * O schema real (tickets/contadores/avaliacoes) já vive no Postgres via
 * migration do Supabase — não há mais banco por guild pra criar. Isso só
 * grava um arquivo marcador local, porque `criarEstruturaPadrao` usa
 * `fsSync.existsSync(dbPath)` como sinal de "esta guild já foi configurada".
 */
async function criarBancoDados(dbPath) {
  await fs.writeFile(dbPath, "");
}

/** Sem uso real após a migração pro Supabase (schema já é gerenciado por migration). */
async function migrarBancoDados(_dbPath) {}

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

      try {
        await ticketRepo.ensureContadores(guildId);
      } catch (err) {
        console.error("Erro ao inserir contador inicial:", err);
      }
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
