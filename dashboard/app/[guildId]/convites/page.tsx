import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchGuildMember } from "@/lib/discordBot";
import { StatCard } from "../stat-card";
import { AtivoToggle } from "./ativo-toggle";

export default async function ConvitesPage({ params }: { params: { guildId: string } }) {
  const { guildId } = params;

  const [configRes, statsRes, rewardRolesRes] = await Promise.all([
    supabaseAdmin.from("invite_config").select("*").eq("guild_id", guildId).maybeSingle(),
    supabaseAdmin.from("invite_stats").select("*").eq("guild_id", guildId),
    supabaseAdmin
      .from("invite_reward_roles")
      .select("*")
      .eq("guild_id", guildId)
      .order("min_qualified", { ascending: true }),
  ]);

  const config = configRes.data;
  const stats = (statsRes.data ?? [])
    .map((row) => ({ ...row, total_real: Math.max(0, row.validos + row.bonus - row.saiu) }))
    .sort((a, b) => b.total_real - a.total_real)
    .slice(0, 10);
  const rewardRoles = rewardRolesRes.data ?? [];

  const totalMembros = stats.length;
  const totalConvitesValidos = (statsRes.data ?? []).reduce((sum, row) => sum + (row.validos ?? 0), 0);
  const totalSairam = (statsRes.data ?? []).reduce((sum, row) => sum + (row.saiu ?? 0), 0);

  const enrichedLeaderboard = await Promise.all(
    stats.map(async (row) => ({ ...row, member: await fetchGuildMember(guildId, row.user_id) })),
  );

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Convites</h1>
          <p className="mt-1 text-sm text-text-muted">
            Ranking de convites e configuração do rastreador deste servidor.
          </p>
        </div>
        <AtivoToggle guildId={guildId} ativo={!!config?.ativo} />
      </header>

      <section className="mb-8 grid grid-cols-3 gap-3">
        <StatCard label="Convidadores ativos" value={totalMembros} tone="accent" />
        <StatCard label="Convites qualificados" value={totalConvitesValidos} tone="success" />
        <StatCard label="Saídas registradas" value={totalSairam} tone="warning" />
      </section>

      <section className="mb-8 overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Top 10 convidadores</h2>
        </header>

        {enrichedLeaderboard.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nenhum convite registrado ainda.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-faint">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Usuário</th>
                <th className="px-4 py-2.5 font-medium">Qualificados</th>
                <th className="px-4 py-2.5 font-medium">Bônus</th>
                <th className="px-4 py-2.5 font-medium">Saíram</th>
                <th className="px-4 py-2.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {enrichedLeaderboard.map((row, i) => (
                <tr key={row.user_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text-faint">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar
                        avatarUrl={row.member?.avatarUrl ?? null}
                        name={row.member?.username ?? row.user_id}
                      />
                      <span className="text-text">{row.member?.username ?? row.user_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{row.validos}</td>
                  <td className="px-4 py-2.5 text-text-muted">{row.bonus}</td>
                  <td className="px-4 py-2.5 text-text-muted">{row.saiu}</td>
                  <td className="px-4 py-2.5 font-medium text-text">{row.total_real}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Cargos de recompensa</h2>
        </header>

        {rewardRoles.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nenhum cargo de recompensa configurado. Use <code>/painel-convites</code> no Discord para configurar.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rewardRoles.map((role) => (
              <li key={role.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-text">
                  Cargo <code className="text-text-muted">{role.role_id}</code> a partir de{" "}
                  <span className="font-medium">{role.min_qualified}</span> convites qualificados
                </span>
                <span className="text-xs text-text-muted">
                  {role.permanent ? "Permanente" : `${role.duration_days} dia(s)`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UserAvatar({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full" />;
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-raised text-[10px] text-text-muted">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
