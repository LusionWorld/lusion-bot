export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: 16,
      }}
    >
      <h1>Painel Lusion Bot</h1>
      {searchParams.error && (
        <p style={{ color: "#f87171" }}>
          Não foi possível entrar. Tente novamente.
        </p>
      )}
      <a
        href="/api/auth/login"
        style={{
          background: "#5865f2",
          color: "white",
          padding: "12px 24px",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Entrar com Discord
      </a>
    </main>
  );
}
