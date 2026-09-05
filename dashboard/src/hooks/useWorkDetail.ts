import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { WorkRiskOverview } from '../lib/types';

export function useWorkDetail(workId: string | undefined) {
  return useQuery<WorkRiskOverview | null>({
    queryKey: ['work_detail', workId],
    queryFn: async () => {
      if (!workId) return null;
      const { data, error } = await supabase
        .from('work_risk_overview')
        .select('*')
        .eq('work_id', workId)
        .single();
      if (error) throw new Error(error.message);
      return data as WorkRiskOverview;
    },
    enabled: !!workId,
    staleTime: 5 * 60 * 1000,
  });
}
