const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  StringSelectMenuBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ComponentType,
  UserSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  RoleSelectMenuBuilder,
  MessageFlags,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MediaType,
  SeparatorBuilder,
  SeparatorSpacingSize,
} = require("discord.js");

const path = require("path");
const fs = require("fs");
const { JsonDatabase } = require("wio.db");
const { set } = require("date-fns");
const config = require("../../../config.json");
const Groq = require("groq-sdk");

const _configDataCache = new Map();
const _personalizacaoCache = new Map();
const _estacoesCache = new Map();
const _iaConfigCache = new Map();
const CONFIG_CACHE_TTL = 30000;

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

function limparEmojisProcessados(texto) {
  if (!texto) return "";
  return texto.replace(/<a?:([a-zA-Z0-9_]+):(\d+)>/g, ":$1:");
}

function getOnOffEmojiId(status) {
  return status ? getEmoji(emojis.on) : getEmoji(emojis.off);
}

function getPersonalizacaoDB(guildId) {
  if (_personalizacaoCache.has(guildId)) return _personalizacaoCache.get(guildId);

  const db = new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../banco/ticket/${guildId}/personalizacao.json`,
    ),
  });

  const embedsDefaults = {
    embedavaliacao: {
      title: `${emojis.star} Avalie o Atendimento`,
      descricao: "Quantas estrelas você dá para o atendimento?",
      descricaoRecebida: `${emojis.check} **Obrigado pela sua avaliação!**\n\n{estrelas} **({avaliacao})**{comentario}\n\n${emojis.sparks} Seu feedback é muito importante para nós!`,
      color: "",
    },
    embedlogavaliacao: {
      title: `${emojis.star} Nova Avaliação`,
      descricao:
        "**Usuário:** {user}\n**Ticket ID:** {ticket_id}\n**Avaliação:** {estrelas} **({avaliacao})**\n**Comentário:** {comentario}\n**Data:** {data}",
      color: "",
    },
    embedassumido: {
      title: "🎫 Seu Ticket foi Assumido",
      descricao:
        "Olá! O staff {staff} assumiu seu ticket.\n\nVocê será atendido em breve. Obrigado pela paciência!",
      color: "",
    },
  };

  Object.entries(embedsDefaults).forEach(([embedKey, defaultValue]) => {
    if (!db.get(embedKey)) {
      db.set(embedKey, defaultValue);
    }
  });

  _personalizacaoCache.set(guildId, db);
  return db;
}

function getConfigDB(guildId) {
  if (!guildId || guildId === "null" || guildId === "undefined") {
    throw new Error("GuildId inválido");
  }

  const filePath = path.resolve(
    __dirname,
    `../../../banco/ticket/${guildId}/config.json`,
  );

  function read() {
    const now = Date.now();
    const cached = _configDataCache.get(guildId);
    if (cached && now - cached.time < CONFIG_CACHE_TTL) return cached.data;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      _configDataCache.set(guildId, { data: JSON.parse(JSON.stringify(data)), time: now });
      return data;
    } catch {
      return {};
    }
  }

  function write(data) {
    _configDataCache.set(guildId, { data: JSON.parse(JSON.stringify(data)), time: Date.now() });
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf8");
    } catch (err) {
      console.error("[CONFIG DB] Detalhes:", err);
    }
  }

  return {
    get(key) {
      const data = read();
      return key
        .split(".")
        .reduce((obj, k) => (obj != null ? obj[k] : undefined), data);
    },
    set(key, value) {
      const data = read();
      const keys = key.split(".");
      let obj = data;
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] == null || typeof obj[keys[i]] !== "object")
          obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      write(data);
    },
    has(key) {
      return this.get(key) !== undefined;
    },
    delete(key) {
      const data = read();
      const keys = key.split(".");
      let obj = data;
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] == null) return;
        obj = obj[keys[i]];
      }
      delete obj[keys[keys.length - 1]];
      write(data);
    },
    all() {
      return read();
    },
  };
}

function getIAConfigDB(guildId) {
  if (!guildId || guildId === "null" || guildId === "undefined") {
    throw new Error("GuildId inválido");
  }
  if (_iaConfigCache.has(guildId)) return _iaConfigCache.get(guildId);
  const db = new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../banco/ticket/${guildId}/iaconfig.json`,
    ),
  });
  _iaConfigCache.set(guildId, db);
  return db;
}

