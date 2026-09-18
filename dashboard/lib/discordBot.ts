const DISCORD_API = "https://discord.com/api/v10";

// Cache em memória do processo — evita bater na API do Discord (e no rate
// limit) a cada carregamento de página para os mesmos usuários/canais.
const memberCache = new Map<string, { username: string; avatarUrl: string | null } | null>();
const channelCache = new Map<string, string | null>();

function botHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN não configurado.");
  return { Authorization: `Bot ${token}` };
}

export async function fetchGuildMember(
  guildId: string,
  userId: string,
): Promise<{ username: string; avatarUrl: string | null } | null> {
  const key = `${guildId}:${userId}`;
  if (memberCache.has(key)) return memberCache.get(key)!;

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
      headers: botHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      memberCache.set(key, null);
      return null;
    }
    const data = await res.json();
    const username: string = data.nick || data.user?.global_name || data.user?.username || userId;
    const avatarHash: string | null = data.avatar || data.user?.avatar || null;
    const avatarUrl = avatarHash
      ? `https://cdn.discordapp.com/${data.avatar ? `guilds/${guildId}/users/${userId}/avatars` : "avatars/" + userId}/${avatarHash}.png?size=32`
      : null;
    const result = { username, avatarUrl };
    memberCache.set(key, result);
    return result;
  } catch {
    memberCache.set(key, null);
    return null;
  }
}

export async function fetchChannelName(channelId: string): Promise<string | null> {
  if (channelCache.has(channelId)) return channelCache.get(channelId)!;

  try {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
      headers: botHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      channelCache.set(channelId, null);
      return null;
    }
    const data = await res.json();
    const name: string | null = data.name ?? null;
    channelCache.set(channelId, name);
    return name;
  } catch {
    channelCache.set(channelId, null);
    return null;
  }
}
