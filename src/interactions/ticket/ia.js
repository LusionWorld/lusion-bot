const {
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
const { JsonDatabase } = require("wio.db");

const {
  getEmoji,
  getConfigDB,
  getPersonalizacaoDB,
  getIAConfigDB,
  getEstacoesDB,
  getEstacao,
  updateEstacao,
  deleteEstacao,
  criarEstacao,
  initIAConfig,
  criarPaginacaoBotoes,
  criarPainelConfiguracaoBotao,
  criarPainelConfiguracaoSelect,
  criarPainelConfiguracaoBotaoEstacao,
  criarPainelConfiguracaoSelectEstacao,
  criarPainelEscolhaEmoji,
  limparEmojisProcessados,
} = require("./helpers");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const Groq = require("groq-sdk");

let iaKeyIndex = 0;

function getGroqClient() {
  const config = require("../../../config.json");
  const keys = [
    config["key-ia"],
    config["key-ia2"],
    config["key-ia3"],
    config["key-ia4"],
    config["key-ia5"],
  ].filter(Boolean);
  const key = keys[iaKeyIndex % keys.length];
  return { groq: new Groq({ apiKey: key }), keys };
}

async function groqCreate(params) {
  const config = require("../../../config.json");
  const keys = [
    config["key-ia"],
    config["key-ia2"],
    config["key-ia3"],
    config["key-ia4"],
    config["key-ia5"],
  ].filter(Boolean);
  for (let tentativa = 0; tentativa < keys.length; tentativa++) {
    try {
      const keyIndex = (iaKeyIndex + tentativa) % keys.length;
      const groq = new Groq({ apiKey: keys[keyIndex] });
      const result = await groq.chat.completions.create(params);
      iaKeyIndex = keyIndex;
      return result;
    } catch (erro) {
      if (erro.status === 429 && tentativa < keys.length - 1) {
        iaKeyIndex = (iaKeyIndex + tentativa + 1) % keys.length;
        continue;
      }
      throw erro;
    }
  }
}

function safeEmoji(raw) {
  if (!raw) return { name: "🔹", id: undefined };
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return { name: "🔹", id: undefined };
  return { name: match[1], id: match[2] };
}

function safeEmojiStr(raw) {
  if (!raw) return "";
  const match = raw.match(/^<(a?:[^:]+:\d+)>$/);
  return match ? `<${match[1]}>` : raw || "";
}

function buildIAPainelPage1(iaDB) {
  const promptBase = iaDB.get("prompt_base") || "";
  const prompts = (() => {
    try {
      const v = iaDB.get("prompts_adicionais");
      return Array.isArray(v) ? v : JSON.parse(v || "[]");
    } catch {
      return [];
    }
  })();
  const promptsCargos = (() => {
    try {
      const v = iaDB.get("prompts_cargos");
      return Array.isArray(v) ? v : JSON.parse(v || "[]");
    } catch {
      return [];
    }
  })();
  const sistemaAtivo = iaDB.get("sistema_ativo") ?? false;
  const msgsRespondidas = iaDB.get("stats_msgs_respondidas") || 0;
  const ticketsEncerrados = iaDB.get("stats_tickets_encerrados_ia") || 0;
  const cargosAtribuidos = iaDB.get("stats_cargos_atribuidos") || 0;
  const e = emojis;

  const promptPreview =
    promptBase.length > 70
      ? promptBase.substring(0, 70) + "..."
      : promptBase || "_não configurado_";

  const statusIA = sistemaAtivo
    ? safeEmojiStr(e.success) + " Sistema **ativo**"
    : safeEmojiStr(e.danger) + " Sistema **inativo**";

  const resumo = [
    statusIA,
    safeEmojiStr(e.cardbox) +
      " " +
      (Array.isArray(prompts) ? prompts.length : 0) +
      " prompt(s) adicional(is)  " +
      safeEmojiStr(e.role) +
      " " +
      promptsCargos.length +
      " regra(s) de cargo",
  ].join("\n");

  const voltarPage2 = new ButtonBuilder()
    .setCustomId("ia_painel_page_2")
    .setLabel("Comportamento")
    .setEmoji(safeEmoji(e.arrowr))
    .setStyle(ButtonStyle.Secondary);

  const voltarBtn = new ButtonBuilder()
    .setCustomId("configurar_ticket")
    .setLabel("Voltar")
    .setEmoji(safeEmoji(e.home))
    .setStyle(ButtonStyle.Secondary);

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "# " +
            safeEmojiStr(e.sparks) +
            " Configuração da IA\n" +
            resumo +
            "\n-# Página 1/2",
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ia_ver_estatisticas")
            .setLabel(msgsRespondidas + " respondidas")
            .setEmoji(safeEmoji(e.send))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("ia_ver_estatisticas_2")
            .setLabel(ticketsEncerrados + " encerrados")
            .setEmoji(safeEmoji(e.check))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("ia_ver_estatisticas_3")
            .setLabel(cargosAtribuidos + " cargos")
            .setEmoji(safeEmoji(e.role))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          safeEmojiStr(e.title) +
            " **Prompt Base:** " +
            promptPreview +
            "\n" +
            safeEmojiStr(e.cardbox) +
            " **Prompts Adicionais:** " +
            (Array.isArray(prompts) ? prompts.length : 0) +
            " cadastrado(s)\n" +
            safeEmojiStr(e.role) +
            " **Prompts de Cargo:** " +
            promptsCargos.length +
            " regra(s)",
        ),
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ia_editar_prompt_base")
            .setLabel("Editar Prompt Base")
            .setEmoji(safeEmoji(e.title))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("ia_gerenciar_prompts")
            .setLabel("Gerenciar Prompts")
            .setEmoji(safeEmoji(e.cardbox))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("ia_gerenciar_prompts_cargos")
            .setLabel("Prompts de Cargo")
            .setEmoji(safeEmoji(e.role))
            .setStyle(ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents(voltarPage2, voltarBtn),
      ),
  ];
}
function buildIAPainelPage2(iaDB) {
  const sistemaAtivo = iaDB.get("sistema_ativo");
  const pararAoAssumir = iaDB.get("parar_ao_assumir");
  const pararStaffResp = iaDB.get("parar_staff_responder");
  const horarioIA = iaDB.get("horario_ativo") ?? false;
  const encerramentoIA = iaDB.get("encerramento_automatico") ?? false;
  const retomarIA = iaDB.get("retomar_apos_inatividade") ?? false;
  const minutosRetomar = iaDB.get("minutos_inatividade_staff") ?? 15;
  const resumoAoAssumir = iaDB.get("resumo_ao_assumir") ?? false;
  const respostaContainer = iaDB.get("resposta_container") ?? false;
  const e = emojis;

  const mkBtn = (id, label, val) =>
    new ButtonBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setEmoji(safeEmoji(val ? e.on : e.off))
      .setStyle(val ? ButtonStyle.Success : ButtonStyle.Secondary);

  const voltarPage1 = new ButtonBuilder()
    .setCustomId("ia_painel_page_1")
    .setLabel("Página Anterior")
    .setEmoji(safeEmoji(e.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const voltarBtn = new ButtonBuilder()
    .setCustomId("configurar_ticket")
    .setLabel("Voltar ao Menu")
    .setEmoji(safeEmoji(e.home))
    .setStyle(ButtonStyle.Secondary);

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${safeEmojiStr(e.settings)} Configuração da IA\n**Página 2/2 — Comportamento**`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${safeEmojiStr(e.sparks)} Sistema de IA**\n${sistemaAtivo ? "```diff\n+ Ativado```" : "```diff\n- Desativado```"}`,
            ),
          )
          .setButtonAccessory(
            mkBtn("toggle_ia_sistema", "Sistema IA", sistemaAtivo),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${safeEmojiStr(e.block)} Parar ao Assumir Ticket**\n${pararAoAssumir ? "```diff\n+ Ativado```" : "```diff\n- Desativado```"}`,
            ),
          )
          .setButtonAccessory(
            mkBtn("toggle_ia_assumir", "Parar ao Assumir", pararAoAssumir),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${safeEmojiStr(e.block)} Parar quando Staff Responder**\n${pararStaffResp ? "```diff\n+ Ativado```" : "```diff\n- Desativado```"}`,
            ),
          )
          .setButtonAccessory(
            mkBtn("toggle_ia_staff", "Parar quando Staff", pararStaffResp),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${safeEmojiStr(e.calendario)} Horário de Atendimento**\n${horarioIA ? "```diff\n+ Ativado```" : "```diff\n- Desativado```"}`,
            ),
          )
          .setButtonAccessory(
            mkBtn("toggle_ia_horario", "Horário da IA", horarioIA),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${safeEmojiStr(e.lock)} Encerramento Automático**\n${encerramentoIA ? "```diff\n+ Ativado```" : "```diff\n- Desativado```"}`,
            ),
          )
          .setButtonAccessory(
            mkBtn(
              "toggle_ia_encerramento",
              "Encerramento Auto",
              encerramentoIA,
            ),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${safeEmojiStr(e.refresh)} Retomar após Inatividade (${minutosRetomar}min)**\n${retomarIA ? "```diff\n+ Ativado```" : "```diff\n- Desativado```"}`,
            ),
          )
          .setButtonAccessory(
            mkBtn("toggle_ia_retomar", "Retomar Inatividade", retomarIA),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${safeEmojiStr(e.clipboard)} Resumo ao Assumir**\n${resumoAoAssumir ? "```diff\n+ Ativado```" : "```diff\n- Desativado```"}`,
            ),
          )
          .setButtonAccessory(
            mkBtn(
              "toggle_ia_resumo_assumir",
              "Resumo ao Assumir",
              resumoAoAssumir,
            ),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${safeEmojiStr(e.layers)} Resposta em Container**\nIA responde em bloco visual (Components V2).\n${respostaContainer ? "```diff\n+ Ativado```" : "```diff\n- Desativado```"}`,
            ),
          )
          .setButtonAccessory(
            mkBtn(
              "toggle_ia_container",
              "Resposta Container",
              respostaContainer,
            ),
          ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ia_config_minutos_retomar")
            .setLabel(`Minutos (${minutosRetomar}min)`)
            .setEmoji(safeEmoji(e.clock))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("ia_config_horario")
            .setLabel("Editar Horários")
            .setEmoji(safeEmoji(e.calendario))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("ia_config_encerramento")
            .setLabel("Palavras de Encerramento")
            .setEmoji(safeEmoji(e.title))
            .setStyle(ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents(voltarPage1, voltarBtn),
      ),
  ];
}

function buildIAPainelComponents(iaDB) {
  return buildIAPainelPage1(iaDB);
}

function buildGerenciarPromptsPanel(prompts, e) {
  const adicionarBtn = new ButtonBuilder()
    .setCustomId("ia_adicionar_prompt")
    .setLabel("Adicionar")
    .setEmoji(safeEmoji(e.plus))
    .setStyle(ButtonStyle.Success);
  const listarBtn = new ButtonBuilder()
    .setCustomId("ia_listar_prompts_page_0")
    .setLabel("Ver Prompts")
    .setEmoji(safeEmoji(e.cardbox))
    .setStyle(ButtonStyle.Primary)
    .setDisabled(prompts.length === 0);
  const voltarBtn = new ButtonBuilder()
    .setCustomId("ia_ticket")
    .setLabel("Voltar")
    .setEmoji(safeEmoji(e.arrowl))
    .setStyle(ButtonStyle.Secondary);

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "# " + safeEmojiStr(e.cardbox) + " Gerenciar Prompts Adicionais",
        ),
        new TextDisplayBuilder().setContent(
          safeEmojiStr(e.info) +
            " Os prompts adicionais complementam o prompt base com informações específicas do seu servidor.",
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**" +
                safeEmojiStr(e.layers) +
                " Total de Prompts Cadastrados**\n" +
                safeEmojiStr(e.cardbox) +
                " " +
                prompts.length +
                " prompt" +
                (prompts.length !== 1 ? "s" : "") +
                " adiciona" +
                (prompts.length !== 1 ? "dos" : "do") +
                " ao sistema",
            ),
          )
          .setButtonAccessory(listarBtn),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**" +
                safeEmojiStr(e.plus) +
                " Adicionar Novo Prompt**\n" +
                safeEmojiStr(e.lapis) +
                " Crie instruções personalizadas para a IA",
            ),
          )
          .setButtonAccessory(adicionarBtn),
      )
      .addActionRowComponents(new ActionRowBuilder().addComponents(voltarBtn)),
  ];
}

function buildPromptDetailPanel(prompts, pageIndex, e) {
  const totalPages = prompts.length;
  const prompt = prompts[pageIndex];

  const editarBtn = new ButtonBuilder()
    .setCustomId(`ia_editar_prompt_index_${pageIndex}`)
    .setLabel("Editar")
    .setEmoji(safeEmoji(e.lapis))
    .setStyle(ButtonStyle.Primary);
  const removerBtn = new ButtonBuilder()
    .setCustomId(`ia_remover_prompt_index_${pageIndex}`)
    .setLabel("Remover")
    .setEmoji(safeEmoji(e.lixeira))
    .setStyle(ButtonStyle.Danger);
  const anteriorBtn = new ButtonBuilder()
    .setCustomId(`ia_listar_prompts_page_${pageIndex - 1}`)
    .setLabel("Anterior")
    .setEmoji(safeEmoji(e.arrowl))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(pageIndex === 0);
  const buscarBtn = new ButtonBuilder()
    .setCustomId("ia_buscar_prompt")
    .setLabel("Buscar")
    .setEmoji(safeEmoji(e.lupa))
    .setStyle(ButtonStyle.Secondary);
  const proximoBtn = new ButtonBuilder()
    .setCustomId(`ia_listar_prompts_page_${pageIndex + 1}`)
    .setLabel("Próximo")
    .setEmoji(safeEmoji(e.arrowr))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(pageIndex >= totalPages - 1);
  const voltarBtn = new ButtonBuilder()
    .setCustomId("ia_gerenciar_prompts")
    .setLabel("Voltar")
    .setEmoji(safeEmoji(e.arrowl))
    .setStyle(ButtonStyle.Secondary);

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "# " +
            safeEmojiStr(e.cardbox) +
            " Prompt " +
            (pageIndex + 1) +
            " de " +
            totalPages,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          safeEmojiStr(e.title) + " " + prompt,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(editarBtn, removerBtn),
        new ActionRowBuilder().addComponents(
          anteriorBtn,
          buscarBtn,
          proximoBtn,
        ),
        new ActionRowBuilder().addComponents(voltarBtn),
      ),
  ];
}

module.exports = {
  customIds: [
    "ia_ticket",
    "toggle_ia_sistema",
    "toggle_ia_assumir",
    "toggle_ia_staff",
    "toggle_ia_horario",
    "toggle_ia_encerramento",
    "toggle_ia_retomar",
    "ia_config_horario",
    "modal_ia_horario",
    "ia_config_msg_fora",
    "modal_ia_msg_fora_horario",
    "ia_config_encerramento",
    "modal_ia_palavras_encerramento",
    "ia_config_minutos_retomar",
    "modal_ia_minutos_retomar",
    "ia_editar_prompt_base",
    "ia_gerenciar_prompts",
    "ia_listar_prompts_page_",
    "ia_buscar_prompt",
    "ia_editar_prompt_index_",
    "ia_remover_prompt_index_",
    "ia_adicionar_prompt",
    "ia_setup_inicial",
    "ia_setup_continuar",
    "ia_edit_titulo_principal",
    "ia_edit_desc_principal",
    "ia_edit_titulo_ticket",
    "ia_edit_desc_ticket",
    "ia_setup_aplicar",
    "ia_setup_cancelar",
    "modal_ia_prompt_base",
    "modal_ia_adicionar_prompt",
    "modal_ia_editar_prompt_",
    "modal_ia_buscar_prompt",
    "modal_ia_setup_step1",
    "ia_setup_estilo_",
    "ia_setup_quantidade_botoes",
    "modal_config_select_descricao_",
    "modal_ia_edit_titulo_principal",
    "modal_ia_edit_desc_principal",
    "modal_ia_edit_titulo_ticket",
    "modal_ia_edit_desc_ticket",
    "ia_setup_tipo_painel",
    "ia_setup_selecionar_categoria",
    "toggle_ia_resumo_assumir",
    "toggle_ia_container",
    "ia_setup_selecionar_equipe",
    "ia_painel_page_1",
    "ia_painel_page_2",
    "toggle_ia_boas_vindas",
    "ia_editar_boas_vindas",
    "modal_ia_boas_vindas",
    "ia_gerenciar_prompts_cargos",
    "ia_adicionar_prompt_cargo",
    "modal_ia_adicionar_prompt_cargo",
    "ia_listar_prompts_cargos_page_",
    "ia_cargos_page_",
    "ia_remover_prompt_cargo_",
    "ia_ver_estatisticas",
    "ia_ver_estatisticas_2",
    "ia_ver_estatisticas_3",
  ],
  async execute(client, interaction) {
    const { customId } = interaction;

    const belongsToThis = module.exports.customIds.some(
      (id) => customId && (customId === id || customId.startsWith(id)),
    );
    if (!belongsToThis) return;

    if (!interaction._fromPainel) return;

    if (customId === "ia_ticket" || customId === "ia_painel_page_1") {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      return interaction.update({
        components: buildIAPainelPage1(iaDB),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "ia_painel_page_2") {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      return interaction.update({
        components: buildIAPainelPage2(iaDB),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      (interaction.customId === "toggle_ia_sistema" ||
        interaction.customId === "toggle_ia_assumir" ||
        interaction.customId === "toggle_ia_staff" ||
        interaction.customId === "toggle_ia_horario" ||
        interaction.customId === "toggle_ia_encerramento" ||
        interaction.customId === "toggle_ia_retomar" ||
        interaction.customId === "toggle_ia_resumo_assumir" ||
        interaction.customId === "toggle_ia_container")
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);

      if (interaction.customId === "toggle_ia_sistema") {
        const atual = iaDB.get("sistema_ativo");
        iaDB.set("sistema_ativo", !atual);
      } else if (interaction.customId === "toggle_ia_assumir") {
        const atual = iaDB.get("parar_ao_assumir");
        iaDB.set("parar_ao_assumir", !atual);
      } else if (interaction.customId === "toggle_ia_staff") {
        const atual = iaDB.get("parar_staff_responder");
        iaDB.set("parar_staff_responder", !atual);
      } else if (interaction.customId === "toggle_ia_horario") {
        iaDB.set("horario_ativo", !(iaDB.get("horario_ativo") ?? false));
      } else if (interaction.customId === "toggle_ia_encerramento") {
        iaDB.set(
          "encerramento_automatico",
          !(iaDB.get("encerramento_automatico") ?? false),
        );
      } else if (interaction.customId === "toggle_ia_retomar") {
        iaDB.set(
          "retomar_apos_inatividade",
          !(iaDB.get("retomar_apos_inatividade") ?? false),
        );
      } else if (interaction.customId === "toggle_ia_resumo_assumir") {
        iaDB.set(
          "resumo_ao_assumir",
          !(iaDB.get("resumo_ao_assumir") ?? false),
        );
      } else if (interaction.customId === "toggle_ia_container") {
        iaDB.set(
          "resposta_container",
          !(iaDB.get("resposta_container") ?? false),
        );
      }

      return interaction.update({
        components: buildIAPainelPage2(iaDB),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "ia_editar_prompt_base"
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const promptAtual = iaDB.get("prompt_base");

      const modal = new ModalBuilder()
        .setCustomId("modal_ia_prompt_base")
        .setTitle("Editar Prompt Base da IA");

      const input = new TextInputBuilder()
        .setCustomId("prompt_base")
        .setLabel("Prompt Base")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(promptAtual)
        .setMaxLength(4000);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    if (
      interaction.isButton() &&
      interaction.customId === "ia_gerenciar_prompts"
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const prompts = iaDB.get("prompts_adicionais") || [];

      const components = buildGerenciarPromptsPanel(prompts, emojis);

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("ia_listar_prompts_page_")
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const prompts = iaDB.get("prompts_adicionais") || [];

      const currentPage = parseInt(interaction.customId.split("_").pop());
      const totalPages = prompts.length;

      if (prompts.length === 0) {
        return interaction.update({
          components: buildGerenciarPromptsPanel([], emojis),
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      }

      return interaction.update({
        components: buildPromptDetailPanel(prompts, currentPage, emojis),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && interaction.customId === "ia_buscar_prompt") {
      const modal = new ModalBuilder()
        .setCustomId("modal_ia_buscar_prompt")
        .setTitle("Buscar Prompt");

      const input = new TextInputBuilder()
        .setCustomId("numero_prompt")
        .setLabel("Número do prompt (1, 2, 3...)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("Digite o número do prompt");

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("ia_editar_prompt_index_")
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const prompts = iaDB.get("prompts_adicionais") || [];
      const index = parseInt(interaction.customId.split("_").pop());

      if (index < 0 || index >= prompts.length) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent("❌ Prompt não encontrado."),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_ia_editar_prompt_${index}`)
        .setTitle(`Editar Prompt ${index + 1}`);

      const input = new TextInputBuilder()
        .setCustomId("prompt_editado")
        .setLabel("Editar Prompt")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(prompts[index])
        .setMaxLength(2000);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("ia_remover_prompt_index_")
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const prompts = iaDB.get("prompts_adicionais") || [];
      const index = parseInt(interaction.customId.split("_").pop());

      if (index < 0 || index >= prompts.length) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent("❌ Prompt não encontrado."),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      prompts.splice(index, 1);
      iaDB.set("prompts_adicionais", prompts);

      if (prompts.length === 0) {
        return interaction.update({
          components: buildGerenciarPromptsPanel([], emojis),
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      }

      const newPage = Math.min(index, prompts.length - 1);
      return interaction.update({
        components: buildPromptDetailPanel(prompts, newPage, emojis),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "ia_adicionar_prompt"
    ) {
      const modal = new ModalBuilder()
        .setCustomId("modal_ia_adicionar_prompt")
        .setTitle("Adicionar Prompt Adicional");

      const input = new TextInputBuilder()
        .setCustomId("novo_prompt")
        .setLabel("Novo Prompt")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000)
        .setPlaceholder(
          "Ex: Quando perguntarem sobre horários de atendimento, informe que atendemos de segunda a sexta.",
        );

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    if (interaction.isButton() && interaction.customId === "ia_setup_inicial") {
      const modal = new ModalBuilder()
        .setCustomId("modal_ia_setup_step1")
        .setTitle("Setup Automatizado - Etapa 1/3");

      const nomeServidor = new TextInputBuilder()
        .setCustomId("nome_servidor")
        .setLabel("Nome do seu servidor")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(interaction.guild.name);

      const inputCor = new TextInputBuilder()
        .setCustomId("cor_descricao")
        .setLabel("Cor do painel (opcional)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: azul claro, vermelho escuro, roxo vibrante")
        .setRequired(false);

      const tipoServidor = new TextInputBuilder()
        .setCustomId("tipo_servidor")
        .setLabel("Qual o foco do servidor?")
        .setPlaceholder("Ex: Comunidade de jogos, Vendas, Suporte técnico")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const objetivoTicket = new TextInputBuilder()
        .setCustomId("objetivo_ticket")
        .setLabel("Para que serão usados os tickets?")
        .setPlaceholder("Ex: Suporte ao cliente, Dúvidas, Denúncias")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nomeServidor),
        new ActionRowBuilder().addComponents(inputCor),
        new ActionRowBuilder().addComponents(tipoServidor),
        new ActionRowBuilder().addComponents(objetivoTicket),
      );

      return interaction.showModal(modal);
    }

    if (
      interaction.isButton() &&
      interaction.customId === "ia_setup_continuar"
    ) {
      await interaction.deferUpdate();

      const tempDB = getConfigDB(interaction.guildId);
      const step1Data = tempDB.get("ia_setup_step1");

      if (!step1Data || step1Data.userId !== interaction.user.id) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Sessão expirada. Inicie o setup novamente.",
            ),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const quantidadeBotoes = parseInt(step1Data.quantidade);
      const corDescricao = step1Data.corDescricao || "";
      const estiloDescricao = step1Data.estilo;
      const tipoPainel = step1Data.tipoPainel;

      const estiloPrompt =
        estiloDescricao === "simples"
          ? "Seja direto e objetivo, máximo 100 caracteres por descrição"
          : "Seja extremamente detalhado, acolhedor e profissional. Use linguagem envolvente que transmita confiança e cuidado. Crie descrições ricas que façam o usuário se sentir bem-vindo e valorizado. Máximo 300 caracteres por descrição, explore todo o espaço disponível para criar uma experiência premium";

      const tipoPrompt =
        tipoPainel === "botao"
          ? `Crie exatamente ${quantidadeBotoes} opções de botões diferentes e relevantes.`
          : tipoPainel === "select"
            ? `Crie exatamente ${quantidadeBotoes} opções de select menu diferentes e relevantes.`
            : `Crie exatamente ${quantidadeBotoes} opções que servirão tanto para botões quanto para select menu.`;

      try {
        const completion = await groqCreate({
          messages: [
            {
              role: "system",
              content: `Você é um especialista em UX/UI e copywriting para Discord, especializado em criar experiências de atendimento premium e envolventes. ${estiloPrompt}. Você também é expert em teoria das cores e sabe converter descrições de cores em valores hexadecimais adequados para interfaces Discord. Responda APENAS em formato JSON válido, sem texto adicional.`,
            },
            {
              role: "user",
              content: `Crie uma configuração completa e profissional de ticket para:
Servidor: ${step1Data.nomeServidor}
Tipo: ${step1Data.tipoServidor}
Objetivo: ${step1Data.objetivoTicket}
${tipoPrompt}
Estilo: ${
                estiloDescricao === "elaborado"
                  ? "EXTREMAMENTE ELABORADO - Use descrições longas, envolventes e que transmitam profissionalismo. Cada descrição deve ser uma experiência em si"
                  : "simples e direto"
              }
${
  corDescricao
    ? `Cor desejada: ${corDescricao} - converta essa descrição para um código hexadecimal (#RRGGBB) que seja visualmente agradável e compatível com Discord. Escolha tons que sejam legíveis e profissionais.`
    : ""
}

IMPORTANTE: 
1. Para cada opção, crie também um "inicio" que será usado como prefixo no nome dos canais.
   O "inicio" deve ter no máximo 5 caracteres e deve refletir a categoria (exemplos: "sup-" para suporte, "vnd-" para vendas, "dv-" para dúvidas).
2. ${
                corDescricao
                  ? "Converta a descrição de cor fornecida em um código hexadecimal válido (formato #RRGGBB). Escolha um tom apropriado e visualmente agradável."
                  : 'Se nenhuma cor foi especificada, deixe o campo "cor" vazio.'
              }
3. A "embedprincipal" é a mensagem inicial onde os usuários veem as opções para abrir tickets. Deve convidar e explicar como abrir um ticket.
4. A "embedticket" é a mensagem enviada DENTRO do ticket após ele ser aberto. Deve dar boas-vindas ao usuário e instruí-lo sobre o que fazer a seguir.

Retorne APENAS um JSON válido com esta estrutura exata:
{
  "embedprincipal": {
    "titulo": "título convidativo para abrir tickets ${
      estiloDescricao === "elaborado" ? "(max 80 chars)" : "(max 50 chars)"
    }",
    "descricao": "descrição explicando como e por que abrir um ticket ${
      estiloDescricao === "elaborado" ? "(max 300 chars)" : "(max 200 chars)"
    }",
    "cor": "${corDescricao ? "código hexadecimal gerado (ex: #5865F2)" : ""}"
  },
  "embedticket": {
    "titulo": "título de boas-vindas ao ticket já aberto ${
      estiloDescricao === "elaborado" ? "(acolhedor)" : "(direto)"
    }",
    "descricao": "mensagem de boas-vindas e instruções para o usuário dentro do ticket ${
      estiloDescricao === "elaborado" ? "(detalhada)" : "(objetiva)"
    }"
  },
  "opcoes": [
    {
      "nome": "nome da opção", 
      "emoji": "emoji unicode simples", 
      "descricao": "função detalhada da opção",
      "inicio": "prefixo curto (max 5 chars, ex: sup-)"
    }
  ]
}`,
            },
          ],
          model: "llama-3.3-70b-versatile",
          temperature: estiloDescricao === "elaborado" ? 0.9 : 0.7,
          max_tokens: estiloDescricao === "elaborado" ? 1200 : 800,
        });

        const resposta = completion.choices[0]?.message?.content.trim();
        const jsonMatch = resposta.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
          throw new Error("Resposta não contém JSON válido");
        }

        const configGerada = JSON.parse(jsonMatch[0]);

        const rolesAdmin = interaction.guild.roles.cache
          .filter((role) => {
            if (!role.permissions.has("Administrator")) return false;
            if (role.managed) return false;
            return true;
          })
          .sort((a, b) => b.position - a.position)
          .first(3)
          .map((r) => r.id);

        const selectRoles = new RoleSelectMenuBuilder()
          .setCustomId("ia_setup_selecionar_equipe")
          .setPlaceholder("Selecione os cargos da equipe (opcional)")
          .setMinValues(0)
          .setMaxValues(10);

        if (rolesAdmin.length > 0) {
          selectRoles.setDefaultRoles(...rolesAdmin);
        }

        const categorias = interaction.guild.channels.cache.filter(
          (c) => c.type === ChannelType.GuildCategory,
        );

        if (categorias.size === 0) {
          tempDB.delete("ia_setup_step1");

          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "❌ Seu servidor não possui categorias. Crie pelo menos uma categoria antes de usar o setup automático.",
              ),
            ),
          ];

          return interaction.editReply({
            components,
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const selectCategoria = new ChannelSelectMenuBuilder()
          .setCustomId("ia_setup_selecionar_categoria")
          .setPlaceholder("Selecione a categoria para os tickets")
          .addChannelTypes(ChannelType.GuildCategory)
          .setMinValues(1)
          .setMaxValues(1);

        const previewOpcoes = configGerada.opcoes
          .map((o, i) => `${i + 1}. ${o.emoji} **${o.nome}** - ${o.descricao}`)
          .join("\n");

        const tipoTexto =
          tipoPainel === "botao"
            ? "Botões"
            : tipoPainel === "select"
              ? "Select Menu"
              : "Botões e Select Menu";

        const btnEditarTituloPrincipal = new ButtonBuilder()
          .setCustomId("ia_edit_titulo_principal")
          .setLabel("Editar")
          .setEmoji(safeEmoji(emojis.lapis))
          .setStyle(ButtonStyle.Secondary);

        const btnEditarDescPrincipal = new ButtonBuilder()
          .setCustomId("ia_edit_desc_principal")
          .setLabel("Editar")
          .setEmoji(safeEmoji(emojis.lapis))
          .setStyle(ButtonStyle.Secondary);

        const btnEditarTituloTicket = new ButtonBuilder()
          .setCustomId("ia_edit_titulo_ticket")
          .setLabel("Editar")
          .setEmoji(safeEmoji(emojis.lapis))
          .setStyle(ButtonStyle.Secondary);

        const btnEditarDescTicket = new ButtonBuilder()
          .setCustomId("ia_edit_desc_ticket")
          .setLabel("Editar")
          .setEmoji(safeEmoji(emojis.lapis))
          .setStyle(ButtonStyle.Secondary);

        const btnAplicar = new ButtonBuilder()
          .setCustomId("ia_setup_aplicar")
          .setLabel("Aplicar Configuração")
          .setEmoji(safeEmoji(emojis.check))
          .setStyle(ButtonStyle.Secondary);

        const btnCancelar = new ButtonBuilder()
          .setCustomId("ia_setup_cancelar")
          .setLabel("Cancelar")
          .setEmoji(safeEmoji(emojis.cancel))
          .setStyle(ButtonStyle.Secondary);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "# Setup Automatizado - Etapa 3/3",
              ),
              new TextDisplayBuilder().setContent("**Configuração Gerada:**"),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "**Embed Principal (Painel de Abertura):**",
              ),
            )
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `**Título:** ${configGerada.embedprincipal.titulo}`,
                  ),
                )
                .setButtonAccessory(btnEditarTituloPrincipal),
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `**Descrição:** ${configGerada.embedprincipal.descricao}`,
                  ),
                )
                .setButtonAccessory(btnEditarDescPrincipal),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "**Embed do Ticket (Dentro do Ticket):**",
              ),
            )
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `**Título:** ${configGerada.embedticket.titulo}`,
                  ),
                )
                .setButtonAccessory(btnEditarTituloTicket),
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `**Descrição:** ${configGerada.embedticket.descricao}`,
                  ),
                )
                .setButtonAccessory(btnEditarDescTicket),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`**${tipoTexto}:**`),
              new TextDisplayBuilder().setContent(previewOpcoes),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "**Selecione os cargos da equipe:**",
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(selectRoles),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "**Selecione a categoria para os tickets:**",
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(selectCategoria),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(btnAplicar, btnCancelar),
            ),
        ];

        tempDB.set("ia_setup_temp", {
          config: configGerada,
          userId: interaction.user.id,
          tipoPainel: tipoPainel,
          teamRoles: rolesAdmin,
        });
        tempDB.delete("ia_setup_step1");

        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error("Erro detalhado:", error);
        tempDB.delete("ia_setup_step1");

        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Erro ao gerar configuração. Tente novamente.",
            ),
          ),
        ];

        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (
      interaction.isButton() &&
      interaction.customId === "ia_edit_titulo_principal"
    ) {
      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      const modal = new ModalBuilder()
        .setCustomId("modal_ia_edit_titulo_principal")
        .setTitle("Editar Título da Embed Principal");

      const input = new TextInputBuilder()
        .setCustomId("valor")
        .setLabel("Título")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100)
        .setValue(setupData.config.embedprincipal.titulo);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (
      interaction.isButton() &&
      interaction.customId === "ia_edit_desc_principal"
    ) {
      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      const modal = new ModalBuilder()
        .setCustomId("modal_ia_edit_desc_principal")
        .setTitle("Editar Descrição da Embed Principal");

      const input = new TextInputBuilder()
        .setCustomId("valor")
        .setLabel("Descrição")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
        .setValue(setupData.config.embedprincipal.descricao);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (
      interaction.isButton() &&
      interaction.customId === "ia_edit_titulo_ticket"
    ) {
      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      const modal = new ModalBuilder()
        .setCustomId("modal_ia_edit_titulo_ticket")
        .setTitle("Editar Título da Embed do Ticket");

      const input = new TextInputBuilder()
        .setCustomId("valor")
        .setLabel("Título")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100)
        .setValue(setupData.config.embedticket.titulo);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (
      interaction.isButton() &&
      interaction.customId === "ia_edit_desc_ticket"
    ) {
      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      const modal = new ModalBuilder()
        .setCustomId("modal_ia_edit_desc_ticket")
        .setTitle("Editar Descrição da Embed do Ticket");

      const input = new TextInputBuilder()
        .setCustomId("valor")
        .setLabel("Descrição")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
        .setValue(setupData.config.embedticket.descricao);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.isButton() && interaction.customId === "ia_setup_aplicar") {
      await interaction.deferUpdate();

      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      if (!setupData || setupData.userId !== interaction.user.id) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Sessão expirada. Inicie o setup novamente.",
            ),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const personalizacaoDB = getPersonalizacaoDB(interaction.guildId);
      const configDB = getConfigDB(interaction.guildId);

      personalizacaoDB.set(
        "embedprincipal.title",
        setupData.config.embedprincipal.titulo,
      );
      personalizacaoDB.set(
        "embedprincipal.descricao",
        setupData.config.embedprincipal.descricao,
      );

      if (
        setupData.config.embedprincipal.cor &&
        setupData.config.embedprincipal.cor.trim() !== ""
      ) {
        personalizacaoDB.set(
          "embedprincipal.color",
          setupData.config.embedprincipal.cor,
        );
      }

      personalizacaoDB.set(
        "embedticket.title",
        setupData.config.embedticket.titulo,
      );
      personalizacaoDB.set(
        "embedticket.descricao",
        setupData.config.embedticket.descricao,
      );

      if (
        setupData.tipoPainel === "botao" ||
        setupData.tipoPainel === "ambos"
      ) {
        const botoesAtuais =
          personalizacaoDB.get("embedprincipal.botoes") || [];

        setupData.config.opcoes.forEach((opcao) => {
          botoesAtuais.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            nome: opcao.nome,
            categoria: setupData.categoria,
            emoji: opcao.emoji || "🎫",
            inicio: opcao.inicio || "",
            cor: "Primary",
          });
        });

        personalizacaoDB.set("embedprincipal.botoes", botoesAtuais);
      }

      if (
        setupData.tipoPainel === "select" ||
        setupData.tipoPainel === "ambos"
      ) {
        const selectsAtuais =
          personalizacaoDB.get("embedprincipal.selects") || [];

        setupData.config.opcoes.forEach((opcao) => {
          selectsAtuais.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            nome: opcao.nome,
            categoria: setupData.categoria,
            emoji: opcao.emoji || "🎫",
            inicio: opcao.inicio || "",
          });
        });

        personalizacaoDB.set("embedprincipal.selects", selectsAtuais);
      }

      if (setupData.teamRoles && setupData.teamRoles.length > 0) {
        configDB.set("team", setupData.teamRoles);
      }

      tempDB.delete("ia_setup_temp");

      const tipoTexto =
        setupData.tipoPainel === "botao"
          ? "botões"
          : setupData.tipoPainel === "select"
            ? "select menu"
            : "botões e select menu";

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("# Setup Concluído!"),
            new TextDisplayBuilder().setContent(
              "Seu sistema de tickets foi configurado com sucesso pela nossa IA!",
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Resumo da Configuração:**"),
            new TextDisplayBuilder().setContent(
              `✅ Embed Principal configurada`,
            ),
            new TextDisplayBuilder().setContent(
              `✅ Embed de Ticket configurada`,
            ),
            new TextDisplayBuilder().setContent(
              `✅ ${setupData.config.opcoes.length} opções criadas para ${tipoTexto}`,
            ),
            new TextDisplayBuilder().setContent(
              `✅ ${
                setupData.teamRoles ? setupData.teamRoles.length : 0
              } cargo(s) de equipe configurado(s)`,
            ),
            new TextDisplayBuilder().setContent(
              `✅ Categoria definida: <#${setupData.categoria}>`,
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Próximos passos:**"),
            new TextDisplayBuilder().setContent(
              `Use \`/ticket tipo:${
                setupData.tipoPainel === "ambos"
                  ? "botao ou select"
                  : setupData.tipoPainel
              }\` para enviar o painel no canal!`,
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("configurar_ticket")
                .setLabel("Ver Configurações")
                .setEmoji(safeEmoji(emojis.settings))
                .setStyle(ButtonStyle.Secondary),
            ),
          ),
      ];

      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === "ia_setup_cancelar"
    ) {
      const tempDB = getConfigDB(interaction.guildId);
      tempDB.delete("ia_setup_temp");
      tempDB.delete("ia_setup_step1");

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("# ❌ Setup Cancelado"),
            new TextDisplayBuilder().setContent(
              "A configuração foi cancelada e nenhuma alteração foi salva.",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("configurar_ticket")
                .setLabel("Voltar ao Menu")
                .setEmoji(safeEmoji(emojis.home))
                .setStyle(ButtonStyle.Secondary),
            ),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_ia_prompt_base"
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const novoPrompt = interaction.fields.getTextInputValue("prompt_base");

      iaDB.set("prompt_base", novoPrompt);

      const sistemaAtivo = iaDB.get("sistema_ativo");
      const pararAoAssumir = iaDB.get("parar_ao_assumir");
      const pararStaffResponder = iaDB.get("parar_staff_responder");
      const promptBase = novoPrompt;
      const prompts = iaDB.get("prompts_adicionais") || [];

      const toggleSistema = new ButtonBuilder()
        .setCustomId("toggle_ia_sistema")
        .setLabel("Sistema IA")
        .setEmoji(safeEmoji(sistemaAtivo ? emojis.on : emojis.off))
        .setStyle(sistemaAtivo ? ButtonStyle.Success : ButtonStyle.Secondary);

      const toggleAssumir = new ButtonBuilder()
        .setCustomId("toggle_ia_assumir")
        .setLabel("Parar ao Assumir")
        .setEmoji(safeEmoji(pararAoAssumir ? emojis.on : emojis.off))
        .setStyle(pararAoAssumir ? ButtonStyle.Success : ButtonStyle.Secondary);

      const toggleStaff = new ButtonBuilder()
        .setCustomId("toggle_ia_staff")
        .setLabel("Parar quando Staff Responder")
        .setEmoji(safeEmoji(pararStaffResponder ? emojis.on : emojis.off))
        .setStyle(
          pararStaffResponder ? ButtonStyle.Success : ButtonStyle.Secondary,
        );

      const editarPromptBase = new ButtonBuilder()
        .setCustomId("ia_editar_prompt_base")
        .setLabel("Editar Prompt Base")
        .setEmoji(safeEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const gerenciarPrompts = new ButtonBuilder()
        .setCustomId("ia_gerenciar_prompts")
        .setLabel("Gerenciar Prompts")
        .setEmoji(safeEmoji(emojis.cardbox))
        .setStyle(ButtonStyle.Secondary);

      const row2 = new ActionRowBuilder().addComponents(
        editarPromptBase,
        gerenciarPrompts,
      );

      const voltarBtn = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel("Voltar")
        .setEmoji(safeEmoji(emojis.home))
        .setStyle(ButtonStyle.Secondary);

      const row3 = new ActionRowBuilder().addComponents(voltarBtn);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("# ⚙️ Configuração da IA"),
            new TextDisplayBuilder().setContent(
              "Configure o comportamento da inteligência artificial nos tickets.",
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder()),

        new ContainerBuilder()
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Sistema de IA**\nControle geral do sistema de atendimento automático.\n\n${
                    sistemaAtivo
                      ? "```diff\n+ Sistema Ativado```"
                      : "```diff\n- Sistema Desativado```"
                  }`,
                ),
              )
              .setButtonAccessory(toggleSistema),

            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Parar ao Assumir Ticket**\nIA para de responder quando um staff assume o atendimento.\n\n${
                    pararAoAssumir
                      ? "```diff\n+ Ativado```"
                      : "```diff\n- Desativado```"
                  }`,
                ),
              )
              .setButtonAccessory(toggleAssumir),

            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Parar quando Staff Responder**\nIA para de responder após qualquer mensagem da equipe.\n\n${
                    pararStaffResponder
                      ? "```diff\n+ Ativado```"
                      : "```diff\n- Desativado```"
                  }`,
                ),
              )
              .setButtonAccessory(toggleStaff),
          )
          .addSeparatorComponents(new SeparatorBuilder()),

        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**📝 Prompt Base**"),
            new TextDisplayBuilder().setContent(
              promptBase.length > 150
                ? `${promptBase.substring(0, 150)}...`
                : promptBase,
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**📚 Prompts Adicionais**\nTotal cadastrado: **${prompts.length}**`,
            ),
          )
          .addActionRowComponents(row2, row3),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_ia_adicionar_prompt"
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const novoPrompt = interaction.fields.getTextInputValue("novo_prompt");

      const prompts = iaDB.get("prompts_adicionais") || [];
      prompts.push(novoPrompt);
      iaDB.set("prompts_adicionais", prompts);

      return interaction.update({
        components: buildGerenciarPromptsPanel(prompts, emojis),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_ia_editar_prompt_")
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const index = parseInt(interaction.customId.split("_").pop());
      const promptEditado =
        interaction.fields.getTextInputValue("prompt_editado");

      const prompts = iaDB.get("prompts_adicionais") || [];

      if (index < 0 || index >= prompts.length) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent("❌ Prompt não encontrado."),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      prompts[index] = promptEditado;
      iaDB.set("prompts_adicionais", prompts);

      return interaction.update({
        components: buildPromptDetailPanel(prompts, index, emojis),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_ia_buscar_prompt"
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const prompts = iaDB.get("prompts_adicionais") || [];

      const numeroDigitado =
        interaction.fields.getTextInputValue("numero_prompt");
      const numero = parseInt(numeroDigitado);

      if (isNaN(numero) || numero < 1 || numero > prompts.length) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `❌ Número inválido. Digite um número entre 1 e ${prompts.length}.`,
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const index = numero - 1;
      return interaction.update({
        components: buildPromptDetailPanel(prompts, index, emojis),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_ia_setup_step1"
    ) {
      const nomeServidor =
        interaction.fields.getTextInputValue("nome_servidor");
      const tipoServidor =
        interaction.fields.getTextInputValue("tipo_servidor");
      const objetivoTicket =
        interaction.fields.getTextInputValue("objetivo_ticket");
      const corDescricao =
        interaction.fields.getTextInputValue("cor_descricao") || "";

      const tempDB = getConfigDB(interaction.guildId);
      tempDB.set("ia_setup_step1", {
        nomeServidor,
        tipoServidor,
        objetivoTicket,
        corDescricao,
        userId: interaction.user.id,
      });

      const btnSimples = new ButtonBuilder()
        .setCustomId("ia_setup_estilo_simples")
        .setLabel("Simples")
        .setEmoji(safeEmoji(emojis.embeds))
        .setStyle(ButtonStyle.Secondary);

      const btnElaborado = new ButtonBuilder()
        .setCustomId("ia_setup_estilo_elaborado")
        .setLabel("Elaborado")
        .setEmoji(safeEmoji(emojis.embeds))
        .setStyle(ButtonStyle.Secondary);

      const row1 = new ActionRowBuilder().addComponents(
        btnSimples,
        btnElaborado,
      );

      const selectQuantidade = new StringSelectMenuBuilder()
        .setCustomId("ia_setup_quantidade_botoes")
        .setPlaceholder("Quantos botões deseja?")
        .addOptions([
          { label: "1 Botão", value: "1", emoji: "1️⃣" },
          { label: "2 Botões", value: "2", emoji: "2️⃣" },
          { label: "3 Botões", value: "3", emoji: "3️⃣" },
          { label: "4 Botões", value: "4", emoji: "4️⃣" },
          { label: "5 Botões", value: "5", emoji: "5️⃣" },
        ]);

      const row2 = new ActionRowBuilder().addComponents(selectQuantidade);

      const selectTipo = new StringSelectMenuBuilder()
        .setCustomId("ia_setup_tipo_painel")
        .setPlaceholder("Tipo de painel")
        .addOptions([
          {
            label: "Apenas Botões",
            value: "botao",
            emoji: "<:cube:1404162505944600667>",
          },
          {
            label: "Apenas Select Menu",
            value: "select",
            emoji: "<:cube:1404162505944600667>",
          },
          {
            label: "Ambos (Botões + Select)",
            value: "ambos",
            emoji: "<:cube:1404162505944600667>",
          },
        ]);

      const row3 = new ActionRowBuilder().addComponents(selectTipo);

      const btnContinuar = new ButtonBuilder()
        .setCustomId("ia_setup_continuar")
        .setLabel("Continuar")
        .setEmoji(safeEmoji(emojis.arrowr))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const row4 = new ActionRowBuilder().addComponents(btnContinuar);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "# Setup Automatizado - Etapa 2/3",
            ),
            new TextDisplayBuilder().setContent(
              "**Escolha o estilo das descrições:**",
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Simples:** Descrições diretas e objetivas (até 100 caracteres)",
            ),
            new TextDisplayBuilder().setContent(
              "**Elaborado:** Descrições detalhadas e acolhedoras (até 250 caracteres)",
            ),
          )
          .addActionRowComponents(row1)
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione a quantidade de opções:**",
            ),
          )
          .addActionRowComponents(row2)
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione o tipo de painel:**",
            ),
          )
          .addActionRowComponents(row3, row4),
      ];

      return interaction.reply({
        components,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("ia_setup_estilo_")
    ) {
      const estilo = interaction.customId.split("_").pop();

      const tempDB = getConfigDB(interaction.guildId);
      let step1Data = tempDB.get("ia_setup_step1");

      if (!step1Data) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Sessão expirada. Inicie o setup novamente.",
            ),
          ),
        ];
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      step1Data.estilo = estilo;
      tempDB.set("ia_setup_step1", step1Data);

      const btnSimples = new ButtonBuilder()
        .setCustomId("ia_setup_estilo_simples")
        .setLabel("Simples")
        .setEmoji(safeEmoji(emojis.embeds))
        .setStyle(
          estilo === "simples" ? ButtonStyle.Success : ButtonStyle.Secondary,
        );

      const btnElaborado = new ButtonBuilder()
        .setCustomId("ia_setup_estilo_elaborado")
        .setLabel("Elaborado")
        .setEmoji(safeEmoji(emojis.embeds))
        .setStyle(
          estilo === "elaborado" ? ButtonStyle.Success : ButtonStyle.Secondary,
        );

      const row1 = new ActionRowBuilder().addComponents(
        btnSimples,
        btnElaborado,
      );

      const selectQuantidade = new StringSelectMenuBuilder()
        .setCustomId("ia_setup_quantidade_botoes")
        .setPlaceholder("Quantos botões deseja?")
        .addOptions([
          {
            label: "1 Botão",
            value: "1",
            emoji: "1️⃣",
            default: step1Data.quantidade === "1",
          },
          {
            label: "2 Botões",
            value: "2",
            emoji: "2️⃣",
            default: step1Data.quantidade === "2",
          },
          {
            label: "3 Botões",
            value: "3",
            emoji: "3️⃣",
            default: step1Data.quantidade === "3",
          },
          {
            label: "4 Botões",
            value: "4",
            emoji: "4️⃣",
            default: step1Data.quantidade === "4",
          },
          {
            label: "5 Botões",
            value: "5",
            emoji: "5️⃣",
            default: step1Data.quantidade === "5",
          },
        ]);

      const row2 = new ActionRowBuilder().addComponents(selectQuantidade);

      const selectTipo = new StringSelectMenuBuilder()
        .setCustomId("ia_setup_tipo_painel")
        .setPlaceholder("Tipo de painel")
        .addOptions([
          {
            label: "Apenas Botões",
            value: "botao",
            emoji: "<:cube:1404162505944600667>",
            default: step1Data.tipoPainel === "botao",
          },
          {
            label: "Apenas Select Menu",
            value: "select",
            emoji: "<:cube:1404162505944600667>",
            default: step1Data.tipoPainel === "select",
          },
          {
            label: "Ambos (Botões + Select)",
            value: "ambos",
            emoji: "<:cube:1404162505944600667>",
            default: step1Data.tipoPainel === "ambos",
          },
        ]);

      const row3 = new ActionRowBuilder().addComponents(selectTipo);

      const podeContinar =
        step1Data.estilo && step1Data.quantidade && step1Data.tipoPainel;

      const btnContinuar = new ButtonBuilder()
        .setCustomId("ia_setup_continuar")
        .setLabel("Continuar")
        .setEmoji(safeEmoji(emojis.arrowr))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!podeContinar);

      const row4 = new ActionRowBuilder().addComponents(btnContinuar);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "# Setup Automatizado - Etapa 2/3",
            ),
            new TextDisplayBuilder().setContent(
              "**Escolha o estilo das descrições:**",
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Simples:** Descrições diretas e objetivas (até 100 caracteres)",
            ),
            new TextDisplayBuilder().setContent(
              "**Elaborado:** Descrições detalhadas e acolhedoras (até 250 caracteres)",
            ),
          )
          .addActionRowComponents(row1)
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione a quantidade de opções:**",
            ),
          )
          .addActionRowComponents(row2)
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione o tipo de painel:**",
            ),
          )
          .addActionRowComponents(row3, row4),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ia_setup_quantidade_botoes"
    ) {
      const quantidadeBotoes = interaction.values[0];
      const tempDB = getConfigDB(interaction.guildId);
      let step1Data = tempDB.get("ia_setup_step1");

      if (!step1Data || step1Data.userId !== interaction.user.id) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Sessão expirada. Inicie o setup novamente.",
            ),
          ),
        ];
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      step1Data.quantidade = quantidadeBotoes;
      tempDB.set("ia_setup_step1", step1Data);

      const btnSimples = new ButtonBuilder()
        .setCustomId("ia_setup_estilo_simples")
        .setLabel("Simples")
        .setEmoji(safeEmoji(emojis.embeds))
        .setStyle(
          step1Data.estilo === "simples"
            ? ButtonStyle.Success
            : ButtonStyle.Secondary,
        );
      const btnElaborado = new ButtonBuilder()
        .setCustomId("ia_setup_estilo_elaborado")
        .setLabel("Elaborado")
        .setEmoji(safeEmoji(emojis.embeds))
        .setStyle(
          step1Data.estilo === "elaborado"
            ? ButtonStyle.Success
            : ButtonStyle.Secondary,
        );
      const row1 = new ActionRowBuilder().addComponents(
        btnSimples,
        btnElaborado,
      );

      const selectQuantidade = new StringSelectMenuBuilder()
        .setCustomId("ia_setup_quantidade_botoes")
        .setPlaceholder("Quantos botões deseja?")
        .addOptions([
          {
            label: "1 Botão",
            value: "1",
            emoji: "1️⃣",
            default: quantidadeBotoes === "1",
          },
          {
            label: "2 Botões",
            value: "2",
            emoji: "2️⃣",
            default: quantidadeBotoes === "2",
          },
          {
            label: "3 Botões",
            value: "3",
            emoji: "3️⃣",
            default: quantidadeBotoes === "3",
          },
          {
            label: "4 Botões",
            value: "4",
            emoji: "4️⃣",
            default: quantidadeBotoes === "4",
          },
          {
            label: "5 Botões",
            value: "5",
            emoji: "5️⃣",
            default: quantidadeBotoes === "5",
          },
        ]);
      const row2 = new ActionRowBuilder().addComponents(selectQuantidade);

      const selectTipo = new StringSelectMenuBuilder()
        .setCustomId("ia_setup_tipo_painel")
        .setPlaceholder("Tipo de painel")
        .addOptions([
          {
            label: "Apenas Botões",
            value: "botao",
            emoji: "<:cube:1404162505944600667>",
            default: step1Data.tipoPainel === "botao",
          },
          {
            label: "Apenas Select Menu",
            value: "select",
            emoji: "<:cube:1404162505944600667>",
            default: step1Data.tipoPainel === "select",
          },
          {
            label: "Ambos (Botões + Select)",
            value: "ambos",
            emoji: "<:cube:1404162505944600667>",
            default: step1Data.tipoPainel === "ambos",
          },
        ]);
      const row3 = new ActionRowBuilder().addComponents(selectTipo);

      const podeContinar =
        step1Data.estilo && step1Data.quantidade && step1Data.tipoPainel;
      const btnContinuar = new ButtonBuilder()
        .setCustomId("ia_setup_continuar")
        .setLabel("Continuar")
        .setEmoji(safeEmoji(emojis.arrowr))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!podeContinar);
      const row4 = new ActionRowBuilder().addComponents(btnContinuar);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "# Setup Automatizado - Etapa 2/3",
            ),
            new TextDisplayBuilder().setContent(
              "**Escolha o estilo das descrições:**",
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Simples:** Descrições diretas e objetivas (até 100 caracteres)",
            ),
            new TextDisplayBuilder().setContent(
              "**Elaborado:** Descrições detalhadas e acolhedoras (até 250 caracteres)",
            ),
          )
          .addActionRowComponents(row1)
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione a quantidade de opções:**",
            ),
          )
          .addActionRowComponents(row2)
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione o tipo de painel:**",
            ),
          )
          .addActionRowComponents(row3, row4),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("modal_config_select_descricao_")
    ) {
      const selectId = interaction.customId.replace(
        "modal_config_select_descricao_",
        "",
      );

      const descricao = interaction.fields.getTextInputValue("descricao");

      const db = getPersonalizacaoDB(interaction.guild.id);
      const selects = db.get("embedprincipal.selects") || [];

      const index = selects.findIndex((s) => s.id === selectId);

      if (index !== -1) {
        selects[index].descricao = descricao;
        db.set("embedprincipal.selects", selects);
        console.log("Selects depois:", JSON.stringify(selects, null, 2));
      } else {
        console.log("❌ Select não encontrado no array!");
      }

      const components = criarPainelConfiguracaoSelect(selectId, db);
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_ia_edit_titulo_principal"
    ) {
      const valor = interaction.fields.getTextInputValue("valor");
      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      setupData.config.embedprincipal.titulo = valor;
      tempDB.set("ia_setup_temp", setupData);

      await interaction.deferUpdate();

      const btnEditarTituloPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_desc_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarTituloTicket = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescTicket = new ButtonBuilder()
        .setCustomId("ia_edit_desc_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const previewOpcoes = setupData.config.opcoes
        .map((o, i) => `${i + 1}. ${o.emoji} **${o.nome}** - ${o.descricao}`)
        .join("\n");

      const tipoTexto =
        setupData.tipoPainel === "botao"
          ? "Botões"
          : setupData.tipoPainel === "select"
            ? "Select Menu"
            : "Botões e Select Menu";

      const selectRoles = new RoleSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_equipe")
        .setPlaceholder("Selecione os cargos da equipe (opcional)")
        .setMinValues(0)
        .setMaxValues(10);

      if (setupData.teamRoles && setupData.teamRoles.length > 0) {
        selectRoles.setDefaultRoles(...setupData.teamRoles);
      }

      const selectCategoria = new ChannelSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_categoria")
        .setPlaceholder("Selecione a categoria para os tickets")
        .addChannelTypes(ChannelType.GuildCategory)
        .setMinValues(1)
        .setMaxValues(1);

      if (setupData.categoria) {
        selectCategoria.setDefaultChannels(setupData.categoria);
      }

      const btnAplicar = new ButtonBuilder()
        .setCustomId("ia_setup_aplicar")
        .setLabel("Aplicar Configuração")
        .setEmoji(safeEmoji(emojis.check))
        .setStyle(ButtonStyle.Secondary);

      const btnCancelar = new ButtonBuilder()
        .setCustomId("ia_setup_cancelar")
        .setLabel("Cancelar")
        .setEmoji(safeEmoji(emojis.cancel))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "# Setup Automatizado - Etapa 3/3",
            ),
            new TextDisplayBuilder().setContent("**📋 Configuração Gerada:**"),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed Principal:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedprincipal.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloPrincipal),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedprincipal.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescPrincipal),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Cor:** ${
                setupData.config.embedprincipal.cor || "Nenhuma cor definida"
              }`,
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed do Ticket:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedticket.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloTicket),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedticket.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescTicket),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${tipoTexto}:**`),
            new TextDisplayBuilder().setContent(previewOpcoes),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione os cargos da equipe:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectRoles),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione a categoria para os tickets:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectCategoria),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAplicar, btnCancelar),
          ),
      ];

      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_ia_edit_desc_principal"
    ) {
      const valor = interaction.fields.getTextInputValue("valor");
      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      setupData.config.embedprincipal.descricao = valor;
      tempDB.set("ia_setup_temp", setupData);

      await interaction.deferUpdate();

      const btnEditarTituloPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_desc_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarTituloTicket = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescTicket = new ButtonBuilder()
        .setCustomId("ia_edit_desc_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const previewOpcoes = setupData.config.opcoes
        .map((o, i) => `${i + 1}. ${o.emoji} **${o.nome}** - ${o.descricao}`)
        .join("\n");

      const tipoTexto =
        setupData.tipoPainel === "botao"
          ? "Botões"
          : setupData.tipoPainel === "select"
            ? "Select Menu"
            : "Botões e Select Menu";

      const selectRoles = new RoleSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_equipe")
        .setPlaceholder("Selecione os cargos da equipe (opcional)")
        .setMinValues(0)
        .setMaxValues(10);

      if (setupData.teamRoles && setupData.teamRoles.length > 0) {
        selectRoles.setDefaultRoles(...setupData.teamRoles);
      }

      const selectCategoria = new ChannelSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_categoria")
        .setPlaceholder("Selecione a categoria para os tickets")
        .addChannelTypes(ChannelType.GuildCategory)
        .setMinValues(1)
        .setMaxValues(1);

      if (setupData.categoria) {
        selectCategoria.setDefaultChannels(setupData.categoria);
      }

      const btnAplicar = new ButtonBuilder()
        .setCustomId("ia_setup_aplicar")
        .setLabel("Aplicar Configuração")
        .setEmoji(safeEmoji(emojis.check))
        .setStyle(ButtonStyle.Secondary);

      const btnCancelar = new ButtonBuilder()
        .setCustomId("ia_setup_cancelar")
        .setLabel("Cancelar")
        .setEmoji(safeEmoji(emojis.cancel))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "# Setup Automatizado - Etapa 3/3",
            ),
            new TextDisplayBuilder().setContent("**📋 Configuração Gerada:**"),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed Principal:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedprincipal.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloPrincipal),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedprincipal.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescPrincipal),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed do Ticket:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedticket.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloTicket),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedticket.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescTicket),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${tipoTexto}:**`),
            new TextDisplayBuilder().setContent(previewOpcoes),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione os cargos da equipe:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectRoles),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione a categoria para os tickets:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectCategoria),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAplicar, btnCancelar),
          ),
      ];

      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_ia_edit_titulo_ticket"
    ) {
      const valor = interaction.fields.getTextInputValue("valor");
      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      setupData.config.embedticket.titulo = valor;
      tempDB.set("ia_setup_temp", setupData);

      await interaction.deferUpdate();

      const btnEditarTituloPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_desc_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarTituloTicket = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescTicket = new ButtonBuilder()
        .setCustomId("ia_edit_desc_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const previewOpcoes = setupData.config.opcoes
        .map((o, i) => `${i + 1}. ${o.emoji} **${o.nome}** - ${o.descricao}`)
        .join("\n");

      const tipoTexto =
        setupData.tipoPainel === "botao"
          ? "Botões"
          : setupData.tipoPainel === "select"
            ? "Select Menu"
            : "Botões e Select Menu";

      const selectRoles = new RoleSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_equipe")
        .setPlaceholder("Selecione os cargos da equipe (opcional)")
        .setMinValues(0)
        .setMaxValues(10);

      if (setupData.teamRoles && setupData.teamRoles.length > 0) {
        selectRoles.setDefaultRoles(...setupData.teamRoles);
      }

      const selectCategoria = new ChannelSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_categoria")
        .setPlaceholder("Selecione a categoria para os tickets")
        .addChannelTypes(ChannelType.GuildCategory)
        .setMinValues(1)
        .setMaxValues(1);

      if (setupData.categoria) {
        selectCategoria.setDefaultChannels(setupData.categoria);
      }

      const btnAplicar = new ButtonBuilder()
        .setCustomId("ia_setup_aplicar")
        .setLabel("Aplicar Configuração")
        .setEmoji(safeEmoji(emojis.check))
        .setStyle(ButtonStyle.Secondary);

      const btnCancelar = new ButtonBuilder()
        .setCustomId("ia_setup_cancelar")
        .setLabel("Cancelar")
        .setEmoji(safeEmoji(emojis.cancel))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "# Setup Automatizado - Etapa 3/3",
            ),
            new TextDisplayBuilder().setContent("**📋 Configuração Gerada:**"),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed Principal:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedprincipal.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloPrincipal),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedprincipal.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescPrincipal),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed do Ticket:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedticket.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloTicket),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedticket.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescTicket),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${tipoTexto}:**`),
            new TextDisplayBuilder().setContent(previewOpcoes),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione os cargos da equipe:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectRoles),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione a categoria para os tickets:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectCategoria),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAplicar, btnCancelar),
          ),
      ];

      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_ia_edit_desc_ticket"
    ) {
      const valor = interaction.fields.getTextInputValue("valor");
      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      setupData.config.embedticket.descricao = valor;
      tempDB.set("ia_setup_temp", setupData);

      await interaction.deferUpdate();

      const btnEditarTituloPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_desc_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarTituloTicket = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescTicket = new ButtonBuilder()
        .setCustomId("ia_edit_desc_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const previewOpcoes = setupData.config.opcoes
        .map((o, i) => `${i + 1}. ${o.emoji} **${o.nome}** - ${o.descricao}`)
        .join("\n");

      const tipoTexto =
        setupData.tipoPainel === "botao"
          ? "Botões"
          : setupData.tipoPainel === "select"
            ? "Select Menu"
            : "Botões e Select Menu";

      const selectRoles = new RoleSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_equipe")
        .setPlaceholder("Selecione os cargos da equipe (opcional)")
        .setMinValues(0)
        .setMaxValues(10);

      if (setupData.teamRoles && setupData.teamRoles.length > 0) {
        selectRoles.setDefaultRoles(...setupData.teamRoles);
      }

      const selectCategoria = new ChannelSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_categoria")
        .setPlaceholder("Selecione a categoria para os tickets")
        .addChannelTypes(ChannelType.GuildCategory)
        .setMinValues(1)
        .setMaxValues(1);

      if (setupData.categoria) {
        selectCategoria.setDefaultChannels(setupData.categoria);
      }

      const btnAplicar = new ButtonBuilder()
        .setCustomId("ia_setup_aplicar")
        .setLabel("Aplicar Configuração")
        .setEmoji(safeEmoji(emojis.check))
        .setStyle(ButtonStyle.Secondary);

      const btnCancelar = new ButtonBuilder()
        .setCustomId("ia_setup_cancelar")
        .setLabel("Cancelar")
        .setEmoji(safeEmoji(emojis.cancel))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "# Setup Automatizado - Etapa 3/3",
            ),
            new TextDisplayBuilder().setContent("**📋 Configuração Gerada:**"),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed Principal:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedprincipal.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloPrincipal),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedprincipal.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescPrincipal),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed do Ticket:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedticket.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloTicket),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedticket.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescTicket),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${tipoTexto}:**`),
            new TextDisplayBuilder().setContent(previewOpcoes),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione os cargos da equipe:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectRoles),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione a categoria para os tickets:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectCategoria),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAplicar, btnCancelar),
          ),
      ];

      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (interaction.isButton() && interaction.customId === "ia_setup_aplicar") {
      await interaction.deferUpdate();

      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      if (!setupData || setupData.userId !== interaction.user.id) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Sessão expirada. Inicie o setup novamente.",
            ),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const personalizacaoDB = getPersonalizacaoDB(interaction.guildId);
      const configDB = getConfigDB(interaction.guildId);

      personalizacaoDB.set(
        "embedprincipal.title",
        setupData.config.embedprincipal.titulo,
      );
      personalizacaoDB.set(
        "embedprincipal.descricao",
        setupData.config.embedprincipal.descricao,
      );
      personalizacaoDB.set(
        "embedticket.title",
        setupData.config.embedticket.titulo,
      );
      personalizacaoDB.set(
        "embedticket.descricao",
        setupData.config.embedticket.descricao,
      );

      if (
        setupData.tipoPainel === "botao" ||
        setupData.tipoPainel === "ambos"
      ) {
        const botoesAtuais =
          personalizacaoDB.get("embedprincipal.botoes") || [];

        setupData.config.opcoes.forEach((opcao) => {
          botoesAtuais.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            nome: opcao.nome,
            categoria: setupData.categoria,
            emoji: opcao.emoji || "🎫",
            inicio: "",
            cor: "Primary",
          });
        });

        personalizacaoDB.set("embedprincipal.botoes", botoesAtuais);
      }

      if (
        setupData.tipoPainel === "select" ||
        setupData.tipoPainel === "ambos"
      ) {
        const selectsAtuais =
          personalizacaoDB.get("embedprincipal.selects") || [];

        setupData.config.opcoes.forEach((opcao) => {
          selectsAtuais.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            nome: opcao.nome,
            categoria: setupData.categoria,
            emoji: opcao.emoji || "🎫",
            inicio: "",
          });
        });

        personalizacaoDB.set("embedprincipal.selects", selectsAtuais);
      }

      if (setupData.teamRoles && setupData.teamRoles.length > 0) {
        configDB.set("team", setupData.teamRoles);
      }

      tempDB.delete("ia_setup_temp");

      const tipoTexto =
        setupData.tipoPainel === "botao"
          ? "botões"
          : setupData.tipoPainel === "select"
            ? "select menu"
            : "botões e select menu";

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("# Setup Concluído!"),
            new TextDisplayBuilder().setContent(
              "Seu sistema de tickets foi configurado com sucesso pela nossa IA!",
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Resumo da Configuração:**"),
            new TextDisplayBuilder().setContent(
              `✅ Embed Principal configurada`,
            ),
            new TextDisplayBuilder().setContent(
              `✅ Embed de Ticket configurada`,
            ),
            new TextDisplayBuilder().setContent(
              `✅ ${setupData.config.opcoes.length} opções criadas para ${tipoTexto}`,
            ),
            new TextDisplayBuilder().setContent(
              `✅ ${
                setupData.teamRoles ? setupData.teamRoles.length : 0
              } cargo(s) de equipe configurado(s)`,
            ),
            new TextDisplayBuilder().setContent(
              `✅ Categoria definida: <#${setupData.categoria}>`,
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Próximos passos:**"),
            new TextDisplayBuilder().setContent(
              `Use \`/ticket tipo:${
                setupData.tipoPainel === "ambos"
                  ? "botao ou select"
                  : setupData.tipoPainel
              }\` para enviar o painel no canal!`,
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("configurar_ticket")
                .setLabel("Ver Configurações")
                .setEmoji(safeEmoji(emojis.settings))
                .setStyle(ButtonStyle.Secondary),
            ),
          ),
      ];

      return interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "ia_setup_tipo_painel"
    ) {
      const tipoPainel = interaction.values[0];

      const tempDB = getConfigDB(interaction.guildId);
      let step1Data = tempDB.get("ia_setup_step1");

      if (!step1Data) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Sessão expirada. Inicie o setup novamente.",
            ),
          ),
        ];
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      step1Data.tipoPainel = tipoPainel;
      tempDB.set("ia_setup_step1", step1Data);

      const btnSimples = new ButtonBuilder()
        .setCustomId("ia_setup_estilo_simples")
        .setLabel("Simples")
        .setEmoji(safeEmoji(emojis.embeds))
        .setStyle(
          step1Data.estilo === "simples"
            ? ButtonStyle.Success
            : ButtonStyle.Secondary,
        );

      const btnElaborado = new ButtonBuilder()
        .setCustomId("ia_setup_estilo_elaborado")
        .setLabel("Elaborado")
        .setEmoji(safeEmoji(emojis.embeds))
        .setStyle(
          step1Data.estilo === "elaborado"
            ? ButtonStyle.Success
            : ButtonStyle.Secondary,
        );

      const row1 = new ActionRowBuilder().addComponents(
        btnSimples,
        btnElaborado,
      );

      const selectQuantidade = new StringSelectMenuBuilder()
        .setCustomId("ia_setup_quantidade_botoes")
        .setPlaceholder("Quantos botões deseja?")
        .addOptions([
          {
            label: "1 Botão",
            value: "1",
            emoji: "1️⃣",
            default: step1Data.quantidade === "1",
          },
          {
            label: "2 Botões",
            value: "2",
            emoji: "2️⃣",
            default: step1Data.quantidade === "2",
          },
          {
            label: "3 Botões",
            value: "3",
            emoji: "3️⃣",
            default: step1Data.quantidade === "3",
          },
          {
            label: "4 Botões",
            value: "4",
            emoji: "4️⃣",
            default: step1Data.quantidade === "4",
          },
          {
            label: "5 Botões",
            value: "5",
            emoji: "5️⃣",
            default: step1Data.quantidade === "5",
          },
        ]);

      const row2 = new ActionRowBuilder().addComponents(selectQuantidade);

      const selectTipo = new StringSelectMenuBuilder()
        .setCustomId("ia_setup_tipo_painel")
        .setPlaceholder("Tipo de painel")
        .addOptions([
          {
            label: "Apenas Botões",
            value: "botao",
            emoji: "<:cube:1404162505944600667>",
            default: tipoPainel === "botao",
          },
          {
            label: "Apenas Select Menu",
            value: "select",
            emoji: "<:cube:1404162505944600667>",
            default: tipoPainel === "select",
          },
          {
            label: "Ambos (Botões + Select)",
            value: "ambos",
            emoji: "<:cube:1404162505944600667>",
            default: tipoPainel === "ambos",
          },
        ]);

      const row3 = new ActionRowBuilder().addComponents(selectTipo);

      const podeContinar =
        step1Data.estilo && step1Data.quantidade && step1Data.tipoPainel;

      const btnContinuar = new ButtonBuilder()
        .setCustomId("ia_setup_continuar")
        .setLabel("Continuar")
        .setEmoji(safeEmoji(emojis.arrowr))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!podeContinar);

      const row4 = new ActionRowBuilder().addComponents(btnContinuar);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "# Setup Automatizado - Etapa 2/3",
            ),
            new TextDisplayBuilder().setContent(
              "**Escolha o estilo das descrições:**",
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Simples:** Descrições diretas e objetivas (até 100 caracteres)",
            ),
            new TextDisplayBuilder().setContent(
              "**Elaborado:** Descrições detalhadas e acolhedoras (até 250 caracteres)",
            ),
          )
          .addActionRowComponents(row1)
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione a quantidade de opções:**",
            ),
          )
          .addActionRowComponents(row2)
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione o tipo de painel:**",
            ),
          )
          .addActionRowComponents(row3, row4),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId === "ia_setup_selecionar_categoria"
    ) {
      const categoriaId = interaction.values[0];
      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      if (!setupData || setupData.userId !== interaction.user.id) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Sessão expirada. Inicie o setup novamente.",
            ),
          ),
        ];
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      setupData.categoria = categoriaId;
      tempDB.set("ia_setup_temp", setupData);

      const btnEditarTituloPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_desc_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarTituloTicket = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescTicket = new ButtonBuilder()
        .setCustomId("ia_edit_desc_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const previewOpcoes = setupData.config.opcoes
        .map((o, i) => `${i + 1}. ${o.emoji} **${o.nome}** - ${o.descricao}`)
        .join("\n");

      const tipoTexto =
        setupData.tipoPainel === "botao"
          ? "Botões"
          : setupData.tipoPainel === "select"
            ? "Select Menu"
            : "Botões e Select Menu";

      const selectRoles = new RoleSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_equipe")
        .setPlaceholder("Selecione os cargos da equipe (opcional)")
        .setMinValues(0)
        .setMaxValues(10);

      if (setupData.teamRoles && setupData.teamRoles.length > 0) {
        selectRoles.setDefaultRoles(...setupData.teamRoles);
      }

      const selectCategoria = new ChannelSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_categoria")
        .setPlaceholder("Selecione a categoria para os tickets")
        .addChannelTypes(ChannelType.GuildCategory)
        .setMinValues(1)
        .setMaxValues(1)
        .setDefaultChannels(categoriaId);

      const btnAplicar = new ButtonBuilder()
        .setCustomId("ia_setup_aplicar")
        .setLabel("Aplicar Configuração")
        .setEmoji(safeEmoji(emojis.check))
        .setStyle(ButtonStyle.Secondary);

      const btnCancelar = new ButtonBuilder()
        .setCustomId("ia_setup_cancelar")
        .setLabel("Cancelar")
        .setEmoji(safeEmoji(emojis.cancel))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "# Setup Automatizado - Etapa 3/3",
            ),
            new TextDisplayBuilder().setContent("**📋 Configuração Gerada:**"),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed Principal:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedprincipal.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloPrincipal),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedprincipal.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescPrincipal),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed do Ticket:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedticket.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloTicket),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedticket.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescTicket),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${tipoTexto}:**`),
            new TextDisplayBuilder().setContent(previewOpcoes),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione os cargos da equipe:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectRoles),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione a categoria para os tickets:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectCategoria),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAplicar, btnCancelar),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isRoleSelectMenu() &&
      interaction.customId === "ia_setup_selecionar_equipe"
    ) {
      const tempDB = getConfigDB(interaction.guildId);
      const setupData = tempDB.get("ia_setup_temp");

      if (!setupData || setupData.userId !== interaction.user.id) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Sessão expirada. Inicie o setup novamente.",
            ),
          ),
        ];
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      setupData.teamRoles = interaction.values;
      tempDB.set("ia_setup_temp", setupData);

      const selectRoles = new RoleSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_equipe")
        .setPlaceholder("Selecione os cargos da equipe (opcional)")
        .setMinValues(0)
        .setMaxValues(10);

      if (interaction.values.length > 0) {
        selectRoles.setDefaultRoles(...interaction.values);
      }

      const selectCategoria = new ChannelSelectMenuBuilder()
        .setCustomId("ia_setup_selecionar_categoria")
        .setPlaceholder("Selecione a categoria para os tickets")
        .addChannelTypes(ChannelType.GuildCategory)
        .setMinValues(1)
        .setMaxValues(1);

      if (setupData.categoria) {
        selectCategoria.setDefaultChannels(setupData.categoria);
      }

      const btnEditarTituloPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescPrincipal = new ButtonBuilder()
        .setCustomId("ia_edit_desc_principal")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarTituloTicket = new ButtonBuilder()
        .setCustomId("ia_edit_titulo_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const btnEditarDescTicket = new ButtonBuilder()
        .setCustomId("ia_edit_desc_ticket")
        .setLabel("Editar")
        .setEmoji(safeEmoji(emojis.lapis))
        .setStyle(ButtonStyle.Secondary);

      const previewOpcoes = setupData.config.opcoes
        .map((o, i) => `${i + 1}. ${o.emoji} **${o.nome}** - ${o.descricao}`)
        .join("\n");

      const tipoTexto =
        setupData.tipoPainel === "botao"
          ? "Botões"
          : setupData.tipoPainel === "select"
            ? "Select Menu"
            : "Botões e Select Menu";

      const btnAplicar = new ButtonBuilder()
        .setCustomId("ia_setup_aplicar")
        .setLabel("Aplicar Configuração")
        .setEmoji(safeEmoji(emojis.check))
        .setStyle(ButtonStyle.Secondary);

      const btnCancelar = new ButtonBuilder()
        .setCustomId("ia_setup_cancelar")
        .setLabel("Cancelar")
        .setEmoji(safeEmoji(emojis.cancel))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "# Setup Automatizado - Etapa 3/3",
            ),
            new TextDisplayBuilder().setContent("**📋 Configuração Gerada:**"),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed Principal:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedprincipal.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloPrincipal),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedprincipal.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescPrincipal),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("**Embed do Ticket:**"),
          )
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Título:** ${setupData.config.embedticket.titulo}`,
                ),
              )
              .setButtonAccessory(btnEditarTituloTicket),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `**Descrição:** ${setupData.config.embedticket.descricao}`,
                ),
              )
              .setButtonAccessory(btnEditarDescTicket),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${tipoTexto}:**`),
            new TextDisplayBuilder().setContent(previewOpcoes),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione os cargos da equipe:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectRoles),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Selecione a categoria para os tickets:**",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectCategoria),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAplicar, btnCancelar),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (interaction.isButton() && customId === "toggle_ia_boas_vindas") {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      iaDB.set(
        "mensagem_boas_vindas_ativo",
        !(iaDB.get("mensagem_boas_vindas_ativo") ?? false),
      );
      return interaction.update({
        components: buildIAPainelPage1(iaDB),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && customId === "ia_editar_boas_vindas") {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const atual = iaDB.get("mensagem_boas_vindas") || "";
      const modal = new ModalBuilder()
        .setCustomId("modal_ia_boas_vindas")
        .setTitle("Mensagem de Boas-Vindas da IA");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("mensagem")
            .setLabel("Mensagem (use {user} e {nome})")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(atual)
            .setRequired(false)
            .setMaxLength(2000)
            .setPlaceholder(
              "Olá {user}! Bem-vindo ao ticket. Como posso ajudar?",
            ),
        ),
      );
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === "modal_ia_boas_vindas") {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const msg = interaction.fields.getTextInputValue("mensagem").trim();
      iaDB.set("mensagem_boas_vindas", msg || " ");
      return interaction.update({
        components: buildIAPainelPage1(iaDB),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    function _buildCargosPage(promptsCargos, currentPage) {
      const e = emojis;
      const PER = 3;
      const totalPages = Math.max(1, Math.ceil(promptsCargos.length / PER));
      const page = Math.max(0, Math.min(currentPage, totalPages - 1));
      const slice = promptsCargos.slice(page * PER, (page + 1) * PER);

      const listaTexto =
        promptsCargos.length === 0
          ? "_Nenhuma regra cadastrada ainda._"
          : slice
              .map((p, i) => {
                const gi = page * PER + i;
                const acaoEmoji =
                  p.acao === "adicionar"
                    ? safeEmojiStr(e.add)
                    : p.acao === "remover"
                      ? safeEmojiStr(e.remove)
                      : safeEmojiStr(e.check);
                return `**${gi + 1}.** ${acaoEmoji} Cargo <@&${p.cargo_id}> \u2014 \`${p.acao}\`\n> ${p.prompt.substring(0, 100)}${p.prompt.length > 100 ? "..." : ""}`;
              })
              .join("\n\n");

      const adicionarBtn = new ButtonBuilder()
        .setCustomId("ia_adicionar_prompt_cargo")
        .setLabel("Adicionar Regra")
        .setEmoji(safeEmoji(e.add))
        .setStyle(ButtonStyle.Success);
      const voltarBtnC = new ButtonBuilder()
        .setCustomId("ia_painel_page_1")
        .setLabel("Voltar")
        .setEmoji(safeEmoji(e.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const navRow = new ActionRowBuilder().addComponents(adicionarBtn);
      if (page > 0)
        navRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ia_cargos_page_${page - 1}`)
            .setLabel("Anterior")
            .setEmoji(safeEmoji(e.arrowl))
            .setStyle(ButtonStyle.Secondary),
        );
      if (page < totalPages - 1)
        navRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ia_cargos_page_${page + 1}`)
            .setLabel("Proxima")
            .setEmoji(safeEmoji(e.arrowr))
            .setStyle(ButtonStyle.Secondary),
        );
      navRow.addComponents(voltarBtnC);

      const rows = [navRow];
      if (slice.length > 0) {
        const removeRow = new ActionRowBuilder();
        slice.forEach((_, i) => {
          const gi = page * PER + i;
          removeRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`ia_remover_prompt_cargo_${gi}`)
              .setLabel(`Remover #${gi + 1}`)
              .setEmoji(safeEmoji(e.lixeira))
              .setStyle(ButtonStyle.Danger),
          );
        });
        rows.push(removeRow);
      }

      return [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `# ${safeEmojiStr(e.role)} Prompts de Cargo\nDefina regras para que a IA adicione ou remova cargos automaticamente.\n-# Pagina ${page + 1}/${totalPages} \u2022 ${promptsCargos.length} regra(s)`,
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(listaTexto),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(...rows),
      ];
    }

    if (interaction.isButton() && customId === "ia_gerenciar_prompts_cargos") {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      let pC = [];
      try {
        const v = iaDB.get("prompts_cargos");
        pC = Array.isArray(v) ? v : JSON.parse(v || "[]");
      } catch {
        pC = [];
      }
      return interaction.update({
        components: _buildCargosPage(pC, 0),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && customId.startsWith("ia_cargos_page_")) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const pg = parseInt(customId.replace("ia_cargos_page_", "")) || 0;
      let pC = [];
      try {
        const v = iaDB.get("prompts_cargos");
        pC = Array.isArray(v) ? v : JSON.parse(v || "[]");
      } catch {
        pC = [];
      }
      return interaction.update({
        components: _buildCargosPage(pC, pg),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      customId.startsWith("ia_remover_prompt_cargo_")
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const idx = parseInt(customId.replace("ia_remover_prompt_cargo_", ""));
      let pC = [];
      try {
        const v = iaDB.get("prompts_cargos");
        pC = Array.isArray(v) ? v : JSON.parse(v || "[]");
      } catch {
        pC = [];
      }
      if (idx >= 0 && idx < pC.length) pC.splice(idx, 1);
      iaDB.set("prompts_cargos", JSON.stringify(pC));
      const newPg = Math.max(
        0,
        Math.floor(Math.min(idx, Math.max(0, pC.length - 1)) / 3),
      );
      return interaction.update({
        components: _buildCargosPage(pC, newPg),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && customId === "ia_adicionar_prompt_cargo") {
      const { LabelBuilder, RoleSelectMenuBuilder } = require("discord.js");
      const modal = new ModalBuilder()
        .setCustomId("modal_ia_adicionar_prompt_cargo")
        .setTitle("Nova Regra de Cargo");

      const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId("cargo_id")
        .setPlaceholder("Selecione o cargo da regra")
        .setRequired(true)
        .setMinValues(1)
        .setMaxValues(1);

      const roleLabel = new LabelBuilder()
        .setLabel("Cargo que a IA vai controlar")
        .setDescription("Selecione o cargo que sera adicionado ou removido")
        .setRoleSelectMenuComponent(roleSelect);

      const acaoInput = new TextInputBuilder()
        .setCustomId("acao")
        .setLabel("Acao (adicionar / remover / verificar)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("adicionar")
        .setValue("adicionar");

      const promptInput = new TextInputBuilder()
        .setCustomId("prompt")
        .setLabel("Quando aplicar? (descreva a situacao)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
        .setPlaceholder("Ex: quando o usuario disser que comprou o produto");

      const msgConfInput = new TextInputBuilder()
        .setCustomId("mensagem_confirmacao")
        .setLabel("Mensagem de confirmacao (opcional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(200)
        .setPlaceholder("Cargo {cargo} entregue para {user}!");

      modal
        .addLabelComponents(roleLabel)
        .addComponents(
          new ActionRowBuilder().addComponents(acaoInput),
          new ActionRowBuilder().addComponents(promptInput),
          new ActionRowBuilder().addComponents(msgConfInput),
        );

      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId === "modal_ia_adicionar_prompt_cargo"
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);

      let cargoId = null;
      try {
        cargoId = interaction.fields.getField("cargo_id")?.value || null;
      } catch {}
      if (!cargoId) {
        try {
          const rawField = interaction.fields.fields?.get("cargo_id");
          cargoId = rawField?.value || rawField?.values?.[0] || null;
        } catch {}
      }

      const acao = interaction.fields
        .getTextInputValue("acao")
        .trim()
        .toLowerCase();
      const prompt = interaction.fields.getTextInputValue("prompt").trim();
      const msgConf = (() => {
        try {
          return interaction.fields
            .getTextInputValue("mensagem_confirmacao")
            .trim();
        } catch {
          return "";
        }
      })();

      if (!cargoId)
        return interaction.reply({
          content: `${safeEmojiStr(emojis.danger)} Selecione um cargo.`,
          flags: MessageFlags.Ephemeral,
        });
      if (!["adicionar", "remover", "verificar"].includes(acao))
        return interaction.reply({
          content: `${safeEmojiStr(emojis.danger)} Acao invalida. Use: adicionar, remover ou verificar.`,
          flags: MessageFlags.Ephemeral,
        });

      const role = interaction.guild.roles.cache.get(cargoId);
      if (!role)
        return interaction.reply({
          content: `${safeEmojiStr(emojis.danger)} Cargo nao encontrado.`,
          flags: MessageFlags.Ephemeral,
        });

      let pC = [];
      try {
        const v = iaDB.get("prompts_cargos");
        pC = Array.isArray(v) ? v : JSON.parse(v || "[]");
      } catch {
        pC = [];
      }
      pC.push({
        cargo_id: cargoId,
        acao,
        prompt,
        mensagem_confirmacao: msgConf,
        contexto_ia: "",
        ativo: true,
      });
      iaDB.set("prompts_cargos", JSON.stringify(pC));

      return interaction.update({
        components: _buildCargosPage(pC, Math.floor((pC.length - 1) / 3)),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      (customId === "ia_ver_estatisticas" ||
        customId === "ia_ver_estatisticas_2" ||
        customId === "ia_ver_estatisticas_3")
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const e = emojis;

      const msgsRespondidas = iaDB.get("stats_msgs_respondidas") || 0;
      const ticketsEncerrados = iaDB.get("stats_tickets_encerrados_ia") || 0;
      const cargosAtribuidos = iaDB.get("stats_cargos_atribuidos") || 0;
      const boasVindasEnviadas = iaDB.get("stats_boas_vindas_enviadas") || 0;

      const voltarBtn = new ButtonBuilder()
        .setCustomId("ia_painel_page_1")
        .setLabel("Voltar")
        .setEmoji(safeEmoji(e.arrowl))
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "# " + safeEmojiStr(e.graph) + " Estatísticas da IA",
              ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                safeEmojiStr(e.send) +
                  " **Mensagens respondidas:** " +
                  msgsRespondidas +
                  "\n" +
                  safeEmojiStr(e.check) +
                  " **Tickets encerrados pela IA:** " +
                  ticketsEncerrados +
                  "\n" +
                  safeEmojiStr(e.role) +
                  " **Cargos atribuídos:** " +
                  cargosAtribuidos,
              ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(voltarBtn),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "ia_config_horario") {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const schedule = iaDB.get("schedule") || {};
      const segSexVal = schedule.monday
        ? `${schedule.monday.start}-${schedule.monday.end}`
        : "";
      const sabVal = schedule.saturday
        ? `${schedule.saturday.start}-${schedule.saturday.end}`
        : "";
      const domVal = schedule.sunday
        ? `${schedule.sunday.start}-${schedule.sunday.end}`
        : "";

      const modal = new ModalBuilder()
        .setCustomId("modal_ia_horario")
        .setTitle("Horário de Atendimento da IA");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("seg_sex")
            .setLabel("Seg-Sex (HH:MM-HH:MM)")
            .setStyle(TextInputStyle.Short)
            .setValue(segSexVal)
            .setRequired(false)
            .setPlaceholder("09:00-18:00"),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("sabado")
            .setLabel("Sábado (vazio = fechado)")
            .setStyle(TextInputStyle.Short)
            .setValue(sabVal)
            .setRequired(false)
            .setPlaceholder("09:00-14:00"),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("domingo")
            .setLabel("Domingo (vazio = fechado)")
            .setStyle(TextInputStyle.Short)
            .setValue(domVal)
            .setRequired(false)
            .setPlaceholder(""),
        ),
      );
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === "modal_ia_horario") {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      function parseRange2(val) {
        if (!val || !val.trim()) return null;
        const p = val.trim().split("-");
        if (p.length < 2) return null;
        const s = p[0].trim(),
          e = p[1].trim();
        if (!/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(e)) return null;
        return { start: s, end: e };
      }
      const segSex2 = parseRange2(
        interaction.fields.getTextInputValue("seg_sex"),
      );
      const sab2 = parseRange2(interaction.fields.getTextInputValue("sabado"));
      const dom2 = parseRange2(interaction.fields.getTextInputValue("domingo"));
      const schedule2 = {};
      if (segSex2)
        ["monday", "tuesday", "wednesday", "thursday", "friday"].forEach(
          (d) => {
            schedule2[d] = segSex2;
          },
        );
      if (sab2) schedule2.saturday = sab2;
      if (dom2) schedule2.sunday = dom2;
      iaDB.set("schedule", schedule2);
      return interaction.reply({
        content: "✅ Horários da IA atualizados!",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (customId === "ia_config_encerramento") {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const palavras = (iaDB.get("palavras_encerramento") || []).join(", ");
      const modal = new ModalBuilder()
        .setCustomId("modal_ia_palavras_encerramento")
        .setTitle("Palavras de Encerramento");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("palavras")
            .setLabel("Palavras-chave (separadas por vírgula)")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(palavras)
            .setRequired(true)
            .setPlaceholder("resolvido, obrigado, pode fechar, era isso")
            .setMaxLength(500),
        ),
      );
      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId === "modal_ia_palavras_encerramento"
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const raw = interaction.fields.getTextInputValue("palavras");
      const palavras = raw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      iaDB.set("palavras_encerramento", palavras);
      return interaction.reply({
        content: `✅ ${palavras.length} palavra(s) de encerramento salvas.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (customId === "ia_config_minutos_retomar") {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const minutos = iaDB.get("minutos_inatividade_staff") ?? 15;
      const modal = new ModalBuilder()
        .setCustomId("modal_ia_minutos_retomar")
        .setTitle("Minutos de Inatividade do Staff");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("minutos")
            .setLabel("Minutos sem resposta para retomar IA")
            .setStyle(TextInputStyle.Short)
            .setValue(String(minutos))
            .setRequired(true)
            .setPlaceholder("15")
            .setMaxLength(3),
        ),
      );
      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId === "modal_ia_minutos_retomar"
    ) {
      await initIAConfig(interaction.guildId);
      const iaDB = getIAConfigDB(interaction.guildId);
      const val =
        parseInt(interaction.fields.getTextInputValue("minutos")) || 15;
      iaDB.set("minutos_inatividade_staff", Math.max(1, Math.min(val, 480)));
      return interaction.reply({
        content: `✅ IA retomará após **${val} minuto(s)** de inatividade do staff.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};