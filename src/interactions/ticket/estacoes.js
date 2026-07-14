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

{
  const _bSetEmoji = ButtonBuilder.prototype.setEmoji;
  ButtonBuilder.prototype.setEmoji = function (emoji) {
    if (emoji === null || emoji === undefined) return this;
    return _bSetEmoji.call(this, emoji);
  };
}

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
  parseEmojisInText,
} = require("./helpers");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();
const { t } = require("../../utils/i18n");

function parseColor(colorString) {
  if (!colorString || colorString === "" || colorString === " ") return null;
  if (typeof colorString === "number") return colorString;
  const cleanColor = colorString.replace("#", "");
  const colorInt = parseInt(cleanColor, 16);
  return !isNaN(colorInt) ? colorInt : null;
}

function getButtonStyle(cor) {
  if (!cor) return ButtonStyle.Primary;
  const map = {
    PRIMARY: ButtonStyle.Primary,
    SECONDARY: ButtonStyle.Secondary,
    SUCCESS: ButtonStyle.Success,
    DANGER: ButtonStyle.Danger,
  };
  return map[cor.toUpperCase()] || ButtonStyle.Primary;
}

function parseEmoji(emojiString, guild) {
  if (!emojiString) return null;
  const match = emojiString.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (match) return { name: match[1], id: match[2] };
  if (/^\p{Emoji}/u.test(emojiString)) return { name: emojiString };
  return null;
}

const _origAddSection = ContainerBuilder.prototype.addSectionComponents;
ContainerBuilder.prototype.addSectionComponentsSafe = function (...items) {
  if (items && items.length > 0) this.addSectionComponents(...items);
  return this;
};

function setEmojiSafe(btn, raw) {
  const e = getEmoji(raw);
  if (e) btn.setEmoji(e);
  return btn;
}

