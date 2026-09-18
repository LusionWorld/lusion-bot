import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireGuildAccess } from "@/lib/guildAccess";
import { fetchUserGuilds } from "@/lib/discord";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import { GuildSidebar } from "./guild-sidebar";

export default async function GuildLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { guildId: string };
}) {
  const session = await requireGuildAccess(params.guildId);
  const guilds = await fetchUserGuilds(session.accessToken);
  const guild = guilds.find((g) => g.id === params.guildId)!;

  return (
    <div className="flex min-h-screen">
      <GuildSidebar guild={guild} username={session.username} />
      <div className="flex-1 md:pl-64">
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
