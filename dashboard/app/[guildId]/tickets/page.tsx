import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchGuildMember, fetchChannelName } from "@/lib/discordBot";
import { StatCard } from "../stat-card";
import { TranscriptButton } from "./transcript-button";

export default async function TicketsPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;

  const [abertosRes, assumidosRes, fechadosRes, recentesRes] = await Promise.all([
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
    supabaseAdmin
      .from("tickets")
      .select("ticket_id, user_id, criado_em, fechado_em, categoria, nome_categoria")
      .eq("guild_id", guildId)
      .order("criado_em", { ascending: false })
      .limit(10),
  ]);

  const abertos = abertosRes.count ?? 0;
  const assumidos = assumidosRes.count ?? 0;
  const fechados = fechadosRes.count ?? 0;
  const recentes = recentesRes.data;

  const rows = recentes ?? [];

  const enrichedRows = await Promise.all(
    rows.map(async (row) => {
      const [member, categoriaNome] = await Promise.all([
        fetchGuildMember(guildId, row.user_id),
        row.categoria ? fetchChannelName(row.categoria) : Promise.resolve(null),
      ]);
      return { ...row, member, categoriaNome: row.nome_categoria || categoriaNome };
    }),
  );

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text">Tickets</h1>
        <p className="mt-1 text-sm text-text-muted">
          Estatísticas e atividade recente de tickets deste servidor.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-3">
        <StatCard label="Abertos agora" value={abertos} tone="warning" />
        <StatCard label="Abertos com staff" value={assumidos} tone="accent" />
        <StatCard label="Fechados (total)" value={fechados} tone="success" />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Tickets recentes</h2>
        </header>

        {enrichedRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nenhum ticket registrado ainda.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-faint">
                <th className="px-4 py-2.5 font-medium">Usuário</th>
                <th className="px-4 py-2.5 font-medium">Ticket</th>
                <th className="px-4 py-2.5 font-medium">Categoria</th>
                <th className="px-4 py-2.5 font-medium">Criado em</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {enrichedRows.map((row) => (
                <tr key={row.ticket_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar
                        avatarUrl={row.member?.avatarUrl ?? null}
                        name={row.member?.username ?? row.user_id}
                      />
                      <span className="text-text">{row.member?.username ?? row.user_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.fechado_em ? (
                      <TranscriptButton guildId={guildId} ticketId={row.ticket_id} />
                    ) : (
                      <a
                        href={`https://discord.com/channels/${guildId}/${row.ticket_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:text-accent-hover hover:underline"
                      >
                        Abrir canal ↗
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{row.categoriaNome ?? "—"}</td>
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
