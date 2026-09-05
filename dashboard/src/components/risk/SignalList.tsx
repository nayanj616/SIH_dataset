import type { RiskSignal } from '../../lib/types';
import { DIMENSION_LABELS, SEVERITY_COLORS, formatSignalId } from '../../lib/constants';
import { AlertTriangle, Info } from 'lucide-react';

interface SignalListProps {
  signals: RiskSignal[];
}

export function SignalList({ signals }: SignalListProps) {
  if (signals.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-4">
        <Info className="w-4 h-4" />
        <span className="text-sm">No anomaly signals detected for this work.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {signals.map((signal) => (
        <div key={signal.signal_instance_id} className="border border-slate-200 rounded-lg p-4 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{formatSignalId(signal.signal_id)}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dimension: {DIMENSION_LABELS[signal.dimension]}
                </p>
                {signal.evidence_summary && (
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{signal.evidence_summary}</p>
                )}
                {(signal.observed_value || signal.threshold) && (
                  <div className="flex flex-wrap gap-4 mt-2">
                    {signal.observed_value && (
                      <div>
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Observed</span>
                        <p className="text-sm font-mono text-slate-700">{signal.observed_value}</p>
                      </div>
                    )}
                    {signal.threshold && (
                      <div>
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Threshold</span>
                        <p className="text-sm font-mono text-slate-700">{signal.threshold}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded border ${SEVERITY_COLORS[signal.severity]}`}>
                {signal.severity}
              </span>
              <span className="text-xs text-slate-400">+{signal.points} pts</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
