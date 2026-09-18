import { NextRequest, NextResponse } from "next/server";
import { requireGuildAccess } from "@/lib/guildAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _request: NextRequest,
  { params }: { params: { guildId: string; ticketId: string } },
) {
  await requireGuildAccess(params.guildId);

  const { data, error } = await supabaseAdmin
    .from("tickets")
    .select("transcript_html")
    .eq("guild_id", params.guildId)
    .eq("ticket_id", params.ticketId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar transcript." }, { status: 500 });
  }
  if (!data?.transcript_html) {
    return NextResponse.json({ error: "Nenhuma conversa registrada para este ticket." }, { status: 404 });
  }

  return NextResponse.json({ html: data.transcript_html });
}
