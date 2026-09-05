import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string | number | null | undefined;
  sublabel?: string;
  icon?: ReactNode;
  accent?: string;
  loading?: boolean;
}

export function KpiCard({ label, value, sublabel, icon, accent = 'text-slate-800', loading }: KpiCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
      ) : (
        <div className={`text-3xl font-bold tabular-nums ${accent}`}>{value ?? '—'}</div>
      )}
      {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
    </div>
  );
}
