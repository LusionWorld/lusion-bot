const supabase = require("../db/supabase");

// Cache em memória por guild + namespace. A Discord Interaction API não
// permite I/O bloqueante, e este código faz get/set síncronos dezenas de
// vezes por handler — então cada ponto de entrada (execute/cron/função
// exportada chamada de fora do arquivo) precisa chamar
// `await ensureTicketConfigLoaded(guildId)` uma vez, antes de qualquer uso
// de getConfigDB/getPersonalizacaoDB/getIAConfigDB naquele fluxo. Depois
// disso, get/set/has/delete/all operam sobre o cache já aquecido, com
// escrita no Supabase em segundo plano (mesmo padrão usado em estações).

const TABLES = {
  config: "ticket_config",
  personalizacao: "ticket_personalizacao",
  iaconfig: "ticket_iaconfig",
};

const _cache = {
  config: new Map(),
  personalizacao: new Map(),
  iaconfig: new Map(),
};

async function loadNamespace(namespace, guildId) {
  if (_cache[namespace].has(guildId)) return _cache[namespace].get(guildId);

  const { data, error } = await supabase
    .from(TABLES[namespace])
    .select("data")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (error) {
    console.error(`[TicketConfig] Erro ao carregar ${namespace} (${guildId}):`, error.message);
    _cache[namespace].set(guildId, {});
    return {};
  }

  const obj = data?.data || {};
  _cache[namespace].set(guildId, obj);
  return obj;
}

/** Pré-carrega config, personalizacao e iaconfig de uma vez. Chame no início
 * de todo ponto de entrada (execute/cron/função pública) antes de usar
 * qualquer um dos três getXDB(guildId) abaixo. */
async function ensureTicketConfigLoaded(guildId) {
  await Promise.all([
    loadNamespace("config", guildId),
    loadNamespace("personalizacao", guildId),
    loadNamespace("iaconfig", guildId),
  ]);
}

function persist(namespace, guildId) {
  const obj = _cache[namespace].get(guildId) || {};
  supabase
    .from(TABLES[namespace])
    .upsert({ guild_id: guildId, data: obj }, { onConflict: "guild_id" })
    .then(({ error }) => {
      if (error) console.error(`[TicketConfig] Erro ao salvar ${namespace} (${guildId}):`, error.message);
    });
}

function getPath(obj, key) {
  return key.split(".").reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

function setPath(obj, key, value) {
  const keys = key.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== "object") cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function deletePath(obj, key) {
  const keys = key.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) return;
    cur = cur[keys[i]];
  }
  delete cur[keys[keys.length - 1]];
}

function makeDB(namespace, guildId) {
  return {
    get(key) {
      const obj = _cache[namespace].get(guildId) || {};
      return getPath(obj, key);
    },
    set(key, value) {
      const obj = _cache[namespace].get(guildId) || {};
      setPath(obj, key, value);
      _cache[namespace].set(guildId, obj);
      persist(namespace, guildId);
    },
    has(key) {
      return this.get(key) !== undefined;
    },
    delete(key) {
      const obj = _cache[namespace].get(guildId) || {};
      deletePath(obj, key);
      _cache[namespace].set(guildId, obj);
      persist(namespace, guildId);
    },
    all() {
      return _cache[namespace].get(guildId) || {};
    },
  };
}

function getConfigDB(guildId) {
  return makeDB("config", guildId);
}

function getPersonalizacaoDB(guildId) {
  const db = makeDB("personalizacao", guildId);

  const embedsDefaults = {
    embedavaliacao: {
      title: "⭐ Avalie o Atendimento",
      descricao: "Quantas estrelas você dá para o atendimento?",
      descricaoRecebida:
        "✅ **Obrigado pela sua avaliação!**\n\n{estrelas} **({avaliacao})**{comentario}\n\n✨ Seu feedback é muito importante para nós!",
      color: "",
    },
    embedlogavaliacao: {
      title: "⭐ Nova Avaliação",
      descricao:
        "**Usuário:** {user}\n**Ticket ID:** {ticket_id}\n**Avaliação:** {estrelas} **({avaliacao})**\n**Comentário:** {comentario}\n**Data:** {data}",
      color: "",
    },
    embedassumido: {
      title: "🎫 Seu Ticket foi Assumido",
      descricao:
        "Olá! O staff {staff} assumiu seu ticket.\n\nVocê será atendido em breve. Obrigado pela paciência!",
      color: "",
    },
  };

  Object.entries(embedsDefaults).forEach(([embedKey, defaultValue]) => {
    if (!db.get(embedKey)) db.set(embedKey, defaultValue);
  });

  return db;
}

function getIAConfigDB(guildId) {
  const db = makeDB("iaconfig", guildId);

  const defaults = {
    sistema_ativo: false,
    parar_ao_assumir: true,
    parar_staff_responder: true,
    prompt_base:
      "Você é uma atendente virtual em um servidor do Discord. Responda sempre em português brasileiro de forma educada, prestativa e profissional. Ajude os usuários com suas dúvidas e problemas.",
    prompts_adicionais: [],
    mensagem_boas_vindas_ativo: false,
    mensagem_boas_vindas: " ",
    prompts_cargos: "[]",
    transferencia_inteligente: false,
    resumo_ao_assumir: false,
    resposta_container: false,
    horario_ativo: false,
    encerramento_automatico: false,
    retomar_apos_inatividade: false,
    minutos_inatividade_staff: 15,
  };

  Object.entries(defaults).forEach(([key, value]) => {
    if (!db.has(key)) db.set(key, value);
  });

  return db;
}

module.exports = {
  ensureTicketConfigLoaded,
  getConfigDB,
  getPersonalizacaoDB,
  getIAConfigDB,
};
