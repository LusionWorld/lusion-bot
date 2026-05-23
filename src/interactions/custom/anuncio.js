const {
  ContainerBuilder,
  MessageFlags,
  ButtonStyle,
  ButtonBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js')
const { JsonDatabase } = require('wio.db')
const path = require('path')
const fs = require('fs')

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

module.exports = {
  async execute(client, interaction) {
    const anuncioIds = [
      'criar_anuncio',
      'anuncios_salvos',
      'abrir_outros',
      'voltar_anuncio_principal',
      'voltar_menu',
      'voltar_anuncios_salvos',
      'salvar_edicao',
      'excluir_anuncio',
      'finalizar_anuncio',
      'envio_rapido',
      'adicionar_link',
      'ver_todos_links',
      'voltar_outros',
      'salvar_anuncio',
      'alterar_nome',
      'alterar_descricao',
      'alterar_imagem_titulo',
      'alterar_imagem',
      'alterar_thumbnail',
      'alterar_footer',
      'alterar_cor',
    ];

    const isAnuncioInteraction =
      (interaction.isButton() && anuncioIds.some(id => interaction.customId === id || interaction.customId.startsWith('editar_link_'))) ||
      (interaction.isModalSubmit() && (
        interaction.customId.startsWith('modal_') &&
        (interaction.customId.includes('anuncio') ||
          interaction.customId.includes('link') ||
          interaction.customId.includes('nome') ||
          interaction.customId.includes('descricao') ||
          interaction.customId.includes('imagem') ||
          interaction.customId.includes('thumbnail') ||
          interaction.customId.includes('footer') ||
          interaction.customId.includes('cor') ||
          interaction.customId.includes('exclusao'))
      )) ||
      (interaction.isStringSelectMenu() && interaction.customId === 'select_anuncio_salvo') ||
      (interaction.isChannelSelectMenu() && interaction.customId === 'selecionar_canal');

    if (!isAnuncioInteraction) return;

    if (!client.anuncioData) client.anuncioData = {}

    const userId = interaction.user.id
    if (!client.anuncioData[userId]) {
      client.anuncioData[userId] = {
        nome: 'No name',
        descricao: 'No description',
        imagemTitulo: 'No title image defined',
        imagem: 'No image defined',
        thumbnail: 'No thumbnail defined',
        footer: 'No footer defined',
        links: [],
        cor: 'No color defined',
        isEditing: false,
        editingKey: null,
        showImagemTituloGallery: false,
        showOutrosMenu: false,
      }
    }

    const anuncio = client.anuncioData[userId]

    function isValidURL(string) {
      try {
        new URL(string)
        return true
      } catch (_) {
        return false
      }
    }

    function isValidHexColor(color) {
      const hexRegex = /^#([0-9A-F]{3}){1,2}$/i
      return hexRegex.test(color)
    }

    function hexToDecimal(hex) {
      return parseInt(hex.replace('#', ''), 16)
    }

    function criarMenuPrincipal() {
      return new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents((td) =>
          td.setContent('📢 **Announcement System**'),
        )
        .addSectionComponents((section) =>
          section
            .addTextDisplayComponents((td) =>
              td.setContent('Click here to create a new announcement'),
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId('criar_anuncio')
                .setLabel('Create Announcement')
                .setEmoji(getEmoji(emojis.plus))
                .setStyle(ButtonStyle.Secondary),
            ),
        )
        .addSeparatorComponents((separator) => separator)
        .addSectionComponents((section) =>
          section
            .addTextDisplayComponents((td) =>
              td.setContent('Click here to send a saved announcement'),
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId('anuncios_salvos')
                .setLabel('Saved Announcements')
                .setEmoji(getEmoji(emojis.fav))
                .setStyle(ButtonStyle.Secondary),
            ),
        )
    }

    function criarContainerOutros(anuncioData) {
      let corContainer = null
      if (anuncioData.cor && !anuncioData.cor.startsWith('No ')) {
        if (isValidHexColor(anuncioData.cor)) {
          corContainer = hexToDecimal(anuncioData.cor)
        }
      }

      const container = new ContainerBuilder()
        .setAccentColor(corContainer)
        .addTextDisplayComponents((td) =>
          td.setContent(
            anuncioData.isEditing
              ? `⚙️ **Other Options - Editing: ${anuncioData.editingKey}**`
              : '⚙️ **Announcement Options**',
          ),
        )

      const linksTexto =
        anuncioData.links.length > 0
          ? anuncioData.links
            .map(
              (link, index) => `**${index + 1}.** ${link.nome} - ${link.url}`,
            )
            .join('\n')
          : 'No links defined'

      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((td) =>
            td.setContent(
              `**Announcement links (${anuncioData.links.length}/5)**\n${linksTexto}`,
            ),
          )
          .setButtonAccessory((button) =>
            button
              .setCustomId('adicionar_link')
              .setLabel(
                anuncioData.links.length < 5
                  ? 'Add Link'
                  : 'Max (5/5)',
              )
              .setEmoji(getEmoji(emojis.plus))
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(anuncioData.links.length >= 5),
          ),
      )

      if (anuncioData.links.length > 0) {
        container.addSectionComponents((section) =>
          section
            .addTextDisplayComponents((td) =>
              td.setContent(
                'Click to view all added links',
              ),
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId('ver_todos_links')
                .setLabel('View All Links')
                .setEmoji(getEmoji(emojis.url))
                .setStyle(ButtonStyle.Secondary),
            ),
        )
      }

      container.addSeparatorComponents((separator) => separator)

      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((td) =>
            td.setContent(`**Embed color**\n${anuncioData.cor}`),
          )
          .setButtonAccessory((button) =>
            button
              .setCustomId('alterar_cor')
              .setLabel('Change')
              .setEmoji(getEmoji(emojis.settings))
              .setStyle(ButtonStyle.Secondary),
          ),
      )

      container.addSeparatorComponents((separator) => separator)

      container.addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ButtonBuilder()
            .setCustomId('voltar_anuncio_principal')
            .setLabel('Back')
            .setEmoji(getEmoji(emojis.arrowl))
            .setStyle(ButtonStyle.Secondary),
        ),
      )

      return container
    }

    function criarContainerAnuncio(anuncioData) {
      let corContainer = null
      if (anuncioData.cor && !anuncioData.cor.startsWith('No ')) {
        if (isValidHexColor(anuncioData.cor)) {
          corContainer = hexToDecimal(anuncioData.cor)
        }
      }

      const container = new ContainerBuilder()
        .setAccentColor(corContainer)
        .addTextDisplayComponents((td) =>
          td.setContent(
            anuncioData.isEditing
              ? `✏️ **Editing Announcement: ${anuncioData.editingKey}**`
              : '✏️ **Create New Announcement**',
          ),
        )

      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((td) =>
            td.setContent(`**Announcement name**\n${anuncioData.nome}`),
          )
          .setButtonAccessory((button) =>
            button
              .setCustomId('alterar_nome')
              .setLabel('Change')
              .setEmoji(getEmoji(emojis.settings))
              .setStyle(ButtonStyle.Secondary),
          ),
      )

      container.addSeparatorComponents((separator) => separator)

      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((td) =>
            td.setContent(`**Announcement description**\n${anuncioData.descricao}`),
          )
          .setButtonAccessory((button) =>
            button
              .setCustomId('alterar_descricao')
              .setLabel('Change')
              .setEmoji(getEmoji(emojis.settings))
              .setStyle(ButtonStyle.Secondary),
          ),
      )

      container.addSeparatorComponents((separator) => separator)

      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((td) =>
            td.setContent(`**Title image**\n${anuncioData.imagemTitulo}`),
          )
          .setButtonAccessory((button) =>
            button
              .setCustomId('alterar_imagem_titulo')
              .setLabel('Change')
              .setEmoji(getEmoji(emojis.settings))
              .setStyle(ButtonStyle.Secondary),
          ),
      )

      if (isValidURL(anuncioData.imagemTitulo)) {
        container.addMediaGalleryComponents((gallery) =>
          gallery.addItems({
            description: 'Title image',
            media: {
              url: anuncioData.imagemTitulo,
            },
          }),
        )
      }

      container.addSeparatorComponents((separator) => separator)

      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((td) =>
            td.setContent(`**Embed image**\n${anuncioData.imagem}`),
          )
          .setButtonAccessory((button) =>
            button
              .setCustomId('alterar_imagem')
              .setLabel('Change')
              .setEmoji(getEmoji(emojis.settings))
              .setStyle(ButtonStyle.Secondary),
          ),
      )

      if (isValidURL(anuncioData.imagem)) {
        container.addMediaGalleryComponents((gallery) =>
          gallery.addItems({
            description: 'Embed image',
            media: {
              url: anuncioData.imagem,
            },
          }),
        )
      }

      container.addSeparatorComponents((separator) => separator)

      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((td) =>
            td.setContent(`**Embed thumbnail**\n${anuncioData.thumbnail}`),
          )
          .setButtonAccessory((button) =>
            button
              .setCustomId('alterar_thumbnail')
              .setLabel('Change')
              .setEmoji(getEmoji(emojis.settings))
              .setStyle(ButtonStyle.Secondary),
          ),
      )

      if (isValidURL(anuncioData.thumbnail)) {
        container.addMediaGalleryComponents((gallery) =>
          gallery.addItems({
            description: 'Embed thumbnail',
            media: {
              url: anuncioData.thumbnail,
            },
          }),
        )
      }

      container.addSeparatorComponents((separator) => separator)

      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((td) =>
            td.setContent(`**Announcement footer**\n${anuncioData.footer}`),
          )
          .setButtonAccessory((button) =>
            button
              .setCustomId('alterar_footer')
              .setLabel('Change')
              .setEmoji(getEmoji(emojis.settings))
              .setStyle(ButtonStyle.Secondary),
          ),
      )

      container.addSeparatorComponents((separator) => separator)

      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((td) =>
            td.setContent('Additional announcement settings'),
          )
          .setButtonAccessory((button) =>
            button
              .setCustomId('abrir_outros')
              .setLabel('More')
              .setEmoji(getEmoji(emojis.selectoptions))
              .setStyle(ButtonStyle.Secondary),
          ),
      )

      container.addSeparatorComponents((separator) => separator)

      if (anuncioData.isEditing) {
        container.addActionRowComponents((actionRow) =>
          actionRow.setComponents(
            new ButtonBuilder()
              .setCustomId('salvar_edicao')
              .setLabel('Save Changes')
              .setEmoji(getEmoji(emojis.check))
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('finalizar_anuncio')
              .setLabel('Send')
              .setEmoji(getEmoji(emojis.send))
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('excluir_anuncio')
              .setLabel('Delete')
              .setEmoji(getEmoji(emojis.lixeira))
              .setStyle(ButtonStyle.Secondary),
          ),
        )

        container.addActionRowComponents((actionRow) =>
          actionRow.setComponents(
            new ButtonBuilder()
              .setCustomId('voltar_anuncios_salvos')
              .setLabel('Back')
              .setEmoji(getEmoji(emojis.arrowl))
              .setStyle(ButtonStyle.Secondary),
          ),
        )
      } else {
        container.addActionRowComponents((actionRow) =>
          actionRow.setComponents(
            new ButtonBuilder()
              .setCustomId('finalizar_anuncio')
              .setLabel('Send')
              .setEmoji(getEmoji(emojis.send))
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('voltar_menu')
              .setLabel('Back')
              .setEmoji(getEmoji(emojis.home))
              .setStyle(ButtonStyle.Secondary),
          ),
        )
      }

      return container
    }

    // --- BUTTONS ---
    if (interaction.isButton()) {
      try {
        if (interaction.customId === 'criar_anuncio') {
          client.anuncioData[userId] = {
            nome: 'No name',
            descricao: 'No description',
            imagemTitulo: 'No title image defined',
            imagem: 'No image defined',
            thumbnail: 'No thumbnail defined',
            footer: 'No footer defined',
            links: [],
            cor: 'No color defined',
            isEditing: false,
            editingKey: null,
            showImagemTituloGallery: false,
            showOutrosMenu: false,
          }

          const criarAnuncioContainer = criarContainerAnuncio(
            client.anuncioData[userId],
          )

          return await interaction.update({
            components: [criarAnuncioContainer],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }

        if (interaction.customId === 'abrir_outros') {
          const outrosContainer = criarContainerOutros(anuncio)

          return await interaction.update({
            components: [outrosContainer],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }

        if (interaction.customId === 'voltar_anuncio_principal') {
          const criarAnuncioContainer = criarContainerAnuncio(anuncio)

          return await interaction.update({
            components: [criarAnuncioContainer],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }

        if (interaction.customId === 'voltar_menu') {
          const menuPrincipal = criarMenuPrincipal()

          return await interaction.update({
            components: [menuPrincipal],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }

        if (interaction.customId === 'voltar_anuncios_salvos') {
          try {
            const dbPath = path.join(
              __dirname,
              `../../../banco/anuncio/${interaction.guild.id}/anuncio.json`,
            )
            const db = new JsonDatabase({ databasePath: dbPath })

            const anuncios = db.all()
            if (!anuncios || anuncios.length === 0) {
              const vazioContainer = new ContainerBuilder()
                .setAccentColor(0xff0000)
                .addTextDisplayComponents((td) =>
                  td.setContent(
                    '📭 No saved announcements found in this server.',
                  ),
                )

              return await interaction.update({
                components: [vazioContainer],
                flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
              })
            }

            const select = new StringSelectMenuBuilder()
              .setCustomId('select_anuncio_salvo')
              .setPlaceholder('Select a saved announcement')
              .addOptions(
                anuncios.map((anuncio) => {
                  const key = anuncio.ID
                  const dados = anuncio.data

                  return new StringSelectMenuOptionBuilder()
                    .setLabel(key)
                    .setDescription(
                      dados.descricao?.substring(0, 50) || 'No description',
                    )
                    .setValue(key)
                }),
              )

            const container = new ContainerBuilder()
              .setAccentColor(0xffffff)
              .addTextDisplayComponents((td) =>
                td.setContent(
                  '📑 **Server Saved Announcements**\n\nSelect an announcement below:',
                ),
              )
              .addActionRowComponents((row) => row.addComponents(select))
              .addSeparatorComponents((separator) => separator)
              .addSectionComponents((section) =>
                section
                  .addTextDisplayComponents((td) =>
                    td.setContent('Back to main menu'),
                  )
                  .setButtonAccessory((button) =>
                    button
                      .setCustomId('voltar_menu')
                      .setLabel('Main Menu')
                      .setEmoji(getEmoji(emojis.home))
                      .setStyle(ButtonStyle.Secondary),
                  ),
              )

            return await interaction.update({
              components: [container],
              flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
            })
          } catch (err) {
            console.error('Error returning to saved announcements:', err)
          }
        }

        if (interaction.customId === 'salvar_edicao') {
          if (!anuncio.isEditing || !anuncio.editingKey) {
            return await interaction.reply({
              content: '❌ **Error:** There is no announcement being edited.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          const guildId = interaction.guild.id
          const dbPath = path.join(
            __dirname,
            `../../../banco/anuncio/${guildId}/anuncio.json`,
          )

          try {
            const db = new JsonDatabase({ databasePath: dbPath })

            const dadosParaSalvar = {
              nome: anuncio.nome,
              descricao: anuncio.descricao,
              imagemTitulo: anuncio.imagemTitulo,
              imagem: anuncio.imagem,
              thumbnail: anuncio.thumbnail,
              footer: anuncio.footer,
              links: anuncio.links,
              cor: anuncio.cor,
            }

            db.set(anuncio.editingKey, dadosParaSalvar)

            return await interaction.reply({
              content: `✅ **Announcement "${anuncio.editingKey}" updated successfully!**`,
              flags: [MessageFlags.Ephemeral],
            })
          } catch (dbError) {
            console.error('Error saving edit:', dbError)
            return await interaction.reply({
              content:
                '❌ **Error:** Failed to save changes to the database.',
              flags: [MessageFlags.Ephemeral],
            })
          }
        }

        if (interaction.customId === 'excluir_anuncio') {
          if (!anuncio.isEditing || !anuncio.editingKey) {
            return await interaction.reply({
              content: '❌ **Error:** There is no announcement being edited.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          const modal = new ModalBuilder()
            .setCustomId('modal_confirmar_exclusao')
            .setTitle('Confirm Deletion')

          const inputConfirmacao = new TextInputBuilder()
            .setCustomId('confirmacao_exclusao')
            .setLabel('Type CONFIRM to delete')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`Delete: ${anuncio.editingKey.substring(0, 30)}...`)
            .setRequired(true)

          const row = new ActionRowBuilder().addComponents(inputConfirmacao)
          modal.addComponents(row)

          return await interaction.showModal(modal)
        }

        if (interaction.customId === 'finalizar_anuncio') {
          const selectChannelContainer = new ContainerBuilder()
            .setAccentColor(0xffffff)
            .addTextDisplayComponents((td) =>
              td.setContent(
                '📢 **Select Channel**\n\nChoose the channel where you want to send the announcement:',
              ),
            )
            .addActionRowComponents((actionRow) =>
              actionRow.setComponents(
                new ChannelSelectMenuBuilder()
                  .setCustomId('selecionar_canal')
                  .setPlaceholder('Select a channel')
                  .setChannelTypes(ChannelType.GuildText),
              ),
            )
            .addSeparatorComponents((separator) => separator)
            .addSectionComponents((section) =>
              section
                .addTextDisplayComponents((td) =>
                  td.setContent('Send the announcement to this current channel'),
                )
                .setButtonAccessory((button) =>
                  button
                    .setCustomId('envio_rapido')
                    .setLabel('Quick Send')
                    .setEmoji(getEmoji(emojis.send))
                    .setStyle(ButtonStyle.Secondary),
                ),
            )

          return await interaction.update({
            components: [selectChannelContainer],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }

        if (interaction.customId === 'adicionar_link') {
          if (anuncio.links.length >= 5) {
            return await interaction.reply({
              content:
                '❌ **Error:** You have reached the maximum limit of 5 links.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          const modal = new ModalBuilder()
            .setCustomId('modal_adicionar_link')
            .setTitle('Add New Link')

          const inputNome = new TextInputBuilder()
            .setCustomId('nome_link')
            .setLabel('Button name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('E.g.: Official Site, Discord, Labz...')
            .setMaxLength(80)
            .setRequired(true)

          const inputUrl = new TextInputBuilder()
            .setCustomId('url_link')
            .setLabel('Link URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://labzapps.com')
            .setRequired(true)

          const row1 = new ActionRowBuilder().addComponents(inputNome)
          const row2 = new ActionRowBuilder().addComponents(inputUrl)
          modal.addComponents(row1, row2)

          return await interaction.showModal(modal)
        }

        if (interaction.customId.startsWith('editar_link_')) {
          const index = parseInt(
            interaction.customId.replace('editar_link_', ''),
          )
          const linkAtual = anuncio.links[index]

          if (!linkAtual) {
            return await interaction.reply({
              content: '❌ **Error:** Link not found.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          const modal = new ModalBuilder()
            .setCustomId(`modal_editar_link_${index}`)
            .setTitle('Edit Link')

          const inputNome = new TextInputBuilder()
            .setCustomId('nome_link')
            .setLabel('Button name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Leave empty to remove the link')
            .setValue(linkAtual.nome)
            .setMaxLength(80)
            .setRequired(false)

          const inputUrl = new TextInputBuilder()
            .setCustomId('url_link')
            .setLabel('Link URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Leave empty to remove the link')
            .setValue(linkAtual.url)
            .setRequired(false)

          const row1 = new ActionRowBuilder().addComponents(inputNome)
          const row2 = new ActionRowBuilder().addComponents(inputUrl)
          modal.addComponents(row1, row2)

          return await interaction.showModal(modal)
        }

        if (interaction.customId === 'salvar_anuncio') {
          const modal = new ModalBuilder()
            .setCustomId('modal_salvar_anuncio')
            .setTitle('Save Announcement')

          const inputNome = new TextInputBuilder()
            .setCustomId('nome_anuncio')
            .setLabel('Enter a name for the announcement')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('E.g.: September Promotion')
            .setMaxLength(50)
            .setRequired(true)

          const row = new ActionRowBuilder().addComponents(inputNome)
          modal.addComponents(row)

          return await interaction.showModal(modal)
        }

        if (interaction.customId === 'ver_todos_links') {
          const linksContainer = new ContainerBuilder()
            .setAccentColor(0x5865f2)
            .addTextDisplayComponents((td) =>
              td.setContent('🔗 **All Links**'),
            )

          anuncio.links.forEach((link, index) => {
            linksContainer.addSectionComponents((section) =>
              section
                .addTextDisplayComponents((td) =>
                  td.setContent(`**${index + 1}. ${link.nome}**\n${link.url}`),
                )
                .setButtonAccessory((button) =>
                  button
                    .setCustomId(`editar_link_${index}`)
                    .setLabel('Edit/Remove')
                    .setStyle(ButtonStyle.Secondary),
                ),
            )
          })

          linksContainer.addSeparatorComponents((separator) => separator)
          linksContainer.addSectionComponents((section) =>
            section
              .addTextDisplayComponents((td) =>
                td.setContent('Back to options'),
              )
              .setButtonAccessory((button) =>
                button
                  .setCustomId('voltar_outros')
                  .setLabel('Back')
                  .setStyle(ButtonStyle.Primary),
              ),
          )

          return await interaction.update({
            components: [linksContainer],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }

        if (interaction.customId === 'voltar_outros') {
          const outrosContainer = criarContainerOutros(anuncio)

          return await interaction.update({
            components: [outrosContainer],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }

        const map = {
          alterar_nome: {
            label: 'Announcement name',
            field: 'nome',
            style: TextInputStyle.Short,
          },
          alterar_descricao: {
            label: 'Announcement description',
            field: 'descricao',
            style: TextInputStyle.Paragraph,
          },
          alterar_imagem_titulo: {
            label: 'Title image URL',
            field: 'imagemTitulo',
            style: TextInputStyle.Short,
          },
          alterar_imagem: {
            label: 'Image URL',
            field: 'imagem',
            style: TextInputStyle.Short,
          },
          alterar_thumbnail: {
            label: 'Thumbnail URL',
            field: 'thumbnail',
            style: TextInputStyle.Short,
          },
          alterar_footer: {
            label: 'Announcement footer',
            field: 'footer',
            style: TextInputStyle.Paragraph,
          },
          alterar_cor: {
            label: 'Embed color (hex)',
            field: 'cor',
            style: TextInputStyle.Short,
          },
        }

        if (map[interaction.customId]) {
          const conf = map[interaction.customId]

          const modal = new ModalBuilder()
            .setCustomId(`modal_${conf.field}`)
            .setTitle(`Change ${conf.label}`)

          const input = new TextInputBuilder()
            .setCustomId('valor')
            .setLabel(`Enter the new ${conf.label}`)
            .setStyle(conf.style)
            .setRequired(false)

          if (conf.field === 'cor') {
            input.setPlaceholder('#FF0000 (leave empty for no color)')
          }

          const valorAtual = anuncio[conf.field]
          if (!valorAtual.startsWith('No ')) {
            input.setValue(valorAtual)
          }

          modal.addComponents(new ActionRowBuilder().addComponents(input))

          return await interaction.showModal(modal)
        }
      } catch (err) {
        console.error('Error handling buttons:', err)
      }
    }

    if (interaction.customId === 'anuncios_salvos') {
      try {
        const dbPath = path.join(
          __dirname,
          `../../../banco/anuncio/${interaction.guild.id}/anuncio.json`,
        )
        const db = new JsonDatabase({ databasePath: dbPath })

        const anuncios = db.all()
        if (!anuncios || anuncios.length === 0) {
          const vazioContainer = new ContainerBuilder()
            .setAccentColor(0xff0000)
            .addTextDisplayComponents((td) =>
              td.setContent(
                '📭 No saved announcements found in this server.',
              ),
            )
            .addSeparatorComponents((separator) => separator)
            .addSectionComponents((section) =>
              section
                .addTextDisplayComponents((td) =>
                  td.setContent('Back to main menu'),
                )
                .setButtonAccessory((button) =>
                  button
                    .setCustomId('voltar_menu')
                    .setLabel('Main Menu')
                    .setEmoji(getEmoji(emojis.home))
                    .setStyle(ButtonStyle.Secondary),
                ),
            )

          return await interaction.update({
            components: [vazioContainer],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }

        const select = new StringSelectMenuBuilder()
          .setCustomId('select_anuncio_salvo')
          .setPlaceholder('Select a saved announcement')
          .addOptions(
            anuncios.map((anuncio) => {
              const key = anuncio.ID
              const dados = anuncio.data

              return new StringSelectMenuOptionBuilder()
                .setLabel(key)
                .setDescription(
                  dados.descricao?.substring(0, 50) || 'No description',
                )
                .setValue(key)
            }),
          )

        const container = new ContainerBuilder()
          .setAccentColor(0xffffff)
          .addTextDisplayComponents((td) =>
            td.setContent(
              '📑 **Server Saved Announcements**\n\nSelect an announcement below:',
            ),
          )
          .addActionRowComponents((row) => row.addComponents(select))
          .addSeparatorComponents((separator) => separator)
          .addSectionComponents((section) =>
            section
              .addTextDisplayComponents((td) =>
                td.setContent('Back to main menu'),
              )
              .setButtonAccessory((button) =>
                button
                  .setCustomId('voltar_menu')
                  .setLabel('Main Menu')
                  .setEmoji(getEmoji(emojis.home))
                  .setStyle(ButtonStyle.Secondary),
              ),
          )

        await interaction.update({
          components: [container],
          flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
        })
      } catch (err) {
        console.error('Error loading saved announcements:', err)

        const errorContainer = new ContainerBuilder()
          .setAccentColor(0xff0000)
          .addTextDisplayComponents((td) =>
            td.setContent('❌ Error loading saved announcements.'),
          )
          .addSeparatorComponents((separator) => separator)
          .addSectionComponents((section) =>
            section
              .addTextDisplayComponents((td) =>
                td.setContent('Back to main menu'),
              )
              .setButtonAccessory((button) =>
                button
                  .setCustomId('voltar_menu')
                  .setLabel('Main Menu')
                  .setEmoji(getEmoji(emojis.home))
                  .setStyle(ButtonStyle.Secondary),
              ),
          )

        await interaction.update({
          components: [errorContainer],
          flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
        })
      }
    }

    if (interaction.customId === 'envio_rapido') {
      const canalAtual = interaction.channel

      let corAnuncio = null
      if (anuncio.cor && !anuncio.cor.startsWith('No ')) {
        if (isValidHexColor(anuncio.cor)) {
          corAnuncio = hexToDecimal(anuncio.cor)
        }
      }

      const containerAnuncio = new ContainerBuilder().setAccentColor(corAnuncio)

      if (isValidURL(anuncio.imagemTitulo)) {
        containerAnuncio.addMediaGalleryComponents((gallery) =>
          gallery.addItems({
            description: 'Title image',
            media: {
              url: anuncio.imagemTitulo,
            },
          }),
        )
        containerAnuncio.addSeparatorComponents((separator) => separator)
      }

      if (isValidURL(anuncio.imagem)) {
        containerAnuncio.addSectionComponents((section) =>
          section
            .addTextDisplayComponents((td) =>
              td.setContent(`**${anuncio.nome}**\n\n${anuncio.descricao}`),
            )
            .setThumbnailAccessory((thumbnail) =>
              thumbnail
                .setURL(anuncio.imagem)
                .setDescription('Embed image'),
            ),
        )
      } else {
        containerAnuncio.addTextDisplayComponents((td) =>
          td.setContent(`**${anuncio.nome}**\n\n${anuncio.descricao}`),
        )
      }

      if (isValidURL(anuncio.thumbnail)) {
        containerAnuncio.addSeparatorComponents((separator) => separator)
        containerAnuncio.addMediaGalleryComponents((gallery) =>
          gallery.addItems({
            media: {
              url: anuncio.thumbnail,
            },
          }),
        )
      }

      if (anuncio.footer && !anuncio.footer.startsWith('No ')) {
        containerAnuncio.addSeparatorComponents((separator) => separator)
        containerAnuncio.addTextDisplayComponents((td) =>
          td.setContent(`${anuncio.footer}`),
        )
      }

      if (anuncio.links && anuncio.links.length > 0) {
        containerAnuncio.addSeparatorComponents((separator) => separator)

        const linkGroups = []
        for (let i = 0; i < anuncio.links.length; i += 5) {
          linkGroups.push(anuncio.links.slice(i, i + 5))
        }

        linkGroups.forEach((group) => {
          const buttons = group.map((link) =>
            new ButtonBuilder()
              .setURL(link.url)
              .setLabel(link.nome)
              .setStyle(ButtonStyle.Link),
          )

          containerAnuncio.addActionRowComponents((actionRow) =>
            actionRow.setComponents(...buttons),
          )
        })
      }

      try {
        await canalAtual.send({
          components: [containerAnuncio],
          flags: [MessageFlags.IsComponentsV2],
        })
      } catch (sendError) {
        console.error('Error sending announcement:', sendError)
        return await interaction.reply({
          content:
            '❌ **Error:** Could not send the announcement to this channel. Please check if I have permission to send messages here.',
          flags: [MessageFlags.Ephemeral],
        })
      }

      const anuncioParaSalvar = { ...client.anuncioData[userId] }

      const confirmacaoEnvioContainer = new ContainerBuilder()
        .setAccentColor(0xffffff)
        .addTextDisplayComponents((td) =>
          td.setContent(
            `**Announcement Sent!**\n\nYour announcement was successfully sent to ${canalAtual}!`,
          ),
        )

      if (anuncioParaSalvar.isEditing) {
        confirmacaoEnvioContainer.addSectionComponents((section) =>
          section
            .addTextDisplayComponents((td) =>
              td.setContent('Back to saved announcements'),
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId('voltar_anuncios_salvos')
                .setLabel('Saved Announcements')
                .setEmoji(getEmoji(emojis.fav))
                .setStyle(ButtonStyle.Secondary),
            ),
        )
      } else {
        confirmacaoEnvioContainer.addSectionComponents((section) =>
          section
            .addTextDisplayComponents((td) =>
              td.setContent('Back to main menu'),
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId('voltar_menu')
                .setLabel('Main Menu')
                .setEmoji(getEmoji(emojis.home))
                .setStyle(ButtonStyle.Secondary),
            ),
        )

        confirmacaoEnvioContainer.addSeparatorComponents(
          (separator) => separator,
        )
        confirmacaoEnvioContainer.addSectionComponents((section) =>
          section
            .addTextDisplayComponents((td) =>
              td.setContent('Save this announcement'),
            )
            .setButtonAccessory((button) =>
              button
                .setCustomId('salvar_anuncio')
                .setLabel('Save Announcement')
                .setEmoji(getEmoji(emojis.fav))
                .setStyle(ButtonStyle.Secondary),
            ),
        )
      }

      if (!anuncioParaSalvar.isEditing) {
        client.anuncioData[`${userId}_temp`] = anuncioParaSalvar
      }

      delete client.anuncioData[userId]

      return await interaction.update({
        components: [confirmacaoEnvioContainer],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      })
    }

    // --- STRING SELECT (SAVED ANNOUNCEMENTS) ---
    if (interaction.isStringSelectMenu()) {
      try {
        if (interaction.customId === 'select_anuncio_salvo') {
          const selectedKey = interaction.values[0]
          const guildId = interaction.guild.id
          const dbPath = path.join(
            __dirname,
            `../../../banco/anuncio/${guildId}/anuncio.json`,
          )

          try {
            const db = new JsonDatabase({ databasePath: dbPath })
            const anuncioSalvo = db.get(selectedKey)

            if (!anuncioSalvo) {
              return await interaction.reply({
                content:
                  '❌ **Error:** Announcement not found in the database.',
                flags: [MessageFlags.Ephemeral],
              })
            }

            client.anuncioData[userId] = {
              nome: anuncioSalvo.nome || 'No name',
              descricao: anuncioSalvo.descricao || 'No description',
              imagemTitulo:
                anuncioSalvo.imagemTitulo || 'No title image defined',
              imagem: anuncioSalvo.imagem || 'No image defined',
              thumbnail: anuncioSalvo.thumbnail || 'No thumbnail defined',
              footer: anuncioSalvo.footer || 'No footer defined',
              links: anuncioSalvo.links || [],
              cor: anuncioSalvo.cor || 'No color defined',
              isEditing: true,
              editingKey: selectedKey,
              showImagemTituloGallery: false,
              showOutrosMenu: false,
            }

            const criarAnuncioContainer = criarContainerAnuncio(
              client.anuncioData[userId],
            )

            return await interaction.update({
              components: [criarAnuncioContainer],
              flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
            })
          } catch (dbError) {
            console.error('Error loading saved announcement:', dbError)
            return await interaction.reply({
              content:
                '❌ **Error:** Failed to load the announcement from the database.',
              flags: [MessageFlags.Ephemeral],
            })
          }
        }
      } catch (err) {
        console.error('Error handling announcement selection:', err)
      }
    }

    // --- CHANNEL SELECT ---
    if (interaction.isChannelSelectMenu()) {
      try {
        if (interaction.customId === 'selecionar_canal') {
          const canalSelecionado = interaction.channels.first()

          let corAnuncio = null
          if (anuncio.cor && !anuncio.cor.startsWith('No ')) {
            if (isValidHexColor(anuncio.cor)) {
              corAnuncio = hexToDecimal(anuncio.cor)
            }
          }

          const containerAnuncio = new ContainerBuilder().setAccentColor(
            corAnuncio,
          )

          if (isValidURL(anuncio.imagemTitulo)) {
            containerAnuncio.addMediaGalleryComponents((gallery) =>
              gallery.addItems({
                description: 'Title image',
                media: {
                  url: anuncio.imagemTitulo,
                },
              }),
            )
            containerAnuncio.addSeparatorComponents((separator) => separator)
          }

          if (isValidURL(anuncio.imagem)) {
            containerAnuncio.addSectionComponents((section) =>
              section
                .addTextDisplayComponents((td) =>
                  td.setContent(`**${anuncio.nome}**\n\n${anuncio.descricao}`),
                )
                .setThumbnailAccessory((thumbnail) =>
                  thumbnail
                    .setURL(anuncio.imagem)
                    .setDescription('Embed image'),
                ),
            )
          } else {
            containerAnuncio.addTextDisplayComponents((td) =>
              td.setContent(`**${anuncio.nome}**\n\n${anuncio.descricao}`),
            )
          }

          if (isValidURL(anuncio.thumbnail)) {
            containerAnuncio.addSeparatorComponents((separator) => separator)
            containerAnuncio.addMediaGalleryComponents((gallery) =>
              gallery.addItems({
                media: {
                  url: anuncio.thumbnail,
                },
              }),
            )
          }

          if (anuncio.footer && !anuncio.footer.startsWith('No ')) {
            containerAnuncio.addSeparatorComponents((separator) => separator)
            containerAnuncio.addTextDisplayComponents((td) =>
              td.setContent(`${anuncio.footer}`),
            )
          }

          if (anuncio.links && anuncio.links.length > 0) {
            containerAnuncio.addSeparatorComponents((separator) => separator)

            const linkGroups = []
            for (let i = 0; i < anuncio.links.length; i += 5) {
              linkGroups.push(anuncio.links.slice(i, i + 5))
            }

            linkGroups.forEach((group) => {
              const buttons = group.map((link) =>
                new ButtonBuilder()
                  .setURL(link.url)
                  .setLabel(link.nome)
                  .setStyle(ButtonStyle.Link),
              )

              containerAnuncio.addActionRowComponents((actionRow) =>
                actionRow.setComponents(...buttons),
              )
            })
          }

          try {
            await canalSelecionado.send({
              components: [containerAnuncio],
              flags: [MessageFlags.IsComponentsV2],
            })
          } catch (sendError) {
            console.error('Error sending announcement:', sendError)
            return await interaction.reply({
              content:
                '❌ **Error:** Could not send the announcement to the selected channel. Please check if I have permission to send messages there.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          const anuncioParaSalvar = { ...client.anuncioData[userId] }

          const confirmacaoEnvioContainer = new ContainerBuilder()
            .setAccentColor(0xffffff)
            .addTextDisplayComponents((td) =>
              td.setContent(
                `**Announcement Sent!**\n\nYour announcement was successfully sent to ${canalSelecionado}!`,
              ),
            )

          if (anuncioParaSalvar.isEditing) {
            confirmacaoEnvioContainer.addSectionComponents((section) =>
              section
                .addTextDisplayComponents((td) =>
                  td.setContent('Back to saved announcements'),
                )
                .setButtonAccessory((button) =>
                  button
                    .setCustomId('voltar_anuncios_salvos')
                    .setLabel('Saved Announcements')
                    .setEmoji(getEmoji(emojis.fav))
                    .setStyle(ButtonStyle.Secondary),
                ),
            )
          } else {
            confirmacaoEnvioContainer.addSectionComponents((section) =>
              section
                .addTextDisplayComponents((td) =>
                  td.setContent('Back to main menu'),
                )
                .setButtonAccessory((button) =>
                  button
                    .setCustomId('voltar_menu')
                    .setLabel('Main Menu')
                    .setEmoji(getEmoji(emojis.home))
                    .setStyle(ButtonStyle.Secondary),
                ),
            )

            confirmacaoEnvioContainer.addSeparatorComponents(
              (separator) => separator,
            )
            confirmacaoEnvioContainer.addSectionComponents((section) =>
              section
                .addTextDisplayComponents((td) =>
                  td.setContent('Save this announcement'),
                )
                .setButtonAccessory((button) =>
                  button
                    .setCustomId('salvar_anuncio')
                    .setLabel('Save Announcement')
                    .setEmoji(getEmoji(emojis.fav))
                    .setStyle(ButtonStyle.Secondary),
                ),
            )
          }

          if (!anuncioParaSalvar.isEditing) {
            client.anuncioData[`${userId}_temp`] = anuncioParaSalvar
          }

          delete client.anuncioData[userId]

          return await interaction.update({
            components: [confirmacaoEnvioContainer],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }
      } catch (err) {
        console.error('Error handling channel selection:', err)
      }
    }

    // --- MODAL SUBMIT ---
    if (interaction.isModalSubmit()) {
      try {
        if (interaction.customId === 'modal_confirmar_exclusao') {
          const confirmacao = interaction.fields
            .getTextInputValue('confirmacao_exclusao')
            .trim()

          if (confirmacao.toUpperCase() !== 'CONFIRM') {
            return await interaction.reply({
              content:
                '❌ **Cancelled:** You must type "CONFIRM" to delete the announcement.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          if (!anuncio.isEditing || !anuncio.editingKey) {
            return await interaction.reply({
              content: '❌ **Error:** There is no announcement being edited.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          const guildId = interaction.guild.id
          const dbPath = path.join(
            __dirname,
            `../../../banco/anuncio/${guildId}/anuncio.json`,
          )

          try {
            const db = new JsonDatabase({ databasePath: dbPath })
            db.delete(anuncio.editingKey)

            delete client.anuncioData[userId]

            return await interaction.reply({
              content: `✅ **Announcement "${anuncio.editingKey}" deleted successfully!**`,
              flags: [MessageFlags.Ephemeral],
            })
          } catch (dbError) {
            console.error('Error deleting announcement:', dbError)
            return await interaction.reply({
              content:
                '❌ **Error:** Failed to delete the announcement from the database.',
              flags: [MessageFlags.Ephemeral],
            })
          }
        }

        if (interaction.customId === 'modal_salvar_anuncio') {
          const nome = interaction.fields.getTextInputValue('nome_anuncio')

          const guildId = interaction.guild.id
          const dbPath = path.join(
            __dirname,
            `../../../banco/anuncio/${guildId}/anuncio.json`,
          )

          const anuncioData =
            client.anuncioData?.[`${interaction.user.id}_temp`] ||
            client.anuncioData?.[interaction.user.id]

          if (!anuncioData) {
            return await interaction.reply({
              content: '❌ **Error:** No announcement data to save.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          try {
            const dirPath = path.dirname(dbPath)
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true })
            }

            const db = new JsonDatabase({ databasePath: dbPath })
            const anunciosExistentes = db.all() || []

            if (anunciosExistentes.length >= 25) {
              return await interaction.reply({
                content:
                  '❌ **Error:** The limit of 25 saved announcements per server has been reached.',
                flags: [MessageFlags.Ephemeral],
              })
            }

            const dadosParaSalvar = {
              nome: anuncioData.nome,
              descricao: anuncioData.descricao,
              imagemTitulo: anuncioData.imagemTitulo,
              imagem: anuncioData.imagem,
              thumbnail: anuncioData.thumbnail,
              footer: anuncioData.footer,
              links: anuncioData.links,
              cor: anuncioData.cor,
            }

            db.set(nome, dadosParaSalvar)

            console.log(`Announcement saved: ${nome}`, dadosParaSalvar)

            delete client.anuncioData[`${interaction.user.id}_temp`]

            return await interaction.reply({
              content: `✅ The announcement was saved with the name **${nome}**.`,
              flags: [MessageFlags.Ephemeral],
            })
          } catch (dbError) {
            console.error('Error saving to database:', dbError)
            return await interaction.reply({
              content:
                '❌ **Error:** Failed to save the announcement to the database.',
              flags: [MessageFlags.Ephemeral],
            })
          }
        }

        if (interaction.customId === 'modal_adicionar_link') {
          const nome = interaction.fields.getTextInputValue('nome_link').trim()
          const url = interaction.fields.getTextInputValue('url_link').trim()

          if (!nome || !url) {
            return await interaction.reply({
              content: '❌ **Error:** Name and URL are required.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          if (!isValidURL(url)) {
            return await interaction.reply({
              content: '❌ **Error:** The provided URL is not valid.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          if (anuncio.links.length >= 5) {
            return await interaction.reply({
              content: '❌ **Error:** Maximum limit of 5 links reached.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          anuncio.links.push({ nome, url })

          const outrosContainer = criarContainerOutros(anuncio)

          return await interaction.update({
            components: [outrosContainer],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }

        if (interaction.customId.startsWith('modal_editar_link_')) {
          const index = parseInt(
            interaction.customId.replace('modal_editar_link_', ''),
          )
          const nome = interaction.fields.getTextInputValue('nome_link').trim()
          const url = interaction.fields.getTextInputValue('url_link').trim()

          if (!nome && !url) {
            anuncio.links.splice(index, 1)
          } else if (nome && url) {
            if (!isValidURL(url)) {
              return await interaction.reply({
                content: '❌ **Error:** The provided URL is not valid.',
                flags: [MessageFlags.Ephemeral],
              })
            }
            anuncio.links[index] = { nome, url }
          } else {
            return await interaction.reply({
              content:
                '❌ **Error:** To edit, fill in both name and URL. To remove, leave both empty.',
              flags: [MessageFlags.Ephemeral],
            })
          }

          const outrosContainer = criarContainerOutros(anuncio)

          return await interaction.update({
            components: [outrosContainer],
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
          })
        }

        const fieldModals = [
          'nome',
          'descricao',
          'imagemTitulo',
          'imagem',
          'thumbnail',
          'footer',
          'cor',
        ]

        for (const field of fieldModals) {
          if (interaction.customId === `modal_${field}`) {
            const valor = interaction.fields.getTextInputValue('valor').trim()

            if (
              (field === 'imagem' ||
                field === 'thumbnail' ||
                field === 'imagemTitulo') &&
              valor !== ''
            ) {
              if (!isValidURL(valor)) {
                return await interaction.reply({
                  content:
                    '❌ **Error:** The provided URL is not valid. Please enter a valid URL.',
                  flags: [MessageFlags.Ephemeral],
                })
              }
            }

            if (field === 'cor' && valor !== '') {
              if (!isValidHexColor(valor)) {
                return await interaction.reply({
                  content:
                    '❌ **Error:** The provided color is not valid. Use hexadecimal format (e.g.: #FF0000, #00FF00, #0000FF).',
                  flags: [MessageFlags.Ephemeral],
                })
              }
            }

            if (field === 'cor' && valor === '') {
              anuncio[field] = 'No color defined'
            } else if (valor === '') {
              const defaultValues = {
                nome: 'No name',
                descricao: 'No description',
                imagemTitulo: 'No title image defined',
                imagem: 'No image defined',
                thumbnail: 'No thumbnail defined',
                footer: 'No footer defined',
              }
              anuncio[field] = defaultValues[field] || valor
            } else {
              anuncio[field] = valor
            }

            if (field === 'cor') {
              const outrosContainer = criarContainerOutros(anuncio)
              return await interaction.update({
                components: [outrosContainer],
                flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
              })
            } else {
              const criarAnuncioContainer = criarContainerAnuncio(anuncio)
              return await interaction.update({
                components: [criarAnuncioContainer],
                flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
              })
            }
          }
        }

      } catch (err) {
        console.error('Error processing modal:', err)
        return await interaction.reply({
          content:
            '❌ **Error:** An error occurred while processing your request.',
          flags: [MessageFlags.Ephemeral],
        })
      }
    }
  },
}