function safeParseEstacoes(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

function getEstacoesDB(guildId) {
  if (_estacoesCache.has(guildId)) return _estacoesCache.get(guildId);

  const db = new JsonDatabase({
    databasePath: path.resolve(
      __dirname,
      `../../../banco/ticket/${guildId}/estacoes.json`,
    ),
  });

  if (!db.has("estacoes")) {
    db.set("estacoes", JSON.stringify([]));
  }

  _estacoesCache.set(guildId, db);
  return db;
}

function criarEstacao(guildId, nome) {
  const db = getEstacoesDB(guildId);
  const estacoes = safeParseEstacoes(db.get("estacoes"));

  const novaEstacao = {
    id: Date.now().toString(),
    nome: nome,
    team: [],
    usersperms: {},
    horario_ativo: false,
    schedule: {},
    mensagem_fora_horario: "Fora do horário de atendimento.",
    limite_tickets: 0,
    embedprincipal: {
      title: "",
      descricao: "",
      color: "",
      botoes: [],
      selects: [],
      banner: "",
      messageId: null,
      channelId: null,
    },
  };

  estacoes.push(novaEstacao);
  db.set("estacoes", JSON.stringify(estacoes));

  return novaEstacao;
}

function getEstacao(guildId, estacaoId) {
  const db = getEstacoesDB(guildId);
  const estacoes = safeParseEstacoes(db.get("estacoes"));
  return estacoes.find((e) => e.id === estacaoId);
}

function updateEstacao(guildId, estacaoId, dados) {
  const db = getEstacoesDB(guildId);
  const estacoes = safeParseEstacoes(db.get("estacoes"));
  const index = estacoes.findIndex((e) => e.id === estacaoId);

  if (index !== -1) {
    estacoes[index] = { ...estacoes[index], ...dados };
    db.set("estacoes", JSON.stringify(estacoes));
    return true;
  }
  return false;
}

function deleteEstacao(guildId, estacaoId) {
  const db = getEstacoesDB(guildId);
  const estacoes = safeParseEstacoes(db.get("estacoes"));
  const filtered = estacoes.filter((e) => e.id !== estacaoId);
  db.set("estacoes", JSON.stringify(filtered));
  return filtered.length < estacoes.length;
}

async function initIAConfig(guildId) {
  const db = getIAConfigDB(guildId);
  if (!db.has("sistema_ativo")) {
    db.set("sistema_ativo", false);
  }
  if (!db.has("parar_ao_assumir")) {
    db.set("parar_ao_assumir", true);
  }
  if (!db.has("parar_staff_responder")) {
    db.set("parar_staff_responder", true);
  }
  if (!db.has("prompt_base")) {
    db.set(
      "prompt_base",
      "Você é uma atendente virtual em um servidor do Discord. Responda sempre em português brasileiro de forma educada, prestativa e profissional. Ajude os usuários com suas dúvidas e problemas.",
    );
  }
  if (!db.has("prompts_adicionais")) {
    db.set("prompts_adicionais", []);
  }
  if (!db.has("mensagem_boas_vindas_ativo")) {
    db.set("mensagem_boas_vindas_ativo", false);
  }
  if (!db.has("mensagem_boas_vindas")) {
    db.set("mensagem_boas_vindas", " ");
  }
  if (!db.has("prompts_cargos")) {
    db.set("prompts_cargos", "[]");
  }
  if (!db.has("transferencia_inteligente")) {
    db.set("transferencia_inteligente", false);
  }
  if (!db.has("resumo_ao_assumir")) {
    db.set("resumo_ao_assumir", false);
  }
  if (!db.has("resposta_container")) {
    db.set("resposta_container", false);
  }
  if (!db.has("horario_ativo")) {
    db.set("horario_ativo", false);
  }
  if (!db.has("encerramento_automatico")) {
    db.set("encerramento_automatico", false);
  }
  if (!db.has("retomar_apos_inatividade")) {
    db.set("retomar_apos_inatividade", false);
  }
  if (!db.has("minutos_inatividade_staff")) {
    db.set("minutos_inatividade_staff", 15);
  }
}

function criarPaginacaoBotoes(botoes, paginaAtual, estacaoId = null) {
  const BOTOES_POR_PAGINA = 5;
  const totalPaginas = Math.ceil(botoes.length / BOTOES_POR_PAGINA);
  const inicio = paginaAtual * BOTOES_POR_PAGINA;
  const fim = inicio + BOTOES_POR_PAGINA;
  const botoesExibidos = botoes.slice(inicio, fim);

  const sections = botoesExibidos.map((botao) =>
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**${botao.nome || "Sem nome"}**\nCategoria: ${
            botao.categoria
              ? botao.categoria
                  .split(",")
                  .map((id) => `<#${id}>`)
                  .join(", ")
              : "Não definida"
          }\nEmoji: ${botao.emoji || "Não definido"}`,
        ),
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(
            estacaoId
              ? `editar_botao_estacao_select_${estacaoId}_${botao.id}`
              : `editar_botao_paginado_${botao.id}`,
          )
          .setLabel("Editar")
          .setEmoji(getEmoji(emojis.title))
          .setStyle(ButtonStyle.Secondary),
      ),
  );

  const btnAnterior = new ButtonBuilder()
    .setCustomId(
      estacaoId
        ? `botoes_estacao_pagina_${estacaoId}_${paginaAtual - 1}`
        : `botoes_pagina_${paginaAtual - 1}`,
    )
    .setLabel("◀ Anterior")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(paginaAtual === 0);

  const btnProximo = new ButtonBuilder()
    .setCustomId(
      estacaoId
        ? `botoes_estacao_pagina_${estacaoId}_${paginaAtual + 1}`
        : `botoes_pagina_${paginaAtual + 1}`,
    )
    .setLabel("Próximo ▶")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(paginaAtual >= totalPaginas - 1);

  return { sections, btnAnterior, btnProximo, totalPaginas };
}

function criarPainelConfiguracaoSelectEstacao(selectId, estacaoId, estacao) {
  const selects = estacao.embedprincipal.selects || [];
  const select = selects.find((s) => s.id === selectId) || {
    id: selectId,
    nome: "",
    categoria: "",
    emoji: null,
    inicio: "",
    descricao: "",
  };

  const btnNome = new ButtonBuilder()
    .setCustomId(`config_select_estacao_nome_${estacaoId}_${selectId}`)
    .setLabel("Nome")
    .setEmoji(getEmoji(emojis.title))
    .setStyle(ButtonStyle.Secondary);

  const btnDescricao = new ButtonBuilder()
    .setCustomId(`config_select_estacao_descricao_${estacaoId}_${selectId}`)
    .setLabel("Descrição")
    .setEmoji(getEmoji(emojis.embeds))
    .setStyle(ButtonStyle.Secondary);

  const btnCategoria = new ButtonBuilder()
    .setCustomId(`config_select_estacao_categoria_${estacaoId}_${selectId}`)
    .setLabel("Categoria")
    .setEmoji(getEmoji(emojis.folder))
    .setStyle(ButtonStyle.Secondary);

  const btnEmoji = new ButtonBuilder()
    .setCustomId(`config_select_estacao_emoji_${estacaoId}_${selectId}`)
    .setLabel("Emoji")
    .setEmoji(getEmoji(emojis.boost1))
    .setStyle(ButtonStyle.Secondary);

  const btnInicio = new ButtonBuilder()
    .setCustomId(`config_select_estacao_inicio_${estacaoId}_${selectId}`)
    .setLabel("Tag Inicial")
    .setEmoji(getEmoji(emojis.home))
    .setStyle(ButtonStyle.Secondary);

  const btnSalvar = new ButtonBuilder()
    .setCustomId(`config_select_estacao_salvar_${estacaoId}_${selectId}`)
    .setLabel("Salvar Opção")
    .setEmoji(getEmoji(emojis.check))
    .setStyle(ButtonStyle.Success);

  const btnVoltar = new ButtonBuilder()
    .setCustomId(`cancelar_config_select_estacao_${estacaoId}_${selectId}`)
    .setLabel("Cancelar")
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const components = [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Configuração de Select Menu"),
        new TextDisplayBuilder().setContent(
          "Configure todas as propriedades da opção abaixo.",
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Nome**\n${select.nome || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnNome),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Descrição**\n${select.descricao || "Não definida"}`,
            ),
          )
          .setButtonAccessory(btnDescricao),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Categoria**\n${
                select.categoria
                  ? select.categoria
                      .split(",")
                      .map((id) => `<#${id}>`)
                      .join(", ")
                  : "Não definida"
              }`,
            ),
          )
          .setButtonAccessory(btnCategoria),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Emoji**\n${select.emoji || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnEmoji),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Tag Inicial**\n${select.inicio || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnInicio),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(btnSalvar, btnVoltar),
      ),
  ];

  return components;
}

function criarPainelConfiguracaoBotaoEstacao(botaoId, estacaoId, estacao) {
  const botoes = estacao.embedprincipal.botoes || [];
  const botao = botoes.find((b) => b.id === botaoId) || {
    id: botaoId,
    nome: "",
    categoria: "",
    emoji: null,
    inicio: "",
    cor: "Primary",
  };

  const btnNome = new ButtonBuilder()
    .setCustomId(`config_botao_estacao_nome_${estacaoId}_${botaoId}`)
    .setLabel("Nome")
    .setEmoji(getEmoji(emojis.title))
    .setStyle(ButtonStyle.Secondary);

  const btnCategoria = new ButtonBuilder()
    .setCustomId(`config_botao_estacao_categoria_${estacaoId}_${botaoId}`)
    .setLabel("Categoria")
    .setEmoji(getEmoji(emojis.folder))
    .setStyle(ButtonStyle.Secondary);

  const btnEmoji = new ButtonBuilder()
    .setCustomId(`config_botao_estacao_emoji_${estacaoId}_${botaoId}`)
    .setLabel("Emoji")
    .setEmoji(getEmoji(emojis.boost1))
    .setStyle(ButtonStyle.Secondary);

  const btnInicio = new ButtonBuilder()
    .setCustomId(`config_botao_estacao_inicio_${estacaoId}_${botaoId}`)
    .setLabel("Tag Inicial")
    .setEmoji(getEmoji(emojis.home))
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder().addComponents(
    btnNome,
    btnCategoria,
    btnEmoji,
    btnInicio,
  );

  const cores = [
    { nome: "Azul", valor: "Primary", style: ButtonStyle.Primary },
    { nome: "Cinza", valor: "Secondary", style: ButtonStyle.Secondary },
    { nome: "Verde", valor: "Success", style: ButtonStyle.Success },
    { nome: "Vermelho", valor: "Danger", style: ButtonStyle.Danger },
  ];

  const btnsCor = cores.map((c) =>
    new ButtonBuilder()
      .setCustomId(
        `config_botao_estacao_cor_${estacaoId}_${botaoId}_${c.valor}`,
      )
      .setLabel(c.nome)
      .setStyle(c.valor === botao.cor ? c.style : ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(...btnsCor);

  const btnSalvar = new ButtonBuilder()
    .setCustomId(`config_botao_estacao_salvar_${estacaoId}_${botaoId}`)
    .setLabel("Salvar Botão")
    .setEmoji(getEmoji(emojis.check))
    .setStyle(ButtonStyle.Success);

  const btnVoltar = new ButtonBuilder()
    .setCustomId(`cancelar_config_botao_estacao_${estacaoId}_${botaoId}`)
    .setLabel("Cancelar")
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const row3 = new ActionRowBuilder().addComponents(btnSalvar, btnVoltar);

  const components = [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Configuração de Botão"),
        new TextDisplayBuilder().setContent(
          "Configure todas as propriedades do botão abaixo.",
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Nome**\n${botao.nome || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnNome),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Categoria**\n${
                botao.categoria
                  ? botao.categoria
                      .split(",")
                      .map((id) => `<#${id}>`)
                      .join(", ")
                  : "Não definida"
              }`,
            ),
          )
          .setButtonAccessory(btnCategoria),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Emoji**\n${botao.emoji || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnEmoji),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Tag Inicial**\n${botao.inicio || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnInicio),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**Cor do Botão**"),
      )
      .addActionRowComponents(row2)
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addActionRowComponents(row3),
  ];

  return components;
}

function criarPainelEscolhaEmoji(interaction, tipo, itemId, paginaAtual = 0) {
  const emojisServidor = Array.from(interaction.guild.emojis.cache.values());
  const EMOJIS_POR_PAGINA = 20;
  const totalPaginas = Math.ceil(emojisServidor.length / EMOJIS_POR_PAGINA);

  const inicio = paginaAtual * EMOJIS_POR_PAGINA;
  const fim = inicio + EMOJIS_POR_PAGINA;
  const emojisExibidos = emojisServidor.slice(inicio, fim);

  const components = [
    new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Escolha um Emoji"),
      new TextDisplayBuilder().setContent(
        `Página ${paginaAtual + 1} de ${
          totalPaginas || 1
        }\n\nSelecione um emoji abaixo ou insira manualmente.`,
      ),
    ),
  ];

  const emojiOptions = emojisExibidos.map((emoji, idx) => ({
    label: `${idx + 1}. ${emoji.name}`,
    value: emoji.id,
    emoji: { id: emoji.id, name: emoji.name, animated: emoji.animated },
    description: `:${emoji.name}:`,
  }));

  if (emojiOptions.length > 0) {
    const selectEmoji = new StringSelectMenuBuilder()
      .setCustomId(`emoji_escolher_${tipo}_${itemId}`)
      .setPlaceholder("Escolha um emoji da lista")
      .addOptions(emojiOptions);

    components[0].addActionRowComponents(
      new ActionRowBuilder().addComponents(selectEmoji),
    );
  }

  const btnManual = new ButtonBuilder()
    .setCustomId(`emoji_manual_${tipo}_${itemId}`)
    .setLabel("Inserir Manualmente")
    .setEmoji(getEmoji(emojis.title))
    .setStyle(ButtonStyle.Primary);

  const btnAnterior = new ButtonBuilder()
    .setCustomId(`emoji_pagina_${tipo}_${itemId}_${paginaAtual - 1}`)
    .setLabel("Anterior")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(paginaAtual === 0);

  const btnProximo = new ButtonBuilder()
    .setCustomId(`emoji_pagina_${tipo}_${itemId}_${paginaAtual + 1}`)
    .setLabel("Próximo")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(paginaAtual >= totalPaginas - 1);

  const btnVoltar = new ButtonBuilder()
    .setCustomId(`emoji_voltar_${tipo}_${itemId}`)
    .setLabel("Voltar")
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  components[0].addActionRowComponents(
    new ActionRowBuilder().addComponents(
      btnManual,
      btnAnterior,
      btnProximo,
      btnVoltar,
    ),
  );

  return components;
}

function criarPainelConfiguracaoBotao(botaoId, db) {
  const botoes = db.get("embedprincipal.botoes") || [];
  const botao = botoes.find((b) => b.id === botaoId) || {
    id: botaoId,
    nome: "",
    categoria: "",
    emoji: null,
    inicio: "",
    cor: "Primary",
  };

  const btnNome = new ButtonBuilder()
    .setCustomId(`config_botao_nome_${botaoId}`)
    .setLabel("Nome")
    .setEmoji(getEmoji(emojis.title))
    .setStyle(ButtonStyle.Secondary);

  const btnCategoria = new ButtonBuilder()
    .setCustomId(`config_botao_categoria_${botaoId}`)
    .setLabel("Categoria")
    .setEmoji(getEmoji(emojis.folder))
    .setStyle(ButtonStyle.Secondary);

  const btnEmoji = new ButtonBuilder()
    .setCustomId(`config_botao_emoji_${botaoId}`)
    .setLabel("Emoji")
    .setEmoji(getEmoji(emojis.boost1))
    .setStyle(ButtonStyle.Secondary);

  const btnInicio = new ButtonBuilder()
    .setCustomId(`config_botao_inicio_${botaoId}`)
    .setLabel("Tag Inicial")
    .setEmoji(getEmoji(emojis.home))
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder().addComponents(
    btnNome,
    btnCategoria,
    btnEmoji,
    btnInicio,
  );

  const cores = [
    { nome: "Azul", valor: "Primary", style: ButtonStyle.Primary },
    { nome: "Cinza", valor: "Secondary", style: ButtonStyle.Secondary },
    { nome: "Verde", valor: "Success", style: ButtonStyle.Success },
    { nome: "Vermelho", valor: "Danger", style: ButtonStyle.Danger },
  ];

  const btnsCor = cores.map((c) =>
    new ButtonBuilder()
      .setCustomId(`config_botao_cor_${botaoId}_${c.valor}`)
      .setLabel(c.nome)
      .setStyle(c.valor === botao.cor ? c.style : ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(...btnsCor);

  const btnSalvar = new ButtonBuilder()
    .setCustomId(`config_botao_salvar_${botaoId}`)
    .setLabel("Salvar Botão")
    .setEmoji(getEmoji(emojis.check))
    .setStyle(ButtonStyle.Success);

  const btnVoltar = new ButtonBuilder()
    .setCustomId(`cancelar_config_botao_${botaoId}`)
    .setLabel("Cancelar")
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const row3 = new ActionRowBuilder().addComponents(btnSalvar, btnVoltar);

  const components = [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Configuração de Botão"),
        new TextDisplayBuilder().setContent(
          "Configure todas as propriedades do botão abaixo.",
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Nome**\n${botao.nome || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnNome),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Categoria**\n${
                botao.categoria
                  ? botao.categoria
                      .split(",")
                      .map((id) => `<#${id}>`)
                      .join(", ")
                  : "Não definida"
              }`,
            ),
          )
          .setButtonAccessory(btnCategoria),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Emoji**\n${botao.emoji || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnEmoji),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Tag Inicial**\n${botao.inicio || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnInicio),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**Cor do Botão**"),
      )
      .addActionRowComponents(row2)
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addActionRowComponents(row3),
  ];

  return components;
}

function criarPainelConfiguracaoSelect(selectId, db) {
  const selects = db.get("embedprincipal.selects") || [];
  const select = selects.find((s) => s.id === selectId) || {
    id: selectId,
    nome: "",
    categoria: "",
    emoji: null,
    inicio: "",
    descricao: "",
  };

  const btnNome = new ButtonBuilder()
    .setCustomId(`config_select_nome_${selectId}`)
    .setLabel("Nome")
    .setEmoji(getEmoji(emojis.title))
    .setStyle(ButtonStyle.Secondary);

  const btnDescricao = new ButtonBuilder()
    .setCustomId(`config_select_descricao_${selectId}`)
    .setLabel("Descrição")
    .setEmoji(getEmoji(emojis.embeds))
    .setStyle(ButtonStyle.Secondary);

  const btnCategoria = new ButtonBuilder()
    .setCustomId(`config_select_categoria_${selectId}`)
    .setLabel("Categoria")
    .setEmoji(getEmoji(emojis.folder))
    .setStyle(ButtonStyle.Secondary);

  const btnEmoji = new ButtonBuilder()
    .setCustomId(`config_select_emoji_${selectId}`)
    .setLabel("Emoji")
    .setEmoji(getEmoji(emojis.boost1))
    .setStyle(ButtonStyle.Secondary);

  const btnInicio = new ButtonBuilder()
    .setCustomId(`config_select_inicio_${selectId}`)
    .setLabel("Tag Inicial")
    .setEmoji(getEmoji(emojis.home))
    .setStyle(ButtonStyle.Secondary);

  const btnSalvar = new ButtonBuilder()
    .setCustomId(`config_select_salvar_${selectId}`)
    .setLabel("Salvar Opção")
    .setEmoji(getEmoji(emojis.check))
    .setStyle(ButtonStyle.Success);

  const btnVoltar = new ButtonBuilder()
    .setCustomId(`cancelar_config_select_${selectId}`)
    .setLabel("Cancelar")
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const components = [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Configuração de Select Menu"),
        new TextDisplayBuilder().setContent(
          "Configure todas as propriedades da opção abaixo.",
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Nome**\n${select.nome || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnNome),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Descrição**\n${select.descricao || "Não definida"}`,
            ),
          )
          .setButtonAccessory(btnDescricao),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Categoria**\n${
                select.categoria
                  ? select.categoria
                      .split(",")
                      .map((id) => `<#${id}>`)
                      .join(", ")
                  : "Não definida"
              }`,
            ),
          )
          .setButtonAccessory(btnCategoria),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Emoji**\n${select.emoji || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnEmoji),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Tag Inicial**\n${select.inicio || "Não definido"}`,
            ),
          )
          .setButtonAccessory(btnInicio),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(btnSalvar, btnVoltar),
      ),
  ];

  return components;
}

