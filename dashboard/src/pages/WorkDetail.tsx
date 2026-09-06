import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkDetail } from '../hooks/useWorkDetail';
import { useRiskSignals } from '../hooks/useRiskSignals';
import { useRiskEvidence } from '../hooks/useRiskEvidence';
import { useTransactions } from '../hooks/useTransactions';
import { DimensionScores } from '../components/risk/DimensionScores';
import { SignalList } from '../components/risk/SignalList';
import { EvidencePanel } from '../components/risk/EvidencePanel';
import { TransactionTable } from '../components/tables/TransactionTable';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { formatCurrency, formatDate, RISK_COLORS } from '../lib/constants';
import { 
  ArrowLeft, Copy, MapPin, Map, User, AlertTriangle, 
  Activity, Briefcase, FileText, 
  Layers, ReceiptText
} from 'lucide-react';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-500 w-40 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-medium">{value ?? '—'}</span>
    </div>
  );
}

export function WorkDetail() {
  const params = useParams();
  const workId = params['*'];
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'evidence'>('overview');
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

  const { data: work, isLoading: workLoading, error: workError } = useWorkDetail(workId);
  const { data: signals, isLoading: signalsLoading } = useRiskSignals(workId);
  const { data: evidence, isLoading: evidenceLoading } = useRiskEvidence(workId);
  const { data: transactions, isLoading: txLoading } = useTransactions(workId);

  const copyId = () => {
    if (workId) navigator.clipboard.writeText(workId);
  };

  if (workLoading) return <div className="p-8"><LoadingSpinner message="Loading investigation…" /></div>;
  if (workError) return <div className="p-8"><ErrorBanner message={workError.message} /></div>;
  if (!work) return (
    <div className="p-8 text-center text-slate-500">Work not found: <code className="font-mono">{workId}</code></div>
  );

  const riskColors = RISK_COLORS[work.risk_level ?? 'Low / Normal'];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to Work Explorer
        </button>
      </div>

      {/* Header Section */}
      <div className="flex flex-col xl:flex-row gap-6 justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900 font-mono tracking-tight">{work.work_id}</h1>
            <button onClick={copyId} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors" title="Copy ID">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-600 mb-4 max-w-3xl leading-relaxed">{work.work ?? work.work_description ?? '—'}</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
              <MapPin className="w-3.5 h-3.5" /> {work.state ?? 'Unknown State'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
              <Map className="w-3.5 h-3.5" /> {work.constituency ?? 'Unknown Const.'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
              <User className="w-3.5 h-3.5" /> {work.mp_name ?? 'Unknown MP'}
            </span>
          </div>
        </div>

        {/* Risk & Review Cards */}
        <div className="flex gap-4 shrink-0">
          <div className={`border-2 rounded-xl p-4 w-44 flex flex-col items-center justify-center text-center ${riskColors.border} ${riskColors.bg}`}>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Risk Score</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-5xl font-bold tabular-nums ${riskColors.text}`}>{work.risk_score ?? '—'}</span>
              <span className="text-slate-400 font-medium">/100</span>
            </div>
            <span className={`mt-2 inline-flex px-2 py-0.5 rounded text-xs font-bold ${riskColors.badge}`}>
              {work.risk_level ?? 'Unknown'}
            </span>
          </div>

          {work.requires_human_review && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 w-64 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider mb-2">
                <AlertTriangle className="w-4 h-4" /> Flagged for Human Review
              </div>
              <p className="text-xs text-amber-700 leading-relaxed mb-3">
                Sentinel has identified risk signals requiring investigation.
              </p>
              <button className="text-xs font-semibold bg-white border border-amber-200 text-amber-800 px-3 py-1.5 rounded hover:bg-amber-100 transition-colors w-full">
                Mark as Reviewed →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Sanction Amount</span>
          <div className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(work.sanction_amount)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Expenditure</span>
          <div className="text-lg font-bold text-slate-800 mt-1">{formatCurrency(work.total_expenditure)}</div>
          <div className="text-xs text-slate-400 font-medium mt-0.5">
            {work.expenditure_vs_sanction_ratio ? `${(work.expenditure_vs_sanction_ratio * 100).toFixed(1)}% of sanctioned` : '—'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Transactions</span>
          <div className="text-lg font-bold text-slate-800 mt-1">{work.expenditure_transaction_count ?? 0}</div>
          <div className="text-xs text-slate-400 font-medium mt-0.5">{work.unique_vendor_count ?? 0} vendors</div>
        </div>
        <div className="bg-white border border-red-200 bg-red-50 rounded-lg p-3">
          <span className="text-xs text-red-600 font-semibold uppercase tracking-wider">Duplicate Tx</span>
          <div className="text-lg font-bold text-red-700 mt-1">{work.duplicate_transaction_count ?? 0}</div>
          <div className="text-xs text-red-500 font-medium mt-0.5">{formatCurrency(work.potential_duplicate_amount_total)} potential</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Days to Sanction</span>
          <div className="text-lg font-bold text-slate-800 mt-1">{work.days_to_sanction ?? '—'}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Days to Completion</span>
          <div className="text-lg font-bold text-slate-800 mt-1">{work.days_to_completion ?? '—'}</div>
        </div>
      </div>

      {/* Compact Risk Dimensions */}
      <DimensionScores work={work} />

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-8">
          {[
            { id: 'overview', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
            { id: 'transactions', label: `Transactions (${transactions?.length ?? 0})`, icon: <Briefcase className="w-4 h-4" /> },
            { id: 'evidence', label: `Evidence (${evidence ? Object.keys(evidence.evidence as object).length : 0})`, icon: <ReceiptText className="w-4 h-4" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 py-4 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="py-2">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Split layout: Info & Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Work Information */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <h2 className="font-bold text-slate-800">Work Information</h2>
                </div>
                <div className="p-6 space-y-1">
                  <InfoRow label="Work ID" value={work.work_id} />
                  <InfoRow label="Work Title" value={work.work} />
                  <InfoRow label="State" value={work.state} />
                  <InfoRow label="Constituency" value={work.constituency} />
                  <InfoRow label="MP Name" value={work.mp_name} />
                  <InfoRow label="Implementing Agency" value={work.ida} />
                  <InfoRow label="Work Category" value={work.work_category} />
                  <InfoRow label="Work Status" value={work.work_status} />
                  <InfoRow label="Sanction Amount" value={formatCurrency(work.sanction_amount)} />
                  <InfoRow label="Sanction Date" value={formatDate(work.sanction_date)} />
                  <InfoRow label="Completion Date" value={formatDate(work.completion_date)} />
                </div>
              </div>

              {/* Execution Metrics (grouped logically) */}
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    <h2 className="font-bold text-slate-800">Execution & Utilization Metrics</h2>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Total Expenditure</span>
                      <span className="text-sm font-semibold text-slate-800">{formatCurrency(work.total_expenditure)}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Exp vs Sanction</span>
                      <span className={`text-sm font-semibold tabular-nums ${work.expenditure_exceeds_sanction ? 'text-red-600' : 'text-slate-800'}`}>
                        {work.expenditure_vs_sanction_ratio ? `${(work.expenditure_vs_sanction_ratio * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Days to Sanction</span>
                      <span className="text-sm font-semibold text-slate-800">{work.days_to_sanction ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Days to Completion</span>
                      <span className="text-sm font-semibold text-slate-800">{work.days_to_completion ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Total Transactions</span>
                      <span className="text-sm font-semibold text-slate-800">{work.expenditure_transaction_count ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Unique Vendors</span>
                      <span className="text-sm font-semibold text-slate-800">{work.unique_vendor_count ?? 0}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <h2 className="font-bold text-slate-800">Duplication & Anomaly Metrics</h2>
                  </div>
                  <div className="p-6 grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Duplicate Tx Count</span>
                      <span className={`text-lg font-bold tabular-nums ${work.duplicate_transaction_count ? 'text-orange-600' : 'text-slate-800'}`}>{work.duplicate_transaction_count ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Duplicate Groups</span>
                      <span className="text-lg font-bold tabular-nums text-slate-800">{work.duplicate_group_count ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Potential Dup. Amount</span>
                      <span className={`text-lg font-bold tabular-nums ${work.potential_duplicate_amount_total ? 'text-orange-600' : 'text-slate-800'}`}>{formatCurrency(work.potential_duplicate_amount_total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Anomaly Signals */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-indigo-500" />
                  <h2 className="font-bold text-slate-800">Anomaly Signals ({signals?.length ?? 0})</h2>
                </div>
                <button 
                  onClick={() => setActiveTab('evidence')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  View Detailed Evidence →
                </button>
              </div>
              <div className="p-6">
                {signalsLoading ? <LoadingSpinner message="Loading signals…" /> : (
                  <SignalList 
                    signals={signals ?? []} 
                    onViewEvidence={(signalId) => {
                      setActiveTab('evidence');
                      setExpandedEvidenceId(signalId);
                    }} 
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-800">Expenditure Transactions</h2>
              <p className="text-xs text-slate-500 mt-1">Duplicate and orphan transactions are automatically highlighted.</p>
            </div>
            <div className="p-6">
              {txLoading ? <LoadingSpinner message="Loading transactions…" /> : <TransactionTable transactions={transactions ?? []} />}
            </div>
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-800">Detailed Evidence Record</h2>
              <p className="text-xs text-slate-500 mt-1">Structured AI-generated evidence supporting the detected anomaly signals.</p>
            </div>
            <div className="p-6">
              {evidenceLoading ? <LoadingSpinner message="Loading evidence…" /> : (
                <EvidencePanel 
                  evidence={evidence ?? null} 
                  signals={signals ?? []} 
                  initialExpandedId={expandedEvidenceId}
                  onClearExpandedId={() => setExpandedEvidenceId(null)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
