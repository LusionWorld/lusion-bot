import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchGuildMember, fetchChannelName } from "@/lib/discordBot";
import { StatCard } from "../stat-card";
import { SecurityToggle } from "./security-toggle";

const TOGGLES = [
  { field: "system_enabled", label: "Sistema anti-nuke/anti-flood", description: "Chave geral do módulo de segurança." },
  { field: "link_enabled", label: "Bloqueio de links", description: "Convites do Discord, encurtadores e domínios customizados." },
  { field: "flood_enabled", label: "Anti-flood", description: "Spam de mensagens, menções, emojis e crossposting." },
  { field: "trust_enabled", label: "Sistema de confiança", description: "Restringe ações de membros muito novos na conta/servidor." },
  { field: "protect_enabled", label: "Proteção anti-nuke", description: "Deleção em massa de canais/cargos em pouco tempo." },
] as const;

const LOG_CHANNELS = [
  { field: "canal_entrou", label: "Entrada de membros" },
  { field: "canal_saiu", label: "Saída de membros" },
  { field: "canal_ban", label: "Banimentos" },
  { field: "canal_kick", label: "Expulsões" },
  { field: "canal_msg_delete", label: "Mensagens apagadas" },
  { field: "canal_msg_edit", label: "Mensagens editadas" },
  { field: "canal_timeout", label: "Timeouts" },
] as const;

export default async function ModeracaoPage({ params }: { params: { guildId: string } }) {
  const { guildId } = params;

  const [modConfigRes, securityConfigRes, recentDeletedRes] = await Promise.all([
    supabaseAdmin.from("mod_config").select("*").eq("guild_id", guildId).maybeSingle(),
    supabaseAdmin.from("security_config").select("*").eq("guild_id", guildId).maybeSingle(),
    supabaseAdmin
      .from("message_log")
      .select("*")
      .eq("guild_id", guildId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(10),
  ]);

  const modConfig = modConfigRes.data;
  const security = securityConfigRes.data;
  const recentDeleted = recentDeletedRes.data ?? [];

  const enrichedDeleted = await Promise.all(
    recentDeleted.map(async (row) => ({
      ...row,
      author: row.author_id ? await fetchGuildMember(guildId, row.author_id) : null,
      channelName: row.channel_id ? await fetchChannelName(row.channel_id) : null,
    })),
  );

  const configuredChannels = LOG_CHANNELS.filter((c) => modConfig?.[c.field]);
  const activeToggles = TOGGLES.filter((t) => security?.[t.field]).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text">Moderação</h1>
        <p className="mt-1 text-sm text-text-muted">
          Segurança anti-nuke/anti-flood e canais de log deste servidor.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3">
        <StatCard label={`Proteções ativas (de ${TOGGLES.length})`} value={activeToggles} tone="accent" />
        <StatCard label={`Canais de log configurados (de ${LOG_CHANNELS.length})`} value={configuredChannels.length} tone="success" />
      </section>

      <section className="mb-8 overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Proteções</h2>
        </header>
        <ul className="divide-y divide-border">
          {TOGGLES.map((t) => (
            <SecurityToggle
              key={t.field}
              guildId={guildId}
              field={t.field}
              label={t.label}
              description={t.description}
              enabled={!!security?.[t.field]}
            />
          ))}
        </ul>
      </section>

      <section className="mb-8 overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Canais de log</h2>
        </header>
        {configuredChannels.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nenhum canal de log configurado. Use <code>/painel-moderacao</code> no Discord para configurar.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {configuredChannels.map((c) => (
              <li key={c.field} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-text">{c.label}</span>
                <span className="text-text-muted">#{modConfig?.[c.field]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Mensagens apagadas recentemente</h2>
        </header>
        {enrichedDeleted.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nenhuma mensagem apagada registrada ainda.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-faint">
                <th className="px-4 py-2.5 font-medium">Autor</th>
                <th className="px-4 py-2.5 font-medium">Canal</th>
                <th className="px-4 py-2.5 font-medium">Conteúdo</th>
                <th className="px-4 py-2.5 font-medium">Apagada em</th>
              </tr>
            </thead>
            <tbody>
              {enrichedDeleted.map((row) => (
                <tr key={row.message_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text">{row.author?.username ?? row.author_tag ?? row.author_id}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {row.channelName ? `#${row.channelName}` : row.channel_id}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-text-muted">{row.content || "—"}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {row.deleted_at ? new Date(row.deleted_at).toLocaleString("pt-BR") : "—"}
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
