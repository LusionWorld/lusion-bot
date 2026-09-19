import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { StatCard } from "./stat-card";

export default async function GuildOverviewPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;

  const [abertosRes, assumidosRes, fechadosRes] = await Promise.all([
    supabaseAdmin
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .is("fechado_em", null),
    supabaseAdmin
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .is("fechado_em", null)
      .not("assumido_em", "is", null),
    supabaseAdmin
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .not("fechado_em", "is", null),
  ]);

  const stats = {
    abertos: abertosRes.count ?? 0,
    assumidos: assumidosRes.count ?? 0,
    fechados: fechadosRes.count ?? 0,
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text">Visão geral</h1>
        <p className="mt-1 text-sm text-text-muted">Resumo rápido dos módulos deste servidor.</p>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-3">
        <StatCard label="Abertos agora" value={stats.abertos} tone="warning" />
        <StatCard label="Abertos com staff" value={stats.assumidos} tone="accent" />
        <StatCard label="Fechados (total)" value={stats.fechados} tone="success" />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ModuleCard
          href={`/${guildId}/tickets`}
          title="Tickets"
          description="Estatísticas, tickets recentes e atividade de suporte."
        />
        <ModuleCard
          href={`/${guildId}/moderacao`}
          title="Moderação"
          description="Anti-nuke, anti-flood e logs de moderação."
        />
        <ModuleCard
          href={`/${guildId}/convites`}
          title="Convites"
          description="Ranking de convites e cargos de recompensa."
        />
      </section>
    </div>
  );
}

function ModuleCard({
  href,
  title,
  description,
  soon,
}: {
  href?: string;
  title: string;
  description: string;
  soon?: boolean;
}) {
  const content = (
    <>
      <div className="mb-6 flex items-start justify-between">
        <h3 className="text-sm font-medium text-text">{title}</h3>
        {soon && (
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-text-faint">
            em breve
          </span>
        )}
      </div>
      <p className="text-sm text-text-muted">{description}</p>
    </>
  );

  if (soon || !href) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 opacity-60">{content}</div>
    );
  }

  return (
    <a
      href={href}
      className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-hover hover:bg-surface-raised"
    >
      {content}
    </a>
  );
}
