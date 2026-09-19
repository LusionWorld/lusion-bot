/**
 * Backfill único, roda automaticamente no boot do bot: lê os arquivos JSON
 * locais (banco/*, no volume persistente do Railway) que ainda existirem de
 * antes da migração pro Supabase, e copia o conteúdo pras tabelas novas —
 * mas só se a linha ainda não existir lá, pra nunca sobrescrever dado que já
 * foi editado depois da migração. Idempotente: seguro rodar em todo boot.
 */
const fs = require("fs");
const path = require("path");
const supabase = require("../utils/db/supabase");

const BANCO_ROOT = path.join(__dirname, "../../banco");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function listGuildDirs(moduleDir) {
  const base = path.join(BANCO_ROOT, moduleDir);
  try {
    return fs.readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

async function backfillGuildJsonTable(table, moduleDir, fileName) {
  const guildIds = listGuildDirs(moduleDir);
  for (const guildId of guildIds) {
    const filePath = path.join(BANCO_ROOT, moduleDir, guildId, fileName);
    if (!fs.existsSync(filePath)) continue;

    const { data: existing, error: readError } = await supabase
      .from(table)
      .select("guild_id")
      .eq("guild_id", guildId)
      .maybeSingle();
    if (readError) {
      console.error(`[Backfill] Erro ao checar ${table} (${guildId}):`, readError.message);
      continue;
    }
    if (existing) continue; // já migrado / já tem dado novo — não sobrescreve

    const json = readJson(filePath);
    if (!json || typeof json !== "object") continue;

    const { error: insertError } = await supabase
      .from(table)
      .insert({ guild_id: guildId, data: json });
    if (insertError) {
      console.error(`[Backfill] Erro ao inserir ${table} (${guildId}):`, insertError.message);
    } else {
      console.log(`[Backfill] ${table}: migrado guild ${guildId} de ${moduleDir}/${fileName}`);
    }
  }
}

async function backfillEstacoes() {
  const guildIds = listGuildDirs("ticket");
  for (const guildId of guildIds) {
    const filePath = path.join(BANCO_ROOT, "ticket", guildId, "estacoes.json");
    if (!fs.existsSync(filePath)) continue;

    const { data: existing, error: readError } = await supabase
      .from("ticket_estacoes")
      .select("guild_id")
      .eq("guild_id", guildId)
      .maybeSingle();
    if (readError) {
      console.error(`[Backfill] Erro ao checar ticket_estacoes (${guildId}):`, readError.message);
      continue;
    }
    if (existing) continue;

    const raw = readJson(filePath);
    let estacoes = raw?.estacoes ?? raw;
    if (typeof estacoes === "string") {
      try {
        estacoes = JSON.parse(estacoes);
      } catch {
        estacoes = [];
      }
    }
    if (!Array.isArray(estacoes)) continue;

    const { error: insertError } = await supabase
      .from("ticket_estacoes")
      .insert({ guild_id: guildId, estacoes });
    if (insertError) {
      console.error(`[Backfill] Erro ao inserir ticket_estacoes (${guildId}):`, insertError.message);
    } else {
      console.log(`[Backfill] ticket_estacoes: migrado guild ${guildId}`);
    }
  }
}

async function backfillAnuncios() {
  const guildIds = listGuildDirs("anuncio");
  for (const guildId of guildIds) {
    const filePath = path.join(BANCO_ROOT, "anuncio", guildId, "anuncio.json");
    if (!fs.existsSync(filePath)) continue;

    const raw = readJson(filePath);
    if (!raw || typeof raw !== "object") continue;

    for (const [nome, data] of Object.entries(raw)) {
      if (!data || typeof data !== "object") continue;

      const { data: existing, error: readError } = await supabase
        .from("anuncios")
        .select("guild_id")
        .eq("guild_id", guildId)
        .eq("nome", nome)
        .maybeSingle();
      if (readError) {
        console.error(`[Backfill] Erro ao checar anuncios (${guildId}/${nome}):`, readError.message);
        continue;
      }
      if (existing) continue;

      const { error: insertError } = await supabase
        .from("anuncios")
        .insert({ guild_id: guildId, nome, data });
      if (insertError) {
        console.error(`[Backfill] Erro ao inserir anuncios (${guildId}/${nome}):`, insertError.message);
      } else {
        console.log(`[Backfill] anuncios: migrado ${guildId}/${nome}`);
      }
    }
  }
}

async function backfillSugestoes() {
  const guildIds = listGuildDirs("sugestao");
  for (const guildId of guildIds) {
    const configPath = path.join(BANCO_ROOT, "sugestao", guildId, "config.json");
    if (fs.existsSync(configPath)) {
      const raw = readJson(configPath);
      if (raw && typeof raw === "object") {
        const { data: existing, error: readError } = await supabase
          .from("sugestao_config")
          .select("guild_id")
          .eq("guild_id", guildId)
          .maybeSingle();
        if (!readError && !existing) {
          const { error: insertError } = await supabase.from("sugestao_config").insert({
            guild_id: guildId,
            canal_sugestao: raw.canal_sugestao ?? null,
            ativo: !!raw.ativo,
          });
          if (insertError) {
            console.error(`[Backfill] Erro ao inserir sugestao_config (${guildId}):`, insertError.message);
          } else {
            console.log(`[Backfill] sugestao_config: migrado guild ${guildId}`);
          }
        }
      }
    }

    const sugestoesPath = path.join(BANCO_ROOT, "sugestao", guildId, "sugestoes.json");
    if (fs.existsSync(sugestoesPath)) {
      const raw = readJson(sugestoesPath);
      if (raw && typeof raw === "object") {
        for (const [sugestaoId, s] of Object.entries(raw)) {
          if (!s || typeof s !== "object") continue;

          const { data: existing, error: readError } = await supabase
            .from("sugestoes")
            .select("id")
            .eq("id", sugestaoId)
            .maybeSingle();
          if (readError) {
            console.error(`[Backfill] Erro ao checar sugestoes (${sugestaoId}):`, readError.message);
            continue;
          }
          if (existing) continue;

          const { error: insertError } = await supabase.from("sugestoes").insert({
            id: sugestaoId,
            guild_id: guildId,
            autor_id: s.autorId,
            autor_nome: s.autorNome,
            conteudo: s.conteudo,
            has_images: !!s.hasImages,
            image_urls: s.imageUrls || [],
            mensagem_id: s.mensagemId,
            thread_id: s.threadId,
            upvotes: s.upvotes || [],
            downvotes: s.downvotes || [],
            status: s.status || "pendente",
            criada_em: s.criadaEm,
          });
          if (insertError) {
            console.error(`[Backfill] Erro ao inserir sugestoes (${sugestaoId}):`, insertError.message);
          } else {
            console.log(`[Backfill] sugestoes: migrado ${sugestaoId}`);
          }
        }
      }
    }
  }
}

async function backfillPixConfigs() {
  const guildIds = listGuildDirs("pix");
  for (const guildId of guildIds) {
    const filePath = path.join(BANCO_ROOT, "pix", guildId, "config.json");
    if (!fs.existsSync(filePath)) continue;

    const { data: existing, error: readError } = await supabase
      .from("pix_config")
      .select("guild_id")
      .eq("guild_id", guildId)
      .maybeSingle();
    if (readError || existing) continue;

    const raw = readJson(filePath);
    if (!raw) continue;

    const { error: insertError } = await supabase.from("pix_config").insert({
      guild_id: guildId,
      chave: raw.chave || "",
      nome: raw.nome || "",
      cidade: raw.cidade || "SAO PAULO",
      valor: raw.valor ?? null,
      descricao: raw.descricao || "",
      txid: raw.txid || "",
      imagem_qrcode: raw.imagemQrcode || "",
      titulo: raw.titulo || "PIX gerado com sucesso",
      cor: raw.cor || "",
    });
    if (insertError) {
      console.error(`[Backfill] Erro ao inserir pix_config (${guildId}):`, insertError.message);
    } else {
      console.log(`[Backfill] pix_config: migrado guild ${guildId}`);
    }
  }
}

async function runBackfill() {
  if (!fs.existsSync(BANCO_ROOT)) return;

  try {
    await backfillGuildJsonTable("ticket_config", "ticket", "config.json");
    await backfillGuildJsonTable("ticket_personalizacao", "ticket", "personalizacao.json");
    await backfillGuildJsonTable("ticket_iaconfig", "ticket", "iaconfig.json");
    await backfillEstacoes();
    await backfillAnuncios();
    await backfillSugestoes();
    await backfillPixConfigs();
    console.log("[Backfill] Concluído.");
  } catch (err) {
    console.error("[Backfill] Erro geral:", err);
  }
}

module.exports = { runBackfill };
