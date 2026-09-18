import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE, SessionData } from "@/lib/session";
import { fetchUserGuilds, canManage } from "@/lib/discord";

/**
 * Garante que há sessão válida e que o usuário pode administrar `guildId`.
 * Redireciona para /login ou / quando não pode. Retorna a sessão em caso de sucesso.
 */
export async function requireGuildAccess(guildId: string): Promise<SessionData> {
  const session = decodeSession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const guilds = await fetchUserGuilds(session.accessToken);
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild || !canManage(guild)) redirect("/");

  return session;
}
