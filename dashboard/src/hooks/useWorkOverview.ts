import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { WorkRiskOverview, WorkExplorerFilters, PaginatedResult } from '../lib/types';

export function useWorkOverview(filters: WorkExplorerFilters) {
  const { state, riskLevel, search, sortBy, sortAsc, page, pageSize } = filters;

  return useQuery<PaginatedResult<WorkRiskOverview>>({
    queryKey: ['work_risk_overview', filters],
    queryFn: async () => {
      let query = supabase
        .from('work_risk_overview')
        .select('*', { count: 'exact' });

      if (state) {
        query = query.eq('state', state);
      }
      if (riskLevel) {
        query = query.eq('risk_level', riskLevel);
      }
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        query = query.or(
          `work_id.ilike.${s},mp_name.ilike.${s},constituency.ilike.${s},work_category.ilike.${s},work.ilike.${s}`
        );
      }

      query = query.order(sortBy as string, { ascending: sortAsc, nullsFirst: false });

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return { data: (data ?? []) as WorkRiskOverview[], count: count ?? 0 };
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useTopRiskWorks(limit = 10, state?: string | null) {
  return useQuery<WorkRiskOverview[]>({
    queryKey: ['top_risk_works', limit, state],
    queryFn: async () => {
      let query = supabase
        .from('work_risk_overview')
        .select('*')
        .order('risk_score', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (state) {
        query = query.eq('state', state);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as WorkRiskOverview[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
