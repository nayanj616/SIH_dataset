import { useParams, useNavigate } from 'react-router-dom';
import { useWorkDetail } from '../hooks/useWorkDetail';
import { useRiskSignals } from '../hooks/useRiskSignals';
import { useRiskEvidence } from '../hooks/useRiskEvidence';
import { useTransactions } from '../hooks/useTransactions';
import { RiskScoreGauge } from '../components/risk/RiskScoreGauge';
import { DimensionScores } from '../components/risk/DimensionScores';
import { SignalList } from '../components/risk/SignalList';
import { EvidencePanel } from '../components/risk/EvidencePanel';
import { TransactionTable } from '../components/tables/TransactionTable';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { formatCurrency, formatDate } from '../lib/constants';
import { ArrowLeft, Shield, AlertTriangle, FileText, ReceiptText, Activity, Briefcase, TrendingUp, Clock } from 'lucide-react';

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200 bg-slate-50">
        <span className="text-indigo-500">{icon}</span>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-800">{value ?? '—'}</span>
    </div>
  );
}

export function WorkDetail() {
  const params = useParams();
  const workId = params['*'];
  const navigate = useNavigate();

  const { data: work, isLoading: workLoading, error: workError } = useWorkDetail(workId);
  const { data: signals, isLoading: signalsLoading } = useRiskSignals(workId);
  const { data: evidence, isLoading: evidenceLoading } = useRiskEvidence(workId);
  const { data: transactions, isLoading: txLoading } = useTransactions(workId);

  if (workLoading) return <div className="p-8"><LoadingSpinner message="Loading investigation…" /></div>;
  if (workError) return <div className="p-8"><ErrorBanner message={workError.message} /></div>;
  if (!work) return (
    <div className="p-8">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
        Work not found: <code className="font-mono">{workId}</code>
      </div>
    </div>
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span>/</span><span>Investigation</span><span>/</span>
        <span className="font-mono text-slate-700 font-semibold">{work.work_id}</span>
      </div>

      <div className="border-b border-slate-200 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Sentinel Investigation</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{work.work_id}</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">{work.work ?? work.work_description ?? '—'}</p>
          </div>
          {work.requires_human_review && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Flagged for Human Review</p>
                <p className="text-xs mt-0.5">Sentinel has identified risk signals requiring investigation.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionCard title="Risk Assessment" icon={<Shield className="w-4 h-4" />}>
          <RiskScoreGauge score={work.risk_score} level={work.risk_level} />
          <p className="text-xs text-slate-400 mt-4 leading-relaxed">
            This score reflects algorithmic assessment of observable data patterns. It does not constitute proof of
            wrongdoing. Investigation and final determination remain with authorised officials.
          </p>
        </SectionCard>

        <SectionCard title="Work Details" icon={<FileText className="w-4 h-4" />}>
          <div className="space-y-3">
            <InfoRow label="Work ID" value={work.work_id} />
            <InfoRow label="State" value={work.state} />
            <InfoRow label="Constituency" value={work.constituency} />
            <InfoRow label="Lok Sabha" value={work.lok_sabha} />
            <InfoRow label="MP Name" value={work.mp_name} />
            <InfoRow label="Category" value={work.work_category} />
            <InfoRow label="Implementing Agency" value={work.ida} />
            <InfoRow label="Work Status" value={work.work_status} />
            <InfoRow label="Sanction Date" value={formatDate(work.sanction_date)} />
            <InfoRow label="Sanction Amount" value={formatCurrency(work.sanction_amount)} />
            <InfoRow label="Amount Disbursed" value={formatCurrency(work.amount_disbursed)} />
            <InfoRow label="Completion Date" value={formatDate(work.completion_date)} />
            {work.data_notes && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-semibold text-yellow-700 mb-1">Pipeline Notes</p>
                <p className="text-xs text-yellow-800">{work.data_notes}</p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Execution & Utilization Metrics" icon={<TrendingUp className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Fund Utilization</div>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Total Expenditure</span><span className="font-semibold text-slate-800">{formatCurrency(work.total_expenditure)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Exp. vs Sanction</span><span className={`font-semibold tabular-nums ${work.expenditure_exceeds_sanction ? 'text-red-600' : 'text-slate-800'}`}>{work.expenditure_vs_sanction_ratio ? `${(work.expenditure_vs_sanction_ratio * 100).toFixed(1)}%` : '—'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Disb. vs Sanction</span><span className="font-semibold tabular-nums text-slate-800">{work.disbursement_vs_sanction_ratio ? `${(work.disbursement_vs_sanction_ratio * 100).toFixed(1)}%` : '—'}</span></div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Duration & Delays</div>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Days to Sanction</span><span className="font-semibold tabular-nums text-slate-800">{work.days_to_sanction ?? '—'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Days to Completion</span><span className="font-semibold tabular-nums text-slate-800">{work.days_to_completion ?? '—'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Days Since Last Exp.</span><span className="font-semibold tabular-nums text-slate-800">{work.days_since_last_expenditure ?? '—'}</span></div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Transaction Volume</div>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Total Transactions</span><span className="font-semibold tabular-nums text-slate-800">{work.expenditure_transaction_count ?? 0}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Unique Vendors</span><span className="font-semibold tabular-nums text-slate-800">{work.unique_vendor_count ?? 0}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">High Volume Flag</span><span className="font-semibold text-slate-800">{work.high_transaction_count ? 'Yes' : 'No'}</span></div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> Duplication Risk</div>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Duplicate Tx Count</span><span className={`font-semibold tabular-nums ${work.duplicate_transaction_count ? 'text-orange-600' : 'text-slate-800'}`}>{work.duplicate_transaction_count ?? 0}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Duplicate Groups</span><span className="font-semibold tabular-nums text-slate-800">{work.duplicate_group_count ?? 0}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Pot. Duplicate Amt</span><span className={`font-semibold tabular-nums ${work.potential_duplicate_amount_total ? 'text-orange-600' : 'text-slate-800'}`}>{formatCurrency(work.potential_duplicate_amount_total)}</span></div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Risk Dimensions" icon={<Activity className="w-4 h-4" />}>
        <p className="text-xs text-slate-500 mb-4">
          The overall risk score is composed of four dimensions. High sub-scores indicate specific areas of concern.
        </p>
        <DimensionScores work={work} />
      </SectionCard>

      <SectionCard title={`Anomaly Signals — Why Was This Work Flagged? (${signals?.length ?? 0})`} icon={<AlertTriangle className="w-4 h-4" />}>
        {signalsLoading ? <LoadingSpinner message="Loading signals…" /> : <SignalList signals={signals ?? []} />}
      </SectionCard>

      <SectionCard title="Evidence" icon={<ReceiptText className="w-4 h-4" />}>
        <p className="text-xs text-slate-500 mb-4">
          Structured evidence supporting the risk signals. All values sourced directly from the ingested dataset.
        </p>
        {evidenceLoading ? <LoadingSpinner message="Loading evidence…" /> : <EvidencePanel evidence={evidence ?? null} />}
      </SectionCard>

      <SectionCard title={`Expenditure Transactions (${transactions?.length ?? 0})`} icon={<Briefcase className="w-4 h-4" />}>
        {txLoading ? <LoadingSpinner message="Loading transactions…" /> : <TransactionTable transactions={transactions ?? []} />}
      </SectionCard>

      <div className="bg-slate-800 text-slate-400 rounded-xl p-5 text-xs leading-relaxed">
        <p className="font-semibold text-white mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" /> Important — Scope of Sentinel Analysis
        </p>
        <p>
          Sentinel identifies risk signals; investigation and final determination remain with authorised officials.
          Risk scores and signals represent automated pattern detection on available data. They do not prove fraud,
          establish intent, or replace formal audit or legal processes.
        </p>
      </div>
    </div>
  );
}