function buildEditarEstacaoComponents(guildId, estacaoId, msgExtra) {
  const estacao = getEstacao(guildId, estacaoId);
  if (!estacao) return null;

  if (!estacao.embedprincipal) estacao.embedprincipal = {};
  if (!Array.isArray(estacao.embedprincipal.botoes))
    estacao.embedprincipal.botoes = [];
  if (!Array.isArray(estacao.embedprincipal.selects))
    estacao.embedprincipal.selects = [];

  const enviarMotivo = estacao.embedprincipal.enviar_motivo ?? false;
  const horarioStatus = estacao.horario_ativo ? t("est_horario_ativado", guildId) : t("est_horario_desativado", guildId);
  const limiteStatus = estacao.limite_tickets
    ? t("est_limite_tickets", guildId, { count: estacao.limite_tickets })
    : t("est_limite_sem_limite", guildId);
  const staffStatus =
    estacao.team && estacao.team.length > 0
      ? t("est_staff_cargos_count", guildId, { count: estacao.team.length })
      : t("est_staff_global", guildId);

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(t("est_config_titulo", guildId, { nome: estacao.nome })),
        new TextDisplayBuilder().setContent(
          msgExtra
            ? `${msgExtra}\n\n${t("est_config_desc", guildId)}`
            : t("est_config_desc", guildId),
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("est_config_botoes_secao", guildId, { count: estacao.embedprincipal.botoes.length }),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`botoes_estacao_${estacaoId}`)
              .setLabel(t("est_btn_botoes_label", guildId))
              .setEmoji(getEmoji(emojis.cube))
              .setStyle(ButtonStyle.Secondary),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("est_config_selects_secao", guildId, { count: estacao.embedprincipal.selects.length }),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`selects_estacao_${estacaoId}`)
              .setLabel(t("est_btn_selects_label", guildId))
              .setEmoji(getEmoji(emojis.cube))
              .setStyle(ButtonStyle.Secondary),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("est_config_motivo_secao", guildId, { status: enviarMotivo ? t("est_config_motivo_ativado", guildId) : t("est_config_motivo_desativado", guildId) }),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`toggle_motivo_estacao_${estacaoId}`)
              .setLabel(t("est_btn_motivo", guildId))
              .setEmoji(getEmoji(enviarMotivo ? emojis.on : emojis.off))
              .setStyle(
                enviarMotivo ? ButtonStyle.Success : ButtonStyle.Secondary,
              ),
          ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${emojis.settings || "⚙️"} **${t("est_config_avancado_label", guildId)}**\n` +
            `${emojis.calendario || "??"} Horário: **${horarioStatus}**  ·  ` +
            `${emojis.cube || "??"} Limite: **${limiteStatus}**  ·  ` +
            `${emojis.user || "??"} Staff: **${staffStatus}**`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`estacao_config_avancado_${estacaoId}`)
            .setLabel(t("est_btn_avancado", guildId))
            .setEmoji(getEmoji(emojis.settings))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`config_formulario_estacao_${estacaoId}`)
            .setLabel(t("est_btn_formulario", guildId))
            .setEmoji(getEmoji(emojis.file))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`personalizar_estacao_${estacaoId}`)
            .setLabel(t("est_btn_visual", guildId))
            .setEmoji(getEmoji(emojis.brush))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`renomear_estacao_${estacaoId}`)
            .setLabel(t("est_btn_renomear_label", guildId))
            .setEmoji(getEmoji(emojis.title))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`enviar_estacao_${estacaoId}`)
            .setLabel(t("est_btn_enviar_painel", guildId))
            .setEmoji(getEmoji(emojis.embeds))
            .setStyle(ButtonStyle.Success),
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`stats_estacao_${estacaoId}`)
            .setLabel(t("est_btn_estatisticas", guildId))
            .setEmoji(getEmoji(emojis.graph))
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`excluir_estacao_${estacaoId}`)
            .setLabel(t("est_btn_excluir_label", guildId))
            .setEmoji(getEmoji(emojis.lixeira))
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("gerenciar_estacoes")
            .setLabel(t("btn_voltar", guildId))
            .setEmoji(getEmoji(emojis.arrowl))
            .setStyle(ButtonStyle.Secondary),
        ),
      ),
  ];
}

function buildAvancadoEstacaoComponents(guildId, estacaoId) {
  const estacao = getEstacao(guildId, estacaoId);
  if (!estacao) return null;

  const horarioAtivo = estacao.horario_ativo ?? false;
  const limite = estacao.limite_tickets ?? 0;
  const teamRoles = estacao.team || [];
  const schedule = estacao.schedule || {};
  const diasSemana = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const diasNomes = [t("est_horarios_seg", guildId), t("est_horarios_ter", guildId), t("est_horarios_qua", guildId), t("est_horarios_qui", guildId), t("est_horarios_sex", guildId), t("est_horarios_sab", guildId), t("est_horarios_dom", guildId)];
  const horarioTexto =
    horarioAtivo && Object.keys(schedule).length > 0
      ? diasSemana
          .map((d, i) => {
            const s = schedule[d];
            if (!s || !s.start || !s.end) return null;
            return `${diasNomes[i]}: ${s.start}–${s.end}`;
          })
          .filter(Boolean)
          .join(" | ") || t("est_horarios_nenhum", guildId)
      : t("est_horarios_nao_configurado", guildId);
  const staffTexto =
    teamRoles.length > 0
      ? teamRoles.map((r) => `<@&${r}>`).join(", ")
      : t("est_horarios_usando_global", guildId);

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(t("est_avancado_titulo", guildId, { nome: estacao.nome })),
        new TextDisplayBuilder().setContent(
          t("est_avancado_desc", guildId),
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("est_avancado_horario_secao", guildId, {
                status: horarioAtivo ? t("est_avancado_horario_ativo", guildId) : t("est_avancado_horario_inativo", guildId),
                detalhe: horarioAtivo ? t("est_avancado_horario_detalhe", guildId, { horarios: horarioTexto }) : t("est_avancado_horario_ativar_desc", guildId)
              }),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`estacao_toggle_horario_${estacaoId}`)
              .setLabel(t("est_avancado_btn_horario", guildId, { status: horarioAtivo ? "ON" : "OFF" }))
              .setEmoji(getEmoji(horarioAtivo ? emojis.on : emojis.off))
              .setStyle(
                horarioAtivo ? ButtonStyle.Success : ButtonStyle.Secondary,
              ),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("est_avancado_config_horario_secao", guildId),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`estacao_config_horario_${estacaoId}`)
              .setLabel(t("est_avancado_btn_editar_horarios", guildId))
              .setEmoji(getEmoji(emojis.calendario))
              .setStyle(ButtonStyle.Secondary),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("est_avancado_mensagem_secao", guildId, {
                mensagem: estacao.mensagem_fora_horario || t("est_avancado_mensagem_padrao", guildId)
              }),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`modal_estacao_msg_fora_horario_${estacaoId}`)
              .setLabel(t("est_avancado_btn_editar_mensagem", guildId))
              .setEmoji(getEmoji(emojis.message))
              .setStyle(ButtonStyle.Secondary),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("est_avancado_limite_secao", guildId, {
                limite: limite > 0 ? t("est_limite_tickets", guildId, { count: limite }) : t("est_avancado_limite_sem_limite", guildId)
              }),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`modal_estacao_limite_${estacaoId}`)
              .setLabel(t("est_avancado_btn_limite", guildId))
              .setEmoji(getEmoji(emojis.cube))
              .setStyle(ButtonStyle.Secondary),
          ),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("est_avancado_staff_secao", guildId, { staff: staffTexto }),
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`estacao_config_staff_${estacaoId}`)
              .setLabel(t("est_avancado_btn_staff", guildId))
              .setEmoji(getEmoji(emojis.user))
              .setStyle(ButtonStyle.Secondary),
          ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`editar_estacao_${estacaoId}`)
            .setLabel(t("btn_voltar", guildId))
            .setEmoji(getEmoji(emojis.arrowl))
            .setStyle(ButtonStyle.Secondary),
        ),
      ),
  ];
}

module.exports = {
  customIds: [
    "gerenciar_estacoes",
    "estacoes_pagina_",
    "criar_estacao",
    "modal_criar_estacao",
    "editar_estacao_",
    "personalizar_estacao_",
    "botoes_estacao_",
    "botao_adicionar_estacao_",
    "config_botao_estacao_",
    "cancelar_config_botao_estacao_",
    "botao_remover_estacao_",
    "remover_botao_estacao_select_",
    "botao_editar_estacao_",
    "editar_botao_estacao_select_",
    "selects_estacao_",
    "config_select_estacao_",
    "cancelar_config_select_estacao_",
    "select_remover_estacao_",
    "remover_select_estacao_select_",
    "select_editar_estacao_",
    "editar_select_estacao_select_",
    "renomear_estacao_",
    "modal_renomear_estacao_",
    "excluir_estacao_",
    "modal_confirmar_excluir_estacao_",
    "botoes_pagina_",
    "editar_botao_paginado_",
    "toggle_motivo_estacao_",
    "salvar_embed_estacao:",
    "modal_config_botao_estacao_",
    "modal_config_select_estacao_",
    "enviar_estacao_tipo_",
    "enviar_estacao_canal",
    "enviar_estacao_",
    "editar_embed_estacao:",
    "select_config_botao_estacao_categoria_",
    "select_adicionar_estacao_",
    "select_config_select_estacao_categoria_",
    "estacao_config_avancado_",
    "estacao_avancado_horario_",
    "estacao_avancado_limite_",
    "estacao_avancado_staff_",
    "estacao_toggle_horario_",
    "estacao_config_horario_",
    "estacao_config_limite_",
    "estacao_config_staff_",
    "modal_estacao_limite_",
    "modal_estacao_horario_",
    "modal_estacao_msg_fora_horario_",
    "estacao_staff_role_",
    "estacao_staff_user_",
    "estacao_staff_clear_",
    "submit_estacao_limite_",
    "submit_estacao_msg_fora_",
    "estacao_staff_role_select_",
  ],
  async execute(client, interaction) {
    const { customId } = interaction;

    const belongsToThis = module.exports.customIds.some(
      (id) => customId && (customId === id || customId.startsWith(id)),
    );
    if (!belongsToThis) return;

    if (!interaction._fromPainel) return;

    if (!customId) return;

    if (customId === "gerenciar_estacoes") {
      const db = getEstacoesDB(interaction.guildId);
      const estacoes = (() => {
        const _r = db.get("estacoes");
        if (Array.isArray(_r)) return _r;
        try {
          return JSON.parse(_r || "[]");
        } catch {
          return [];
        }
      })();

      const btnCriar = new ButtonBuilder()
        .setCustomId("criar_estacao")
        .setLabel(t("est_btn_criar_estacao", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Success);

      const btnVoltar = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const ESTACOES_POR_PAGINA = 5;
      const paginaAtual = 0;
      const totalPaginas = Math.ceil(estacoes.length / ESTACOES_POR_PAGINA);
      const inicio = paginaAtual * ESTACOES_POR_PAGINA;
      const fim = inicio + ESTACOES_POR_PAGINA;
      const estacoesExibidas = estacoes.slice(inicio, fim);

      const sections = estacoesExibidas.map((estacao) =>
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${estacao.nome}**\n${t("est_item_info", interaction.guildId, { botoes: estacao.embedprincipal.botoes?.length || 0, selects: estacao.embedprincipal.selects?.length || 0 })}`,
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`editar_estacao_${estacao.id}`)
              .setLabel(t("btn_editar", interaction.guildId))
              .setEmoji(getEmoji(emojis.title))
              .setStyle(ButtonStyle.Secondary),
          ),
      );

      const btnAnterior = new ButtonBuilder()
        .setCustomId(`estacoes_pagina_${paginaAtual - 1}`)
        .setLabel(t("btn_anterior", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(paginaAtual === 0);

      const btnProximo = new ButtonBuilder()
        .setCustomId(`estacoes_pagina_${paginaAtual + 1}`)
        .setLabel(t("btn_proximo", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowr))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(paginaAtual >= totalPaginas - 1);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_gerenciar_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(
              t("est_gerenciar_desc", interaction.guildId, { count: estacoes.length }),
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addSectionComponentsSafe(...sections)
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAnterior, btnProximo),
            new ActionRowBuilder().addComponents(btnCriar, btnVoltar),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && customId.startsWith("estacoes_pagina_")) {
      const pagina = parseInt(customId.split("_").pop());
      const db = getEstacoesDB(interaction.guildId);
      const estacoes = (() => {
        const _r = db.get("estacoes");
        if (Array.isArray(_r)) return _r;
        try {
          return JSON.parse(_r || "[]");
        } catch {
          return [];
        }
      })();

      const ESTACOES_POR_PAGINA = 5;
      const totalPaginas = Math.ceil(estacoes.length / ESTACOES_POR_PAGINA);
      const inicio = pagina * ESTACOES_POR_PAGINA;
      const fim = inicio + ESTACOES_POR_PAGINA;
      const estacoesExibidas = estacoes.slice(inicio, fim);

      const sections = estacoesExibidas.map((estacao) =>
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${estacao.nome}**\n${t("est_item_info", interaction.guildId, { botoes: estacao.embedprincipal.botoes?.length || 0, selects: estacao.embedprincipal.selects?.length || 0 })}`,
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`editar_estacao_${estacao.id}`)
              .setLabel(t("btn_editar", interaction.guildId))
              .setEmoji(getEmoji(emojis.title))
              .setStyle(ButtonStyle.Secondary),
          ),
      );

      const btnCriar = new ButtonBuilder()
        .setCustomId("criar_estacao")
        .setLabel(t("est_btn_criar_estacao", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Success);

      const btnVoltar = new ButtonBuilder()
        .setCustomId("voltar_inicio")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const btnAnterior = new ButtonBuilder()
        .setCustomId(`estacoes_pagina_${pagina - 1}`)
        .setLabel(t("btn_anterior", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina === 0);

      const btnProximo = new ButtonBuilder()
        .setCustomId(`estacoes_pagina_${pagina + 1}`)
        .setLabel(t("btn_proximo", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowr))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina >= totalPaginas - 1);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_gerenciar_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(
              t("est_gerenciar_desc_paginado", interaction.guildId, { count: estacoes.length, pagina: pagina + 1, total: totalPaginas }),
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addSectionComponentsSafe(...sections)
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAnterior, btnProximo),
            new ActionRowBuilder().addComponents(btnCriar, btnVoltar),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "criar_estacao") {
      const modal = new ModalBuilder()
        .setCustomId("modal_criar_estacao")
        .setTitle(t("est_modal_criar_titulo", interaction.guildId));

      const inputNome = new TextInputBuilder()
        .setCustomId("nome_estacao")
        .setLabel(t("est_modal_criar_label", interaction.guildId))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50)
        .setPlaceholder(t("est_modal_criar_placeholder", interaction.guildId));

      modal.addComponents(new ActionRowBuilder().addComponents(inputNome));

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === "modal_criar_estacao") {
      const nomeEstacao = interaction.fields.getTextInputValue("nome_estacao");
      const novaEstacao = criarEstacao(interaction.guildId, nomeEstacao);

      const db = getEstacoesDB(interaction.guildId);
      const estacoes = (() => {
        const _r = db.get("estacoes");
        if (Array.isArray(_r)) return _r;
        try {
          return JSON.parse(_r || "[]");
        } catch {
          return [];
        }
      })();

      const ESTACOES_POR_PAGINA = 5;
      const totalPaginas = Math.ceil(estacoes.length / ESTACOES_POR_PAGINA);
      const ultimaPagina = Math.max(0, totalPaginas - 1);
      const inicio = ultimaPagina * ESTACOES_POR_PAGINA;
      const fim = inicio + ESTACOES_POR_PAGINA;
      const estacoesExibidas = estacoes.slice(inicio, fim);

      const sections = estacoesExibidas.map((estacao) =>
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${estacao.nome}**\n${t("est_item_info", interaction.guildId, { botoes: estacao.embedprincipal.botoes?.length || 0, selects: estacao.embedprincipal.selects?.length || 0 })}`,
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`editar_estacao_${estacao.id}`)
              .setLabel(t("btn_editar", interaction.guildId))
              .setEmoji(getEmoji(emojis.title))
              .setStyle(ButtonStyle.Secondary),
          ),
      );

      const btnCriar = new ButtonBuilder()
        .setCustomId("criar_estacao")
        .setLabel(t("est_btn_criar_estacao", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Success);

      const btnVoltar = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const btnAnterior = new ButtonBuilder()
        .setCustomId(`estacoes_pagina_${ultimaPagina - 1}`)
        .setLabel(t("btn_anterior", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(ultimaPagina === 0);

      const btnProximo = new ButtonBuilder()
        .setCustomId(`estacoes_pagina_${ultimaPagina + 1}`)
        .setLabel(t("btn_proximo", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowr))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(ultimaPagina >= totalPaginas - 1);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_gerenciar_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(
              t("est_criada_sucesso", interaction.guildId, { nome: nomeEstacao, count: estacoes.length, pagina: ultimaPagina + 1, total: totalPaginas || 1 }),
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addSectionComponentsSafe(...sections)
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAnterior, btnProximo),
            new ActionRowBuilder().addComponents(btnCriar, btnVoltar),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("editar_estacao_")) {
      const estacaoId = customId.replace("editar_estacao_", "");
      const comps = buildEditarEstacaoComponents(
        interaction.guildId,
        estacaoId,
      );
      if (!comps)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });
      return interaction.update({
        components: comps,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      customId.startsWith("estacao_avancado_horario_") ||
      customId.startsWith("estacao_avancado_limite_") ||
      customId.startsWith("estacao_avancado_staff_")
    ) {
      const estacaoId = customId.replace(
        /^estacao_avancado_(horario|limite|staff)_/,
        "",
      );
      const comps = buildAvancadoEstacaoComponents(
        interaction.guildId,
        estacaoId,
      );
      if (!comps)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });
      return interaction.update({
        components: comps,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("estacao_config_avancado_")) {
      const estacaoId = customId.replace("estacao_config_avancado_", "");
      const comps = buildAvancadoEstacaoComponents(
        interaction.guildId,
        estacaoId,
      );
      if (!comps)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });
      return interaction.update({
        components: comps,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("estacao_toggle_horario_")) {
      const estacaoId = customId.replace("estacao_toggle_horario_", "");
      const db = getEstacoesDB(interaction.guildId);
      const estacoes = (() => {
        const _r = db.get("estacoes");
        if (Array.isArray(_r)) return _r;
        try {
          return JSON.parse(_r || "[]");
        } catch {
          return [];
        }
      })();
      const idx = estacoes.findIndex((e) => e.id === estacaoId);
      if (idx === -1)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });
      estacoes[idx].horario_ativo = !(estacoes[idx].horario_ativo ?? false);
      db.set("estacoes", JSON.stringify(estacoes));
      const comps = buildAvancadoEstacaoComponents(
        interaction.guildId,
        estacaoId,
      );
      if (!comps)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });
      return interaction.update({
        components: comps,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("estacao_config_horario_")) {
      const estacaoId = customId.replace("estacao_config_horario_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);
      if (!estacao)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });

      const schedule = estacao.schedule || {};
      const modal = new ModalBuilder()
        .setCustomId(`modal_estacao_horario_${estacaoId}`)
        .setTitle(`Horários: ${estacao.nome.substring(0, 30)}`);

      const diasInputs = [
        {
          id: "seg_sex",
          label: "Seg-Sex (HH:MM-HH:MM)",
          value: schedule.monday
            ? `${schedule.monday.start}-${schedule.monday.end}`
            : "",
        },
        {
          id: "sabado",
          label: "Sábado (HH:MM-HH:MM ou vazio)",
          value: schedule.saturday
            ? `${schedule.saturday.start}-${schedule.saturday.end}`
            : "",
        },
        {
          id: "domingo",
          label: "Domingo (HH:MM-HH:MM ou vazio)",
          value: schedule.sunday
            ? `${schedule.sunday.start}-${schedule.sunday.end}`
            : "",
        },
      ];

      for (const inp of diasInputs) {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(inp.id)
              .setLabel(inp.label)
              .setStyle(TextInputStyle.Short)
              .setValue(inp.value)
              .setRequired(false)
              .setPlaceholder("Ex: 09:00-18:00"),
          ),
        );
      }

      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("modal_estacao_horario_")
    ) {
      const estacaoId = customId.replace("modal_estacao_horario_", "");
      const db = getEstacoesDB(interaction.guildId);
      const estacoes = (() => {
        const _r = db.get("estacoes");
        if (Array.isArray(_r)) return _r;
        try {
          return JSON.parse(_r || "[]");
        } catch {
          return [];
        }
      })();
      const idx = estacoes.findIndex((e) => e.id === estacaoId);
      if (idx === -1)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });

      function parseRange(val) {
        if (!val || !val.trim()) return null;
        const parts = val.trim().split("-");
        if (parts.length < 2) return null;
        const start = parts[0].trim();
        const end = parts[1].trim();
        if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end))
          return null;
        return { start, end };
      }

      const segSex = parseRange(
        interaction.fields.getTextInputValue("seg_sex"),
      );
      const sabado = parseRange(interaction.fields.getTextInputValue("sabado"));
      const domingo = parseRange(
        interaction.fields.getTextInputValue("domingo"),
      );

      const schedule = {};
      if (segSex) {
        ["monday", "tuesday", "wednesday", "thursday", "friday"].forEach(
          (d) => {
            schedule[d] = segSex;
          },
        );
      }
      if (sabado) schedule.saturday = sabado;
      if (domingo) schedule.sunday = domingo;

      estacoes[idx].schedule = schedule;
      db.set("estacoes", JSON.stringify(estacoes));

      await interaction.reply({
        content: `✅ Horários da estação **${estacoes[idx].nome}** atualizados com sucesso!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      customId.startsWith("modal_estacao_msg_fora_horario_") &&
      !interaction.isModalSubmit()
    ) {
      const estacaoId = customId.replace("modal_estacao_msg_fora_horario_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);
      if (!estacao)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });

      const modal = new ModalBuilder()
        .setCustomId(`submit_estacao_msg_fora_${estacaoId}`)
        .setTitle("Mensagem Fora do Horário");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("mensagem")
            .setLabel("Mensagem exibida fora do horário")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(estacao.mensagem_fora_horario || "")
            .setRequired(false)
            .setPlaceholder(
              "Ex: Nosso suporte está fechado agora. Horário: 9h-18h",
            )
            .setMaxLength(500),
        ),
      );

      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("submit_estacao_msg_fora_")
    ) {
      const estacaoId = customId.replace("submit_estacao_msg_fora_", "");
      const db = getEstacoesDB(interaction.guildId);
      const estacoes = (() => {
        const _r = db.get("estacoes");
        if (Array.isArray(_r)) return _r;
        try {
          return JSON.parse(_r || "[]");
        } catch {
          return [];
        }
      })();
      const idx = estacoes.findIndex((e) => e.id === estacaoId);
      if (idx === -1)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });

      estacoes[idx].mensagem_fora_horario =
        interaction.fields.getTextInputValue("mensagem") || "";
      db.set("estacoes", JSON.stringify(estacoes));

      const _compsMsg = buildAvancadoEstacaoComponents(
        interaction.guildId,
        estacaoId,
      );
      if (_compsMsg)
        return interaction.update({
          components: _compsMsg,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      return interaction.reply({
        content: "✅ Mensagem atualizada.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (
      customId.startsWith("modal_estacao_limite_") &&
      !interaction.isModalSubmit()
    ) {
      const estacaoId = customId.replace("modal_estacao_limite_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);
      if (!estacao)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });

      const modal = new ModalBuilder()
        .setCustomId(`submit_estacao_limite_${estacaoId}`)
        .setTitle("Limite de Tickets por Estação");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("limite")
            .setLabel("Limite (0 = sem limite)")
            .setStyle(TextInputStyle.Short)
            .setValue(String(estacao.limite_tickets ?? 0))
            .setRequired(true)
            .setPlaceholder("Ex: 1")
            .setMaxLength(3),
        ),
      );

      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("submit_estacao_limite_")
    ) {
      const estacaoId = customId.replace("submit_estacao_limite_", "");
      const db = getEstacoesDB(interaction.guildId);
      const estacoes = (() => {
        const _r = db.get("estacoes");
        if (Array.isArray(_r)) return _r;
        try {
          return JSON.parse(_r || "[]");
        } catch {
          return [];
        }
      })();
      const idx = estacoes.findIndex((e) => e.id === estacaoId);
      if (idx === -1)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });

      const val = parseInt(interaction.fields.getTextInputValue("limite")) || 0;
      estacoes[idx].limite_tickets = Math.max(0, val);
      db.set("estacoes", JSON.stringify(estacoes));

      const _compsLim = buildAvancadoEstacaoComponents(
        interaction.guildId,
        estacaoId,
      );
      if (_compsLim)
        return interaction.update({
          components: _compsLim,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      return interaction.reply({
        content: "✅ Limite atualizado.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (customId.startsWith("estacao_config_staff_")) {
      const estacaoId = customId.replace("estacao_config_staff_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);
      if (!estacao)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });

      const teamAtual = estacao.team || [];

      const btnAddRole = new ButtonBuilder()
        .setCustomId(`estacao_staff_role_${estacaoId}`)
        .setLabel("Adicionar Cargo")
        .setEmoji(getEmoji(emojis.invite))
        .setStyle(ButtonStyle.Success);

      const btnClear = new ButtonBuilder()
        .setCustomId(`estacao_staff_clear_${estacaoId}`)
        .setLabel("Limpar (usar global)")
        .setEmoji(getEmoji(emojis.lixeira))
        .setStyle(ButtonStyle.Danger);

      const btnVoltar3 = new ButtonBuilder()
        .setCustomId(`estacao_config_avancado_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const staffTexto3 =
        teamAtual.length > 0
          ? teamAtual.map((r) => `<@&${r}>`).join("\n")
          : "*(Nenhum — usando staff global)*";

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.users || "👥"} # Staff Exclusivo: ${estacao.nome}`,
              ),
              new TextDisplayBuilder().setContent(
                `${emojis.info || "ℹ️"} Cargos configurados sobrepõem o staff global para esta estação.\n${emojis.role || "🎭"} **Cargos atuais:**\n${staffTexto3}`,
              ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                  .setCustomId(`estacao_staff_role_select_${estacaoId}`)
                  .setPlaceholder("Selecione cargos para adicionar")
                  .setMinValues(1)
                  .setMaxValues(10),
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(btnClear, btnVoltar3),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isRoleSelectMenu?.() &&
      customId.startsWith("estacao_staff_role_select_")
    ) {
      const estacaoId = customId.replace("estacao_staff_role_select_", "");
      const db = getEstacoesDB(interaction.guildId);
      const estacoes = (() => {
        const _r = db.get("estacoes");
        if (Array.isArray(_r)) return _r;
        try {
          return JSON.parse(_r || "[]");
        } catch {
          return [];
        }
      })();
      const idx = estacoes.findIndex((e) => e.id === estacaoId);
      if (idx === -1)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });

      const existing = estacoes[idx].team || [];
      const novos = interaction.values.filter((id) => !existing.includes(id));
      estacoes[idx].team = [...existing, ...novos];
      db.set("estacoes", JSON.stringify(estacoes));

      const est2 = getEstacao(interaction.guildId, estacaoId);
      const teamAtual2 = est2?.team || [];
      const staffTexto4 =
        teamAtual2.length > 0
          ? teamAtual2.map((r) => `<@&${r}>`).join("\n")
          : "*(Nenhum — usando staff global)*";
      return interaction
        .update({
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${emojis.users || "👥"} # Staff Exclusivo: ${est2?.nome || estacaoId}`,
                ),
                new TextDisplayBuilder().setContent(
                  `${emojis.check || "✅"} Cargos atualizados!\n${emojis.role || "🎭"} **Cargos atuais:**\n${staffTexto4}`,
                ),
              )
              .addSeparatorComponents(new SeparatorBuilder())
              .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                  new RoleSelectMenuBuilder()
                    .setCustomId(`estacao_staff_role_select_${estacaoId}`)
                    .setPlaceholder("Selecione cargos para adicionar")
                    .setMinValues(1)
                    .setMaxValues(10),
                ),
              )
              .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId(`estacao_staff_clear_${estacaoId}`)
                    .setLabel("Limpar (usar global)")
                    .setEmoji(getEmoji(emojis.lixeira))
                    .setStyle(ButtonStyle.Danger),
                  new ButtonBuilder()
                    .setCustomId(`estacao_config_avancado_${estacaoId}`)
                    .setLabel(t("btn_voltar", interaction.guildId))
                    .setEmoji(getEmoji(emojis.arrowl))
                    .setStyle(ButtonStyle.Secondary),
                ),
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        })
        .catch(() => {});
    }

    if (customId.startsWith("estacao_staff_clear_")) {
      const estacaoId = customId.replace("estacao_staff_clear_", "");
      const db = getEstacoesDB(interaction.guildId);
      const estacoes = (() => {
        const _r = db.get("estacoes");
        if (Array.isArray(_r)) return _r;
        try {
          return JSON.parse(_r || "[]");
        } catch {
          return [];
        }
      })();
      const idx = estacoes.findIndex((e) => e.id === estacaoId);
      if (idx === -1)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });

      estacoes[idx].team = [];
      estacoes[idx].usersperms = {};
      db.set("estacoes", JSON.stringify(estacoes));

      const _compsStaffClear = buildAvancadoEstacaoComponents(
        interaction.guildId,
        estacaoId,
      );
      if (_compsStaffClear)
        return interaction.update({
          components: _compsStaffClear,
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
          content: null,
        });
      return interaction.reply({
        content: "✅ Staff removido.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (customId.startsWith("personalizar_estacao_")) {
      const estacaoId = customId.replace("personalizar_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const data = estacao.embedprincipal;

      const previewTexts = [
        new TextDisplayBuilder().setContent(data.title || t("est_visual_sem_titulo", interaction.guildId)),
        new TextDisplayBuilder().setContent(data.descricao || t("est_visual_sem_descricao", interaction.guildId)),
      ];

      previewTexts.push(
        new TextDisplayBuilder().setContent(
          t("est_visual_cor", interaction.guildId, { cor: data.color || t("est_visual_sem_cor", interaction.guildId) }),
        ),
      );

      const editarMenuOptions = [
        { label: t("est_visual_opt_titulo", interaction.guildId), value: "titulo", emoji: getEmoji(emojis.title) },
        {
          label: t("est_visual_opt_descricao", interaction.guildId),
          value: "descricao",
          emoji: getEmoji(emojis.embeds),
        },
        { label: t("est_visual_opt_cor", interaction.guildId), value: "cor", emoji: getEmoji(emojis.colorpicker) },
        { label: t("est_visual_opt_banner", interaction.guildId), value: "banner", emoji: getEmoji(emojis.image) },
      ];

      const editarMenu = new StringSelectMenuBuilder()
        .setCustomId(`editar_embed_estacao:${estacaoId}`)
        .setPlaceholder(t("est_visual_select_placeholder", interaction.guildId))
        .addOptions(editarMenuOptions);

      const voltarButton = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const container = new ContainerBuilder();

      const accentColor = parseColor(data.color);
      if (accentColor !== null) {
        container.setAccentColor(accentColor);
      }

      container.addTextDisplayComponents(...previewTexts);

      if (
        data.banner &&
        typeof data.banner === "string" &&
        data.banner.startsWith("http")
      ) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(data.banner),
          ),
        );
      }

      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(editarMenu),
        new ActionRowBuilder().addComponents(voltarButton),
      );

      return interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("botoes_estacao_")) {
      const estacaoId = customId.replace("botoes_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const _botoesRaw = estacao.embedprincipal.botoes || [];
      const _botoesLimpos = _botoesRaw.filter((b) => !b.temp);
      if (_botoesRaw.length !== _botoesLimpos.length) {
        estacao.embedprincipal.botoes = _botoesLimpos;
        updateEstacao(interaction.guildId, estacaoId, estacao);
      }

      const adicionar = new ButtonBuilder()
        .setCustomId(`botao_adicionar_estacao_${estacaoId}`)
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(_botoesLimpos.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId(`botao_remover_estacao_${estacaoId}`)
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId(`botao_editar_estacao_${estacaoId}`)
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(
        adicionar,
        remover,
        editar,
        voltar,
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Configuração de Botões - ${estacao.nome}`,
            ),
            new TextDisplayBuilder().setContent(
              `Total de botões: **${
                estacao.embedprincipal.botoes?.length || 0
              }**\n\nEscolha uma das ações abaixo.`,
            ),
          )
          .addActionRowComponents(row),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId.startsWith("botao_adicionar_estacao_")) {
      const estacaoId = customId.replace("botao_adicionar_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      let botoesExistentes = estacao.embedprincipal.botoes || [];

      botoesExistentes = botoesExistentes.filter((b) => !b.temp);
      estacao.embedprincipal.botoes = botoesExistentes;
      updateEstacao(interaction.guildId, estacaoId, estacao);

      if (botoesExistentes.length >= 5) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Você já atingiu o limite máximo de 5 botões.",
            ),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const novoId = Date.now().toString();
      const botaoTemp = {
        id: novoId,
        nome: "",
        categoria: "",
        emoji: null,
        inicio: "",
        cor: "Primary",
        temp: true,
      };

      botoesExistentes.push(botaoTemp);
      estacao.embedprincipal.botoes = botoesExistentes;
      updateEstacao(interaction.guildId, estacaoId, estacao);

      const components = criarPainelConfiguracaoBotaoEstacao(
        novoId,
        estacaoId,
        estacao,
      );
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isButton() &&
      customId.startsWith("config_botao_estacao_")
    ) {
      const parts = customId.split("_");
      const campo = parts[3];
      const estacaoId = parts[4];
      const botaoId = parts[5];

      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (campo === "nome") {
        const modal = new ModalBuilder()
          .setCustomId(
            `modal_config_botao_estacao_nome_${estacaoId}_${botaoId}`,
          )
          .setTitle("Nome do Botão");

        const input = new TextInputBuilder()
          .setCustomId("nome")
          .setLabel("Digite o nome do botão")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "categoria") {
        const selectCategoria = new ChannelSelectMenuBuilder()
          .setCustomId(
            `select_config_botao_estacao_categoria_${estacaoId}_${botaoId}`,
          )
          .setPlaceholder("Selecione uma ou mais categorias")
          .setMinValues(1)
          .setMaxValues(5)
          .addChannelTypes(ChannelType.GuildCategory);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("Selecione as Categorias"),
              new TextDisplayBuilder().setContent(
                "Escolha as categorias onde os tickets serão criados.",
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(selectCategoria),
            ),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (campo === "emoji") {
        const modal = new ModalBuilder()
          .setCustomId(
            `modal_config_botao_estacao_emoji_${estacaoId}_${botaoId}`,
          )
          .setTitle("Emoji do Botão");

        const input = new TextInputBuilder()
          .setCustomId("emoji")
          .setLabel("Utilize emojis padrões ou do discord.")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "inicio") {
        const modal = new ModalBuilder()
          .setCustomId(
            `modal_config_botao_estacao_inicio_${estacaoId}_${botaoId}`,
          )
          .setTitle("Tag Inicial do Ticket");

        const input = new TextInputBuilder()
          .setCustomId("inicio")
          .setLabel("Digite a tag inicial (máx 5 caracteres)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(5)
          .setPlaceholder("Ex: sup-");

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "cor") {
        const cor = parts[6];
        const botoes = estacao.embedprincipal.botoes || [];
        const index = botoes.findIndex((b) => b.id === botaoId);

        if (index !== -1) {
          botoes[index].cor = cor;
          estacao.embedprincipal.botoes = botoes;
          updateEstacao(interaction.guildId, estacaoId, estacao);
        }

        const components = criarPainelConfiguracaoBotaoEstacao(
          botaoId,
          estacaoId,
          estacao,
        );
        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (campo === "salvar") {
        const botoes = estacao.embedprincipal.botoes || [];
        const botao = botoes.find((b) => b.id === botaoId);

        if (!botao || !botao.nome || !botao.categoria) {
          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "Preencha pelo menos o nome e a categoria antes de salvar.",
              ),
            ),
          ];
          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }

        const index = botoes.findIndex((b) => b.id === botaoId);
        if (index !== -1) {
          delete botoes[index].temp;
          estacao.embedprincipal.botoes = botoes;
          updateEstacao(interaction.guildId, estacaoId, estacao);
        }

        const adicionar = new ButtonBuilder()
          .setCustomId(`botao_adicionar_estacao_${estacaoId}`)
          .setLabel(t("btn_adicionar", interaction.guildId))
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled((estacao.embedprincipal.botoes || []).length >= 5);

        const remover = new ButtonBuilder()
          .setCustomId(`botao_remover_estacao_${estacaoId}`)
          .setLabel(t("btn_remover", interaction.guildId))
          .setEmoji(getEmoji(emojis.minus))
          .setStyle(ButtonStyle.Secondary);

        const editar = new ButtonBuilder()
          .setCustomId(`botao_editar_estacao_${estacaoId}`)
          .setLabel(t("btn_editar", interaction.guildId))
          .setEmoji(getEmoji(emojis.title))
          .setStyle(ButtonStyle.Secondary);

        const voltar = new ButtonBuilder()
          .setCustomId(`editar_estacao_${estacaoId}`)
          .setLabel(t("btn_voltar", interaction.guildId))
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `Configuração de Botões - ${estacao.nome}`,
              ),
              new TextDisplayBuilder().setContent(
                `Botão **${botao.nome}** salvo com sucesso!`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                adicionar,
                remover,
                editar,
                voltar,
              ),
            ),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (
      interaction.isButton() &&
      customId.startsWith("cancelar_config_botao_estacao_")
    ) {
      const parts = customId.split("_");
      const estacaoId = parts[4];
      const botaoId = parts[5];

      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const botoes = estacao.embedprincipal.botoes || [];

      const index = botoes.findIndex((b) => b.id === botaoId);
      if (index !== -1 && botoes[index].temp === true) {
        botoes.splice(index, 1);
        estacao.embedprincipal.botoes = botoes;
        updateEstacao(interaction.guildId, estacaoId, estacao);
      }

      const adicionar = new ButtonBuilder()
        .setCustomId(`botao_adicionar_estacao_${estacaoId}`)
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId(`botao_remover_estacao_${estacaoId}`)
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId(`botao_editar_estacao_${estacaoId}`)
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Configuração de Botões - ${estacao.nome}`,
            ),
            new TextDisplayBuilder().setContent(
              "Escolha uma das ações abaixo.",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              adicionar,
              remover,
              editar,
              voltar,
            ),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId.startsWith("botao_remover_estacao_")) {
      const estacaoId = customId.replace("botao_remover_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const botoes = estacao.embedprincipal.botoes || [];

      if (botoes.length === 0) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Nenhum botão encontrado para remover.",
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`remover_botao_estacao_select_${estacaoId}`)
        .setPlaceholder("Selecione o botão que deseja remover")
        .addOptions(
          botoes.map((botao) => ({
            label: botao.nome || "Sem nome",
            value: botao.id,
            description: `ID: ${botao.id}`,
            emoji: botao.emoji || undefined,
          })),
        );

      const voltar = new ButtonBuilder()
        .setCustomId(`botoes_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
      const rowVoltar = new ActionRowBuilder().addComponents(voltar);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Selecione o botão que deseja remover:",
            ),
          )
          .addActionRowComponents(rowSelect, rowVoltar),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      customId.startsWith("remover_botao_estacao_select_")
    ) {
      const estacaoId = customId.replace("remover_botao_estacao_select_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const botoes = estacao.embedprincipal.botoes || [];
      const botaoIdParaRemover = interaction.values[0];

      const index = botoes.findIndex((b) => b.id === botaoIdParaRemover);

      if (index === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_botao_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const botaoRemovido = botoes[index];
      botoes.splice(index, 1);
      estacao.embedprincipal.botoes = botoes;
      updateEstacao(interaction.guildId, estacaoId, estacao);

      const adicionar = new ButtonBuilder()
        .setCustomId(`botao_adicionar_estacao_${estacaoId}`)
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId(`botao_remover_estacao_${estacaoId}`)
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId(`botao_editar_estacao_${estacaoId}`)
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Configuração de Botões - ${estacao.nome}`,
            ),
            new TextDisplayBuilder().setContent(
              `✅ Botão **${botaoRemovido.nome}** removido com sucesso!`,
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              adicionar,
              remover,
              editar,
              voltar,
            ),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId.startsWith("botao_editar_estacao_")) {
      const estacaoId = customId.replace("botao_editar_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const botoes = estacao.embedprincipal.botoes || [];

      if (botoes.length === 0) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Nenhum botão encontrado para editar.",
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId(`editar_botao_estacao_select_${estacaoId}`)
        .setPlaceholder("Selecione o botão que deseja editar")
        .addOptions(
          botoes.map((botao) => ({
            label: botao.nome || "Sem nome",
            value: botao.id,
            description: `ID: ${botao.id}`,
            emoji: botao.emoji || undefined,
          })),
        );

      const row = new ActionRowBuilder().addComponents(select);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Selecione o botão que deseja editar:",
            ),
          )
          .addActionRowComponents(row),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      customId.startsWith("editar_botao_estacao_select_")
    ) {
      const estacaoId = customId.replace("editar_botao_estacao_select_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selectedId = interaction.values[0];
      const botoes = estacao.embedprincipal.botoes || [];
      const botao = botoes.find((b) => b.id === selectedId);

      if (!botao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_botao_nao_encontrado", interaction.guildId)),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const components = criarPainelConfiguracaoBotaoEstacao(
        selectedId,
        estacaoId,
        estacao,
      );

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("selects_estacao_")) {
      const estacaoId = customId.replace("selects_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const _selectsRaw = estacao.embedprincipal.selects || [];
      const _selectsLimpos = _selectsRaw.filter((s) => !s.temp);
      if (_selectsRaw.length !== _selectsLimpos.length) {
        estacao.embedprincipal.selects = _selectsLimpos;
        updateEstacao(interaction.guildId, estacaoId, estacao);
      }

      const adicionar = new ButtonBuilder()
        .setCustomId(`select_adicionar_estacao_${estacaoId}`)
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(_selectsLimpos.length >= 10);

      const remover = new ButtonBuilder()
        .setCustomId(`select_remover_estacao_${estacaoId}`)
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId(`select_editar_estacao_${estacaoId}`)
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(
        adicionar,
        remover,
        editar,
        voltar,
      );

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Configuração de Select Menu - ${estacao.nome}`,
            ),
            new TextDisplayBuilder().setContent(
              `Total de opções: **${
                estacao.embedprincipal.selects?.length || 0
              }**\n\nEscolha uma das ações abaixo.`,
            ),
          )
          .addActionRowComponents(row),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isButton() &&
      customId.startsWith("config_select_estacao_")
    ) {
      const parts = customId.split("_");
      const campo = parts[3];
      const estacaoId = parts[4];
      const selectId = parts[5];

      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (campo === "nome") {
        const modal = new ModalBuilder()
          .setCustomId(
            `modal_config_select_estacao_nome_${estacaoId}_${selectId}`,
          )
          .setTitle("Nome da Opção");

        const input = new TextInputBuilder()
          .setCustomId("nome")
          .setLabel("Digite o nome da opção")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "descricao") {
        const modal = new ModalBuilder()
          .setCustomId(
            `modal_config_select_estacao_descricao_${estacaoId}_${selectId}`,
          )
          .setTitle("Descrição da Opção");

        const input = new TextInputBuilder()
          .setCustomId("descricao")
          .setLabel("Digite a descrição (opcional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(100)
          .setPlaceholder("Aparece abaixo do nome no select menu");

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "categoria") {
        const selectCategoria = new ChannelSelectMenuBuilder()
          .setCustomId(
            `select_config_select_estacao_categoria_${estacaoId}_${selectId}`,
          )
          .setPlaceholder("Selecione uma ou mais categorias")
          .setMinValues(1)
          .setMaxValues(5)
          .addChannelTypes(ChannelType.GuildCategory);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("Selecione as Categorias"),
              new TextDisplayBuilder().setContent(
                "Escolha as categorias onde os tickets serão criados.",
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(selectCategoria),
            ),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (campo === "emoji") {
        const modal = new ModalBuilder()
          .setCustomId(
            `modal_config_select_estacao_emoji_${estacaoId}_${selectId}`,
          )
          .setTitle("Emoji da Opção");

        const input = new TextInputBuilder()
          .setCustomId("emoji")
          .setLabel("Utilize emojis padrões ou do discord.")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "inicio") {
        const modal = new ModalBuilder()
          .setCustomId(
            `modal_config_select_estacao_inicio_${estacaoId}_${selectId}`,
          )
          .setTitle("Tag Inicial do Ticket");

        const input = new TextInputBuilder()
          .setCustomId("inicio")
          .setLabel("Digite a tag inicial (máx 5 caracteres)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(5)
          .setPlaceholder("Ex: sup-");

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (campo === "salvar") {
        const selects = estacao.embedprincipal.selects || [];
        const select = selects.find((s) => s.id === selectId);

        if (!select || !select.nome || !select.categoria) {
          const components = [
            new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "Preencha pelo menos o nome e a categoria antes de salvar.",
              ),
            ),
          ];
          return interaction.reply({
            components,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
        }

        const index = selects.findIndex((s) => s.id === selectId);
        if (index !== -1) {
          delete selects[index].temp;
          estacao.embedprincipal.selects = selects;
          updateEstacao(interaction.guildId, estacaoId, estacao);
        }

        const adicionar = new ButtonBuilder()
          .setCustomId(`select_adicionar_estacao_${estacaoId}`)
          .setLabel(t("btn_adicionar", interaction.guildId))
          .setEmoji(getEmoji(emojis.plus))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled((estacao.embedprincipal.selects || []).length >= 10);

        const remover = new ButtonBuilder()
          .setCustomId(`select_remover_estacao_${estacaoId}`)
          .setLabel(t("btn_remover", interaction.guildId))
          .setEmoji(getEmoji(emojis.minus))
          .setStyle(ButtonStyle.Secondary);

        const editar = new ButtonBuilder()
          .setCustomId(`select_editar_estacao_${estacaoId}`)
          .setLabel(t("btn_editar", interaction.guildId))
          .setEmoji(getEmoji(emojis.title))
          .setStyle(ButtonStyle.Secondary);

        const voltar = new ButtonBuilder()
          .setCustomId(`editar_estacao_${estacaoId}`)
          .setLabel(t("btn_voltar", interaction.guildId))
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary);

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `Configuração de Select Menu - ${estacao.nome}`,
              ),
              new TextDisplayBuilder().setContent(
                `Opção **${select.nome}** salva com sucesso!`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                adicionar,
                remover,
                editar,
                voltar,
              ),
            ),
        ];

        return interaction.update({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (
      interaction.isButton() &&
      customId.startsWith("cancelar_config_select_estacao_")
    ) {
      const parts = customId.split("_");
      const estacaoId = parts[4];
      const selectId = parts[5];

      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selects = estacao.embedprincipal.selects || [];

      const index = selects.findIndex((s) => s.id === selectId);
      if (index !== -1 && selects[index].temp === true) {
        selects.splice(index, 1);
        estacao.embedprincipal.selects = selects;
        updateEstacao(interaction.guildId, estacaoId, estacao);
      }

      const adicionar = new ButtonBuilder()
        .setCustomId(`select_adicionar_estacao_${estacaoId}`)
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(selects.length >= 10);

      const remover = new ButtonBuilder()
        .setCustomId(`select_remover_estacao_${estacaoId}`)
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId(`select_editar_estacao_${estacaoId}`)
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Configuração de Select Menu - ${estacao.nome}`,
            ),
            new TextDisplayBuilder().setContent(
              "Escolha uma das ações abaixo.",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              adicionar,
              remover,
              editar,
              voltar,
            ),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId.startsWith("select_remover_estacao_")) {
      const estacaoId = customId.replace("select_remover_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selects = estacao.embedprincipal.selects || [];

      if (selects.length === 0) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Nenhuma opção de select encontrada para remover.",
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`remover_select_estacao_select_${estacaoId}`)
        .setPlaceholder("Selecione a opção que deseja remover")
        .addOptions(
          selects.map((select) => ({
            label: select.nome || "Sem nome",
            value: select.id,
            description: `ID: ${select.id}`,
            emoji: select.emoji || undefined,
          })),
        );

      const voltarButton = new ButtonBuilder()
        .setCustomId(`selects_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmoji(emojis.arrowl));

      const row1 = new ActionRowBuilder().addComponents(selectMenu);
      const row2 = new ActionRowBuilder().addComponents(voltarButton);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Selecione a opção que deseja remover do select:",
            ),
          )
          .addActionRowComponents(row1, row2),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      customId.startsWith("remover_select_estacao_select_")
    ) {
      const estacaoId = customId.replace("remover_select_estacao_select_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selects = estacao.embedprincipal.selects || [];
      const selectIdParaRemover = interaction.values[0];
      const index = selects.findIndex((s) => s.id === selectIdParaRemover);

      if (index === -1) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Opção de select não encontrada.",
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      selects.splice(index, 1);
      estacao.embedprincipal.selects = selects;
      updateEstacao(interaction.guildId, estacaoId, estacao);

      const adicionar = new ButtonBuilder()
        .setCustomId(`select_adicionar_estacao_${estacaoId}`)
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(selects.length >= 10);

      const remover = new ButtonBuilder()
        .setCustomId(`select_remover_estacao_${estacaoId}`)
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const editar = new ButtonBuilder()
        .setCustomId(`select_editar_estacao_${estacaoId}`)
        .setLabel(t("btn_editar", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Configuração de Select Menu - ${estacao.nome}`,
            ),
            new TextDisplayBuilder().setContent(
              "Escolha uma das ações abaixo.",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              adicionar,
              remover,
              editar,
              voltar,
            ),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId.startsWith("select_editar_estacao_")) {
      const estacaoId = customId.replace("select_editar_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selects = estacao.embedprincipal.selects || [];

      if (selects.length === 0) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Nenhuma opção de select encontrada para editar.",
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId(`editar_select_estacao_select_${estacaoId}`)
        .setPlaceholder("Selecione a opção que deseja editar")
        .addOptions(
          selects.map((s) => ({
            label: s.nome || "Sem nome",
            value: s.id,
            description: `ID: ${s.id}`,
            emoji: s.emoji || undefined,
          })),
        );

      const row = new ActionRowBuilder().addComponents(select);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Selecione a opção que deseja editar:",
            ),
          )
          .addActionRowComponents(row),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      customId.startsWith("editar_select_estacao_select_")
    ) {
      const estacaoId = customId.replace("editar_select_estacao_select_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selectedId = interaction.values[0];
      const selects = estacao.embedprincipal.selects || [];
      const selectObj = selects.find((s) => s.id === selectedId);

      if (!selectObj) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Opção de select não encontrada.",
            ),
          ),
        ];

        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const components = criarPainelConfiguracaoSelectEstacao(
        selectedId,
        estacaoId,
        estacao,
      );

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("renomear_estacao_")) {
      const estacaoId = customId.replace("renomear_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_renomear_estacao_${estacaoId}`)
        .setTitle(t("est_modal_renomear_titulo", interaction.guildId));

      const inputNome = new TextInputBuilder()
        .setCustomId("novo_nome")
        .setLabel(t("est_modal_renomear_label", interaction.guildId))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50)
        .setValue(estacao.nome);

      modal.addComponents(new ActionRowBuilder().addComponents(inputNome));

      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("modal_renomear_estacao_")
    ) {
      const estacaoId = customId.replace("modal_renomear_estacao_", "");
      const novoNome = interaction.fields.getTextInputValue("novo_nome");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      estacao.nome = novoNome;
      updateEstacao(interaction.guildId, estacaoId, estacao);

      const btnPersonalizar = new ButtonBuilder()
        .setCustomId(`personalizar_estacao_${estacaoId}`)
        .setLabel(t("est_btn_visual", interaction.guildId))
        .setEmoji(getEmoji(emojis.brush))
        .setStyle(ButtonStyle.Secondary);

      const btnBotoes = new ButtonBuilder()
        .setCustomId(`botoes_estacao_${estacaoId}`)
        .setLabel(t("est_btn_botoes_label", interaction.guildId))
        .setEmoji(getEmoji(emojis.cube))
        .setStyle(ButtonStyle.Secondary);

      const btnSelects = new ButtonBuilder()
        .setCustomId(`selects_estacao_${estacaoId}`)
        .setLabel(t("est_btn_selects_label", interaction.guildId))
        .setEmoji(getEmoji(emojis.cube))
        .setStyle(ButtonStyle.Secondary);

      const btnEnviar = new ButtonBuilder()
        .setCustomId(`enviar_estacao_${estacaoId}`)
        .setLabel(t("est_btn_enviar_painel", interaction.guildId))
        .setEmoji(getEmoji(emojis.embeds))
        .setStyle(ButtonStyle.Success);

      const btnRenomear = new ButtonBuilder()
        .setCustomId(`renomear_estacao_${estacaoId}`)
        .setLabel(t("est_btn_renomear_label", interaction.guildId))
        .setEmoji(getEmoji(emojis.title))
        .setStyle(ButtonStyle.Secondary);

      const btnExcluir = new ButtonBuilder()
        .setCustomId(`excluir_estacao_${estacaoId}`)
        .setLabel(t("est_btn_excluir_label", interaction.guildId))
        .setEmoji(getEmoji(emojis.lixeira))
        .setStyle(ButtonStyle.Danger);

      const btnVoltar = new ButtonBuilder()
        .setCustomId("gerenciar_estacoes")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_config_titulo", interaction.guildId, { nome: estacao.nome })),
            new TextDisplayBuilder().setContent(
              t("est_renomeada_sucesso", interaction.guildId),
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("est_config_botoes_secao", interaction.guildId, { count: estacao.embedprincipal.botoes?.length || 0 }),
                ),
              )
              .setButtonAccessory(btnBotoes),
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("est_config_selects_secao", interaction.guildId, { count: estacao.embedprincipal.selects?.length || 0 }),
                ),
              )
              .setButtonAccessory(btnSelects),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              btnPersonalizar,
              btnEnviar,
              btnRenomear,
              btnExcluir,
              btnVoltar,
            ),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("excluir_estacao_")) {
      const estacaoId = customId.replace("excluir_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_confirmar_excluir_estacao_${estacaoId}`)
        .setTitle(t("est_modal_excluir_titulo", interaction.guildId));

      const inputConfirmacao = new TextInputBuilder()
        .setCustomId("confirmacao")
        .setLabel(t("est_modal_excluir_label", interaction.guildId))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(t("est_modal_excluir_placeholder", interaction.guildId));

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputConfirmacao),
      );

      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("modal_confirmar_excluir_estacao_")
    ) {
      const estacaoId = customId.replace(
        "modal_confirmar_excluir_estacao_",
        "",
      );
      const confirmacao = interaction.fields.getTextInputValue("confirmacao");

      if (confirmacao.toLowerCase() !== "confirmar") {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("est_confirmacao_incorreta", interaction.guildId),
            ),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const deletado = deleteEstacao(interaction.guildId, estacaoId);

      if (!deletado) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t("est_erro_excluir", interaction.guildId),
            ),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const db = getEstacoesDB(interaction.guildId);
      const estacoes = (() => {
        const _r = db.get("estacoes");
        if (Array.isArray(_r)) return _r;
        try {
          return JSON.parse(_r || "[]");
        } catch {
          return [];
        }
      })();

      const ESTACOES_POR_PAGINA = 5;
      const totalPaginas = Math.ceil(estacoes.length / ESTACOES_POR_PAGINA);
      const paginaAtual = 0;
      const inicio = paginaAtual * ESTACOES_POR_PAGINA;
      const fim = inicio + ESTACOES_POR_PAGINA;
      const estacoesExibidas = estacoes.slice(inicio, fim);

      const sections = estacoesExibidas.map((estacao) =>
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${estacao.nome}**\n${t("est_item_info", interaction.guildId, { botoes: estacao.embedprincipal.botoes?.length || 0, selects: estacao.embedprincipal.selects?.length || 0 })}`,
            ),
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`editar_estacao_${estacao.id}`)
              .setLabel(t("btn_editar", interaction.guildId))
              .setEmoji(getEmoji(emojis.title))
              .setStyle(ButtonStyle.Secondary),
          ),
      );

      const btnCriar = new ButtonBuilder()
        .setCustomId("criar_estacao")
        .setLabel(t("est_btn_criar_estacao", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Success);

      const btnVoltar = new ButtonBuilder()
        .setCustomId("configurar_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const btnAnterior = new ButtonBuilder()
        .setCustomId(`estacoes_pagina_${paginaAtual - 1}`)
        .setLabel(t("btn_anterior", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(paginaAtual === 0);

      const btnProximo = new ButtonBuilder()
        .setCustomId(`estacoes_pagina_${paginaAtual + 1}`)
        .setLabel(t("btn_proximo", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowr))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(paginaAtual >= totalPaginas - 1);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_gerenciar_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(
              t("est_excluida_sucesso", interaction.guildId, { count: estacoes.length, pagina: paginaAtual + 1, total: totalPaginas || 1 }),
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addSectionComponentsSafe(...sections)
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAnterior, btnProximo),
            new ActionRowBuilder().addComponents(btnCriar, btnVoltar),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && customId.startsWith("botoes_pagina_")) {
      const pagina = parseInt(customId.split("_").pop());
      const db = getPersonalizacaoDB(interaction.guild.id);
      const botoes = db.get("embedprincipal.botoes") || [];

      const { sections, btnAnterior, btnProximo, totalPaginas } =
        criarPaginacaoBotoes(botoes, pagina);

      const adicionar = new ButtonBuilder()
        .setCustomId("botao_adicionar")
        .setLabel(t("btn_adicionar", interaction.guildId))
        .setEmoji(getEmoji(emojis.plus))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(botoes.length >= 5);

      const remover = new ButtonBuilder()
        .setCustomId("botao_remover")
        .setLabel(t("btn_remover", interaction.guildId))
        .setEmoji(getEmoji(emojis.minus))
        .setStyle(ButtonStyle.Secondary);

      const voltar = new ButtonBuilder()
        .setCustomId("sistema_ticket")
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_editar_botoes_titulo", interaction.guildId)),
            new TextDisplayBuilder().setContent(
              t("est_editar_botoes_desc", interaction.guildId, { pagina: pagina + 1, total: totalPaginas }),
            ),
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addSectionComponentsSafe(...sections)
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(btnAnterior, btnProximo),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(adicionar, remover, voltar),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isButton() &&
      customId.startsWith("editar_botao_paginado_")
    ) {
      const botaoId = customId.replace("editar_botao_paginado_", "");
      const db = getPersonalizacaoDB(interaction.guild.id);
      const botoes = db.get("embedprincipal.botoes") || [];
      const botao = botoes.find((b) => b.id === botaoId);

      if (!botao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_botao_nao_encontrado", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const components = criarPainelConfiguracaoBotao(botaoId, db);
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("toggle_motivo_estacao_")) {
      const estacaoId = customId.replace("toggle_motivo_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);
      if (!estacao)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });
      estacao.embedprincipal = estacao.embedprincipal || {};
      estacao.embedprincipal.enviar_motivo = !(
        estacao.embedprincipal.enviar_motivo ?? false
      );
      updateEstacao(interaction.guildId, estacaoId, estacao);
      const comps = buildEditarEstacaoComponents(
        interaction.guildId,
        estacaoId,
      );
      if (!comps)
        return interaction.reply({
          content: t("est_nao_encontrada", interaction.guildId),
          flags: MessageFlags.Ephemeral,
        });
      return interaction.update({
        components: comps,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    // == FIM BOTOES == //

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("salvar_embed_estacao:")
    ) {
      const [, estacaoId, campo] = customId.split(":");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      let novoValor = interaction.fields
        .getTextInputValue("novo_valor")
        .toString()
        .trim();

      if (campo === "titulo") {
        let valorParaSalvar = novoValor !== "" ? novoValor : " ";
        valorParaSalvar = parseEmojisInText(valorParaSalvar, interaction.guild);
        estacao.embedprincipal.title = valorParaSalvar;
      } else if (campo === "descricao") {
        let valorParaSalvar = novoValor !== "" ? novoValor : " ";
        valorParaSalvar = parseEmojisInText(valorParaSalvar, interaction.guild);
        estacao.embedprincipal.descricao = valorParaSalvar;
      } else if (campo === "banner") {
        estacao.embedprincipal.banner = novoValor !== "" ? novoValor : " ";
      } else if (campo === "cor") {
        if (novoValor === "" || novoValor.trim() === "") {
          estacao.embedprincipal.color = "";
        } else {
          let cor = novoValor.trim();
          if (!cor.startsWith("#")) cor = `#${cor}`;
          const hexColorRegex = /^#([0-9A-Fa-f]{6})$/;
          if (!hexColorRegex.test(cor)) {
            const components = [
              new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  t("est_visual_err_cor", interaction.guildId),
                ),
              ),
            ];
            return interaction.reply({
              components,
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          }
          estacao.embedprincipal.color = cor;
        }
      }

      updateEstacao(interaction.guildId, estacaoId, estacao);

      const data = estacao.embedprincipal;

      const previewTexts = [
        new TextDisplayBuilder().setContent(data.title || t("est_visual_sem_titulo", interaction.guildId)),
        new TextDisplayBuilder().setContent(data.descricao || t("est_visual_sem_descricao", interaction.guildId)),
      ];

      previewTexts.push(
        new TextDisplayBuilder().setContent(
          t("est_visual_cor", interaction.guildId, { cor: data.color || t("est_visual_sem_cor", interaction.guildId) }),
        ),
      );

      const editarMenuOptions = [
        { label: t("est_visual_opt_titulo", interaction.guildId), value: "titulo", emoji: getEmoji(emojis.title) },
        {
          label: t("est_visual_opt_descricao", interaction.guildId),
          value: "descricao",
          emoji: getEmoji(emojis.embeds),
        },
        { label: t("est_visual_opt_cor", interaction.guildId), value: "cor", emoji: getEmoji(emojis.colorpicker) },
        { label: t("est_visual_opt_banner", interaction.guildId), value: "banner", emoji: getEmoji(emojis.image) },
      ];

      const editarMenu = new StringSelectMenuBuilder()
        .setCustomId(`editar_embed_estacao:${estacaoId}`)
        .setPlaceholder(t("est_visual_select_placeholder", interaction.guildId))
        .addOptions(editarMenuOptions);

      const voltarButton = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const container = new ContainerBuilder();

      const accentColor = parseColor(data.color);
      if (accentColor !== null) {
        container.setAccentColor(accentColor);
      }

      container.addTextDisplayComponents(...previewTexts);

      if (
        data.banner &&
        typeof data.banner === "string" &&
        data.banner.startsWith("http")
      ) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(data.banner),
          ),
        );
      }

      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(editarMenu),
        new ActionRowBuilder().addComponents(voltarButton),
      );

      return interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("modal_config_botao_estacao_")
    ) {
      const parts = customId.split("_");
      const campo = parts[4];
      const estacaoId = parts[5];
      const botaoId = parts[6];

      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const botoes = estacao.embedprincipal.botoes || [];
      const index = botoes.findIndex((b) => b.id === botaoId);

      if (index === -1) return;

      if (campo === "nome") {
        botoes[index].nome = interaction.fields.getTextInputValue("nome");
      } else if (campo === "inicio") {
        botoes[index].inicio = interaction.fields.getTextInputValue("inicio");
      } else if (campo === "emoji") {
        const emojiInput = interaction.fields.getTextInputValue("emoji");
        if (emojiInput) {
          const emojiProcessado = parseEmoji(emojiInput, interaction.guild);
          botoes[index].emoji = emojiProcessado.id
            ? `<${emojiProcessado.animated ? "a" : ""}:${
                emojiProcessado.name
              }:${emojiProcessado.id}>`
            : emojiProcessado.name;
        } else {
          botoes[index].emoji = null;
        }
      }

      estacao.embedprincipal.botoes = botoes;
      updateEstacao(interaction.guildId, estacaoId, estacao);

      const components = criarPainelConfiguracaoBotaoEstacao(
        botaoId,
        estacaoId,
        estacao,
      );
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("modal_config_select_estacao_")
    ) {
      const parts = customId.split("_");
      const campo = parts[4];
      const estacaoId = parts[5];
      const selectId = parts[6];

      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selects = estacao.embedprincipal.selects || [];
      const index = selects.findIndex((s) => s.id === selectId);

      if (index === -1) return;

      if (campo === "nome") {
        selects[index].nome = interaction.fields.getTextInputValue("nome");
      } else if (campo === "descricao") {
        selects[index].descricao =
          interaction.fields.getTextInputValue("descricao");
      } else if (campo === "inicio") {
        selects[index].inicio = interaction.fields.getTextInputValue("inicio");
      } else if (campo === "emoji") {
        const emojiInput = interaction.fields.getTextInputValue("emoji");
        if (emojiInput) {
          const emojiProcessado = parseEmoji(emojiInput, interaction.guild);
          selects[index].emoji = emojiProcessado.id
            ? `<${emojiProcessado.animated ? "a" : ""}:${
                emojiProcessado.name
              }:${emojiProcessado.id}>`
            : emojiProcessado.name;
        } else {
          selects[index].emoji = null;
        }
      }

      estacao.embedprincipal.selects = selects;
      updateEstacao(interaction.guildId, estacaoId, estacao);

      const components = criarPainelConfiguracaoSelectEstacao(
        selectId,
        estacaoId,
        estacao,
      );
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      customId.startsWith("enviar_estacao_tipo_")
    ) {
      const estacaoId = customId.replace("enviar_estacao_tipo_", "");
      const tipoPainel = interaction.values[0];

      const tempDB = getConfigDB(interaction.guildId);

      tempDB.set("enviar_estacao_temp", {
        estacaoId: estacaoId,
        tipo: tipoPainel,
        userId: interaction.user.id,
      });

      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selectCanal = new ChannelSelectMenuBuilder()
        .setCustomId("enviar_estacao_canal")
        .setPlaceholder("Selecione o canal para enviar o painel")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);

      const voltarBtn = new ButtonBuilder()
        .setCustomId(`enviar_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `# Selecionar Canal - ${estacao.nome}`,
            ),
            new TextDisplayBuilder().setContent(
              `Tipo de painel: **${
                tipoPainel === "botao" ? "Botões" : "Select Menu"
              }**\n\nEscolha o canal onde o painel será enviado:`,
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectCanal),
            new ActionRowBuilder().addComponents(voltarBtn),
          ),
      ];

      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId === "enviar_estacao_canal"
    ) {
      await interaction.deferUpdate();

      const tempDB = getConfigDB(interaction.guildId);
      const tempData = tempDB.get("enviar_estacao_temp");

      if (!tempData || tempData.userId !== interaction.user.id) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Sessão expirada. Tente novamente.",
            ),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const canalId = interaction.values[0];
      const canal = interaction.guild.channels.cache.get(canalId);

      if (!canal) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent("❌ Canal não encontrado."),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const estacao = getEstacao(interaction.guildId, tempData.estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const embedData = estacao.embedprincipal;
      const tipoPainel = tempData.tipo;

      try {
        if (tipoPainel === "botao") {
          const botoes = embedData.botoes || [];

          const containerTicket = new ContainerBuilder();
          const accentColor = parseColor(embedData.color);
          if (accentColor !== null) {
            containerTicket.setAccentColor(accentColor);
          }

          containerTicket.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${embedData.title || "🎫 Painel de Tickets"}**`,
            ),
          );

          if (embedData.descricao) {
            containerTicket.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(embedData.descricao),
            );
          }

          if (
            embedData.banner &&
            typeof embedData.banner === "string" &&
            embedData.banner.startsWith("http")
          ) {
            containerTicket.addMediaGalleryComponents(
              new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(embedData.banner),
              ),
            );
          }

          containerTicket.addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          );

          const botoesFormatados = botoes.map((botao) => {
            const button = new ButtonBuilder()
              .setCustomId(
                `ticket_estacao_botoes_${tempData.estacaoId}_${botao.id}`,
              )
              .setLabel(botao.nome || "Abrir")
              .setStyle(getButtonStyle(botao.cor));

            if (botao.emoji) {
              const parsedEmoji = parseEmoji(botao.emoji, interaction.guild);
              if (parsedEmoji) button.setEmoji(parsedEmoji);
            }

            return button;
          });

          for (let i = 0; i < botoesFormatados.length; i += 5) {
            containerTicket.addActionRowComponents(
              new ActionRowBuilder().addComponents(
                botoesFormatados.slice(i, i + 5),
              ),
            );
          }

          const mensagemEnviada = await canal.send({
            components: [containerTicket],
            flags: MessageFlags.IsComponentsV2,
          });

          estacao.embedprincipal.messageId = mensagemEnviada.id;
          estacao.embedprincipal.channelId = canal.id;
          updateEstacao(interaction.guildId, tempData.estacaoId, estacao);
        } else if (tipoPainel === "select") {
          const selects = embedData.selects || [];

          const containerTicket = new ContainerBuilder();
          const accentColor = parseColor(embedData.color);
          if (accentColor !== null) {
            containerTicket.setAccentColor(accentColor);
          }

          containerTicket.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${embedData.title || "🎫 Painel de Tickets"}**`,
            ),
          );

          if (embedData.descricao) {
            containerTicket.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(embedData.descricao),
            );
          }

          if (
            embedData.banner &&
            typeof embedData.banner === "string" &&
            embedData.banner.startsWith("http")
          ) {
            containerTicket.addMediaGalleryComponents(
              new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(embedData.banner),
              ),
            );
          }

          containerTicket.addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(SeparatorSpacingSize.Small),
          );

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`ticket_estacao_select_${tempData.estacaoId}`)
            .setPlaceholder("Escolha uma opção")
            .addOptions(
              selects.map((sel) => {
                const option = {
                  label: sel.nome || "Ticket",
                  value: `select_${sel.id}`,
                  description:
                    sel.descricao ||
                    `Abrir ticket para: ${sel.nome || "Atendimento"}`,
                };

                if (sel.emoji) {
                  const parsedEmoji = parseEmoji(sel.emoji, interaction.guild);
                  if (parsedEmoji) option.emoji = parsedEmoji;
                }

                return option;
              }),
            );

          containerTicket.addActionRowComponents(
            new ActionRowBuilder().addComponents(selectMenu),
          );

          const mensagemEnviada = await canal.send({
            components: [containerTicket],
            flags: MessageFlags.IsComponentsV2,
          });

          estacao.embedprincipal.messageId = mensagemEnviada.id;
          estacao.embedprincipal.channelId = canal.id;
          updateEstacao(interaction.guildId, tempData.estacaoId, estacao);
        }

        tempDB.delete("enviar_estacao_temp");

        const components = [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# ${emojis.check} Painel Enviado!`,
              ),
              new TextDisplayBuilder().setContent(
                `O painel da estação **${estacao.nome}** foi enviado com sucesso em ${canal}!`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`editar_estacao_${tempData.estacaoId}`)
                  .setLabel("Voltar para Estação")
                  .setEmoji(getEmoji(emojis.arrowl))
                  .setStyle(ButtonStyle.Secondary),
              ),
            ),
        ];

        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error(error);
        tempDB.delete("enviar_estacao_temp");

        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Erro ao enviar o painel. Verifique se o bot tem permissão para enviar mensagens neste canal.",
            ),
          ),
        ];

        return interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (customId.startsWith("enviar_estacao_")) {
      const estacaoId = customId.replace("enviar_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const botoes = estacao.embedprincipal.botoes || [];
      const selects = estacao.embedprincipal.selects || [];

      if (botoes.length === 0 && selects.length === 0) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "❌ Você precisa configurar pelo menos um botão ou select antes de enviar o painel.",
            ),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const tempDB = getConfigDB(interaction.guildId);
      tempDB.set("enviar_estacao_temp", {
        estacaoId: estacaoId,
        tipo: null,
        userId: interaction.user.id,
      });

      const selectTipo = new StringSelectMenuBuilder()
        .setCustomId(`enviar_estacao_tipo_${estacaoId}`)
        .setPlaceholder("Escolha o tipo de painel");

      const opcoes = [];

      if (botoes.length > 0) {
        opcoes.push({
          label: "Painel com Botões",
          value: "botao",
          description: `${botoes.length} botão(ões) configurado(s)`,
          emoji: getEmoji(emojis.cube),
        });
      }

      if (selects.length > 0) {
        opcoes.push({
          label: "Painel com Select Menu",
          value: "select",
          description: `${selects.length} opção(ões) configurada(s)`,
          emoji: getEmoji(emojis.cube),
        });
      }

      selectTipo.addOptions(opcoes);

      const voltarBtn = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel(t("btn_voltar", interaction.guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const components = [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `# Enviar Painel - ${estacao.nome}`,
            ),
            new TextDisplayBuilder().setContent(
              "Selecione o tipo de painel que deseja enviar:",
            ),
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(selectTipo),
            new ActionRowBuilder().addComponents(voltarBtn),
          ),
      ];

      await interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      customId.startsWith("editar_embed_estacao:")
    ) {
      const estacaoId = customId.split(":")[1];
      const campo = interaction.values[0];
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const dados = estacao.embedprincipal;

      const modal = new ModalBuilder()
        .setTitle("Editar Embed")
        .setCustomId(`salvar_embed_estacao:${estacaoId}:${campo}`);

      if (campo === "titulo") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("novo_valor")
              .setLabel("Novo título")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setValue(limparEmojisProcessados(dados.title || "")),
          ),
        );
      } else if (campo === "descricao") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("novo_valor")
              .setLabel("Nova descrição")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setValue(limparEmojisProcessados(dados.descricao || "")),
          ),
        );
      } else if (campo === "cor") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("novo_valor")
              .setLabel("Nova cor (hexadecimal, ex: #ffffff)")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setPlaceholder("Deixe vazio para sem cor")
              .setValue(dados.color || ""),
          ),
        );
      } else if (campo === "banner") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("novo_valor")
              .setLabel("URL do novo banner")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setValue(dados.banner || ""),
          ),
        );
      }

      await interaction.showModal(modal);
    }

    if (
      interaction.isChannelSelectMenu() &&
      customId.startsWith("select_config_botao_estacao_categoria_")
    ) {
      const parts = customId.split("_");
      const estacaoId = parts[5];
      const botaoId = parts[6];

      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const botoes = estacao.embedprincipal.botoes || [];
      const index = botoes.findIndex((b) => b.id === botaoId);

      if (index !== -1) {
        botoes[index].categoria = interaction.values.join(",");
        estacao.embedprincipal.botoes = botoes;
        updateEstacao(interaction.guildId, estacaoId, estacao);
      }

      const components = criarPainelConfiguracaoBotaoEstacao(
        botaoId,
        estacaoId,
        estacao,
      );
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId.startsWith("select_adicionar_estacao_")) {
      const estacaoId = customId.replace("select_adicionar_estacao_", "");
      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      let selectsExistentes = estacao.embedprincipal.selects || [];

      selectsExistentes = selectsExistentes.filter((s) => !s.temp);
      estacao.embedprincipal.selects = selectsExistentes;
      updateEstacao(interaction.guildId, estacaoId, estacao);

      if (selectsExistentes.length >= 10) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Você já atingiu o limite máximo de 10 opções no select menu.",
            ),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const novoId = Date.now().toString();
      const selectTemp = {
        id: novoId,
        nome: "",
        categoria: "",
        emoji: null,
        inicio: "",
        descricao: "",
        temp: true,
      };

      selectsExistentes.push(selectTemp);
      estacao.embedprincipal.selects = selectsExistentes;
      updateEstacao(interaction.guildId, estacaoId, estacao);

      const components = criarPainelConfiguracaoSelectEstacao(
        novoId,
        estacaoId,
        estacao,
      );
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      customId.startsWith("select_config_select_estacao_categoria_")
    ) {
      const parts = customId.split("_");
      const estacaoId = parts[5];
      const selectId = parts[6];

      const estacao = getEstacao(interaction.guildId, estacaoId);

      if (!estacao) {
        const components = [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(t("est_nao_encontrada", interaction.guildId)),
          ),
        ];
        return interaction.reply({
          components,
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const selects = estacao.embedprincipal.selects || [];
      const index = selects.findIndex((s) => s.id === selectId);

      if (index !== -1) {
        selects[index].categoria = interaction.values.join(",");
        estacao.embedprincipal.selects = selects;
        updateEstacao(interaction.guildId, estacaoId, estacao);
      }

      const components = criarPainelConfiguracaoSelectEstacao(
        selectId,
        estacaoId,
        estacao,
      );
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};