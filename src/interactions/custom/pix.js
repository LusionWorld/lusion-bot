const {
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} = require('discord.js');

const pixRepository = require('../../utils/pix/repository');
const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

function buildConfigContainer(configData) {
  const buttonConfigPix = new ButtonBuilder()
    .setCustomId('configurar_dados_pix')
    .setLabel('Dados PIX')
    .setEmoji(emojis.pixbsr)
    .setStyle(ButtonStyle.Primary);

  const buttonConfigContainer = new ButtonBuilder()
    .setCustomId('configurar_container_pix')
    .setLabel('Container')
    .setEmoji(emojis.embeds)
    .setStyle(ButtonStyle.Primary);

  const buttonVoltar = new ButtonBuilder()
    .setCustomId('voltar_inicio')
    .setLabel('Voltar')
    .setEmoji(emojis.home)
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(
    buttonConfigPix,
    buttonConfigContainer,
    buttonVoltar,
  );

  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Configuração Pix'),
      new TextDisplayBuilder().setContent(
        'Para chaves Pix do tipo telefone, sempre adicione o código do país +55 antes do número.\nClique nos botões abaixo para configurar ou voltar.',
      ),
      new TextDisplayBuilder().setContent(
        `**Chave**\n||${configData.chave || 'Não configurada'}||`,
      ),
      new TextDisplayBuilder().setContent(
        `**Nome**\n||${configData.nome || 'Não configurado'}||`,
      ),
      new TextDisplayBuilder().setContent(
        `**Título**\n${configData.titulo || 'PIX gerado com sucesso'}`,
      ),
      new TextDisplayBuilder().setContent(
        `**Imagem QR Code**\n${configData.imagem_qrcode || 'Não configurada'}`,
      ),
      new TextDisplayBuilder().setContent(
        `**Descrição**\n${configData.descricao || 'Não configurada'}`,
      ),
      new TextDisplayBuilder().setContent(
        `**Cor**\n${configData.cor || 'Sem cor (padrão)'}`,
      ),
    )
    .addActionRowComponents(row);
}

module.exports = {
  async execute(client, interaction) {
    if (!interaction.guild) return;

    const guildId = interaction.guild.id;

    // ============= BOTÕES =============

    if (interaction.isButton()) {
      if (!['pix_ticket', 'configurar_dados_pix', 'configurar_container_pix'].includes(interaction.customId)) {
        return;
      }

      if (interaction.customId === 'pix_ticket') {
        await interaction.deferUpdate();
        const configData = await pixRepository.ensureConfig(guildId);

        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [buildConfigContainer(configData)],
        });
      }

      if (interaction.customId === 'configurar_dados_pix') {
        const configData = (await pixRepository.getConfig(guildId)) || { chave: '', nome: '' };

        const modal = new ModalBuilder()
          .setCustomId('modal_dados_pix')
          .setTitle('Configurar Dados PIX');

        const inputChave = new TextInputBuilder()
          .setCustomId('chave_pix')
          .setLabel('Chave Pix')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite sua chave Pix')
          .setRequired(true)
          .setValue(configData.chave || '');

        const inputNome = new TextInputBuilder()
          .setCustomId('nome_pix')
          .setLabel('Nome do recebedor')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Joaozinho do morro')
          .setRequired(true)
          .setValue(configData.nome || '');

        modal.addComponents(
          new ActionRowBuilder().addComponents(inputChave),
          new ActionRowBuilder().addComponents(inputNome),
        );

        await interaction.showModal(modal);
      }

      if (interaction.customId === 'configurar_container_pix') {
        const configData = (await pixRepository.getConfig(guildId)) || {
          titulo: 'PIX gerado com sucesso',
          imagem_qrcode: '',
          descricao: '',
          cor: '',
        };

        const modal = new ModalBuilder()
          .setCustomId('modal_container_pix')
          .setTitle('Configurar Container');

        const inputTitulo = new TextInputBuilder()
          .setCustomId('titulo_pix')
          .setLabel('Título da mensagem')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: PIX gerado com sucesso')
          .setRequired(false)
          .setValue(configData.titulo || 'PIX gerado com sucesso');

        const inputImagemQrcode = new TextInputBuilder()
          .setCustomId('imagem_qrcode')
          .setLabel('URL da Imagem do QR Code (opcional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Link do QR Code. Deixe vazio para não usar.')
          .setRequired(false)
          .setValue(configData.imagem_qrcode || '');

        const inputDescricao = new TextInputBuilder()
          .setCustomId('descricao_pix')
          .setLabel('Descrição / Mensagem')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: Pagamento do mês')
          .setRequired(false)
          .setValue(configData.descricao || '');

        const inputCor = new TextInputBuilder()
          .setCustomId('cor_pix')
          .setLabel('Cor em hexadecimal')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: #00D09C ou 00D09C (vazio = sem cor)')
          .setRequired(false)
          .setValue(configData.cor || '');

        modal.addComponents(
          new ActionRowBuilder().addComponents(inputTitulo),
          new ActionRowBuilder().addComponents(inputImagemQrcode),
          new ActionRowBuilder().addComponents(inputDescricao),
          new ActionRowBuilder().addComponents(inputCor),
        );

        await interaction.showModal(modal);
      }
    }

    // ============= MODAIS =============

    if (interaction.isModalSubmit()) {
      // Apenas processar se for modal relacionado ao PIX
      if (!['modal_dados_pix', 'modal_container_pix'].includes(interaction.customId)) {
        return; // Não é modal do PIX, ignora
      }

      if (interaction.customId === 'modal_dados_pix') {
        const chave = interaction.fields.getTextInputValue('chave_pix');
        const nome = interaction.fields.getTextInputValue('nome_pix');

        await pixRepository.setConfig(guildId, { chave, nome });
        const configData = await pixRepository.getConfig(guildId);

        await interaction.update({
          flags: MessageFlags.IsComponentsV2,
          components: [buildConfigContainer(configData)],
        });
      }

      if (interaction.customId === 'modal_container_pix') {
        const titulo = interaction.fields.getTextInputValue('titulo_pix');
        const imagemQrcode = interaction.fields.getTextInputValue('imagem_qrcode');
        const descricao = interaction.fields.getTextInputValue('descricao_pix');
        const cor = interaction.fields.getTextInputValue('cor_pix');

        await pixRepository.setConfig(guildId, {
          titulo: titulo || 'PIX gerado com sucesso',
          imagem_qrcode: imagemQrcode,
          descricao,
          cor: cor || '',
        });
        const configData = await pixRepository.getConfig(guildId);

        await interaction.update({
          flags: MessageFlags.IsComponentsV2,
          components: [buildConfigContainer(configData)],
        });
      }
    }
  }
};
