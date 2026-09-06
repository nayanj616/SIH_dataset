import type { RiskSignal } from '../../lib/types';
import { DIMENSION_LABELS, SEVERITY_COLORS, formatSignalId } from '../../lib/constants';
import { AlertTriangle, Info, ArrowRight } from 'lucide-react';

interface SignalListProps {
  signals: RiskSignal[];
  onViewEvidence?: (signalId: string) => void;
}

export function SignalList({ signals, onViewEvidence }: SignalListProps) {
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
        <div key={signal.signal_instance_id} className="border border-slate-200 rounded-lg p-4 bg-white hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${signal.severity === 'Critical' || signal.severity === 'High' ? 'text-red-500' : 'text-orange-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{formatSignalId(signal.signal_id)}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {DIMENSION_LABELS[signal.dimension]}
                </p>
                {signal.evidence_summary && (
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{signal.evidence_summary}</p>
                )}
                
                {onViewEvidence && (
                  <button 
                    onClick={() => onViewEvidence(signal.signal_id)}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    View Evidence <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${SEVERITY_COLORS[signal.severity]}`}>
                {signal.severity}
              </span>
              <span className="text-xs font-bold text-slate-400">+{signal.points}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
