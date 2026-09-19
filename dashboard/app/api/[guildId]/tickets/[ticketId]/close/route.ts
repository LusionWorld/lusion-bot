import { NextRequest, NextResponse } from "next/server";
import { requireGuildAccess } from "@/lib/guildAccess";

export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string; ticketId: string } },
) {
  const session = await requireGuildAccess(params.guildId);

  const botUrl = process.env.BOT_INTERNAL_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!botUrl || !secret) {
    return NextResponse.json(
      { error: "Integração com o bot não configurada." },
      { status: 500 },
    );
  }

  let motivo = "Fechado pelo painel web.";
  try {
    const body = await request.json();
    if (typeof body?.motivo === "string" && body.motivo.trim()) {
      motivo = body.motivo.trim();
    }
  } catch {
    // corpo vazio é aceitável, usa o motivo padrão
  }

  try {
    const res = await fetch(`${botUrl}/internal/tickets/close`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        guildId: params.guildId,
        ticketId: params.ticketId,
        motivo,
        staffId: session.userId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? "Erro ao fechar o ticket." },
        { status: res.status },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[close] Erro ao chamar o bot:", err);
    return NextResponse.json(
      { error: "Não foi possível falar com o bot. Ele está online?" },
      { status: 502 },
    );
  }
}
