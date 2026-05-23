const {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SectionBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const path = require("path");
const fs = require("fs");
const { JsonDatabase } = require("wio.db");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const PROJECT_ROOT = path.resolve(__dirname, "../../../");

function safeEmoji(raw) {
  if (!raw) return undefined;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return undefined;
  return { name: match[1], id: match[2] };
}

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
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

function getEstacao(guildId, estacaoId) {
  const db = getEstacoesDB(guildId);
  const estacoes = safeParseEstacoes(db.get("estacoes"));
  return estacoes.find((e) => e.id === estacaoId);
}

function updateEstacao(guildId, estacaoId, data) {
  const db = getEstacoesDB(guildId);
  const estacoes = safeParseEstacoes(db.get("estacoes"));
  const idx = estacoes.findIndex((e) => e.id === estacaoId);
  if (idx !== -1) {
    estacoes[idx] = { ...estacoes[idx], ...data };
    db.set("estacoes", JSON.stringify(estacoes));
  }
}

function criarModalFormulario(estacao, customIdOverride) {
  if (!(estacao.formulario_ativo ?? false)) return null;
  const campos = estacao.formulario_campos || [];
  if (campos.length === 0) return null;
  const camposLimitados = campos.slice(0, 5);

  const modal = new ModalBuilder()
    .setCustomId(customIdOverride || `submit_form_estacao_${estacao.id}`)
    .setTitle(estacao.formulario_titulo || `Abrir Ticket — ${estacao.nome}`);

  for (const campo of camposLimitados) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`campo_${campo.id}`)
          .setLabel(campo.label.substring(0, 45))
          .setStyle(
            campo.longo ? TextInputStyle.Paragraph : TextInputStyle.Short,
          )
          .setRequired(campo.obrigatorio ?? true)
          .setPlaceholder(campo.placeholder || "")
          .setMaxLength(campo.longo ? 1000 : 200),
      ),
    );
  }

  return modal;
}

