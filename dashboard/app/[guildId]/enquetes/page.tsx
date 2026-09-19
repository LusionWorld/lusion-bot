import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchChannelName } from "@/lib/discordBot";
import { StatCard } from "../stat-card";

export default async function EnquetesPage({ params }: { params: { guildId: string } }) {
  const { guildId } = params;

  const [activeRes, endedRes] = await Promise.all([
    supabaseAdmin
      .from("polls")
      .select("*")
      .eq("guild_id", guildId)
      .eq("ended", false)
      .order("ends_at", { ascending: true }),
    supabaseAdmin
      .from("polls")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .eq("ended", true),
  ]);

  const activePolls = activeRes.data ?? [];
  const endedCount = endedRes.count ?? 0;

  const pollIds = activePolls.map((p) => p.id);
  const votesRes = pollIds.length
    ? await supabaseAdmin.from("poll_votes").select("poll_id").in("poll_id", pollIds)
    : { data: [] as { poll_id: string }[] };
  const voteCountByPoll = new Map<string, number>();
  for (const row of votesRes.data ?? []) {
    voteCountByPoll.set(row.poll_id, (voteCountByPoll.get(row.poll_id) ?? 0) + 1);
  }

  const enrichedPolls = await Promise.all(
    activePolls.map(async (poll) => ({
      ...poll,
      channelName: poll.channel_id ? await fetchChannelName(poll.channel_id) : null,
      totalVotes: voteCountByPoll.get(poll.id) ?? 0,
    })),
  );

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text">Enquetes</h1>
        <p className="mt-1 text-sm text-text-muted">Enquetes ativas e histórico deste servidor.</p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3">
        <StatCard label="Enquetes ativas" value={activePolls.length} tone="accent" />
        <StatCard label="Enquetes encerradas" value={endedCount} tone="success" />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Enquetes ativas</h2>
        </header>

        {enrichedPolls.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nenhuma enquete ativa no momento.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-faint">
                <th className="px-4 py-2.5 font-medium">Título</th>
                <th className="px-4 py-2.5 font-medium">Canal</th>
                <th className="px-4 py-2.5 font-medium">Opções</th>
                <th className="px-4 py-2.5 font-medium">Votos</th>
                <th className="px-4 py-2.5 font-medium">Encerra em</th>
              </tr>
            </thead>
            <tbody>
              {enrichedPolls.map((poll) => (
                <tr key={poll.id} className="border-b border-border last:border-0">
                  <td className="max-w-xs truncate px-4 py-2.5 text-text">{poll.title}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {poll.channelName ? `#${poll.channelName}` : poll.channel_id ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {Array.isArray(poll.options) ? poll.options.length : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{poll.totalVotes}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {poll.ends_at ? new Date(poll.ends_at).toLocaleString("pt-BR") : "Sem prazo"}
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
