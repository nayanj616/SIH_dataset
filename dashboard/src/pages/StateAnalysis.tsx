import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStateSummary } from '../hooks/useStateSummary';
import { useTopRiskWorks } from '../hooks/useWorkOverview';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { RiskDistributionChart } from '../components/charts/RiskDistributionChart';
import { PriorityWorksTable } from '../components/tables/PriorityWorksTable';
import { KpiCard } from '../components/ui/KpiCard';
import type { StateSummary } from '../lib/types';
import { STATES, formatCurrency } from '../lib/constants';
import { Map, AlertTriangle, TrendingUp, Users, FileText, Activity } from 'lucide-react';

export function StateAnalysis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedState, setSelectedState] = useState<string>(searchParams.get('state') ?? '');

  const { data: allStates, isLoading, error } = useStateSummary();
  const { data: topWorks, isLoading: worksLoading } = useTopRiskWorks(10, selectedState || undefined);

  useEffect(() => {
    setSelectedState(searchParams.get('state') ?? '');
  }, [searchParams]);

  const handleStateChange = (s: string) => {
    setSelectedState(s);
    if (s) setSearchParams({ state: s });
    else setSearchParams({});
  };

  const stateData: StateSummary | null = selectedState
    ? (allStates?.find((s) => s.state === selectedState) ?? null)
    : null;

  const displayData: StateSummary | null = selectedState
    ? stateData
    : allStates
    ? ({
        state: 'All States',
        total_works: allStates.reduce((s, r) => s + r.total_works, 0),
        total_transactions: allStates.reduce((s, r) => s + r.total_transactions, 0),
        avg_risk_score: parseFloat(
          (allStates.reduce((s, r) => s + (r.avg_risk_score ?? 0), 0) / allStates.length).toFixed(2)
        ),
        high_risk_works: allStates.reduce((s, r) => s + r.high_risk_works, 0),
        elevated_risk_works: allStates.reduce((s, r) => s + r.elevated_risk_works, 0),
        moderate_risk_works: allStates.reduce((s, r) => s + r.moderate_risk_works, 0),
        low_risk_works: allStates.reduce((s, r) => s + r.low_risk_works, 0),
        human_review_required: allStates.reduce((s, r) => s + r.human_review_required, 0),
        total_sanction_amount: allStates.reduce((s, r) => s + (r.total_sanction_amount ?? 0), 0),
        total_disbursed: allStates.reduce((s, r) => s + (r.total_disbursed ?? 0), 0),
        total_expenditure: allStates.reduce((s, r) => s + (r.total_expenditure ?? 0), 0),
        total_potential_duplicate_amount: allStates.reduce((s, r) => s + r.total_potential_duplicate_amount, 0),
        works_with_overrun: allStates.reduce((s, r) => s + r.works_with_overrun, 0),
        works_with_duplicates: allStates.reduce((s, r) => s + r.works_with_duplicates, 0),
        orphan_transaction_count: allStates.reduce((s, r) => s + r.orphan_transaction_count, 0),
        orphan_transaction_amount: allStates.reduce((s, r) => s + r.orphan_transaction_amount, 0),
      } as StateSummary)
    : null;

  if (error) return <div className="p-8"><ErrorBanner message={error.message} /></div>;

  return (
    <div className="p-8 space-y-8">
      <div className="border-b border-slate-200 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">State Analysis</h1>
        </div>
        <select
          value={selectedState}
          onChange={(e) => handleStateChange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All States</option>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? <LoadingSpinner message="Loading state data…" /> : displayData ? (
        <>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{displayData.state}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Average Risk Score: <strong className="text-slate-700">
                {displayData.avg_risk_score != null ? Number(displayData.avg_risk_score).toFixed(2) : '—'}
              </strong> / 100
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            <KpiCard label="Total Works" value={displayData.total_works.toLocaleString()} icon={<FileText className="w-4 h-4" />} />
            <KpiCard label="Transactions" value={displayData.total_transactions.toLocaleString()} icon={<Activity className="w-4 h-4" />} />
            <KpiCard label="High Risk Works" value={displayData.high_risk_works} icon={<AlertTriangle className="w-4 h-4" />} accent="text-red-600" />
            <KpiCard label="Elevated Risk" value={displayData.elevated_risk_works} icon={<TrendingUp className="w-4 h-4" />} accent="text-orange-600" />
            <KpiCard label="Moderate Risk" value={displayData.moderate_risk_works} accent="text-yellow-700" />
            <KpiCard label="Low / Normal" value={displayData.low_risk_works} accent="text-green-700" />
            <KpiCard label="Human Review Required" value={displayData.human_review_required} icon={<Users className="w-4 h-4" />} accent="text-amber-700" />
            <KpiCard label="Works with Duplicates" value={displayData.works_with_duplicates} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Sanction Amount</p>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(displayData.total_sanction_amount)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Budget Overrun Works</p>
              <p className="text-2xl font-bold text-red-600">{displayData.works_with_overrun}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Orphan Transactions</p>
              <p className="text-2xl font-bold text-yellow-700">{displayData.orphan_transaction_count}</p>
              <p className="text-xs text-slate-400 mt-1">Expenditure without matching work record</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
              Risk Distribution — {displayData.state}
            </h2>
            <RiskDistributionChart data={displayData} />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
              Priority Works — {displayData.state}
            </h2>
            <PriorityWorksTable works={topWorks ?? []} loading={worksLoading} />
          </div>
        </>
      ) : null}
    </div>
  );
}
