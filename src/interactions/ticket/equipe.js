const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  LabelBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require("discord.js");

const { getEmoji, getConfigDB } = require("./helpers");

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

const { t } = require("../../utils/i18n");

function getOnOffEmoji(status) {
  return status ? getEmoji(emojis.on) : getEmoji(emojis.off);
}

function safeUpdate(interaction, options) {
  return interaction.update(options).catch((err) => {
    if (err?.code !== 10062) throw err;
  });
}

function safeReply(interaction, options) {
  return interaction.reply(options).catch((err) => {
    if (err?.code !== 10062) throw err;
  });
}

function criarPainelPrincipal(db, guildId) {
  const teamRoles = db.get("team") || [];
  const usersPerms = db.get("usersperms") || {};
  const totalRoles = teamRoles.length;
  const totalUsers = Object.keys(usersPerms).length;

  const rolesText =
    totalRoles > 0
      ? teamRoles
          .slice(0, 5)
          .map((id) => `<@&${id}>`)
          .join(", ") +
          (totalRoles > 5 ? ` ${t("eq_e_mais", guildId, { n: totalRoles - 5 })}` : "")
      : t("eq_nenhum_cargo", guildId);

  const usersText =
    totalUsers > 0
      ? t("eq_usuarios_com_perms", guildId, { n: totalUsers })
      : t("eq_nenhum_usuario", guildId);

  const btnAdicionarCargo = new ButtonBuilder()
    .setCustomId("eq_add_role")
    .setLabel(t("eq_btn_gerenciar_cargos", guildId))
    .setEmoji(getEmoji(emojis.role))
    .setStyle(ButtonStyle.Secondary);

  const btnAdicionarUsuario = new ButtonBuilder()
    .setCustomId("eq_add_user")
    .setLabel(t("eq_btn_gerenciar_usuarios", guildId))
    .setEmoji(getEmoji(emojis.users))
    .setStyle(ButtonStyle.Secondary);

  const btnListar = new ButtonBuilder()
    .setCustomId("eq_listar")
    .setLabel(t("eq_btn_ver_equipe", guildId))
    .setEmoji(getEmoji(emojis.user))
    .setStyle(ButtonStyle.Secondary);

  const btnLimpar = new ButtonBuilder()
    .setCustomId("eq_limpar")
    .setLabel(t("eq_btn_limpar_tudo", guildId))
    .setEmoji(getEmoji(emojis.lixeira))
    .setStyle(ButtonStyle.Danger);

  const btnVoltar = new ButtonBuilder()
    .setCustomId("configurar_ticket")
    .setLabel(t("btn_voltar", guildId))
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(t("eq_titulo", guildId)),
      new TextDisplayBuilder().setContent(t("eq_desc", guildId)),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        t("eq_painel_status", guildId, { cargos: rolesText, usuarios: usersText }),
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        btnAdicionarCargo,
        btnAdicionarUsuario,
        btnListar,
      ),
      new ActionRowBuilder().addComponents(btnLimpar, btnVoltar),
    );

  return [container];
}

function criarPainelGerenciarCargos(guild, db, guildId) {
  const teamRoles = db.get("team") || [];

  const rolesText =
    teamRoles.length > 0
      ? teamRoles
          .map((id) => {
            const r = guild.roles.cache.get(id);
            return r ? `• ${r.toString()}` : null;
          })
          .filter(Boolean)
          .join("\n")
      : t("eq_nenhum_cargo_definido", guildId);

  const select = new RoleSelectMenuBuilder()
    .setCustomId("eq_select_roles")
    .setPlaceholder(t("eq_select_cargos_placeholder", guildId))
    .setMinValues(0)
    .setMaxValues(25);

  if (teamRoles.length > 0) {
    select.setDefaultRoles(...teamRoles);
  }

  const btnVoltar = new ButtonBuilder()
    .setCustomId("team_ticket")
    .setLabel(t("btn_voltar", guildId))
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(t("eq_gerenciar_cargos_titulo", guildId)),
      new TextDisplayBuilder().setContent(t("eq_gerenciar_cargos_desc", guildId)),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(t("eq_cargos_atuais", guildId, { cargos: rolesText })),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(btnVoltar),
    );

  return [container];
}

