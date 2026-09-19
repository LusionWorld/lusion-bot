import { NextRequest, NextResponse } from "next/server";
import { requireGuildAccess } from "@/lib/guildAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  _request: NextRequest,
  { params }: { params: { guildId: string; ticketId: string } },
) {
  const session = await requireGuildAccess(params.guildId);

  const { data: ticket, error: fetchError } = await supabaseAdmin
    .from("tickets")
    .select("assumido_em, fechado_em")
    .eq("guild_id", params.guildId)
    .eq("ticket_id", params.ticketId)
    .maybeSingle();

  if (fetchError || !ticket) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }
  if (ticket.fechado_em) {
    return NextResponse.json({ error: "Este ticket já está fechado." }, { status: 409 });
  }
  if (ticket.assumido_em) {
    return NextResponse.json({ error: "Este ticket já foi assumido." }, { status: 409 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("tickets")
    .update({ assumido_em: Date.now(), staff_id: session.userId })
    .eq("guild_id", params.guildId)
    .eq("ticket_id", params.ticketId);

  if (updateError) {
    return NextResponse.json({ error: "Erro ao assumir o ticket." }, { status: 500 });
  }

  await supabaseAdmin.rpc("incrementar_contador", {
    p_guild_id: params.guildId,
    p_coluna: "assumidos",
  });

  return NextResponse.json({ ok: true });
}
