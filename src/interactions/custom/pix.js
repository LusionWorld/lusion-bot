const fs = require('fs');
const path = require('path');
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

const { getEmojis } = require("../../utils/emojis/emojiHelper");
const emojis = getEmojis();

function getEmoji(raw) {
  if (!raw) return null;
  const match = raw.match(/^<a?:([^:]+):(\d+)>$/);
  if (!match) return null;
  const [, name, id] = match;
  return { name, id };
}

function converterCorHex(cor) {
  if (!cor || cor.trim() === '') return null;

  let corLimpa = cor.trim();

  if (corLimpa.startsWith('#')) {
    corLimpa = corLimpa.slice(1);
  } else if (corLimpa.startsWith('0x')) {
    corLimpa = corLimpa.slice(2);
  }

  if (!/^[0-9A-Fa-f]{6}$/.test(corLimpa)) {
    return null;
  }

  return parseInt(corLimpa, 16);
}

module.exports = {
  async execute(client, interaction) {
    if (!interaction.guild) return;

    const guildId = interaction.guild.id;
    const pixPath = path.resolve(__dirname, `../../../banco/pix/${guildId}`);
    const configFile = path.join(pixPath, 'config.json');

    // ============= BOTÕES =============

    if (interaction.isButton()) {
      if (!['pix_ticket', 'configurar_dados_pix', 'configurar_container_pix'].includes(interaction.customId)) {
        return;
      }

      if (interaction.customId === 'pix_ticket') {
        await interaction.deferUpdate();
        if (!fs.existsSync(pixPath)) fs.mkdirSync(pixPath, { recursive: true });
        if (!fs.existsSync(configFile)) {
          const initialData = {
            chave: '',
            nome: '',
            cidade: 'SAO PAULO',
            valor: null,
            descricao: '',
            txid: '',
            imagemQrcode: '',
            titulo: 'PIX gerado com sucesso',
            cor: '',
          };
          fs.writeFileSync(configFile, JSON.stringify(initialData, null, 2));
        }

        const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));

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

        const container = new ContainerBuilder()
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
              `**Imagem QR Code**\n${configData.imagemQrcode || 'Não configurada'}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Descrição**\n${configData.descricao || 'Não configurada'}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Cor**\n${configData.cor || 'Sem cor (padrão)'}`,
            ),
          )
          .addActionRowComponents(row);

        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [container],
        });
      }

      if (interaction.customId === 'configurar_dados_pix') {
        const configData = fs.existsSync(configFile)
          ? JSON.parse(fs.readFileSync(configFile, 'utf8'))
          : { chave: '', nome: '' };

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
        const configData = fs.existsSync(configFile)
          ? JSON.parse(fs.readFileSync(configFile, 'utf8'))
          : {
            titulo: 'PIX gerado com sucesso',
            imagemQrcode: '',
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
          .setValue(configData.imagemQrcode || '');

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

        let configData = fs.existsSync(configFile)
          ? JSON.parse(fs.readFileSync(configFile, 'utf8'))
          : {};

        configData.chave = chave;
        configData.nome = nome;

        fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));

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

        const container = new ContainerBuilder()
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
              `**Imagem QR Code**\n${configData.imagemQrcode || 'Não configurada'}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Descrição**\n${configData.descricao || 'Não configurada'}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Cor**\n${configData.cor || 'Sem cor (padrão)'}`,
            ),
          )
          .addActionRowComponents(row);

        await interaction.update({
          flags: MessageFlags.IsComponentsV2,
          components: [container],
        });
      }

      if (interaction.customId === 'modal_container_pix') {
        const titulo = interaction.fields.getTextInputValue('titulo_pix');
        const imagemQrcode = interaction.fields.getTextInputValue('imagem_qrcode');
        const descricao = interaction.fields.getTextInputValue('descricao_pix');
        const cor = interaction.fields.getTextInputValue('cor_pix');

        let configData = fs.existsSync(configFile)
          ? JSON.parse(fs.readFileSync(configFile, 'utf8'))
          : {};

        configData.titulo = titulo || 'PIX gerado com sucesso';
        configData.imagemQrcode = imagemQrcode;
        configData.descricao = descricao;
        configData.cor = cor || '';

        fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));

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

        const container = new ContainerBuilder()
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
              `**Imagem QR Code**\n${configData.imagemQrcode || 'Não configurada'}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Descrição**\n${configData.descricao || 'Não configurada'}`,
            ),
            new TextDisplayBuilder().setContent(
              `**Cor**\n${configData.cor || 'Sem cor (padrão)'}`,
            ),
          )
          .addActionRowComponents(row);

        await interaction.update({
          flags: MessageFlags.IsComponentsV2,
          components: [container],
        });
      }
    }
  }
};