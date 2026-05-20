import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/features/receipts/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Trash2,
  Upload,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Receipt, ReceiptStatus } from '@/types/database';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────
interface SummaryProps {
  receipts: Receipt[];
}

function SummaryCards({ receipts }: SummaryProps) {
  const total = receipts.length;
  const pending = receipts.filter((r) => r.status === 'new' || r.status === 'reviewed').length;
  const invoiced = receipts.filter((r) => r.status === 'invoiced').length;

  const cards = [
    { label: 'Total subidos', value: total, color: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: 'En proceso', value: pending, color: 'bg-amber-50 text-amber-700 border-amber-100' },
    { label: 'Facturados', value: invoiced, color: 'bg-green-50 text-green-700 border-green-100' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border p-3 text-center ${c.color}`}>
          <p className="text-2xl font-bold">{c.value}</p>
          <p className="text-xs font-medium">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MyReceipts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | 'all'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Receipt | null>(null);

  const { data: receipts, isLoading } = useQuery({
    queryKey: ['my-receipts', user?.id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Receipt[];
    },
    enabled: !!user,
  });

  // All receipts (unfiltered) for summary cards
  const { data: allReceipts } = useQuery({
    queryKey: ['my-receipts-all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user?.id);
      if (error) throw error;
      return data as Receipt[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (receipt: Receipt) => {
      // Delete from DB first
      const { error: dbError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receipt.id);
      if (dbError) throw dbError;

      // Then remove from storage
      await supabase.storage.from('receipts').remove([receipt.storage_path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['my-receipts-all'] });
      setDeleteTarget(null);
      toast({ title: 'Recibo eliminado', description: 'El recibo fue eliminado correctamente.' });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el recibo. Intenta de nuevo.',
      });
    },
  });

  const handleDownload = async (receipt: Receipt) => {
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .download(receipt.storage_path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = receipt.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo descargar el archivo.' });
    }
  };

  const handleView = async (receipt: Receipt) => {
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(receipt.storage_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo abrir el archivo.' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mis Recibos</h1>
            <p className="text-muted-foreground">Gestiona tus recibos y documentos</p>
          </div>
          <Button asChild>
            <Link to="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Subir recibo
            </Link>
          </Button>
        </div>

        {/* Summary Cards - only when data is loaded */}
        {allReceipts && allReceipts.length > 0 && (
          <SummaryCards receipts={allReceipts} />
        )}

        {/* Filter */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {receipts?.length ?? 0} recibo{(receipts?.length ?? 0) !== 1 ? 's' : ''} encontrado{(receipts?.length ?? 0) !== 1 ? 's' : ''}
          </p>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as ReceiptStatus | 'all')}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="new">Pendiente</SelectItem>
              <SelectItem value="reviewed">Revisado</SelectItem>
              <SelectItem value="invoiced">Facturado</SelectItem>
              <SelectItem value="archived">Archivado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          // Skeleton loaders
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : receipts && receipts.length > 0 ? (
          // Receipt cards
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <Card key={receipt.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: icon + info */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{receipt.original_filename}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Gasto:{' '}
                          <span className="font-medium">
                            {format(new Date(receipt.expense_date), "dd 'de' MMMM yyyy", { locale: es })}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Subido el {format(new Date(receipt.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                        {/* Admin notes visible to client */}
                        {receipt.admin_notes && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-blue-50 px-2 py-1.5">
                            <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                            <p className="text-xs text-blue-700">
                              <span className="font-medium">Nota del administrador:</span>{' '}
                              {receipt.admin_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: status + actions */}
                    <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                      <StatusBadge status={receipt.status} showDescription />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(receipt)}
                          title="Ver PDF"
                          className="h-8 w-8"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(receipt)}
                          title="Descargar"
                          className="h-8 w-8"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {/* Only allow delete if receipt is still pending (new) */}
                        {receipt.status === 'new' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(receipt)}
                            title="Eliminar"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Empty state
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="mb-1 text-lg font-medium">
              {statusFilter === 'all' ? 'Aún no tienes recibos' : 'Sin recibos en esta categoría'}
            </h3>
            <p className="mb-6 max-w-xs text-sm text-muted-foreground">
              {statusFilter === 'all'
                ? 'Comienza subiendo tu primer recibo. Es muy fácil.'
                : 'Prueba cambiando el filtro o sube un nuevo recibo.'}
            </p>
            <Button asChild>
              <Link to="/upload">
                <Upload className="mr-2 h-4 w-4" />
                Subir mi primer recibo
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este recibo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El recibo{' '}
              <strong>{deleteTarget?.original_filename}</strong> será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