module.exports = {
  customIds: [
    "config_formulario_estacao_",
    "add_campo_form_",
    "modal_add_campo_form_",
    "remover_campo_form_",
    "campo_form_remover_select_",
    "toggle_form_estacao_",
    "config_form_titulo_",
    "modal_form_titulo_",
    "submit_form_estacao_",
  ],
  criarModalFormulario,

  async execute(client, interaction) {
    const belongsToThis = module.exports.customIds.some(
      (id) =>
        interaction.customId && (interaction.customId === id || interaction.customId.startsWith(id)),
    );
    if (!belongsToThis) return;
    if (!interaction._fromPainel) return;
    const { customId, guildId } = interaction;
    if (!customId) return;

    if (customId.startsWith("config_formulario_estacao_")) {
      const estacaoId = customId.replace("config_formulario_estacao_", "");
      const estacao = getEstacao(guildId, estacaoId);
      if (!estacao)
        return interaction.reply({
          content: "❌ Estação não encontrada.",
          flags: MessageFlags.Ephemeral,
        });

      const campos = estacao.formulario_campos || [];
      const ativo = estacao.formulario_ativo ?? false;

      const btnToggle = new ButtonBuilder()
        .setCustomId(`toggle_form_estacao_${estacaoId}`)
        .setLabel(`Formulário: ${ativo ? "ON" : "OFF"}`)
        .setEmoji(safeEmoji(ativo ? emojis.on : emojis.off) || "🔹")
        .setStyle(ativo ? ButtonStyle.Success : ButtonStyle.Secondary);

      const btnAddCampo = new ButtonBuilder()
        .setCustomId(`add_campo_form_${estacaoId}`)
        .setLabel("Adicionar Campo")
        .setEmoji(safeEmoji(emojis.plus) || "🔹")
        .setStyle(ButtonStyle.Success)
        .setDisabled(campos.length >= 5);

      const btnRemoverCampo = new ButtonBuilder()
        .setCustomId(`remover_campo_form_${estacaoId}`)
        .setLabel("Remover Campo")
        .setEmoji(safeEmoji(emojis.minus) || "🔹")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(campos.length === 0);

      const btnTitulo = new ButtonBuilder()
        .setCustomId(`config_form_titulo_${estacaoId}`)
        .setLabel("Título do Modal")
        .setEmoji(safeEmoji(emojis.title) || "🔹")
        .setStyle(ButtonStyle.Secondary);

      const btnVoltar = new ButtonBuilder()
        .setCustomId(`editar_estacao_${estacaoId}`)
        .setLabel("Voltar")
        .setStyle(ButtonStyle.Secondary);
      const _emojiVoltar = safeEmoji(emojis.arrowl);
      if (_emojiVoltar) btnVoltar.setEmoji(_emojiVoltar);

      const camposList =
        campos.length > 0
          ? campos
              .map(
                (c, i) =>
                  `**${i + 1}.** ${c.label} ${c.obrigatorio ? "*(obrigatório)*" : "*(opcional)*"} ${c.longo ? "[texto longo]" : ""}`,
              )
              .join("\n")
          : "*(Nenhum campo — formulário desativado)*";

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.clipboard || "📋"} # Formulário: ${estacao.nome}`,
              ),
              new TextDisplayBuilder().setContent(
                `Configure quais informações serão solicitadas ao usuário ao abrir um ticket nesta estação.\n\n**Status:** ${ativo ? "✅ Ativo" : "❌ Inativo"}\n**Título:** ${estacao.formulario_titulo || "(padrão)"}\n**Campos (${campos.length}/5):**\n${camposList}`,
              ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(btnToggle, btnTitulo),
              new ActionRowBuilder().addComponents(
                btnAddCampo,
                btnRemoverCampo,
                btnVoltar,
              ),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId.startsWith("toggle_form_estacao_")) {
      const estacaoId = customId.replace("toggle_form_estacao_", "");
      const estacao = getEstacao(guildId, estacaoId);
      if (!estacao)
        return interaction.reply({
          content: "❌ Estação não encontrada.",
          flags: MessageFlags.Ephemeral,
        });

      estacao.formulario_ativo = !(estacao.formulario_ativo ?? false);
      updateEstacao(guildId, estacaoId, {
        formulario_ativo: estacao.formulario_ativo,
      });

      interaction.customId = `config_formulario_estacao_${estacaoId}`;
      return this.execute(client, interaction);
    }

    if (customId.startsWith("config_form_titulo_")) {
      const estacaoId = customId.replace("config_form_titulo_", "");
      const estacao = getEstacao(guildId, estacaoId);
      const modal = new ModalBuilder()
        .setCustomId(`modal_form_titulo_${estacaoId}`)
        .setTitle("Título do Formulário");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("titulo")
            .setLabel("Título do modal (máx 45 caracteres)")
            .setStyle(TextInputStyle.Short)
            .setValue(estacao?.formulario_titulo || "")
            .setRequired(false)
            .setMaxLength(45)
            .setPlaceholder(`Abrir Ticket — ${estacao?.nome}`),
        ),
      );
      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("modal_form_titulo_")
    ) {
      const estacaoId = customId.replace("modal_form_titulo_", "");
      const titulo = interaction.fields.getTextInputValue("titulo").trim();
      updateEstacao(guildId, estacaoId, { formulario_titulo: titulo || null });
      return interaction.reply({
        content: `✅ Título atualizado: **${titulo || "(padrão)"}**`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (
      customId.startsWith("add_campo_form_") &&
      !interaction.isModalSubmit()
    ) {
      const estacaoId = customId.replace("add_campo_form_", "");
      const modal = new ModalBuilder()
        .setCustomId(`modal_add_campo_form_${estacaoId}`)
        .setTitle("Adicionar Campo ao Formulário");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("label")
            .setLabel("Label do campo (aparece no modal)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(45)
            .setPlaceholder("Ex: Descrição do problema"),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("placeholder")
            .setLabel("Placeholder (texto de exemplo, opcional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(100)
            .setPlaceholder("Ex: Descreva com detalhes..."),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("tipo")
            .setLabel('Tipo: "curto" ou "longo"')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue("curto")
            .setPlaceholder("curto / longo"),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("obrigatorio")
            .setLabel('Obrigatório? "sim" ou "nao"')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue("sim")
            .setPlaceholder("sim / nao"),
        ),
      );
      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("modal_add_campo_form_")
    ) {
      const estacaoId = customId.replace("modal_add_campo_form_", "");
      const estacao = getEstacao(guildId, estacaoId);
      if (!estacao)
        return interaction.reply({
          content: "❌ Estação não encontrada.",
          flags: MessageFlags.Ephemeral,
        });

      const label = interaction.fields.getTextInputValue("label").trim();
      const placeholder = interaction.fields
        .getTextInputValue("placeholder")
        .trim();
      const tipo = interaction.fields
        .getTextInputValue("tipo")
        .toLowerCase()
        .trim();
      const obrigatorioStr = interaction.fields
        .getTextInputValue("obrigatorio")
        .toLowerCase()
        .trim();

      const campos = estacao.formulario_campos || [];
      if (campos.length >= 5)
        return interaction.reply({
          content: "❌ Máximo de 5 campos por formulário.",
          flags: MessageFlags.Ephemeral,
        });

      const novoCampo = {
        id: Date.now().toString(),
        label,
        placeholder,
        longo: tipo === "longo" || tipo === "paragraph",
        obrigatorio: obrigatorioStr !== "nao" && obrigatorioStr !== "não",
      };

      campos.push(novoCampo);
      updateEstacao(guildId, estacaoId, { formulario_campos: campos });

      return interaction.reply({
        content: `✅ Campo **${label}** adicionado! (${campos.length}/5 campos)`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (
      customId.startsWith("remover_campo_form_") &&
      !interaction.isStringSelectMenu()
    ) {
      const estacaoId = customId.replace("remover_campo_form_", "");
      const estacao = getEstacao(guildId, estacaoId);
      if (!estacao)
        return interaction.reply({
          content: "❌ Estação não encontrada.",
          flags: MessageFlags.Ephemeral,
        });

      const campos = estacao.formulario_campos || [];
      if (campos.length === 0)
        return interaction.reply({
          content: "❌ Nenhum campo para remover.",
          flags: MessageFlags.Ephemeral,
        });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`campo_form_remover_select_${estacaoId}`)
        .setPlaceholder("Selecione o campo para remover")
        .setMinValues(1)
        .setMaxValues(campos.length)
        .addOptions(
          campos.map((c) => ({
            label: c.label,
            value: c.id,
            description: c.longo ? "Texto longo" : "Texto curto",
          })),
        );

      return interaction.reply({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                "Selecione os campos para remover:",
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(select),
            ),
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    if (
      interaction.isStringSelectMenu() &&
      customId.startsWith("campo_form_remover_select_")
    ) {
      const estacaoId = customId.replace("campo_form_remover_select_", "");
      const estacao = getEstacao(guildId, estacaoId);
      if (!estacao)
        return interaction.reply({
          content: "❌ Estação não encontrada.",
          flags: MessageFlags.Ephemeral,
        });

      const remover = interaction.values;
      const campos = (estacao.formulario_campos || []).filter(
        (c) => !remover.includes(c.id),
      );
      updateEstacao(guildId, estacaoId, { formulario_campos: campos });

      return interaction.update({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `✅ ${remover.length} campo(s) removido(s). Restam ${campos.length}/5 campos.`,
            ),
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (
      interaction.isModalSubmit() &&
      customId.startsWith("submit_form_estacao_")
    ) {
      const estacaoId = customId.replace("submit_form_estacao_", "");
      const estacao = getEstacao(guildId, estacaoId);
      if (!estacao) {
        return interaction.reply({
          content: "❌ Estação não encontrada.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const campos = estacao.formulario_campos || [];
      const respostas = campos.map((c) => {
        const val = interaction.fields
          .getTextInputValue(`campo_${c.id}`)
          .trim();
        return { label: c.label, valor: val };
      });

      if (!global._formRespostas) global._formRespostas = new Map();
      global._formRespostas.set(interaction.user.id, { estacaoId, respostas });

      const linhas = respostas
        .map((r) => `**${r.label}:**\n${r.valor || "*(não informado)*"}`)
        .join("\n\n");

      return interaction.reply({
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "📋 **Informações do Ticket**\n\n" + linhas,
            ),
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};