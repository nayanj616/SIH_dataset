import type { WorkRiskOverview, SignalDimension } from '../../lib/types';
import { DIMENSION_LABELS, DIMENSION_DESCRIPTIONS } from '../../lib/constants';

const DIMENSIONS: { key: keyof WorkRiskOverview; dim: SignalDimension }[] = [
  { key: 'financial_integrity_score', dim: 'financial_integrity' },
  { key: 'transaction_pattern_score', dim: 'transaction_pattern' },
  { key: 'lifecycle_execution_score', dim: 'lifecycle_execution' },
  { key: 'data_quality_score', dim: 'data_quality' },
];

function scoreColor(score: number): string {
  if (score >= 60) return '#dc2626';
  if (score >= 35) return '#ea580c';
  if (score >= 15) return '#ca8a04';
  return '#16a34a';
}

interface DimensionScoresProps {
  work: WorkRiskOverview;
}

export function DimensionScores({ work }: DimensionScoresProps) {
  return (
    <div className="space-y-4">
      {DIMENSIONS.map(({ key, dim }) => {
        const score = (work[key] as number) ?? 0;
        const label = DIMENSION_LABELS[dim];
        const desc = DIMENSION_DESCRIPTIONS[dim];
        const color = scoreColor(score);

        return (
          <div key={dim}>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <span className="text-sm font-semibold text-slate-700">{label}</span>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <span className="text-base font-bold tabular-nums ml-4" style={{ color }}>
                {score}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${score}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
