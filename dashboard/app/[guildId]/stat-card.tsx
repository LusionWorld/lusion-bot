const TONES = {
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

export function StatCard({
  label,
  value,
  tone = "accent",
}: {
  label: string;
  value: number;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className={`text-2xl font-semibold tabular-nums ${TONES[tone]}`}>{value}</div>
      <div className="mt-0.5 text-sm text-text-muted">{label}</div>
    </div>
  );
}
