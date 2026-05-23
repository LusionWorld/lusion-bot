const fs = require("fs").promises;
const path = require("path");

class ApplicationEmojiManager {
  constructor(client) {
    this.client = client;
    this.iconpackPath = path.join(process.cwd(), "iconpack");
    this.emojisFilePath = path.join(__dirname, "emojis.json");
    this.manifestFilePath = path.join(__dirname, ".emoji-manifest.json");

    this.concurrentUploads = 50;
    this.batchDelay = 800;
  }

  async loadManifest() {
    try {
      const data = await fs.readFile(this.manifestFilePath, "utf-8");
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveManifest(manifest) {
    await fs.writeFile(this.manifestFilePath, JSON.stringify(manifest, null, 2), "utf-8");
  }

  async getFileHash(filePath) {
    const stat = await fs.stat(filePath);
    return `${stat.size}-${stat.mtimeMs}`;
  }

  extractEmojiId(emojiString) {
    const match = emojiString.match(/:(\d+)>/);
    return match ? match[1] : null;
  }

  async uploadAndUpdateEmojis() {
    const startTime = Date.now();

    console.log(`\n   \u{1F50D} Buscando emojis da aplicacao...`);
    await this.client.application.emojis.fetch();
    const appEmojis = this.client.application.emojis.cache;
    console.log(`   \u2705 ${appEmojis.size} emojis na aplicacao (ID: ${this.client.application.id})\n`);

    let existingJson = {};
    try {
      const data = await fs.readFile(this.emojisFilePath, "utf-8");
      existingJson = JSON.parse(data);
      console.log(`   \u{1F4C4} ${Object.keys(existingJson).length} emojis no JSON\n`);
    } catch {
      console.log("   \u2139\uFE0F  emojis.json nao encontrado\n");
    }

    const allFiles = await this.collectAllFiles();
    const hasIconpack = allFiles.length > 0;

    if (!hasIconpack) {
      console.log("   \u{1F4E6} Sem iconpack local — sincronizando JSON com a aplicacao...\n");
      return await this.syncFromApp(existingJson, appEmojis, startTime);
    }

    const fileNames = new Set(allFiles.map((f) => f.name));
    const manifest = await this.loadManifest();

    const validatedJson = {};
    let fixedCount = 0;
    let invalidCount = 0;

    for (const [name, emojiStr] of Object.entries(existingJson)) {
      if (!fileNames.has(name)) {
        validatedJson[name] = emojiStr;
        continue;
      }

      const jsonId = this.extractEmojiId(emojiStr);
      const appEmoji = appEmojis.find((e) => e.name === name);

      if (!appEmoji) {
        console.log(`   \u26A0\uFE0F  ${name}: ausente na aplicacao, sera re-upado`);
        invalidCount++;
        continue;
      }

      if (appEmoji.id !== jsonId) {
        const fixed = appEmoji.animated
          ? `<a:${appEmoji.name}:${appEmoji.id}>`
          : `<:${appEmoji.name}:${appEmoji.id}>`;
        console.log(`   \u{1F504} ${name}: ID corrigido (${jsonId} -> ${appEmoji.id})`);
        validatedJson[name] = fixed;
        fixedCount++;
      } else {
        validatedJson[name] = emojiStr;
      }
    }

    const toUpload = [];
    for (const file of allFiles) {
      const hash = await this.getFileHash(file.path);
      const inJson = validatedJson[file.name];
      const prevHash = manifest[file.name];
      const appEmoji = appEmojis.find((e) => e.name === file.name);

      if (appEmoji && !inJson) {
        const fmt = appEmoji.animated
          ? `<a:${appEmoji.name}:${appEmoji.id}>`
          : `<:${appEmoji.name}:${appEmoji.id}>`;
        validatedJson[file.name] = fmt;
      }

      const isNew = !inJson && !appEmoji;
      const hashChanged = inJson && prevHash && prevHash !== hash;
      const missingFromApp = !appEmoji;

      if (isNew || hashChanged || missingFromApp) {
        toUpload.push(file);
        if (hashChanged) console.log(`   \u{1F501} ${file.name}: arquivo modificado`);
        else if (isNew) console.log(`   \u2728 ${file.name}: novo emoji`);
        else if (missingFromApp) console.log(`   \u{1F527} ${file.name}: ausente na aplicacao, re-upload`);
      }

      manifest[file.name] = hash;
    }

    if (toUpload.length > 0) {
      console.log(`\n   \u{1F195} ${toUpload.length} emoji(s) para upload...\n`);
      await this.client.application.emojis.fetch();
      const freshAppEmojis = this.client.application.emojis.cache;
      const results = await this.uploadInBatches(toUpload, freshAppEmojis);
      for (const result of results) {
        if (result.success) validatedJson[result.name] = result.emoji;
      }
    } else {
      console.log(`   \u2714\uFE0F  Todos emojis validos, nenhum upload necessario\n`);
    }

    await this.saveManifest(manifest);
    await this.updateEmojisFile(validatedJson);
    delete require.cache[require.resolve(this.emojisFilePath)];

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`   \u26A1 Concluido em ${duration}s`);
    if (fixedCount > 0) console.log(`   \u{1F527} IDs corrigidos: ${fixedCount}`);
    if (invalidCount > 0) console.log(`   \u{1F501} Re-uploads por ausencia: ${invalidCount}`);
    console.log(`   \u{1F4CA} Total no JSON: ${Object.keys(validatedJson).length} emojis\n`);

    return validatedJson;
  }

  async syncFromApp(existingJson, appEmojis, startTime) {
    const result = {};
    let fixedCount = 0;
    let addedCount = 0;

    for (const [name, emojiStr] of Object.entries(existingJson)) {
      const jsonId = this.extractEmojiId(emojiStr);
      const appEmoji = appEmojis.find((e) => e.name === name);

      if (!appEmoji) {
        console.log(`   \u26A0\uFE0F  ${name}: nao encontrado na aplicacao, ignorado`);
        continue;
      }

      if (appEmoji.id !== jsonId) {
        const fixed = appEmoji.animated
          ? `<a:${appEmoji.name}:${appEmoji.id}>`
          : `<:${appEmoji.name}:${appEmoji.id}>`;
        console.log(`   \u{1F504} ${name}: ID corrigido (${jsonId} -> ${appEmoji.id})`);
        result[name] = fixed;
        fixedCount++;
      } else {
        result[name] = emojiStr;
      }
    }

    for (const [, appEmoji] of appEmojis) {
      if (!result[appEmoji.name]) {
        const fmt = appEmoji.animated
          ? `<a:${appEmoji.name}:${appEmoji.id}>`
          : `<:${appEmoji.name}:${appEmoji.id}>`;
        result[appEmoji.name] = fmt;
        addedCount++;
        console.log(`   \u2795 ${appEmoji.name}: adicionado do app`);
      }
    }

    await this.updateEmojisFile(result);
    delete require.cache[require.resolve(this.emojisFilePath)];

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`   \u26A1 Concluido em ${duration}s`);
    if (fixedCount > 0) console.log(`   \u{1F527} IDs corrigidos: ${fixedCount}`);
    if (addedCount > 0) console.log(`   \u2795 Novos do app: ${addedCount}`);
    console.log(`   \u{1F4CA} Total no JSON: ${Object.keys(result).length} emojis\n`);

    return result;
  }

