import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { RiskSignal } from '../lib/types';

export function useRiskSignals(workId: string | undefined) {
  return useQuery<RiskSignal[]>({
    queryKey: ['risk_signals', workId],
    queryFn: async () => {
      if (!workId) return [];
      const { data, error } = await supabase
        .from('risk_signals')
        .select('*')
        .eq('work_id', workId)
        .order('points', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as RiskSignal[];
    },
    enabled: !!workId,
    staleTime: 5 * 60 * 1000,
  });
}
