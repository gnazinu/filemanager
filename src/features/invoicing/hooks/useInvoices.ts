import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { Invoice } from '../types/invoice.types';

export function useInvoices() {
  const { user, isAdmin } = useAuth();
  const queryClient       = useQueryClient();

  const query = useQuery({
    queryKey: ['invoices', user?.id],
    queryFn: async (): Promise<Invoice[]> => {
      let q = supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      // Admin ve todas; cliente solo las suyas
      if (!isAdmin) {
        q = q.eq('user_id', user!.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
    enabled: !!user,
    // Polling dinámico: activo solo mientras hay facturas en estado PENDING
    refetchInterval: (query) => {
      const invoices = query.state.data ?? [];
      const hasPending = invoices.some((inv: Invoice) => inv.status === 'PENDING');
      return hasPending ? 5_000 : false;
    },
  });

  // Supabase Realtime: recibe cambios de estado en tiempo real sin polling constante
  useEffect(() => {
    if (!user) return;

    const filter = isAdmin
      ? undefined
      : `user_id=eq.${user.id}`;

    const channel = supabase
      .channel(`invoices-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'invoices',
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          queryClient.setQueryData<Invoice[]>(
            ['invoices', user.id],
            (old) =>
              old?.map((inv) =>
                inv.id === payload.new.id
                  ? { ...inv, ...(payload.new as Invoice) }
                  : inv
              ) ?? []
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, queryClient]);

  return query;
}
