import { useState, useEffect } from 'react';
import type { RiskEvidence, RiskSignal } from '../../lib/types';
import { formatSignalId, formatCurrency } from '../../lib/constants';
import { FileText, Info, ChevronDown, ChevronUp, Database } from 'lucide-react';

interface EvidencePanelProps {
  evidence: RiskEvidence | null;
  signals: RiskSignal[];
  initialExpandedId?: string | null;
  onClearExpandedId?: () => void;
}

function isPrimitive(val: unknown): boolean {
  return val === null || val === undefined || typeof val !== 'object';
}

function PrimitiveRenderer({ val }: { val: unknown }) {
  if (val === null || val === undefined) return <span className="text-slate-400 italic">null</span>;
  if (typeof val === 'boolean')
    return <span className={val ? 'text-red-600 font-semibold' : 'text-green-600'}>{val.toString()}</span>;
  if (typeof val === 'number') return <span className="text-indigo-700 font-mono">{val}</span>;
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return <span className="text-slate-700 font-mono">{val}</span>;
    return <span className="text-slate-700">{val}</span>;
  }
  return <span>{String(val)}</span>;
}

function getSummaryFields(obj: any): string {
  if (!obj || typeof obj !== 'object') return '';
  const parts = [];
  const o = obj as Record<string, any>;
  
  if (o.vendor_name) parts.push(String(o.vendor_name));
  else if (o.vendor) parts.push(String(o.vendor));
  
  if (o.expenditure_id) parts.push(`ID: ${o.expenditure_id}`);
  else if (o.duplicate_group_id) parts.push(`Group: ${o.duplicate_group_id}`);
  else if (o.id) parts.push(`ID: ${o.id}`);

  if (o.amount !== undefined) parts.push(formatCurrency(Number(o.amount)));
  else if (o.fund_disbursed_amount !== undefined) parts.push(formatCurrency(Number(o.fund_disbursed_amount)));
  else if (o.potential_duplicate_amount !== undefined) parts.push(formatCurrency(Number(o.potential_duplicate_amount)));

  if (o.date) parts.push(String(o.date));
  else if (o.expenditure_date) parts.push(String(o.expenditure_date));
  
  if (o.status) parts.push(String(o.status));
  else if (o.payment_status) parts.push(String(o.payment_status));

  if (parts.length > 0) return parts.join(' • ');
  
  const primitives = Object.entries(o).filter(([_, v]) => isPrimitive(v));
  if (primitives.length > 0) {
    return primitives.slice(0, 3).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' • ');
  }
  return 'Expand to view record details';
}

interface CollapsibleNodeProps {
  id?: string;
  label: string;
  summary?: string;
  isRoot?: boolean;
  initialExpanded?: boolean;
  expandCounter: number;
  collapseCounter: number;
  children: React.ReactNode;
}

