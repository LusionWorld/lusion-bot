import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import { fetchUserGuilds, canManage, guildIconUrl } from "@/lib/discord";

export default async function HomePage() {
  const session = decodeSession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const allGuilds = await fetchUserGuilds(session.accessToken);
  const manageable = allGuilds.filter(canManage);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Seus servidores</h1>
          <p className="mt-1 text-sm text-text-muted">
            Servidores onde você tem permissão de administrador.
          </p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-lg border border-border px-3.5 py-2 text-sm text-text-muted transition-colors hover:border-border-hover hover:text-text"
          >
            Sair ({session.username})
          </button>
        </form>
      </header>

      {manageable.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center">
          <p className="text-sm text-text-muted">
            Nenhum servidor com permissão de administrador foi encontrado nesta conta.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {manageable.map((guild) => (
            <li key={guild.id}>
              <a
                href={`/${guild.id}`}
                className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-hover hover:bg-surface-raised"
              >
                <GuildIcon guild={guild} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{guild.name}</p>
                  <p className="text-xs text-text-muted">
                    {guild.owner ? "Dono" : "Administrador"}
                  </p>
                </div>
                <svg
                  className="h-4 w-4 shrink-0 text-text-faint transition-colors group-hover:text-text-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M6 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function GuildIcon({ guild }: { guild: { id: string; name: string; icon: string | null } }) {
  const url = guildIconUrl(guild);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-lg" />;
  }
  const initials = guild.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-xs font-semibold text-text-muted">
      {initials}
    </div>
  );
}
