import type { RiskLevel } from '../../lib/types';
import { RISK_COLORS } from '../../lib/constants';

interface RiskScoreGaugeProps {
  score: number | null;
  level: RiskLevel | null;
}

export function RiskScoreGauge({ score, level }: RiskScoreGaugeProps) {
  if (score == null || !level) {
    return (
      <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-xl border border-slate-200">
        <span className="text-slate-400">No risk score available</span>
      </div>
    );
  }

  const colors = RISK_COLORS[level];

  return (
    <div className={`rounded-xl border-2 p-6 ${colors.border} ${colors.bg}`}>
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className={`text-5xl font-bold tabular-nums ${colors.text}`}>{score}</div>
          <div className="text-xs text-slate-500 mt-1">out of 100</div>
        </div>
        <div className="w-px h-16 bg-slate-200" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Risk Level</div>
          <div className={`text-2xl font-bold ${colors.text}`}>{level}</div>
          <div className="mt-3 w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${score}%`, backgroundColor: colors.hex }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
