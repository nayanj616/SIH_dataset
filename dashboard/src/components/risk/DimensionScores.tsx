import type { WorkRiskOverview, SignalDimension } from '../../lib/types';
import { DIMENSION_LABELS } from '../../lib/constants';
import { Activity } from 'lucide-react';

const DIMENSIONS: { key: keyof WorkRiskOverview; dim: SignalDimension }[] = [
  { key: 'financial_integrity_score', dim: 'financial_integrity' },
  { key: 'transaction_pattern_score', dim: 'transaction_pattern' },
  { key: 'lifecycle_execution_score', dim: 'lifecycle_execution' },
  { key: 'data_quality_score', dim: 'data_quality' },
];

function scoreColor(score: number): string {
  if (score >= 60) return '#dc2626'; // red-600
  if (score >= 35) return '#ea580c'; // orange-600
  if (score >= 15) return '#ca8a04'; // yellow-600
  return '#16a34a'; // green-600
}

interface DimensionScoresProps {
  work: WorkRiskOverview;
}

export function DimensionScores({ work }: DimensionScoresProps) {
  return (
    <div className="flex flex-col md:flex-row gap-8 bg-white border border-slate-200 rounded-xl p-6">
      <div className="md:w-1/3 shrink-0">
        <div className="flex items-center gap-2 text-indigo-600 mb-2">
          <div className="p-1.5 bg-indigo-50 rounded-md">
            <Activity className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-slate-800">Risk Dimensions</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Breakdown of risk score across key areas. Higher scores indicate greater detected anomalies.
        </p>
      </div>

      <div className="flex-1 space-y-4">
        {DIMENSIONS.map(({ key, dim }) => {
          const score = (work[key] as number) ?? 0;
          const label = DIMENSION_LABELS[dim];
          const color = scoreColor(score);

          return (
            <div key={dim} className="flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-700 w-32 shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-sm font-bold tabular-nums w-8 text-right" style={{ color }}>
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

