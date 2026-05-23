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

function criarPainelPrincipal(db) {
  const teamRoles = db.get("team") || [];
  const usersPerms = db.get("usersperms") || {};
  const totalRoles = teamRoles.length;
  const totalUsers = Object.keys(usersPerms).length;

  const rolesText =
    totalRoles > 0
      ? teamRoles
          .slice(0, 5)
          .map((id) => `<@&${id}>`)
          .join(", ") + (totalRoles > 5 ? ` e mais ${totalRoles - 5}...` : "")
      : "Nenhum cargo configurado";

  const usersText =
    totalUsers > 0
      ? `${totalUsers} usuário(s) com permissões personalizadas`
      : "Nenhum usuário configurado";

  const btnAdicionarCargo = new ButtonBuilder()
    .setCustomId("eq_add_role")
    .setLabel("Gerenciar Cargos")
    .setEmoji(getEmoji(emojis.role))
    .setStyle(ButtonStyle.Secondary);

  const btnAdicionarUsuario = new ButtonBuilder()
    .setCustomId("eq_add_user")
    .setLabel("Gerenciar Usuários")
    .setEmoji(getEmoji(emojis.users))
    .setStyle(ButtonStyle.Secondary);

  const btnListar = new ButtonBuilder()
    .setCustomId("eq_listar")
    .setLabel("Ver Equipe")
    .setEmoji(getEmoji(emojis.user))
    .setStyle(ButtonStyle.Secondary);

  const btnLimpar = new ButtonBuilder()
    .setCustomId("eq_limpar")
    .setLabel("Limpar Tudo")
    .setEmoji(getEmoji(emojis.lixeira))
    .setStyle(ButtonStyle.Danger);

  const btnVoltar = new ButtonBuilder()
    .setCustomId("configurar_ticket")
    .setLabel("Voltar")
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.suporte} **Permissões de Atendimento**`,
      ),
      new TextDisplayBuilder().setContent(
        "Gerencie quais cargos e usuários podem atender ou configurar tickets.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.role} **Cargos permitidos:** ${rolesText}\n` +
          `${emojis.users} **Usuários:** ${usersText}`,
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

function criarPainelGerenciarCargos(guild, db) {
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
      : "Nenhum cargo definido ainda.";

  const select = new RoleSelectMenuBuilder()
    .setCustomId("eq_select_roles")
    .setPlaceholder("Selecione os cargos permitidos")
    .setMinValues(0)
    .setMaxValues(25);

  if (teamRoles.length > 0) {
    select.setDefaultRoles(...teamRoles);
  }

  const btnVoltar = new ButtonBuilder()
    .setCustomId("team_ticket")
    .setLabel("Voltar")
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.role} **Gerenciar Cargos**`,
      ),
      new TextDisplayBuilder().setContent(
        "Selecione os cargos que poderão atender tickets. Remova um cargo desmarcando-o.",
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Cargos atuais:**\n${rolesText}`),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(btnVoltar),
    );

  return [container];
}

function criarPainelGerenciarUsuario(userId, db) {
  const perms = db.get(`usersperms.${userId}`) || [];
  const hasAtender = perms.includes("Atender ticket");
  const hasConfigurar = perms.includes("Configurar bot");

  const btnAtender = new ButtonBuilder()
    .setCustomId(`eq_perm_atender_${userId}`)
    .setLabel("Atender Ticket")
    .setEmoji(getOnOffEmoji(hasAtender))
    .setStyle(hasAtender ? ButtonStyle.Success : ButtonStyle.Secondary);

  const btnConfigurar = new ButtonBuilder()
    .setCustomId(`eq_perm_configurar_${userId}`)
    .setLabel("Configurar Bot")
    .setEmoji(getOnOffEmoji(hasConfigurar))
    .setStyle(hasConfigurar ? ButtonStyle.Success : ButtonStyle.Secondary);

  const btnRemover = new ButtonBuilder()
    .setCustomId(`eq_remover_usuario_${userId}`)
    .setLabel("Remover Usuário")
    .setEmoji(getEmoji(emojis.lixeira))
    .setStyle(ButtonStyle.Danger);

  const btnVoltar = new ButtonBuilder()
    .setCustomId("team_ticket")
    .setLabel("Voltar")
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const statusText =
    `${hasAtender ? emojis.check : emojis.cancel} Atender ticket\n` +
    `${hasConfigurar ? emojis.check : emojis.cancel} Configurar bot`;

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.user} **Permissões do Usuário**`,
      ),
      new TextDisplayBuilder().setContent(`Usuário: <@${userId}>`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Status das permissões:**\n${statusText}`,
      ),
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

