const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require("discord.js");

const path = require("path");
const fs = require("fs");
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

function getBlacklistDB(guildId) {
  if (!guildId || guildId === "null" || guildId === "undefined") {
    throw new Error("GuildId inválido");
  }

  const filePath = path.resolve(
    __dirname,
    `../../../banco/ticket/${guildId}/blacklist.json`,
  );

  function read() {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return { usuarios: [], cargos: [] };
    }
  }

  function write(data) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf8");
    } catch (err) {
      console.error("[BLACKLIST DB] Erro:", err);
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

function isBlacklisted(guildId, userId, memberRoles) {
  const db = getBlacklistDB(guildId);
  const usuarios = db.get("usuarios") || [];
  const cargos = db.get("cargos") || [];

  if (usuarios.includes(userId)) return true;

  if (memberRoles && cargos.length > 0) {
    const roleIds = memberRoles.map
      ? memberRoles.map((r) => (typeof r === "string" ? r : r.id))
      : Array.from(memberRoles.cache.keys());
    return roleIds.some((rid) => cargos.includes(rid));
  }

  return false;
}

function buildBlacklistPanel(guildId) {
  const db = getBlacklistDB(guildId);
  const usuarios = db.get("usuarios") || [];
  const cargos = db.get("cargos") || [];

  const totalBloqueados = usuarios.length + cargos.length;

  const addUserBtn = new ButtonBuilder()
    .setCustomId("bl_add_user")
    .setLabel(t("bl_btn_add_usuario", guildId))
    .setEmoji(getEmoji(emojis.user))
    .setStyle(ButtonStyle.Secondary);

  const addRoleBtn = new ButtonBuilder()
    .setCustomId("bl_add_role")
    .setLabel(t("bl_btn_add_cargo", guildId))
    .setEmoji(getEmoji(emojis.role))
    .setStyle(ButtonStyle.Secondary);

  const listBtn = new ButtonBuilder()
    .setCustomId("bl_listar")
    .setLabel(t("bl_btn_ver_lista", guildId))
    .setEmoji(getEmoji(emojis.clipboard))
    .setStyle(ButtonStyle.Secondary);

  const clearBtn = new ButtonBuilder()
    .setCustomId("bl_limpar")
    .setLabel(t("bl_btn_limpar", guildId))
    .setEmoji(getEmoji(emojis.trashcan))
    .setStyle(ButtonStyle.Danger);

  const voltarBtn = new ButtonBuilder()
    .setCustomId("configurar_ticket")
    .setLabel(t("bl_btn_voltar", guildId))
    .setEmoji(getEmoji(emojis.arrowl))
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder().addComponents(addUserBtn, addRoleBtn, listBtn);
  const row2 = new ActionRowBuilder().addComponents(clearBtn, voltarBtn);

  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${emojis.block} ${t("bl_titulo", guildId)}`,
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large),
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${emojis.user} ${t("bl_usuarios_titulo", guildId)}**\nTotal: **${usuarios.length}**`,
            ),
          )
          .setButtonAccessory(addUserBtn),
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**${emojis.role} ${t("bl_roles_titulo", guildId)}**\nTotal: **${cargos.length}**`,
            ),
          )
          .setButtonAccessory(addRoleBtn),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# ${emojis.info} Total: **${totalBloqueados}**`,
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(listBtn, clearBtn, voltarBtn),
      ),
  ];
}

