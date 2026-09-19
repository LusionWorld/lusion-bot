const supabase = require("../db/supabase");

// Cache em memória por guild — a Discord Interaction API não permite I/O
// bloqueante, então cada handler que mexe em estações precisa chamar
// `ensureEstacoesLoaded(guildId)` (await) uma vez, no início do fluxo,
// antes de usar qualquer uma das funções síncronas abaixo.
const _cache = new Map(); // guildId -> array de estações

function safeParseEstacoes(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

async function ensureEstacoesLoaded(guildId) {
  if (_cache.has(guildId)) return _cache.get(guildId);

  const { data, error } = await supabase
    .from("ticket_estacoes")
    .select("estacoes")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) {
    console.error(`[Estacoes] Erro ao carregar estações (${guildId}):`, error.message);
    _cache.set(guildId, []);
    return [];
  }

  const estacoes = safeParseEstacoes(data?.estacoes);
  _cache.set(guildId, estacoes);
  return estacoes;
}

function persist(guildId, estacoes) {
  supabase
    .from("ticket_estacoes")
    .upsert({ guild_id: guildId, estacoes }, { onConflict: "guild_id" })
    .then(({ error }) => {
      if (error) console.error(`[Estacoes] Erro ao salvar estações (${guildId}):`, error.message);
    });
}

// Compatível com a antiga interface wio.db: { get(key), set(key, value) }
function getEstacoesDB(guildId) {
  return {
    get(key) {
      if (key !== "estacoes") return undefined;
      return _cache.get(guildId) || [];
    },
    set(key, value) {
      if (key !== "estacoes") return;
      const estacoes = safeParseEstacoes(value);
      _cache.set(guildId, estacoes);
      persist(guildId, estacoes);
    },
  };
}

function criarEstacao(guildId, nome) {
  const estacoes = _cache.get(guildId) || [];

  const novaEstacao = {
    id: Date.now().toString(),
    nome: nome,
    team: [],
    usersperms: {},
    horario_ativo: false,
    schedule: {},
    mensagem_fora_horario: "Fora do horário de atendimento.",
    limite_tickets: 0,
    embedprincipal: {
      title: "",
      descricao: "",
      color: "",
      botoes: [],
      selects: [],
      banner: "",
      messageId: null,
      channelId: null,
    },
  };

  estacoes.push(novaEstacao);
  _cache.set(guildId, estacoes);
  persist(guildId, estacoes);

  return novaEstacao;
}

function getEstacao(guildId, estacaoId) {
  const estacoes = _cache.get(guildId) || [];
  return estacoes.find((e) => e.id === estacaoId);
}

function updateEstacao(guildId, estacaoId, dados) {
  const estacoes = _cache.get(guildId) || [];
  const index = estacoes.findIndex((e) => e.id === estacaoId);

  if (index !== -1) {
    estacoes[index] = { ...estacoes[index], ...dados };
    _cache.set(guildId, estacoes);
    persist(guildId, estacoes);
    return true;
  }
  return false;
}

function deleteEstacao(guildId, estacaoId) {
  const estacoes = _cache.get(guildId) || [];
  const filtered = estacoes.filter((e) => e.id !== estacaoId);
  _cache.set(guildId, filtered);
  persist(guildId, filtered);
  return filtered.length < estacoes.length;
}

module.exports = {
  safeParseEstacoes,
  ensureEstacoesLoaded,
  getEstacoesDB,
  criarEstacao,
  getEstacao,
  updateEstacao,
  deleteEstacao,
};
