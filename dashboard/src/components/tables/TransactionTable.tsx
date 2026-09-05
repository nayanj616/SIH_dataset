import type { ExpenditureTransaction } from '../../lib/types';
import { formatCurrency, formatDate } from '../../lib/constants';
import { AlertTriangle, Info } from 'lucide-react';

interface TransactionTableProps {
  transactions: ExpenditureTransaction[];
  loading?: boolean;
}

export function TransactionTable({ transactions, loading }: TransactionTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-4">
        <Info className="w-4 h-4" />
        <span className="text-sm">No expenditure transactions recorded for this work.</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2.5 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
            <th className="text-left py-2.5 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Vendor</th>
            <th className="text-left py-2.5 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
            <th className="text-right py-2.5 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
            <th className="text-left py-2.5 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Flags</th>
            <th className="text-left py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Dup Group</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map((tx) => {
            const isDup = tx.is_exact_duplicate;
            const isOrphan = tx.expenditure_without_matching_work;
            const rowClass = isDup ? 'bg-orange-50' : isOrphan ? 'bg-yellow-50' : '';

            return (
              <tr key={tx.expenditure_id} className={rowClass}>
                <td className="py-2.5 pr-3 text-slate-700 whitespace-nowrap font-mono text-xs">
                  {formatDate(tx.expenditure_date)}
                </td>
                <td className="py-2.5 pr-3 text-slate-700 max-w-[160px] truncate">{tx.vendor_name ?? '—'}</td>
                <td className="py-2.5 pr-3"><span className="text-xs text-slate-600">{tx.payment_status ?? '—'}</span></td>
                <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-slate-800 whitespace-nowrap">
                  {formatCurrency(tx.fund_disbursed_amount)}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex gap-1 flex-wrap">
                    {isDup && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" /> Duplicate
                      </span>
                    )}
                    {isOrphan && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" /> Orphan
                      </span>
                    )}
                    {!isDup && !isOrphan && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
                <td className="py-2.5 text-xs font-mono text-slate-400">
                  {tx.duplicate_group_id
                    ? `${tx.duplicate_group_id.slice(0, 8)}… (×${tx.duplicate_group_size})`
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-3">
        {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} shown.
        {transactions.some((t) => t.is_exact_duplicate) && (
          <span className="ml-2 text-orange-600 font-medium">
            ⚠ Duplicate rows highlighted in orange — intentional anomaly-detection cases.
          </span>
        )}
        {transactions.some((t) => t.expenditure_without_matching_work) && (
          <span className="ml-2 text-yellow-600 font-medium">⚠ Orphan transactions highlighted in yellow.</span>
        )}
      </p>
    </div>
  );
}
