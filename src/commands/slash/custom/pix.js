const {
  ApplicationCommandType,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionsBitField,
  MessageFlags,
  SeparatorSpacingSize,
} = require("discord.js");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

function tlv(id, value) {
  const v = String(value || "");
  const len = String(Buffer.byteLength(v, "utf8")).padStart(2, "0");
  return `${id}${len}${v}`;
}

function crc16ccitt(inputStr) {
  const buf = Buffer.from(inputStr, "utf8");
  let crc = 0xffff;
  for (const b of buf) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(str, maxLen) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .toUpperCase()
    .slice(0, maxLen);
}

function gerarPayloadPix({ chave, nome, cidade, valor, descricao }) {
  const nomeLimpo = sanitize(nome, 25);
  const cidadeLimpa = sanitize(cidade, 15);
  const valorStr = valor != null && !isNaN(valor) ? Number(valor).toFixed(2) : null;
  const mensagem = descricao ? sanitize(descricao, 60) : "";

  const id00 = tlv("00", "01");
  const id01 = valorStr ? tlv("01", "12") : tlv("01", "11");

  let id26Content = tlv("00", "br.gov.bcb.pix") + tlv("01", chave);
  if (mensagem) {
    id26Content += tlv("02", mensagem);
  }
  const id26 = tlv("26", id26Content);

  const id52 = tlv("52", "0000");
  const id53 = tlv("53", "986");
  const id54 = valorStr ? tlv("54", valorStr) : "";
  const id58 = tlv("58", "BR");
  const id59 = tlv("59", nomeLimpo);
  const id60 = tlv("60", cidadeLimpa);

  const id62Content = tlv("05", "***");
  const id62 = tlv("62", id62Content);

  const semCRC = `${id00}${id01}${id26}${id52}${id53}${id54}${id58}${id59}${id60}${id62}6304`;
  const crc = crc16ccitt(semCRC);
  return semCRC + crc;
}

function converterCorHex(cor) {
  if (!cor || cor.trim() === "") return null;

  let corLimpa = cor.trim();

  if (corLimpa.startsWith("#")) {
    corLimpa = corLimpa.slice(1);
  } else if (corLimpa.startsWith("0x")) {
    corLimpa = corLimpa.slice(2);
  }

  if (!/^[0-9A-Fa-f]{6}$/.test(corLimpa)) {
    return null;
  }

  return parseInt(corLimpa, 16);
}

module.exports = {
  name: "pix",
  description: "Gerar QR Code e código copia-e-cola do Pix",
  descriptionKey: "cmd_pix_desc",
  type: ApplicationCommandType.ChatInput,
  default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),

  options: [
    {
      name: "valor",
      description: "Valor em reais",
      descriptionKey: "opt_pix_valor_desc",
      type: ApplicationCommandOptionType.Number,
      required: false,
    },
    {
      name: "descricao",
      description: "Descrição/Mensagem",
      descriptionKey: "opt_pix_descricao_desc",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],

  run: async (client, interaction) => {
    await interaction.deferReply();

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.editReply({
        content: "❌ Você não tem permissão para usar este comando. Apenas administradores podem utilizar.",
      });
    }

    try {
      const guildId = interaction.guild.id;
      const filePath = path.resolve(__dirname, `../../../../banco/pix/${guildId}/config.json`);

      if (!fs.existsSync(filePath)) {
        return interaction.editReply({
          content: "❌ Configuração do Pix não encontrada para esta guild. Vá ate o painel de tickets e configure.",
        });
      }

      const configData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      let chave = configData.chave || "";
      const nome = configData.nome || "";
      const cidade = configData.cidade || "SAO PAULO";
      const imagemQrcode = configData.imagemQrcode || "";
      const titulo = configData.titulo || "PIX gerado com sucesso";
      const cor = configData.cor || "";

      if (!chave || !nome || !cidade) {
        return interaction.editReply({
          content: "❌ Chave, nome ou cidade não configurados no banco da guild.",
        });
      }

      const valor = interaction.options.getNumber("valor");
      const descricaoInput = interaction.options.getString("descricao");
      const descricao = descricaoInput || configData.descricao || "";

      const payload = gerarPayloadPix({ chave, nome, cidade, valor, descricao });

      const pixId = `pix_${guildId}_${Date.now()}`;

      const buttonCopia = new ButtonBuilder()
        .setCustomId(`copia_${pixId}`)
        .setLabel("Copia e Cola")
        .setStyle(ButtonStyle.Primary);

      const container = new ContainerBuilder();

      const corFormatada = converterCorHex(cor);
      if (corFormatada !== null) {
        container.setAccentColor(corFormatada);
      }

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# ${titulo}\nClique no botão abaixo para receber o copia e cola.`)
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

      const infoFields = [];
      infoFields.push(`**Chave:** ${chave}`);
      infoFields.push(`**Nome:** ${nome.slice(0, 256)}`);
      if (valor != null) {
        infoFields.push(`**Valor:** R$ ${Number(valor).toFixed(2)}`);
      }

      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(infoFields.join("\n")));

      if (descricao) {
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
        );
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Descrição:** ${descricao}`));
      }

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true)
      );

      let files = [];

      if (imagemQrcode && imagemQrcode.trim() !== "" && (imagemQrcode.startsWith("http://") || imagemQrcode.startsWith("https://"))) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems((item) => item.setURL(imagemQrcode).setDescription("QR Code PIX"))
        );
      } else {
        const qrPng = await QRCode.toBuffer(payload, {
          type: "png",
          errorCorrectionLevel: "M",
          margin: 2,
          scale: 8,
        });
        const anexoqr = new AttachmentBuilder(qrPng, { name: "qrcode-pix.png" });
        files.push(anexoqr);

        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems((item) => item.setURL("attachment://qrcode-pix.png").setDescription("QR Code PIX"))
        );
      }

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
      );

      container.addActionRowComponents((actionRow) => actionRow.setComponents(buttonCopia));

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("*Pague escaneando o QR Code ou usando o código copia-e-cola.*")
      );

      await interaction.editReply({
        components: [container],
        files: files,
        flags: MessageFlags.IsComponentsV2,
      });

      const collector = interaction.channel.createMessageComponentCollector({
        filter: (i) => i.customId === `copia_${pixId}`,
        time: 600000
      });

      collector.on('collect', async (i) => {
        const payloadAtual = gerarPayloadPix({ chave, nome, cidade, valor, descricao });
        await i.reply({ content: payloadAtual, flags: MessageFlags.Ephemeral });
      });

    } catch (err) {
      console.error(err);
      await interaction.editReply({
        content: "❌ Ocorreu um erro ao gerar seu Pix. Verifique os dados e tente novamente.",
      });
    }
  },
};