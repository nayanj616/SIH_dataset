import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStateSummary } from '../hooks/useStateSummary';
import { useTopRiskWorks } from '../hooks/useWorkOverview';
import { KpiCard } from '../components/ui/KpiCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { RiskDistributionChart } from '../components/charts/RiskDistributionChart';
import { PriorityWorksTable } from '../components/tables/PriorityWorksTable';
import type { StateSummary } from '../lib/types';
import { Activity, FileText, AlertTriangle, TrendingUp, Users, Shield } from 'lucide-react';

function StateRow({ s, onClick }: { s: StateSummary; onClick: () => void }) {
  return (
    <tr
      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap">{s.state}</td>
      <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{s.total_works}</td>
      <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{s.total_transactions}</td>
      <td className="py-3 pr-4 text-right tabular-nums font-semibold text-slate-800">
        {s.avg_risk_score != null ? Number(s.avg_risk_score).toFixed(2) : '—'}
      </td>
      <td className="py-3 pr-4 text-right tabular-nums text-red-700 font-semibold">{s.high_risk_works}</td>
      <td className="py-3 pr-4 text-right tabular-nums text-orange-600">{s.elevated_risk_works}</td>
      <td className="py-3 pr-4 text-right tabular-nums text-yellow-700">{s.moderate_risk_works}</td>
      <td className="py-3 pr-4 text-right tabular-nums text-green-700">{s.low_risk_works}</td>
      <td className="py-3 text-right tabular-nums">
        {s.human_review_required > 0 ? (
          <span className="text-amber-700 font-semibold">{s.human_review_required}</span>
        ) : (
          <span className="text-slate-400">0</span>
        )}
      </td>
    </tr>
  );
}

export function Overview() {
  const navigate = useNavigate();
  const { data: states, isLoading: statesLoading, error: statesError } = useStateSummary();
  const { data: topWorks, isLoading: worksLoading } = useTopRiskWorks(10);

  const totals = useMemo(() => {
    if (!states) return null;
    return {
      totalWorks: states.reduce((s, r) => s + r.total_works, 0),
      totalTx: states.reduce((s, r) => s + r.total_transactions, 0),
      highRisk: states.reduce((s, r) => s + r.high_risk_works, 0),
      elevatedRisk: states.reduce((s, r) => s + r.elevated_risk_works, 0),
      humanReview: states.reduce((s, r) => s + r.human_review_required, 0),
    };
  }, [states]);

  const nationalDistribution = useMemo(() => {
    if (!states) return null;
    return {
      high_risk_works: states.reduce((s, r) => s + r.high_risk_works, 0),
      elevated_risk_works: states.reduce((s, r) => s + r.elevated_risk_works, 0),
      moderate_risk_works: states.reduce((s, r) => s + r.moderate_risk_works, 0),
      low_risk_works: states.reduce((s, r) => s + r.low_risk_works, 0),
    };
  }, [states]);

  if (statesError) return <div className="p-8"><ErrorBanner message={statesError.message} /></div>;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-indigo-600" />
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SENTINEL</h1>
            </div>
            <p className="text-slate-500 text-sm">
              MPLADS Implementation Intelligence — Sentinel Risk Engine · Deterministic Anomaly Detection &amp; Risk-Based Monitoring
            </p>
          </div>
          {totals && (
            <div className="text-right">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Connected · {totals.totalWorks.toLocaleString()} Works · {totals.totalTx.toLocaleString()} Transactions · 5 States
              </span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard label="Total Works" value={totals?.totalWorks.toLocaleString()} icon={<FileText className="w-4 h-4" />} loading={statesLoading} />
        <KpiCard label="Expenditure Transactions" value={totals?.totalTx.toLocaleString()} icon={<Activity className="w-4 h-4" />} loading={statesLoading} />
        <KpiCard label="High Risk Works" value={totals?.highRisk} icon={<AlertTriangle className="w-4 h-4" />} accent="text-red-600" loading={statesLoading} />
        <KpiCard label="Elevated Risk Works" value={totals?.elevatedRisk} icon={<TrendingUp className="w-4 h-4" />} accent="text-orange-600" loading={statesLoading} />
        <KpiCard label="Human Review Required" value={totals?.humanReview} icon={<Users className="w-4 h-4" />} accent="text-amber-600" sublabel="Flagged by Sentinel engine" loading={statesLoading} />
      </div>

      {/* Risk Distribution + State Comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">National Risk Distribution</h2>
          {statesLoading ? <LoadingSpinner message="Loading risk data…" /> : nationalDistribution ? <RiskDistributionChart data={nationalDistribution} /> : null}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">State Comparison</h2>
          {statesLoading ? <LoadingSpinner message="Loading states…" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {['State', 'Works', 'Txs', 'Avg Risk', 'High', 'Elevated', 'Moderate', 'Low', 'Review'].map((h) => (
                      <th key={h} className="text-right first:text-left py-2 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(states ?? []).map((s) => (
                    <StateRow key={s.state} s={s} onClick={() => navigate(`/states?state=${encodeURIComponent(s.state)}`)} />
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-2">Click a state row → State Analysis</p>
            </div>
          )}
        </div>
      </div>

      {/* Priority Works */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Priority Works — Top 10 by Risk Score</h2>
          <button onClick={() => navigate('/explorer')} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">View all →</button>
        </div>
        <PriorityWorksTable works={topWorks ?? []} loading={worksLoading} />
      </div>

      {/* Disclaimer */}
      <div className="bg-slate-800 text-slate-300 rounded-xl p-5 text-xs leading-relaxed">
        <p className="font-semibold text-white mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" /> Sentinel — Human Review Framework
        </p>
        <p>
          Sentinel identifies risk signals and anomaly patterns in MPLADS implementation data. It does not determine guilt, certify fraud, or replace official inquiry processes. Risk scores represent algorithmic assessments of observable data patterns. All flagged works require investigation and final determination by authorised officials.
        </p>
      </div>
    </div>
  );
}
