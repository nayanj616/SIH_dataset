import { useStateSummary } from '../hooks/useStateSummary';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Database, CheckCircle2, AlertCircle } from 'lucide-react';

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-800 tabular-nums">{value}</span>
    </div>
  );
}

export function SystemInfo() {
  const { data: states, isLoading, error } = useStateSummary();

  const totalWorks = states?.reduce((s, r) => s + r.total_works, 0) ?? 0;
  const totalTx = states?.reduce((s, r) => s + r.total_transactions, 0) ?? 0;

  return (
    <div className="p-8 space-y-8">
      <div className="border-b border-slate-200 pb-6 flex items-center gap-2">
        <Database className="w-5 h-5 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System / Dataset</h1>
      </div>

      {isLoading ? <LoadingSpinner /> : error ? <ErrorBanner message={error.message} /> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Dataset Stats */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
              Supabase Prototype Dataset
            </h2>
            <InfoRow label="Total States" value={states?.length ?? 0} />
            <InfoRow label="Total Works" value={totalWorks.toLocaleString()} />
            <InfoRow label="Total Expenditure Transactions" value={totalTx.toLocaleString()} />
            <InfoRow label="Intentional Duplicate Transactions" value="134" />
            <InfoRow label="Orphan Transactions (Punjab MP381)" value="38" />
            <InfoRow label="Risk Score Records" value="1,000" />
            <InfoRow label="Risk Signal Records" value="1,142" />
            <InfoRow label="Risk Evidence Records" value="1,000" />
          </div>

          {/* Connection status */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
              Supabase Connection
            </h2>
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Connected</p>
                <p className="text-xs text-green-600 font-mono truncate">
                  ttmchwvmbmejxrjmjqse.supabase.co
                </p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <p><strong>Authentication:</strong> Anonymous public key (anon role)</p>
              <p><strong>RLS:</strong> Enabled — read-only access for dashboard</p>
              <p><strong>Views:</strong> state_risk_summary, work_risk_overview</p>
              <p><strong>Security:</strong> service_role key not present in frontend</p>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Data Integrity Notes
              </p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc ml-4">
                <li>134 exact duplicate transaction rows are intentional anomaly-detection cases and are preserved as-is.</li>
                <li>38 Punjab expenditure transactions without a matching work (orphan records) are intentionally preserved.</li>
                <li>Duplicate detection is based on original transaction attributes, not expenditure_id.</li>
              </ul>
            </div>
          </div>

          {/* State breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 xl:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
              State Dataset Breakdown
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {['State', 'Works', 'Transactions', 'Avg Risk Score', 'Human Review Required', 'Works w/ Duplicates', 'Orphan Txs'].map((h) => (
                    <th key={h} className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(states ?? []).map((s) => (
                  <tr key={s.state}>
                    <td className="py-3 pr-4 font-semibold text-slate-800">{s.state}</td>
                    <td className="py-3 pr-4 text-slate-700 tabular-nums">{s.total_works}</td>
                    <td className="py-3 pr-4 text-slate-700 tabular-nums">{s.total_transactions}</td>
                    <td className="py-3 pr-4 text-slate-700 tabular-nums">
                      {s.avg_risk_score != null ? Number(s.avg_risk_score).toFixed(2) : '—'}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      <span className={s.human_review_required > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}>
                        {s.human_review_required}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-700 tabular-nums">{s.works_with_duplicates}</td>
                    <td className="py-3 pr-4 text-slate-700 tabular-nums">{s.orphan_transaction_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tech stack */}
      <div className="bg-slate-800 text-slate-300 rounded-xl p-5 text-xs">
        <p className="font-bold text-white mb-2">Technology Stack</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Frontend', value: 'React 18 + TypeScript + Vite' },
            { label: 'UI', value: 'Tailwind CSS + Custom components' },
            { label: 'Charts', value: 'Recharts' },
            { label: 'Backend', value: 'Supabase (PostgreSQL)' },
            { label: 'Data Fetching', value: 'TanStack Query v5' },
            { label: 'Routing', value: 'React Router v6' },
            { label: 'Auth', value: 'Supabase Anon Key (read-only)' },
            { label: 'Prototype', value: 'SIH 2026' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">{label}</p>
              <p className="text-slate-300">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
