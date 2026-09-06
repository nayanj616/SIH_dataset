import { useState, useEffect } from 'react';
import type { RiskEvidence, RiskSignal } from '../../lib/types';
import { DIMENSION_LABELS, SEVERITY_COLORS, formatSignalId } from '../../lib/constants';
import { FileText, Info, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface EvidencePanelProps {
  evidence: RiskEvidence | null;
  signals: RiskSignal[];
  initialExpandedId?: string | null;
  onClearExpandedId?: () => void;
}

function renderValue(val: unknown, depth = 0): React.ReactNode {
  if (val === null || val === undefined) return <span className="text-slate-400 italic">null</span>;
  if (typeof val === 'boolean')
    return <span className={val ? 'text-red-600 font-semibold' : 'text-green-600'}>{val.toString()}</span>;
  if (typeof val === 'number') return <span className="text-indigo-700 font-mono">{val}</span>;
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return <span className="text-slate-700 font-mono">{val}</span>;
    return <span className="text-slate-700">{val}</span>;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-slate-400 italic">empty list</span>;
    return (
      <ul className={`space-y-1 ${depth > 0 ? 'ml-4' : ''}`}>
        {val.slice(0, 20).map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-slate-400 text-xs mt-0.5 flex-shrink-0">•</span>
            <span>{renderValue(item, depth + 1)}</span>
          </li>
        ))}
        {val.length > 20 && <li className="text-slate-400 text-xs italic">… and {val.length - 20} more</li>}
      </ul>
    );
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-slate-400 italic">empty</span>;
    return (
      <div className={`space-y-2 ${depth > 0 ? 'ml-4 border-l border-slate-100 pl-3' : ''}`}>
        {entries.map(([k, v]) => (
          <div key={k}>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{k.replace(/_/g, ' ')}</span>
            <div className="mt-0.5 text-sm">{renderValue(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(val)}</span>;
}

export function EvidencePanel({ evidence, signals, initialExpandedId, onClearExpandedId }: EvidencePanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialExpandedId) {
      setExpandedIds(prev => new Set(prev).add(initialExpandedId));
      if (onClearExpandedId) onClearExpandedId();
    }
  }, [initialExpandedId, onClearExpandedId]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = (allIds: string[]) => setExpandedIds(new Set(allIds));
  const collapseAll = () => setExpandedIds(new Set());

  const evObj = (evidence?.evidence as Record<string, unknown>) || {};
  const evKeys = Object.keys(evObj);
  const matchedKeys = new Set<string>();

  // Determine all IDs that can be expanded (signals + unmatched keys)
  const unmatchedKeys = evKeys.filter(k => !signals.some(s => s.signal_id === k));
  const allExpandableIds = [...signals.map(s => s.signal_id), ...unmatchedKeys];

  return (
    <div className="space-y-4">
      {(signals.length > 0 || evKeys.length > 0) && (
        <div className="flex justify-end gap-3 mb-2 px-2">
          <button 
            onClick={() => expandAll(allExpandableIds)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Expand All
          </button>
          <button 
            onClick={collapseAll}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Collapse All
          </button>
        </div>
      )}

      {signals.map(signal => {
        const signalKey = signal.signal_id;
        const hasSpecificEvidence = evObj.hasOwnProperty(signalKey);
        const isExpanded = expandedIds.has(signalKey);
        
        if (hasSpecificEvidence) matchedKeys.add(signalKey);

        return (
          <div key={signal.signal_instance_id} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
            <div 
              className="px-5 py-4 cursor-pointer select-none group"
              onClick={() => toggleExpand(signalKey)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${signal.severity === 'Critical' || signal.severity === 'High' ? 'text-red-500' : 'text-orange-500'}`} />
                    <h3 className="font-bold text-slate-800 truncate">{formatSignalId(signalKey)}</h3>
                    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${SEVERITY_COLORS[signal.severity]}`}>
                      {signal.severity}
                    </span>
                    <span className="text-xs font-bold text-slate-400">+{signal.points}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                    {DIMENSION_LABELS[signal.dimension]}
                  </p>
                  {signal.evidence_summary && (
                    <p className="text-sm text-slate-600 leading-relaxed mb-3 pr-8">
                      {signal.evidence_summary}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                {isExpanded ? (
                  <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Hide Evidence</>
                ) : (
                  <><ChevronDown className="w-3.5 h-3.5 mr-1" /> View Evidence</>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                {hasSpecificEvidence ? (
                  <div className="text-sm">{renderValue(evObj[signalKey])}</div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400 italic text-sm">
                    <Info className="w-4 h-4" />
                    <span>No structured raw JSON evidence mapped specifically to this signal ID.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {unmatchedKeys.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-slate-800 mb-3 px-2">Additional Evidence Records</h3>
          <div className="space-y-4">
            {unmatchedKeys.map(k => {
              const isExpanded = expandedIds.has(k);
              return (
                <div key={k} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div 
                    className="flex items-center justify-between px-5 py-4 cursor-pointer select-none group"
                    onClick={() => toggleExpand(k)}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      <span className="text-sm font-bold uppercase tracking-wider text-slate-700">
                        {k.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-5 text-sm">
                      {renderValue(evObj[k])}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {signals.length === 0 && unmatchedKeys.length === 0 && (
        <div className="flex items-center justify-center gap-2 text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-xl">
          <Info className="w-5 h-5" />
          <span className="text-sm font-medium">No evidence records found for this work.</span>
        </div>
      )}
    </div>
  );
}