function criarPainelGerenciarUsuario(userId, db, guildId) {
  const perms = db.get(`usersperms.${userId}`) || [];
  const hasAtender = perms.includes("Atender ticket");
  const hasConfigurar = perms.includes("Configurar bot");

  const btnAtender = new ButtonBuilder()
    .setCustomId(`eq_perm_atender_${userId}`)
    .setLabel(t("eq_perm_atender", guildId))
    .setEmoji(getOnOffEmoji(hasAtender))
    .setStyle(hasAtender ? ButtonStyle.Success : ButtonStyle.Secondary);

  const btnConfigurar = new ButtonBuilder()
    .setCustomId(`eq_perm_configurar_${userId}`)
    .setLabel(t("eq_perm_configurar", guildId))
    .setEmoji(getOnOffEmoji(hasConfigurar))
    .setStyle(hasConfigurar ? ButtonStyle.Success : ButtonStyle.Secondary);

  const btnRemover = new ButtonBuilder()
    .setCustomId(`eq_remover_usuario_${userId}`)
    .setLabel(t("eq_btn_remover_usuario", guildId))
    .setEmoji(getEmoji(emojis.lixeira))
    .setStyle(ButtonStyle.Danger);

  const btnVoltar = new ButtonBuilder()
    .setCustomId("team_ticket")
    .setLabel(t("btn_voltar", guildId))
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const atenderLabel = t("eq_perm_atender", guildId);
  const configurarLabel = t("eq_perm_configurar", guildId);
  const statusText =
    `${hasAtender ? emojis.check : emojis.cancel} ${atenderLabel}\n` +
    `${hasConfigurar ? emojis.check : emojis.cancel} ${configurarLabel}`;

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(t("eq_permissoes_usuario_titulo", guildId)),
      new TextDisplayBuilder().setContent(t("eq_permissoes_usuario_usuario", guildId, { userId })),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(t("eq_status_permissoes", guildId, { status: statusText })),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(btnAtender, btnConfigurar),
      new ActionRowBuilder().addComponents(btnRemover, btnVoltar),
    );

  return [container];
}

function criarPainelListarEquipe(guild, db, guildId) {
  const teamRoles = db.get("team") || [];
  const usersPerms = db.get("usersperms") || {};
  const entries = Object.entries(usersPerms);

  const btnVoltar = new ButtonBuilder()
    .setCustomId("team_ticket")
    .setLabel(t("btn_voltar", guildId))
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const rolesText =
    teamRoles.length > 0
      ? teamRoles
          .map((id) => {
            const r = guild.roles.cache.get(id);
            return r ? `• ${r.toString()}` : null;
          })
          .filter(Boolean)
          .join("\n") || t("eq_cargos_nao_encontrados", guildId)
      : t("eq_nenhum_cargo", guildId);

  const permMap = {
    "Atender ticket": t("eq_perm_atender", guildId),
    "Configurar bot": t("eq_perm_configurar", guildId),
  };

  let usersText = t("eq_sem_usuarios_perms", guildId);
  if (entries.length > 0) {
    usersText = entries
      .map(([uid, perms]) => {
        const permList =
          perms.length > 0
            ? perms.map((p) => `  ${emojis.check} ${permMap[p] || p}`).join("\n")
            : `  ${emojis.cancel} ${t("eq_sem_permissoes", guildId)}`;
        return `<@${uid}>\n${permList}`;
      })
      .join("\n\n");
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(t("eq_equipe_titulo", guildId)),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(t("eq_cargos_lista", guildId, { cargos: rolesText })),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(t("eq_usuarios_lista", guildId, { usuarios: usersText })),
    )
    .addActionRowComponents(new ActionRowBuilder().addComponents(btnVoltar));

  return [container];
}

