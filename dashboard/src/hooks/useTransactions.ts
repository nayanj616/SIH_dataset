import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ExpenditureTransaction } from '../lib/types';

export function useTransactions(workId: string | undefined) {
  return useQuery<ExpenditureTransaction[]>({
    queryKey: ['expenditure_transactions', workId],
    queryFn: async () => {
      if (!workId) return [];
      const { data, error } = await supabase
        .from('expenditure_transactions')
        .select('*')
        .eq('work_id', workId)
        .order('expenditure_date', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ExpenditureTransaction[];
    },
    enabled: !!workId,
    staleTime: 5 * 60 * 1000,
  });
}
