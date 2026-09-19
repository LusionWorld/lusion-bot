"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TicketActions({
  guildId,
  ticketId,
  assumido,
}: {
  guildId: string;
  ticketId: string;
  assumido: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"assume" | "close" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  async function handleAssume() {
    setLoading("assume");
    setError(null);
    try {
      const res = await fetch(`/api/${guildId}/tickets/${ticketId}/assume`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao assumir.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao assumir.");
    } finally {
      setLoading(null);
    }
  }

  async function handleClose() {
    setLoading("close");
    setError(null);
    try {
      const res = await fetch(`/api/${guildId}/tickets/${ticketId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: "Fechado pelo painel web." }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao fechar.");
      setConfirmClose(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fechar.");
    } finally {
      setLoading(null);
    }
  }

  if (confirmClose) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Fechar ticket?</span>
        <button
          type="button"
          onClick={handleClose}
          disabled={loading === "close"}
          className="text-xs font-medium text-danger hover:text-danger/80 disabled:opacity-50"
        >
          {loading === "close" ? "Fechando…" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmClose(false)}
          className="text-xs text-text-muted hover:text-text"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {!assumido && (
        <button
          type="button"
          onClick={handleAssume}
          disabled={loading !== null}
          className="text-xs font-medium text-accent hover:text-accent-hover disabled:opacity-50"
        >
          {loading === "assume" ? "Assumindo…" : "Assumir"}
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirmClose(true)}
        disabled={loading !== null}
        className="text-xs font-medium text-danger hover:text-danger/80 disabled:opacity-50"
      >
        Fechar
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
