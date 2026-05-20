import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { CreateInvoiceInput, CreateInvoiceResponse } from '../types/invoice.types';

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateInvoiceInput): Promise<CreateInvoiceResponse> => {
      const { data, error } = await supabase.functions.invoke('create-invoice', {
        body:    input,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw new Error(error.message);
      return data as CreateInvoiceResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
