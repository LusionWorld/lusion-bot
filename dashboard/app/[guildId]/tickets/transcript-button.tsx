"use client";

import { useState } from "react";

export function TranscriptButton({
  guildId,
  ticketId,
}: {
  guildId: string;
  ticketId: string;
}) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (html || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${guildId}/tickets/${ticketId}/transcript`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível carregar a conversa.");
      } else {
        setHtml(data.html);
      }
    } catch {
      setError("Não foi possível carregar a conversa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-accent hover:text-accent-hover hover:underline"
      >
        Ver conversa
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-medium text-text">Conversa do ticket</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-text-muted hover:bg-surface-raised hover:text-text"
                aria-label="Fechar"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-hidden bg-white">
              {loading && (
                <p className="p-6 text-center text-sm text-text-muted">Carregando…</p>
              )}
              {error && <p className="p-6 text-center text-sm text-danger">{error}</p>}
              {html && (
                <iframe
                  title="Transcript do ticket"
                  srcDoc={html}
                  sandbox=""
                  className="h-full w-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