async function safeUpdate(interaction, data) {
  try {
    if (interaction.replied || interaction.deferred) return;
    await interaction.update(data);
  } catch (err) {
    if (err.code === 10062) return;
    throw err;
  }
}

async function safeReply(interaction, data) {
  try {
    if (interaction.replied || interaction.deferred) return;
    await interaction.reply(data);
  } catch (err) {
    if (err.code === 10062) return;
    throw err;
  }
}

function parseEmojisInText(text, guild) {
  if (!text) return text;
  return text.replace(/:([a-zA-Z0-9_]+):/g, (match, name) => {
    const found = guild.emojis.cache.find((e) => e.name === name);
    if (found) return `<${found.animated ? "a" : ""}:${found.name}:${found.id}>`;
    return match;
  });
}

module.exports = {
  getEmoji,
  limparEmojisProcessados,
  getOnOffEmojiId,
  getPersonalizacaoDB,
  getConfigDB,
  getIAConfigDB,
  getEstacoesDB,
  criarEstacao,
  getEstacao,
  updateEstacao,
  deleteEstacao,
  initIAConfig,
  criarPaginacaoBotoes,
  criarPainelConfiguracaoSelectEstacao,
  criarPainelConfiguracaoBotaoEstacao,
  criarPainelEscolhaEmoji,
  criarPainelConfiguracaoBotao,
  criarPainelConfiguracaoSelect,
  safeUpdate,
  safeReply,
  parseEmojisInText,
};