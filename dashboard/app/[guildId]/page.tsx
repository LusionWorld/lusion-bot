import type { CSSProperties } from "react";
import { requireGuildAccess } from "@/lib/guildAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function GuildDashboard({
  params,
}: {
  params: { guildId: string };
}) {
  await requireGuildAccess(params.guildId);
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

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 32 }}>
      <a href="/" style={{ color: "#8ea2ff" }}>
        ← Voltar
      </a>
      <h1>Tickets</h1>

      <section style={{ display: "flex", gap: 16, margin: "24px 0" }}>
        <StatCard label="Abertos" value={stats.abertos} />
        <StatCard label="Assumidos" value={stats.assumidos} />
        <StatCard label="Fechados" value={stats.fechados} />
      </section>

      <h2>Tickets recentes</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #262a33" }}>
            <th style={cellStyle}>Ticket</th>
            <th style={cellStyle}>Usuário</th>
            <th style={cellStyle}>Categoria</th>
            <th style={cellStyle}>Criado em</th>
            <th style={cellStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {(recentes ?? []).map((row) => (
            <tr key={row.ticket_id} style={{ borderBottom: "1px solid #1c1f26" }}>
              <td style={cellStyle}>{row.ticket_id}</td>
              <td style={cellStyle}>{row.user_id}</td>
              <td style={cellStyle}>{row.categoria ?? "—"}</td>
              <td style={cellStyle}>{new Date(row.criado_em).toLocaleString("pt-BR")}</td>
              <td style={cellStyle}>{row.fechado_em ? "Fechado" : "Aberto"}</td>
            </tr>
          ))}
          {(recentes ?? []).length === 0 && (
            <tr>
              <td style={cellStyle} colSpan={5}>
                Nenhum ticket registrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#181b22",
        border: "1px solid #262a33",
        borderRadius: 10,
        padding: 16,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: "#9aa1ac" }}>{label}</div>
    </div>
  );
}

const cellStyle: CSSProperties = { padding: "8px 6px" };
