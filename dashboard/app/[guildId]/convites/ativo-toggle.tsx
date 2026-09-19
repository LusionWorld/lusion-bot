"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AtivoToggle({ guildId, ativo }: { guildId: string; ativo: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/${guildId}/convites/toggle`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        ativo
          ? "border-success/30 bg-success-muted text-success hover:bg-success-muted/70"
          : "border-border bg-surface-raised text-text-muted hover:text-text"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ativo ? "bg-success" : "bg-text-faint"}`} />
      {loading ? "Salvando…" : ativo ? "Ativado" : "Desativado"}
    </button>
  );
}