function criarPainelListarEquipe(guild, db) {
  const teamRoles = db.get("team") || [];
  const usersPerms = db.get("usersperms") || {};
  const entries = Object.entries(usersPerms);

  const btnVoltar = new ButtonBuilder()
    .setCustomId("team_ticket")
    .setLabel("Voltar")
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
          .join("\n") || "Cargos não encontrados no servidor"
      : "Nenhum cargo configurado";

  let usersText = "Nenhum usuário com permissões personalizadas";
  if (entries.length > 0) {
    usersText = entries
      .map(([uid, perms]) => {
        const permList =
          perms.length > 0
            ? perms.map((p) => `  ${emojis.check} ${p}`).join("\n")
            : `  ${emojis.cancel} Sem permissões`;
        return `<@${uid}>\n${permList}`;
      })
      .join("\n\n");
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.users} **Equipe de Atendimento**`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.role} **Cargos permitidos:**\n${rolesText}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.user} **Usuários com permissões:**\n${usersText}`,
      ),
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

    const db = getConfigDB(interaction.guild.id);

    if (customId === "team_ticket") {
      const components = criarPainelPrincipal(db);
      return safeUpdate(interaction, {
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "eq_add_role") {
      const components = criarPainelGerenciarCargos(interaction.guild, db);
      return safeUpdate(interaction, {
        components,
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isRoleSelectMenu() && customId === "eq_select_roles") {
      db.set("team", interaction.values);

      const components = criarPainelPrincipal(db);
      const rolesText =
        interaction.values.length > 0
          ? interaction.values.map((id) => `<@&${id}>`).join(", ")
          : "Nenhum cargo";

      const container = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${emojis.check} **Cargos atualizados!**`,
        ),
        new TextDisplayBuilder().setContent(`Cargos salvos: ${rolesText}`),
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
        .setTitle("Adicionar Usuário à Equipe");

      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("eq_user_select_modal")
        .setPlaceholder("Escolha um usuário")
        .setRequired(true);

      const userLabel = new LabelBuilder()
        .setLabel("Selecione o usuário")
        .setDescription("O usuário receberá permissões personalizadas")
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
          new TextDisplayBuilder().setContent("❌ Nenhum usuário selecionado."),
        );
        return safeReply(interaction, {
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      if (!db.has("usersperms")) db.set("usersperms", {});
      const currentPerms = db.get(`usersperms.${userId}`) || [];
      db.set(`usersperms.${userId}`, currentPerms);

      const components = criarPainelGerenciarUsuario(userId, db);
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

      const components = criarPainelGerenciarUsuario(userId, db);
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

      const components = criarPainelGerenciarUsuario(userId, db);
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
          `${emojis.check} Usuário <@${userId}> removido da equipe.`,
        ),
      );

      const mainComponents = criarPainelPrincipal(db);

      return safeUpdate(interaction, {
        components: [container, ...mainComponents],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "eq_listar") {
      const components = criarPainelListarEquipe(interaction.guild, db);
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
        .setTitle("Confirmar Limpeza de Permissões");

      const inputConfirm = new TextInputBuilder()
        .setCustomId("confirmacao_limpar")
        .setLabel("Digite CONFIRMAR para prosseguir")
        .setPlaceholder("CONFIRMAR")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const label = new LabelBuilder()
        .setLabel("⚠️ Atenção: ação irreversível!")
        .setDescription("Todos os cargos e permissões serão removidos")
        .setTextInputComponent(inputConfirm);

      modal.addLabelComponents(label);
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === "modal_eq_limpar") {
      const resposta = interaction.fields
        .getTextInputValue("confirmacao_limpar")
        .trim()
        .toUpperCase();

      if (resposta !== "CONFIRMAR") {
        const container = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "❌ Confirmação incorreta. Nenhuma permissão foi alterada.",
          ),
        );
        return safeReply(interaction, {
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      db.set("team", []);
      db.set("usersperms", {});

      const container = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${emojis.check} **Permissões resetadas com sucesso!**`,
        ),
        new TextDisplayBuilder().setContent(
          "Todos os cargos e permissões de usuários foram removidos.",
        ),
      );

      return safeReply(interaction, {
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    if (customId === "adicionar_cargo") {
      const components = criarPainelGerenciarCargos(interaction.guild, db);
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
        .setTitle("Adicionar Usuário à Equipe");

      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("eq_user_select_modal")
        .setPlaceholder("Escolha um usuário")
        .setRequired(true);

      const userLabel = new LabelBuilder()
        .setLabel("Selecione o usuário")
        .setDescription("O usuário receberá permissões personalizadas")
        .setUserSelectMenuComponent(userSelect);

      modal.addLabelComponents(userLabel);
      return interaction.showModal(modal);
    }
  },
};