type Command = { name: string; description: string; extra?: string };
type CommandCategory = { title: string; commands: Command[] };

const COMMAND_CATEGORIES: CommandCategory[] = [
  {
    title: "Tickets",
    commands: [
      { name: "/ticket", description: "Envia o painel de abertura de ticket com botão ou select.", extra: "Opção: tipo (Botão / Select)" },
      { name: "/painel-ticket", description: "Painel de configuração do sistema de tickets.", extra: "Configurar, banco de dados, PIX, enviar ticket, setup de IA, idioma" },
      { name: "/painel-staff", description: "Painel de gerenciamento do staff dentro de um ticket aberto.", extra: "Assumir, renomear, notificar usuário, criar/deletar call, adicionar/remover membro, fechar" },
      { name: "/fechar-todos", description: "Fecha todos os tickets abertos do servidor de uma vez.", extra: "Opção: motivo" },
    ],
  },
  {
    title: "Moderação",
    commands: [
      { name: "/painel-moderacao", description: "Painel de moderação: logs, onboarding (DM de boas-vindas) e segurança (anti-link, anti-flood, restrições de conta nova).", extra: "Também configurável pela aba Moderação deste painel" },
    ],
  },
  {
    title: "Convites",
    commands: [
      { name: "/painel-invite", description: "Painel do rastreador de convites: configurar, critérios de qualificação, cargos de recompensa, ranking, buscar membro, reset.", extra: "Também configurável pela aba Convites deste painel" },
    ],
  },
  {
    title: "Enquetes",
    commands: [
      { name: "/poll", description: "Cria uma nova votação: título, descrição, imagens, opções, duração, cor, canal e canal de resultados." },
      { name: "/poll-manage", description: "Gerencia votações ativas — estender o prazo ou encerrar antes da hora." },
    ],
  },
  {
    title: "FAQ",
    commands: [
      { name: "/faq", description: "Painel de configuração da FAQ: categorias, canal e texto do painel." },
    ],
  },
  {
    title: "Ask a Question",
    commands: [
      { name: "/askaquestions", description: "Painel de configuração de Perguntas & Respostas: canais, categorias, palavras-chave, modo de acesso e limite de promoção para a FAQ." },
    ],
  },
  {
    title: "Patreon",
    commands: [
      { name: "/patreon", description: "Painel de configuração do Patreon: URL, canal do painel, sincronização e contagem de apoiadores." },
    ],
  },
  {
    title: "Supporter Experience",
    commands: [
      { name: "/supporter", description: "Painel de configuração da experiência de apoiadores: canal de log, canal de relatório, DMs automáticas e cargos por tier." },
    ],
  },
  {
    title: "PIX",
    commands: [
      { name: "/pix", description: "Gera o QR Code e o código copia-e-cola do Pix configurado para o servidor.", extra: "Opções: valor, descrição" },
    ],
  },
  {
    title: "Tradutor",
    commands: [
      { name: "/autotranslate", description: "Configura tradução automática por reação em um canal.", extra: "Sub-opções: definir canal, remover" },
      { name: "Translate", description: "Comando de contexto (clique direito numa mensagem): traduz para um idioma escolhido.", extra: "Comando de menu de contexto, não usa barra" },
      { name: "Quick Translate", description: "Comando de contexto (clique direito numa mensagem): traduz direto para o idioma salvo do usuário.", extra: "Comando de menu de contexto, não usa barra" },
    ],
  },
  {
    title: "Outros",
    commands: [
      { name: "/bot-config", description: "Painel de controle do bot: identidade visual (nome, avatar, banner), presença e status." },
      { name: "/announcement", description: "Sistema de anúncios do servidor: criar e enviar anúncios salvos." },
      { name: "/sugestao", description: "Configura o sistema de sugestões.", extra: "Sub-opções: configurar canal, desativar, status" },
    ],
  },
];

const DASHBOARD_FEATURES = [
  {
    title: "Visão geral",
    description: "Resumo dos tickets do servidor e atalhos para todos os módulos disponíveis.",
  },
  {
    title: "Tickets",
    description:
      "Estatísticas ao vivo, lista dos tickets recentes com usuário/categoria/status reais, botão \"Ver conversa\" com a transcrição completa de tickets fechados, e os botões Assumir/Fechar para atender tickets abertos direto pelo painel — sem precisar entrar no Discord.",
  },
  {
    title: "Moderação",
    description:
      "Liga/desliga as 5 principais proteções (anti-nuke, bloqueio de links, anti-flood, sistema de confiança, proteção anti-nuke), mostra os canais de log configurados e as últimas 10 mensagens apagadas no servidor.",
  },
  {
    title: "Convites",
    description:
      "Liga/desliga o rastreador de convites, ranking dos top 10 convidadores (com nome e avatar reais) e lista dos cargos de recompensa configurados.",
  },
  {
    title: "Enquetes",
    description: "Lista as enquetes ativas (canal, número de opções, votos e prazo) e a contagem de enquetes já encerradas.",
  },
  {
    title: "FAQ",
    description: "Mostra as categorias configuradas, quantas perguntas cada uma tem e quantos acessos a FAQ já registrou.",
  },
  {
    title: "Outros módulos",
    description:
      "Status resumido de PIX, Patreon, Tradutor, Onboarding, Supporter e Ask a Question — mostra se cada um está configurado. A configuração detalhada desses módulos ainda é feita pelos comandos acima, direto no Discord.",
  },
];

export default function AjudaPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text">Ajuda</h1>
        <p className="mt-1 text-sm text-text-muted">
          Referência de todos os comandos do bot e um guia rápido do que cada aba deste painel faz.
        </p>
      </header>

      <section className="mb-8 overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">O que dá pra fazer neste painel</h2>
        </header>
        <ul className="divide-y divide-border">
          {DASHBOARD_FEATURES.map((f) => (
            <li key={f.title} className="px-4 py-3">
              <p className="text-sm font-medium text-text">{f.title}</p>
              <p className="mt-0.5 text-sm text-text-muted">{f.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-text">Comandos do bot no Discord</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {COMMAND_CATEGORIES.map((cat) => (
            <div key={cat.title} className="overflow-hidden rounded-xl border border-border bg-surface">
              <header className="border-b border-border px-4 py-2.5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-text-faint">{cat.title}</h3>
              </header>
              <ul className="divide-y divide-border">
                {cat.commands.map((cmd) => (
                  <li key={cmd.name} className="px-4 py-3">
                    <code className="rounded bg-surface-raised px-1.5 py-0.5 text-xs text-accent">{cmd.name}</code>
                    <p className="mt-1.5 text-sm text-text-muted">{cmd.description}</p>
                    {cmd.extra && <p className="mt-1 text-xs text-text-faint">{cmd.extra}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
