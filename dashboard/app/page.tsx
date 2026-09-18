import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import { fetchUserGuilds, canManage } from "@/lib/discord";

export default async function HomePage() {
  const session = decodeSession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const allGuilds = await fetchUserGuilds(session.accessToken);
  const manageable = allGuilds.filter(canManage);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1>Seus servidores</h1>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            style={{
              background: "transparent",
              color: "#e8e9ec",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            Sair ({session.username})
          </button>
        </form>
      </header>

      {manageable.length === 0 && (
        <p>Nenhum servidor onde você tem permissão de administrador foi encontrado.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {manageable.map((guild) => (
          <li key={guild.id}>
            <a
              href={`/${guild.id}`}
              style={{
                display: "block",
                background: "#181b22",
                border: "1px solid #262a33",
                borderRadius: 10,
                padding: 16,
                color: "inherit",
                textDecoration: "none",
              }}
            >
              {guild.name}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
