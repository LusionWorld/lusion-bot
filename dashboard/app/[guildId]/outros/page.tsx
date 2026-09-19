import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function OutrosModulosPage({ params }: { params: { guildId: string } }) {
  const { guildId } = params;

  const [
    pixRes,
    patreonTiersRes,
    translateRes,
    onboardingRes,
    supporterTierRolesRes,
    aaqCountRes,
  ] = await Promise.all([
    supabaseAdmin.from("pix_config").select("*").eq("guild_id", guildId).maybeSingle(),
    supabaseAdmin.from("patreon_tiers").select("*", { count: "exact", head: true }).eq("guild_id", guildId),
    supabaseAdmin.from("translate_config").select("*").eq("guild_id", guildId).maybeSingle(),
    supabaseAdmin.from("onboarding_config").select("*").eq("guild_id", guildId).maybeSingle(),
    supabaseAdmin.from("supporter_tier_roles").select("*", { count: "exact", head: true }).eq("guild_id", guildId),
    supabaseAdmin
      .from("aaq_questions")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .eq("status", "pending"),
  ]);

  const pix = pixRes.data;
  const translate = translateRes.data;
  const onboarding = onboardingRes.data;

  const modules = [
    {
      title: "PIX",
      configured: !!(pix?.chave && pix?.nome),
      detail: pix?.chave ? `Chave configurada, nome: ${pix.nome || "—"}` : "Chave Pix não configurada",
    },
    {
      title: "Patreon",
      configured: (patreonTiersRes.count ?? 0) > 0,
      detail: `${patreonTiersRes.count ?? 0} tier(s) configurado(s)`,
    },
    {
      title: "Tradutor",
      configured: !!translate?.channel_id,
      detail: translate?.channel_id
        ? `Auto-tradução ativa em um canal`
        : "Nenhum canal de auto-tradução configurado",
    },
    {
      title: "Onboarding",
      configured: !!onboarding?.ativo,
      detail: onboarding?.ativo ? "Mensagem de boas-vindas ativa" : "Onboarding desativado",
    },
    {
      title: "Supporter Experience",
      configured: (supporterTierRolesRes.count ?? 0) > 0,
      detail: `${supporterTierRolesRes.count ?? 0} cargo(s) de tier configurado(s)`,
    },
    {
      title: "Ask a Question",
      configured: true,
      detail: `${aaqCountRes.count ?? 0} pergunta(s) pendente(s) de resposta`,
    },
  ];

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text">Outros módulos</h1>
        <p className="mt-1 text-sm text-text-muted">
          Status resumido dos módulos configurados por comando no Discord. A configuração completa
          desses módulos ainda é feita pelos painéis do bot — aqui você só acompanha o status atual.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modules.map((mod) => (
          <div key={mod.title} className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-text">{mod.title}</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] ${
                  mod.configured
                    ? "bg-success-muted text-success"
                    : "bg-surface-raised text-text-faint"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${mod.configured ? "bg-success" : "bg-text-faint"}`} />
                {mod.configured ? "Configurado" : "Não configurado"}
              </span>
            </div>
            <p className="text-sm text-text-muted">{mod.detail}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
