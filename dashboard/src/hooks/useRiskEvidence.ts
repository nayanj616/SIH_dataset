import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { RiskEvidence } from '../lib/types';

export function useRiskEvidence(workId: string | undefined) {
  return useQuery<RiskEvidence | null>({
    queryKey: ['risk_evidence', workId],
    queryFn: async () => {
      if (!workId) return null;
      const { data, error } = await supabase
        .from('risk_evidence')
        .select('*')
        .eq('work_id', workId)
        .single();
      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return (data as RiskEvidence) ?? null;
    },
    enabled: !!workId,
    staleTime: 5 * 60 * 1000,
  });
}