function CollapsibleNode({ id, label, summary, isRoot, initialExpanded, expandCounter, collapseCounter, children }: CollapsibleNodeProps) {
  const [expanded, setExpanded] = useState(initialExpanded ?? false);

  useEffect(() => {
    if (expandCounter > 0) setExpanded(true);
  }, [expandCounter]);

  useEffect(() => {
    if (collapseCounter > 0) setExpanded(false);
  }, [collapseCounter]);

  return (
    <div id={id} className={`border ${isRoot ? 'border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm' : 'border-slate-100 rounded bg-white mt-2'}`}>
      <div 
        className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none group transition-colors ${isRoot ? 'bg-slate-50 border-b border-slate-100' : 'hover:bg-slate-50'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isRoot ? <Database className="w-4 h-4 text-indigo-500 flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3">
            <span className={`font-bold truncate ${isRoot ? 'text-slate-800 uppercase tracking-wider text-xs' : 'text-slate-700 text-sm'}`}>
              {label}
            </span>
            {summary && <span className="text-xs text-slate-500 truncate">{summary}</span>}
          </div>
        </div>
        <div className="flex items-center justify-center w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      {expanded && (
        <div className={`p-4 ${!isRoot ? 'border-t border-slate-100 bg-slate-50/30' : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function ValueRenderer({ val, depth = 0, expandCounter, collapseCounter }: { val: unknown, depth?: number, expandCounter: number, collapseCounter: number }) {
  if (isPrimitive(val)) {
    return <PrimitiveRenderer val={val} />;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-slate-400 italic text-sm">empty list</span>;
    if (isPrimitive(val[0])) {
      return <div className="text-sm text-slate-700">{val.map(String).join(', ')}</div>;
    }
    return (
      <div className="space-y-2">
        {val.map((item, idx) => (
          <CollapsibleNode 
            key={idx}
            label={`Record ${idx + 1}`}
            summary={getSummaryFields(item)}
            expandCounter={expandCounter}
            collapseCounter={collapseCounter}
          >
            <ValueRenderer val={item} depth={depth + 1} expandCounter={expandCounter} collapseCounter={collapseCounter} />
          </CollapsibleNode>
        ))}
      </div>
    );
  }

  const entries = Object.entries(val as Record<string, unknown>);
  if (entries.length === 0) return <span className="text-slate-400 italic text-sm">empty object</span>;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
      {entries.map(([k, v]) => {
        const isPrim = isPrimitive(v);
        const isArr = Array.isArray(v);

        if (isPrim) {
          return (
            <div key={k} className="flex flex-col border-b border-slate-100 pb-2 last:border-0 md:border-0 md:pb-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{k.replace(/_/g, ' ')}</span>
              <div className="text-sm"><PrimitiveRenderer val={v} /></div>
            </div>
          );
        }
        
        if (isArr) {
           return (
              <div key={k} className="col-span-1 md:col-span-2 pt-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">{k.replace(/_/g, ' ')} ({(v as any[]).length})</span>
                  <ValueRenderer val={v} depth={depth + 1} expandCounter={expandCounter} collapseCounter={collapseCounter} />
              </div>
           );
        }

        return (
          <div key={k} className="col-span-1 md:col-span-2">
            <CollapsibleNode 
              label={k.replace(/_/g, ' ')}
              expandCounter={expandCounter}
              collapseCounter={collapseCounter}
            >
              <ValueRenderer val={v} depth={depth + 1} expandCounter={expandCounter} collapseCounter={collapseCounter} />
            </CollapsibleNode>
          </div>
        );
      })}
    </div>
  );
}

export function EvidencePanel({ evidence, signals, initialExpandedId, onClearExpandedId }: EvidencePanelProps) {
  const [expandCounter, setExpandCounter] = useState(0);
  const [collapseCounter, setCollapseCounter] = useState(0);

  useEffect(() => {
    if (initialExpandedId) {
      const el = document.getElementById(`evidence-section-${initialExpandedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [initialExpandedId]);

  if (!evidence) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-xl">
        <Info className="w-5 h-5" />
        <span className="text-sm font-medium">No evidence record found for this work.</span>
      </div>
    );
  }

  const evObj = (evidence.evidence as Record<string, unknown>) || {};
  const sections = Object.entries(evObj);

  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-xl">
        <Info className="w-5 h-5" />
        <span className="text-sm font-medium">Evidence record is empty.</span>
      </div>
    );
  }

  const focusSignal = initialExpandedId ? signals.find(s => s.signal_id === initialExpandedId) : null;

  return (
    <div className="space-y-6">
      {focusSignal && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">
              Evidence Context: {formatSignalId(focusSignal.signal_id)}
            </h3>
            <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
              {focusSignal.evidence_summary}
            </p>
            <button 
              onClick={onClearExpandedId} 
              className="mt-3 text-xs font-semibold bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded hover:bg-indigo-100 transition-colors"
            >
              Clear Focus
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center px-2">
        <h3 className="text-sm font-bold text-slate-700">Forensic Evidence Records</h3>
        <div className="flex gap-4">
          <button 
            onClick={() => setExpandCounter(c => c + 1)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Expand All
          </button>
          <button 
            onClick={() => setCollapseCounter(c => c + 1)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map(([sectionKey, sectionVal]) => {
          let summary = '';
          if (Array.isArray(sectionVal)) summary = `${sectionVal.length} records`;
          else if (typeof sectionVal === 'object' && sectionVal !== null) summary = `${Object.keys(sectionVal).length} fields`;

          const isFocused = initialExpandedId === sectionKey;

          return (
            <CollapsibleNode 
              key={sectionKey}
              id={`evidence-section-${sectionKey}`}
              label={sectionKey.replace(/_/g, ' ')}
              summary={summary}
              isRoot={true}
              initialExpanded={isFocused}
              expandCounter={expandCounter}
              collapseCounter={collapseCounter}
            >
              <ValueRenderer 
                val={sectionVal} 
                expandCounter={expandCounter} 
                collapseCounter={collapseCounter} 
              />
            </CollapsibleNode>
          );
        })}
      </div>
    </div>
  );
}
