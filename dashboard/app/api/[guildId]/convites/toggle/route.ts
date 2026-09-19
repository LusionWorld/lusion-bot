import { NextResponse } from "next/server";
import { requireGuildAccess } from "@/lib/guildAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(_request: Request, { params }: { params: { guildId: string } }) {
  await requireGuildAccess(params.guildId);

  const { data: current, error: readError } = await supabaseAdmin
    .from("invite_config")
    .select("ativo")
    .eq("guild_id", params.guildId)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from("invite_config")
    .upsert({ guild_id: params.guildId, ativo: !current?.ativo }, { onConflict: "guild_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
