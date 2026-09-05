import { useNavigate } from 'react-router-dom';
import type { WorkRiskOverview } from '../../lib/types';
import { RiskBadge } from '../risk/RiskBadge';

interface PriorityWorksTableProps {
  works: WorkRiskOverview[];
  loading?: boolean;
}

export function PriorityWorksTable({ works, loading }: PriorityWorksTableProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (works.length === 0) {
    return <p className="text-sm text-slate-400 py-4">No works to display.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2.5 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Risk</th>
            <th className="text-left py-2.5 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Work ID</th>
            <th className="text-left py-2.5 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">State</th>
            <th className="text-left py-2.5 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Constituency</th>
            <th className="text-left py-2.5 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">MP</th>
            <th className="text-right py-2.5 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Score</th>
            <th className="text-left py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Review</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {works.map((w) => (
            <tr
              key={w.work_id}
              className="hover:bg-slate-50 cursor-pointer transition-colors"
              onClick={() => navigate(`/work/${w.work_id}`)}
            >
              <td className="py-3 pr-4"><RiskBadge level={w.risk_level} size="sm" /></td>
              <td className="py-3 pr-4 font-mono text-xs text-indigo-700 font-semibold whitespace-nowrap">{w.work_id}</td>
              <td className="py-3 pr-4 text-slate-700 whitespace-nowrap">{w.state ?? '—'}</td>
              <td className="py-3 pr-4 text-slate-600 whitespace-nowrap max-w-[140px] truncate">{w.constituency ?? '—'}</td>
              <td className="py-3 pr-4 text-slate-600 whitespace-nowrap max-w-[140px] truncate">{w.mp_name ?? '—'}</td>
              <td className="py-3 pr-4 text-right font-bold tabular-nums text-slate-800">{w.risk_score ?? '—'}</td>
              <td className="py-3">
                {w.requires_human_review ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Review Required
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
