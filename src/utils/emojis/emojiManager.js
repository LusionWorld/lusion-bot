const fs = require("fs").promises;
const path = require("path");
const { log, error: logError } = require("../logger");

class ApplicationEmojiManager {
  constructor(client) {
    this.client = client;
    this.iconpackPath = path.join(process.cwd(), "iconpack");
    this.emojisFilePath = path.join(__dirname, "emojis.json");
    this.setupFilePath = path.join(__dirname, ".emoji-setup-done");

    this.concurrentUploads = 50;
    this.batchDelay = 800;
  }

  async uploadAndUpdateEmojis() {
    try {
      const setupDone = await this.isSetupDone();

      if (setupDone) {
        try {
          const data = await fs.readFile(this.emojisFilePath, "utf-8");
          const emojis = JSON.parse(data);
          const reconciled = await this.reconcileWithApplication(emojis);
          delete require.cache[require.resolve(this.emojisFilePath)];
          log("Emojis", `${Object.keys(reconciled).length} emojis carregados`);
          return reconciled;
        } catch (err) {
          logError("Emojis", `erro ao ler JSON, forçando re-upload: ${err.message}`);
        }
      }

      log("Emojis", "Sincronizando...");

      await this.client.application.emojis.fetch();
      const appEmojis = this.client.application.emojis.cache;

      let existingEmojis = {};
      try {
        const data = await fs.readFile(this.emojisFilePath, "utf-8");
        existingEmojis = JSON.parse(data);
      } catch {}

      const allFiles = await this.collectAllFiles();
      const outdatedIds = await this.checkOutdatedIds(existingEmojis, appEmojis);
      const results = await this.uploadInBatches(allFiles, appEmojis);

      const allEmojis = { ...existingEmojis };
      let newUploads = 0;
      let failed = 0;

      for (const result of results) {
        if (result.success) {
          allEmojis[result.name] = result.emoji;
          if (!result.existed) newUploads++;
        } else {
          failed++;
        }
      }

      await this.updateEmojisFile(allEmojis);
      await this.markAsSetup();

      delete require.cache[require.resolve(this.emojisFilePath)];

      const parts = [`${Object.keys(allEmojis).length} emojis sincronizados`];
      if (newUploads > 0) parts.push(`${newUploads} novos`);
      if (failed > 0) parts.push(`${failed} erros`);
      log("Emojis", parts.join("   "));

      return allEmojis;
    } catch (err) {
      logError("Emojis", err.message);
      throw err;
    }
  }

  async reconcileWithApplication(jsonEmojis) {
    let appEmojis;
    try {
      await this.client.application.emojis.fetch();
      appEmojis = this.client.application.emojis.cache;
    } catch (err) {
      logError("Emojis", `falha ao validar emojis, mantendo JSON: ${err.message}`);
      return jsonEmojis;
    }

    if (!appEmojis || appEmojis.size === 0) return jsonEmojis;

    const byName = new Map();
    for (const emoji of appEmojis.values()) byName.set(emoji.name, emoji);

    const reconciled = {};
    let updated = 0;
    let removed = 0;

    for (const [name, emojiString] of Object.entries(jsonEmojis)) {
      const live = byName.get(name);
      if (!live) {
        removed++;
        continue;
      }
      const format = live.animated
        ? `<a:${live.name}:${live.id}>`
        : `<:${live.name}:${live.id}>`;
      if (format !== emojiString) updated++;
      reconciled[name] = format;
    }

    if (updated > 0 || removed > 0) {
      await this.updateEmojisFile(reconciled);
      const parts = [];
      if (updated > 0) parts.push(`${updated} corrigidos`);
      if (removed > 0) parts.push(`${removed} removidos`);
      log("Emojis", `JSON sincronizado com a aplicação   ${parts.join("   ")}`);
    }

    return reconciled;
  }

  async checkOutdatedIds(jsonEmojis, appEmojis) {
    const outdated = [];
    for (const [name, emojiString] of Object.entries(jsonEmojis)) {
      const jsonId = this.extractEmojiId(emojiString);
      const appEmoji = appEmojis.find((e) => e.name === name);
      if (appEmoji && appEmoji.id !== jsonId) {
        outdated.push({ name, oldId: jsonId, newId: appEmoji.id });
      }
    }
    return outdated;
  }

  extractEmojiId(emojiString) {
    const match = emojiString.match(/:(\d+)>/);
    return match ? match[1] : null;
  }

  async collectAllFiles() {
    const allFiles = [];
    const folders = await fs.readdir(this.iconpackPath);
    const folderPromises = folders.map(async (folder) => {
      const folderPath = path.join(this.iconpackPath, folder);
      try {
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) return [];
        const files = await fs.readdir(folderPath);
        const imageFiles = files.filter(
          (f) => f.endsWith(".png") || f.endsWith(".gif") || f.endsWith(".jpg") || f.endsWith(".jpeg")
        );
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
    for (let i = 0; i < files.length; i += this.concurrentUploads) {
      const batch = files.slice(i, i + this.concurrentUploads);
      const batchPromises = batch.map((file) => this.uploadEmoji(file, appEmojis));
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.success) {
          results.push(result.value);
        } else {
          results.push({ success: false, name: batch[index].name });
        }
      });
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
          const existing = this.client.application.emojis.cache.find((e) => e.name === file.name);
          if (existing) {
            const emojiFormat = existing.animated
              ? `<a:${existing.name}:${existing.id}>`
              : `<:${existing.name}:${existing.id}>`;
            return { success: true, name: file.name, emoji: emojiFormat, existed: true };
          }
        } catch {}
      }
      if (error.code === 429) {
        const retryAfter = Math.min(error.retry_after || 5, 30);
        await this.sleep(retryAfter * 1000);
        return { success: false, name: file.name, error: "rate_limited" };
      }
      return { success: false, name: file.name, error: error.message };
    }
  }

  async updateEmojisFile(emojis) {
    const content = JSON.stringify(emojis, null, 2);
    await fs.writeFile(this.emojisFilePath, content, "utf-8");
  }

  async markAsSetup() {
    await fs.writeFile(
      this.setupFilePath,
      JSON.stringify({ date: new Date().toISOString(), applicationId: this.client.application.id })
    );
  }

  async isSetupDone() {
    try {
      await fs.access(this.setupFilePath);
      await fs.access(this.emojisFilePath);
      const raw = await fs.readFile(this.setupFilePath, "utf-8");
      const meta = JSON.parse(raw);
      if (meta.applicationId !== this.client.application.id) return false;
      return true;
    } catch {
      return false;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = ApplicationEmojiManager;