module.exports = {
  customIds: [
    "team_ticket",
    "eq_add_role",
    "eq_add_user",
    "eq_listar",
    "eq_limpar",
    "eq_perm_atender_",
    "eq_perm_configurar_",
    "eq_remover_usuario_",
    "eq_select_roles",
    "eq_select_user",
    "eq_modal_add_user",
    "modal_eq_limpar",
    "modal_eq_add_user",
  ],

  async execute(client, interaction) {
    const { customId } = interaction;

    const belongsToThis = module.exports.customIds.some(
      (id) => customId && (customId === id || customId.startsWith(id)),
    );
    if (!belongsToThis) return;

    if (!interaction._fromPainel) return;
    if (!interaction.guild) return;

    const guildId = interaction.guildId;
    const db = getConfigDB(interaction.guild.id);

    if (customId === "team_ticket") {
      const components = criarPainelPrincipal(db, guildId);
      return safeUpdate(interaction, {
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "eq_add_role") {
      const components = criarPainelGerenciarCargos(interaction.guild, db, guildId);
      return safeUpdate(interaction, {
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isRoleSelectMenu() && customId === "eq_select_roles") {
      db.set("team", interaction.values);

      const components = criarPainelPrincipal(db, guildId);
      const rolesText =
        interaction.values.length > 0
          ? interaction.values.map((id) => `<@&${id}>`).join(", ")
          : t("eq_nenhum_cargo_salvo", guildId);

      const container = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(t("eq_cargos_atualizados", guildId)),
        new TextDisplayBuilder().setContent(t("eq_cargos_salvos", guildId, { cargos: rolesText })),
      );

      return safeUpdate(interaction, {
        components: [container, ...components],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "eq_add_user") {
      const modal = new ModalBuilder()
        .setCustomId("modal_eq_add_user")
        .setTitle(t("eq_modal_add_user_titulo", guildId));

      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("eq_user_select_modal")
        .setPlaceholder(t("eq_select_usuario_placeholder", guildId))
        .setRequired(true);

      const userLabel = new LabelBuilder()
        .setLabel(t("eq_label_selecionar_usuario", guildId))
        .setDescription(t("eq_label_usuario_desc", guildId))
        .setUserSelectMenuComponent(userSelect);

      modal.addLabelComponents(userLabel);

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === "modal_eq_add_user") {
      const field = interaction.fields.getField("eq_user_select_modal");
      const userId =
        field?.value ?? (Array.isArray(field?.values) ? field.values[0] : null);

      if (!userId) {
        const container = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(t("eq_nenhum_usuario_selecionado", guildId)),
        );
        return safeReply(interaction, {
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (!db.has("usersperms")) db.set("usersperms", {});
      const currentPerms = db.get(`usersperms.${userId}`) || [];
      db.set(`usersperms.${userId}`, currentPerms);

      const components = criarPainelGerenciarUsuario(userId, db, guildId);
      return interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && customId.startsWith("eq_perm_atender_")) {
      const userId = customId.replace("eq_perm_atender_", "");
      let perms = db.get(`usersperms.${userId}`) || [];

      if (perms.includes("Atender ticket")) {
        perms = perms.filter((p) => p !== "Atender ticket");
      } else {
        perms.push("Atender ticket");
      }
      perms = [...new Set(perms)];
      db.set(`usersperms.${userId}`, perms);

      const components = criarPainelGerenciarUsuario(userId, db, guildId);
      return safeUpdate(interaction, {
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && customId.startsWith("eq_perm_configurar_")) {
      const userId = customId.replace("eq_perm_configurar_", "");
      let perms = db.get(`usersperms.${userId}`) || [];

      if (perms.includes("Configurar bot")) {
        perms = perms.filter((p) => p !== "Configurar bot");
      } else {
        perms.push("Configurar bot");
      }
      perms = [...new Set(perms)];
      db.set(`usersperms.${userId}`, perms);

      const components = criarPainelGerenciarUsuario(userId, db, guildId);
      return safeUpdate(interaction, {
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isButton() && customId.startsWith("eq_remover_usuario_")) {
      const userId = customId.replace("eq_remover_usuario_", "");
      const usersPerms = db.get("usersperms") || {};
      delete usersPerms[userId];
      db.set("usersperms", usersPerms);

      const container = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          t("eq_usuario_removido", guildId, { userId }),
        ),
      );

      const mainComponents = criarPainelPrincipal(db, guildId);

      return safeUpdate(interaction, {
        components: [container, ...mainComponents],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "eq_listar") {
      const components = criarPainelListarEquipe(interaction.guild, db, guildId);
      return safeUpdate(interaction, {
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "eq_limpar") {
      const modal = new ModalBuilder()
        .setCustomId("modal_eq_limpar")
        .setTitle(t("eq_modal_limpar_titulo", guildId));

      const inputConfirm = new TextInputBuilder()
        .setCustomId("confirmacao_limpar")
        .setLabel(t("eq_label_confirmar_limpeza", guildId))
        .setPlaceholder(t("eq_confirmar_palavra", guildId))
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const label = new LabelBuilder()
        .setLabel(t("eq_label_atencao", guildId))
        .setDescription(t("eq_label_atencao_desc", guildId))
        .setTextInputComponent(inputConfirm);

      modal.addLabelComponents(label);
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === "modal_eq_limpar") {
      const resposta = interaction.fields
        .getTextInputValue("confirmacao_limpar")
        .trim()
        .toUpperCase();

      const expected = t("eq_confirmar_palavra", guildId).trim().toUpperCase();

      if (resposta !== expected) {
        const container = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(t("eq_confirmacao_incorreta", guildId)),
        );
        return safeReply(interaction, {
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      db.set("team", []);
      db.set("usersperms", {});

      const container = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(t("eq_permissoes_resetadas", guildId)),
        new TextDisplayBuilder().setContent(t("eq_permissoes_resetadas_desc", guildId)),
      );

      return safeReply(interaction, {
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    if (customId === "adicionar_cargo") {
      const components = criarPainelGerenciarCargos(interaction.guild, db, guildId);
      return safeUpdate(interaction, {
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "adicionar_usuario") {
      const modal = new ModalBuilder()
        .setCustomId("modal_eq_add_user")
        .setTitle(t("eq_modal_add_user_titulo", guildId));

      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("eq_user_select_modal")
        .setPlaceholder(t("eq_select_usuario_placeholder", guildId))
        .setRequired(true);

      const userLabel = new LabelBuilder()
        .setLabel(t("eq_label_selecionar_usuario", guildId))
        .setDescription(t("eq_label_usuario_desc", guildId))
        .setUserSelectMenuComponent(userSelect);

      modal.addLabelComponents(userLabel);
      return interaction.showModal(modal);
    }
  },
};