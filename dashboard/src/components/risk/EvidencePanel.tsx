import type { RiskEvidence } from '../../lib/types';
import { FileText, Info } from 'lucide-react';

interface EvidencePanelProps {
  evidence: RiskEvidence | null;
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

export function EvidencePanel({ evidence }: EvidencePanelProps) {
  if (!evidence) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-4">
        <Info className="w-4 h-4" />
        <span className="text-sm">No evidence record found for this work.</span>
      </div>
    );
  }

  const evObj = evidence.evidence as Record<string, unknown>;
  const sections = Object.entries(evObj);

  if (sections.length === 0) {
    return <div className="text-slate-400 text-sm py-4 italic">Evidence record is empty.</div>;
  }

  return (
    <div className="space-y-4">
      {sections.map(([sectionKey, sectionVal]) => (
        <div key={sectionKey} className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <FileText className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {sectionKey.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="p-4 text-sm">{renderValue(sectionVal)}</div>
        </div>
      ))}
    </div>
  );
}
