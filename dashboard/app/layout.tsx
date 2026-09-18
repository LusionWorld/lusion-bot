import type { ReactNode } from "react";

export const metadata = {
  title: "Lusion Bot — Painel",
  description: "Painel de controle do bot Labz",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#0f1115",
          color: "#e8e9ec",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
