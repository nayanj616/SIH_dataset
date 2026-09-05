import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { StateSummary } from '../lib/types';

export function useStateSummary() {
  return useQuery<StateSummary[]>({
    queryKey: ['state_risk_summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('state_risk_summary')
        .select('*');
      if (error) throw new Error(error.message);
      return (data ?? []) as StateSummary[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
