"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SecurityToggle({
  guildId,
  field,
  label,
  description,
  enabled,
}: {
  guildId: string;
  field: string;
  label: string;
  description: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/${guildId}/moderacao/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm text-text">{label}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-success" : "bg-surface-raised"
        }`}
      >
        <span
          className={`h-4.5 w-4.5 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </li>
  );
}
