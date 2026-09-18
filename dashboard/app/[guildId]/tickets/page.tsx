import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { StatCard } from "../stat-card";

export default async function TicketsPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;

  const [{ data: contadores }, { data: recentes }] = await Promise.all([
    supabaseAdmin
      .from("ticket_contadores")
      .select("*")
      .eq("guild_id", guildId)
      .maybeSingle(),
    supabaseAdmin
      .from("tickets")
      .select("ticket_id, user_id, criado_em, fechado_em, categoria")
      .eq("guild_id", guildId)
      .order("criado_em", { ascending: false })
      .limit(10),
  ]);

  const stats = contadores ?? { abertos: 0, assumidos: 0, fechados: 0 };
  const rows = recentes ?? [];

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text">Tickets</h1>
        <p className="mt-1 text-sm text-text-muted">
          Estatísticas e atividade recente de tickets deste servidor.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-3">
        <StatCard label="Abertos" value={stats.abertos} tone="warning" />
        <StatCard label="Assumidos" value={stats.assumidos} tone="accent" />
        <StatCard label="Fechados" value={stats.fechados} tone="success" />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Tickets recentes</h2>
        </header>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nenhum ticket registrado ainda.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-faint">
                <th className="px-4 py-2.5 font-medium">Ticket</th>
                <th className="px-4 py-2.5 font-medium">Usuário</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium">Criado em</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ticket_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                    {row.ticket_id}
                  </td>
                  <td className="px-4 py-2.5 text-text">{row.user_id}</td>
                  <td className="px-4 py-2.5 text-text-muted">{row.categoria ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {new Date(row.criado_em).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge fechado={!!row.fechado_em} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ fechado }: { fechado: boolean }) {
  if (fechado) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-raised px-2 py-0.5 text-xs text-text-muted">
        Fechado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-success-muted px-2 py-0.5 text-xs text-success">
      Aberto
    </span>
  );
}
