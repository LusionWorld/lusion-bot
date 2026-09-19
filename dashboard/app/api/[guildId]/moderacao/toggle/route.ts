import { NextRequest, NextResponse } from "next/server";
import { requireGuildAccess } from "@/lib/guildAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TOGGLEABLE_FIELDS = [
  "system_enabled",
  "link_enabled",
  "flood_enabled",
  "trust_enabled",
  "protect_enabled",
] as const;

export async function POST(request: NextRequest, { params }: { params: { guildId: string } }) {
  await requireGuildAccess(params.guildId);

  const body = await request.json().catch(() => ({}));
  const field = body?.field;
  if (!TOGGLEABLE_FIELDS.includes(field)) {
    return NextResponse.json({ error: "Campo inválido." }, { status: 400 });
  }

  const { data: current, error: readError } = await supabaseAdmin
    .from("security_config")
    .select(field)
    .eq("guild_id", params.guildId)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from("security_config")
    .upsert({ guild_id: params.guildId, [field]: !(current as any)?.[field] }, { onConflict: "guild_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
