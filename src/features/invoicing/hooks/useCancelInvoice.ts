import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { CancelInvoiceInput } from '../types/invoice.types';

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (input: CancelInvoiceInput) => {
      const { data, error } = await supabase.functions.invoke('cancel-invoice', {
        body:    input,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw new Error(error.message);
      return data as { cancelled: boolean; invoice_id: string; motivo: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
