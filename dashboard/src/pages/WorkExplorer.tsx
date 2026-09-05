import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkOverview } from '../hooks/useWorkOverview';
import { RiskBadge } from '../components/risk/RiskBadge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { STATES } from '../lib/constants';
import type { WorkExplorerFilters, RiskLevel, WorkRiskOverview } from '../lib/types';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Table2 } from 'lucide-react';

const RISK_LEVELS: RiskLevel[] = ['High Risk', 'Elevated Risk', 'Moderate', 'Low / Normal'];
const PAGE_SIZE = 25;

function SortIcon({ col, filters }: { col: string; filters: WorkExplorerFilters }) {
  if (filters.sortBy !== col) return <ChevronsUpDown className="w-3 h-3 text-slate-400 inline ml-1" />;
  return filters.sortAsc
    ? <ChevronUp className="w-3 h-3 text-indigo-600 inline ml-1" />
    : <ChevronDown className="w-3 h-3 text-indigo-600 inline ml-1" />;
}

export function WorkExplorer() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<WorkExplorerFilters>({
    state: null,
    riskLevel: null,
    search: '',
    sortBy: 'risk_score',
    sortAsc: false,
    page: 0,
    pageSize: PAGE_SIZE,
  });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading, error, isFetching } = useWorkOverview(filters);
  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0;

  const handleSort = (col: keyof WorkRiskOverview) => {
    setFilters((f) => ({
      ...f,
      sortBy: col,
      sortAsc: f.sortBy === col ? !f.sortAsc : false,
      page: 0,
    }));
  };

  const handleSearch = useCallback(() => {
    setFilters((f) => ({ ...f, search: searchInput, page: 0 }));
  }, [searchInput]);

  const clearFilters = () => {
    setSearchInput('');
    setFilters({ state: null, riskLevel: null, search: '', sortBy: 'risk_score', sortAsc: false, page: 0, pageSize: PAGE_SIZE });
  };

  const colHeader = (label: string, col: keyof WorkRiskOverview) => (
    <th
      className="text-left py-3 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap cursor-pointer hover:text-slate-800 select-none"
      onClick={() => handleSort(col)}
    >
      {label}
      <SortIcon col={col as string} filters={filters} />
    </th>
  );

  if (error) return <div className="p-8"><ErrorBanner message={error.message} /></div>;

  return (
    <div className="p-8 space-y-6">
      <div className="border-b border-slate-200 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table2 className="w-5 h-5 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Work Explorer</h1>
        </div>
        <p className="text-sm text-slate-500">
          {data ? <>{data.count.toLocaleString()} works {isFetching && <span className="text-indigo-500">(refreshing…)</span>}</> : '…'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search work ID, MP, constituency…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 w-72"
            />
          </div>
          <button onClick={handleSearch} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
            Search
          </button>
        </div>

        <select
          value={filters.state ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value || null, page: 0 }))}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All States</option>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filters.riskLevel ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, riskLevel: (e.target.value as RiskLevel) || null, page: 0 }))}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All Risk Levels</option>
          {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {(filters.state || filters.riskLevel || filters.search) && (
          <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-slate-700 underline">Clear filters</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {colHeader('Score', 'risk_score')}
                <th className="text-left py-3 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Level</th>
                {colHeader('Work ID', 'work_id')}
                {colHeader('State', 'state')}
                {colHeader('Constituency', 'constituency')}
                {colHeader('MP Name', 'mp_name')}
                {colHeader('Category', 'work_category')}
                {colHeader('Status', 'work_status')}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={8} className="py-16 text-center"><LoadingSpinner message="Loading works…" /></td></tr>
              ) : !data || data.data.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400 text-sm">No works match the current filters.</td></tr>
              ) : (
                data.data.map((w) => (
                  <tr key={w.work_id} className="hover:bg-indigo-50/50 cursor-pointer transition-colors" onClick={() => navigate(`/work/${w.work_id}`)}>
                    <td className="py-3 pr-3 font-bold tabular-nums text-slate-800">{w.risk_score ?? '—'}</td>
                    <td className="py-3 pr-3"><RiskBadge level={w.risk_level} size="sm" /></td>
                    <td className="py-3 pr-3 font-mono text-xs text-indigo-700 font-semibold whitespace-nowrap">{w.work_id}</td>
                    <td className="py-3 pr-3 text-slate-700 whitespace-nowrap">{w.state ?? '—'}</td>
                    <td className="py-3 pr-3 text-slate-600 max-w-[130px] truncate">{w.constituency ?? '—'}</td>
                    <td className="py-3 pr-3 text-slate-600 max-w-[130px] truncate">{w.mp_name ?? '—'}</td>
                    <td className="py-3 pr-3 text-slate-500 max-w-[120px] truncate">{w.work_category ?? '—'}</td>
                    <td className="py-3 pr-3">
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{w.work_status ?? '—'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.count > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500">
              Showing {filters.page * PAGE_SIZE + 1}–{Math.min((filters.page + 1) * PAGE_SIZE, data.count)} of {data.count.toLocaleString()} works
            </p>
            <div className="flex gap-2">
              <button disabled={filters.page === 0} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-xs text-slate-600">Page {filters.page + 1} / {totalPages}</span>
              <button disabled={filters.page >= totalPages - 1} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400">Click any row to open the investigation view. Default sort: highest risk score first.</p>
    </div>
  );
}
