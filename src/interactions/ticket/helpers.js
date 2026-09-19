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

const { set } = require("date-fns");
const config = require("../../../config.json");
const Groq = require("groq-sdk");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return undefined;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return undefined;
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

const estacoesRepo = require("../../utils/ticket/estacoesRepository");
const { safeParseEstacoes, ensureEstacoesLoaded, getEstacoesDB, criarEstacao, getEstacao, updateEstacao, deleteEstacao } = estacoesRepo;

const configRepo = require("../../utils/ticket/configRepository");
const { ensureTicketConfigLoaded, getConfigDB, getPersonalizacaoDB, getIAConfigDB } = configRepo;

// initIAConfig é um no-op agora: getIAConfigDB() já aplica os defaults na
// primeira leitura (via configRepository.js), mantido só por compatibilidade
// com chamadas antigas.
async function initIAConfig(_guildId) {}

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
  ensureTicketConfigLoaded,
  getEstacoesDB,
  ensureEstacoesLoaded,
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