  async collectAllFiles() {
    const allFiles = [];
    let folders;
    try {
      folders = await fs.readdir(this.iconpackPath);
    } catch {
      return [];
    }

    const folderPromises = folders.map(async (folder) => {
      const folderPath = path.join(this.iconpackPath, folder);
      try {
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) return [];
        const files = await fs.readdir(folderPath);
        const imageFiles = files.filter((f) => /\.(png|gif|jpg|jpeg)$/i.test(f));
        console.log(`   \u{1F4C1} ${folder}: ${imageFiles.length} emojis`);
        return imageFiles.map((file) => ({
          name: path.parse(file).name,
          path: path.join(folderPath, file),
          folder,
        }));
      } catch {
        return [];
      }
    });

    const results = await Promise.all(folderPromises);
    return results.flat();
  }

  async uploadInBatches(files, appEmojis) {
    const results = [];
    const totalBatches = Math.ceil(files.length / this.concurrentUploads);

    for (let i = 0; i < files.length; i += this.concurrentUploads) {
      const batch = files.slice(i, i + this.concurrentUploads);
      const batchNum = Math.floor(i / this.concurrentUploads) + 1;

      const batchResults = await Promise.allSettled(
        batch.map((file) => this.uploadEmoji(file, appEmojis)),
      );

      let successCount = 0;
      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.success) {
          results.push(result.value);
          successCount++;
        } else {
          results.push({ success: false, name: batch[index].name });
        }
      });

      const progress = Math.round(((i + batch.length) / files.length) * 100);
      console.log(`   \u26A1 ${progress}% - Lote ${batchNum}/${totalBatches} (${successCount}/${batch.length} ok)`);

      if (i + this.concurrentUploads < files.length) {
        await this.sleep(this.batchDelay);
      }
    }

    return results;
  }

  async uploadEmoji(file, appEmojis) {
    try {
      const existing = appEmojis.find((e) => e.name === file.name);

      if (existing) {
        const emojiFormat = existing.animated
          ? `<a:${existing.name}:${existing.id}>`
          : `<:${existing.name}:${existing.id}>`;
        return { success: true, name: file.name, emoji: emojiFormat, existed: true };
      }

      const emoji = await this.client.application.emojis.create({
        attachment: file.path,
        name: file.name,
      });

      const emojiFormat = emoji.animated
        ? `<a:${emoji.name}:${emoji.id}>`
        : `<:${emoji.name}:${emoji.id}>`;

      return { success: true, name: file.name, emoji: emojiFormat, existed: false };
    } catch (error) {
      if (error.code === 30008) {
        try {
          await this.client.application.emojis.fetch();
          const existing = this.client.application.emojis.cache.find(
            (e) => e.name === file.name,
          );
          if (existing) {
            const emojiFormat = existing.animated
              ? `<a:${existing.name}:${existing.id}>`
              : `<:${existing.name}:${existing.id}>`;
            return { success: true, name: file.name, emoji: emojiFormat, existed: true };
          }
        } catch {}
      }

      if (error.code === 429) {
        const retryAfter = error.retry_after || 5;
        await this.sleep(retryAfter * 1000);
        return await this.uploadEmoji(file, appEmojis);
      }

      return { success: false, name: file.name, error: error.message };
    }
  }

  async updateEmojisFile(emojis) {
    const content = JSON.stringify(emojis, null, 2);
    await fs.writeFile(this.emojisFilePath, content, "utf-8");
    console.log(`   \u{1F4DD} emojis.json atualizado com ${Object.keys(emojis).length} emojis`);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = ApplicationEmojiManager;