module.exports = {
  getBlacklistDB,
  isBlacklisted,
  buildBlacklistPanel,

  customIds: [
    "blacklist_ticket",
    "bl_add_user",
    "bl_add_role",
    "bl_listar",
    "bl_limpar",
    "bl_remove_user_",
    "bl_remove_role_",
    "bl_confirm_limpar",
    "bl_cancel_limpar",
    "bl_select_user",
    "bl_select_role",
    "bl_pagina_usuarios_",
    "bl_pagina_cargos_",
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
    const db = getBlacklistDB(guildId);

    if (customId === "blacklist_ticket") {
      return interaction.update({
        components: buildBlacklistPanel(guildId),
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "bl_add_user") {
      const select = new UserSelectMenuBuilder()
        .setCustomId("bl_select_user")
        .setPlaceholder(t("bl_modal_add_usuario_placeholder", guildId))
        .setMinValues(1)
        .setMaxValues(10);

      const voltarBtn = new ButtonBuilder()
        .setCustomId("blacklist_ticket")
        .setLabel(t("bl_btn_voltar", guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# ${emojis.block} ${t("bl_titulo", guildId)}`,
              ),
              new TextDisplayBuilder().setContent(
                `**${emojis.user} ${t("bl_usuarios_titulo", guildId)}**`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(select),
              new ActionRowBuilder().addComponents(voltarBtn),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "bl_add_role") {
      const select = new RoleSelectMenuBuilder()
        .setCustomId("bl_select_role")
        .setPlaceholder(t("bl_modal_add_cargo_placeholder", guildId))
        .setMinValues(1)
        .setMaxValues(10);

      const voltarBtn = new ButtonBuilder()
        .setCustomId("blacklist_ticket")
        .setLabel(t("bl_btn_voltar", guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# ${emojis.block} ${t("bl_titulo", guildId)}`,
              ),
              new TextDisplayBuilder().setContent(
                `**${emojis.role} ${t("bl_roles_titulo", guildId)}**`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(select),
              new ActionRowBuilder().addComponents(voltarBtn),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isUserSelectMenu() && customId === "bl_select_user") {
      const usuarios = db.get("usuarios") || [];
      const selecionados = interaction.values;
      const adicionados = [];
      const jaExistiam = [];

      for (const uid of selecionados) {
        if (usuarios.includes(uid)) {
          jaExistiam.push(uid);
        } else {
          usuarios.push(uid);
          adicionados.push(uid);
        }
      }

      db.set("usuarios", usuarios);

      let msg = "";
      if (adicionados.length > 0) {
        msg += `${emojis.check} **${adicionados.length}** ${t("bl_add_usuario_sucesso", guildId)}\n${adicionados.map((id) => `<@${id}>`).join(", ")}\n`;
      }
      if (jaExistiam.length > 0) {
        msg += `${emojis.warning} **${jaExistiam.length}** ${t("bl_usuario_ja_existe", guildId)}\n${jaExistiam.map((id) => `<@${id}>`).join(", ")}`;
      }

      const voltarBtn = new ButtonBuilder()
        .setCustomId("blacklist_ticket")
        .setLabel(t("bl_btn_voltar_painel", guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# ${emojis.block} ${t("bl_titulo", guildId)}`,
              ),
              new TextDisplayBuilder().setContent(msg.trim() || `${emojis.cancel} ${t("bl_usuario_nao_encontrado", guildId)}`),
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(voltarBtn),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (interaction.isRoleSelectMenu() && customId === "bl_select_role") {
      const cargos = db.get("cargos") || [];
      const selecionados = interaction.values;
      const adicionados = [];
      const jaExistiam = [];

      for (const rid of selecionados) {
        if (cargos.includes(rid)) {
          jaExistiam.push(rid);
        } else {
          cargos.push(rid);
          adicionados.push(rid);
        }
      }

      db.set("cargos", cargos);

      let msg = "";
      if (adicionados.length > 0) {
        msg += `${emojis.check} **${adicionados.length}** ${t("bl_add_cargo_sucesso", guildId)}\n${adicionados.map((id) => `<@&${id}>`).join(", ")}\n`;
      }
      if (jaExistiam.length > 0) {
        msg += `${emojis.warning} **${jaExistiam.length}** ${t("bl_cargo_ja_existe", guildId)}\n${jaExistiam.map((id) => `<@&${id}>`).join(", ")}`;
      }

      const voltarBtn = new ButtonBuilder()
        .setCustomId("blacklist_ticket")
        .setLabel(t("bl_btn_voltar_painel", guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# ${emojis.block} ${t("bl_titulo", guildId)}`,
              ),
              new TextDisplayBuilder().setContent(msg.trim() || `${emojis.cancel} ${t("bl_cargo_nao_encontrado", guildId)}`),
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(voltarBtn),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId === "bl_listar") {
      const usuarios = db.get("usuarios") || [];
      const cargos = db.get("cargos") || [];

      const PAGE_SIZE = 10;
      const pageU = 0;
      const pageR = 0;

      const usuariosPage = usuarios.slice(pageU * PAGE_SIZE, (pageU + 1) * PAGE_SIZE);
      const cargosPage = cargos.slice(pageR * PAGE_SIZE, (pageR + 1) * PAGE_SIZE);

      const usuariosText =
        usuariosPage.length > 0
          ? usuariosPage
              .map((id, i) => `**${pageU * PAGE_SIZE + i + 1}.** <@${id}> \`${id}\``)
              .join("\n")
          : `${emojis.info} ${t("bl_usuarios_vazio", guildId)}`;

      const cargosText =
        cargosPage.length > 0
          ? cargosPage
              .map((id, i) => `**${pageR * PAGE_SIZE + i + 1}.** <@&${id}> \`${id}\``)
              .join("\n")
          : `${emojis.info} ${t("bl_roles_vazio", guildId)}`;

      const voltarBtn = new ButtonBuilder()
        .setCustomId("blacklist_ticket")
        .setLabel(t("bl_btn_voltar", guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      const rows = [new ActionRowBuilder().addComponents(voltarBtn)];

      if (usuarios.length > 0) {
        const removeUserBtn = new ButtonBuilder()
          .setCustomId("bl_remove_user_0")
          .setLabel(t("bl_btn_add_usuario", guildId))
          .setEmoji(getEmoji(emojis.minus))
          .setStyle(ButtonStyle.Danger);
        rows.unshift(new ActionRowBuilder().addComponents(removeUserBtn));
      }

      if (cargos.length > 0) {
        const removeRoleBtn = new ButtonBuilder()
          .setCustomId("bl_remove_role_0")
          .setLabel(t("bl_btn_add_cargo", guildId))
          .setEmoji(getEmoji(emojis.minus))
          .setStyle(ButtonStyle.Danger);
        if (rows[0]?.components?.length < 5) {
          rows[0].addComponents(removeRoleBtn);
        } else {
          rows.unshift(new ActionRowBuilder().addComponents(removeRoleBtn));
        }
      }

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# ${emojis.block} ${t("bl_titulo", guildId)}`,
              ),
              new TextDisplayBuilder().setContent(
                `**${emojis.user} ${t("bl_usuarios_titulo", guildId)}** (${usuarios.length})\n${usuariosText}`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large),
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**${emojis.role} ${t("bl_roles_titulo", guildId)}** (${cargos.length})\n${cargosText}`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(...rows),
        ],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
        content: null,
      });
    }

    if (customId.startsWith("bl_remove_user_")) {
      const usuarios = db.get("usuarios") || [];

      if (usuarios.length === 0) {
        return interaction.update({
          components: buildBlacklistPanel(guildId),
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("modal_bl_remove_user")
        .setTitle(t("bl_modal_add_usuario_titulo", guildId));

      const input = new TextInputBuilder()
        .setCustomId("bl_user_id_input")
        .setLabel(t("bl_modal_add_usuario_label", guildId))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(t("bl_modal_add_usuario_placeholder", guildId))
        .setRequired(true)
        .setMinLength(15)
        .setMaxLength(20);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (customId.startsWith("bl_remove_role_")) {
      const cargos = db.get("cargos") || [];

      if (cargos.length === 0) {
        return interaction.update({
          components: buildBlacklistPanel(guildId),
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("modal_bl_remove_role")
        .setTitle(t("bl_modal_add_cargo_titulo", guildId));

      const input = new TextInputBuilder()
        .setCustomId("bl_role_id_input")
        .setLabel(t("bl_modal_add_cargo_label", guildId))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(t("bl_modal_add_cargo_placeholder", guildId))
        .setRequired(true)
        .setMinLength(15)
        .setMaxLength(20);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === "modal_bl_remove_user") {
      const idInput = interaction.fields.getTextInputValue("bl_user_id_input").trim();
      const usuarios = db.get("usuarios") || [];

      if (!usuarios.includes(idInput)) {
        const voltarBtn = new ButtonBuilder()
          .setCustomId("bl_listar")
          .setLabel(t("bl_btn_voltar_lista", guildId))
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary);

        return interaction.update({
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${emojis.cancel} ${t("bl_usuario_nao_encontrado", guildId)} \`${idInput}\``,
                ),
              )
              .addActionRowComponents(
                new ActionRowBuilder().addComponents(voltarBtn),
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const novosUsuarios = usuarios.filter((u) => u !== idInput);
      db.set("usuarios", novosUsuarios);

      const voltarBtn = new ButtonBuilder()
        .setCustomId("blacklist_ticket")
        .setLabel(t("bl_btn_voltar_painel", guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.check} ${t("bl_remover_usuario_sucesso", guildId)} <@${idInput}>`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(voltarBtn),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (interaction.isModalSubmit() && customId === "modal_bl_remove_role") {
      const idInput = interaction.fields.getTextInputValue("bl_role_id_input").trim();
      const cargos = db.get("cargos") || [];

      if (!cargos.includes(idInput)) {
        const voltarBtn = new ButtonBuilder()
          .setCustomId("bl_listar")
          .setLabel(t("bl_btn_voltar_lista", guildId))
          .setEmoji(getEmoji(emojis.arrowl))
          .setStyle(ButtonStyle.Secondary);

        return interaction.update({
          components: [
            new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${emojis.cancel} ${t("bl_cargo_nao_encontrado", guildId)} \`${idInput}\``,
                ),
              )
              .addActionRowComponents(
                new ActionRowBuilder().addComponents(voltarBtn),
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const novosCargos = cargos.filter((r) => r !== idInput);
      db.set("cargos", novosCargos);

      const voltarBtn = new ButtonBuilder()
        .setCustomId("blacklist_ticket")
        .setLabel(t("bl_btn_voltar_painel", guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.check} ${t("bl_remover_cargo_sucesso", guildId)} <@&${idInput}>`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(voltarBtn),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "bl_limpar") {
      const usuarios = db.get("usuarios") || [];
      const cargos = db.get("cargos") || [];
      const total = usuarios.length + cargos.length;

      if (total === 0) {
        return interaction.update({
          components: buildBlacklistPanel(guildId),
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const confirmarBtn = new ButtonBuilder()
        .setCustomId("bl_confirm_limpar")
        .setLabel(t("bl_btn_limpar", guildId))
        .setEmoji(getEmoji(emojis.check))
        .setStyle(ButtonStyle.Danger);

      const cancelarBtn = new ButtonBuilder()
        .setCustomId("bl_cancel_limpar")
        .setLabel(t("bl_btn_voltar", guildId))
        .setEmoji(getEmoji(emojis.cancel))
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# ${emojis.warning} ${t("bl_titulo", guildId)}`,
              ),
              new TextDisplayBuilder().setContent(
                `${t("bl_desc", guildId)} **${total}**`,
              ),
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(confirmarBtn, cancelarBtn),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "bl_confirm_limpar") {
      db.set("usuarios", []);
      db.set("cargos", []);

      const voltarBtn = new ButtonBuilder()
        .setCustomId("blacklist_ticket")
        .setLabel(t("bl_btn_voltar_painel", guildId))
        .setEmoji(getEmoji(emojis.arrowl))
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${emojis.check} ${t("bl_limpar_sucesso", guildId)}`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(voltarBtn),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (customId === "bl_cancel_limpar") {
      return interaction.update({
        components: buildBlacklistPanel(guildId),
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};