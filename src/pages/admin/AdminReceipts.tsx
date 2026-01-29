import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/receipts/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download, Eye, FileText, Loader2, ArrowUpDown, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ReceiptWithProfile, ReceiptStatus, Profile } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

type SortField = 'expense_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function AdminReceipts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const initialStatus = searchParams.get('status') as ReceiptStatus | 'all' | null;
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | 'all'>(initialStatus || 'all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptWithProfile | null>(null);
  const [editExpenseDate, setEditExpenseDate] = useState('');
  const [editStatus, setEditStatus] = useState<ReceiptStatus>('new');
  const [editNotes, setEditNotes] = useState('');

  // Fetch clients for filter
  const { data: clients } = useQuery({
    queryKey: ['admin-clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');

      if (error) throw error;
      return data as Pick<Profile, 'user_id' | 'full_name'>[];
    },
  });

  // Fetch receipts
  const { data: receipts, isLoading } = useQuery({
    queryKey: ['admin-receipts', statusFilter, clientFilter, sortField, sortDirection],
    queryFn: async () => {
      let query = supabase
        .from('receipts')
        .select('*')
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (clientFilter !== 'all') {
        query = query.eq('user_id', clientFilter);
      }

      const { data: receiptsData, error } = await query;

      if (error) throw error;

      // Fetch profile names for all receipts
      const userIds = [...new Set(receiptsData?.map((r) => r.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const profilesMap = new Map(profilesData?.map((p) => [p.user_id, p.full_name]) || []);

      return receiptsData?.map((receipt) => ({
        ...receipt,
        profiles: { full_name: profilesMap.get(receipt.user_id) || 'Desconocido' },
      })) as ReceiptWithProfile[];
    },
  });

  // Update receipt mutation
  const updateReceiptMutation = useMutation({
    mutationFn: async (data: { id: string; expense_date: string; status: ReceiptStatus; admin_notes: string | null }) => {
      const { error } = await supabase
        .from('receipts')
        .update({
          expense_date: data.expense_date,
          status: data.status,
          admin_notes: data.admin_notes,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setEditDialogOpen(false);
      toast({
        title: 'Recibo actualizado',
        description: 'Los cambios se guardaron correctamente',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el recibo',
      });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleEdit = (receipt: ReceiptWithProfile) => {
    setEditingReceipt(receipt);
    setEditExpenseDate(receipt.expense_date);
    setEditStatus(receipt.status);
    setEditNotes(receipt.admin_notes || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingReceipt) return;

    updateReceiptMutation.mutate({
      id: editingReceipt.id,
      expense_date: editExpenseDate,
      status: editStatus,
      admin_notes: editNotes || null,
    });
  };

  const handleDownload = async (receipt: ReceiptWithProfile) => {
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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo descargar el archivo',
      });
    }
  };

  const handleView = async (receipt: ReceiptWithProfile) => {
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(receipt.storage_path, 3600);

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo abrir el archivo',
      });
    }
  };

  // Update status filter in URL
  useEffect(() => {
    if (statusFilter !== 'all') {
      searchParams.set('status', statusFilter);
    } else {
      searchParams.delete('status');
    }
    setSearchParams(searchParams, { replace: true });
  }, [statusFilter]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Todos los Recibos</h1>
          <p className="text-muted-foreground">
            Gestiona los recibos de todos los clientes
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Lista de recibos</CardTitle>
                <CardDescription>
                  {receipts?.length ?? 0} recibos encontrados
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={clientFilter}
                  onValueChange={setClientFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.user_id} value={client.user_id}>
                        {client.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as ReceiptStatus | 'all')}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="new">Nuevo</SelectItem>
                    <SelectItem value="reviewed">Revisado</SelectItem>
                    <SelectItem value="invoiced">Facturado</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : receipts && receipts.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Archivo</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8"
                          onClick={() => handleSort('expense_date')}
                        >
                          Fecha de gasto
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8"
                          onClick={() => handleSort('created_at')}
                        >
                          Fecha de subida
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-medium">
                          {receipt.profiles?.full_name || 'Desconocido'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="max-w-[150px] truncate">
                              {receipt.original_filename}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(receipt.expense_date), 'dd MMM yyyy', { locale: es })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(receipt.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={receipt.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(receipt)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(receipt)}
                              title="Ver"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(receipt)}
                              title="Descargar"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-medium">No hay recibos</h3>
                <p className="text-sm text-muted-foreground">
                  No se encontraron recibos con los filtros seleccionados
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar recibo</DialogTitle>
            <DialogDescription>
              {editingReceipt?.original_filename}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editStatus">Estado</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ReceiptStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Nuevo</SelectItem>
                  <SelectItem value="reviewed">Revisado</SelectItem>
                  <SelectItem value="invoiced">Facturado</SelectItem>
                  <SelectItem value="archived">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editExpenseDate">Fecha de gasto</Label>
              <Input
                id="editExpenseDate"
                type="date"
                value={editExpenseDate}
                onChange={(e) => setEditExpenseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editNotes">Notas (opcional)</Label>
              <Textarea
                id="editNotes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notas internas sobre este recibo..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateReceiptMutation.isPending}>
              {updateReceiptMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
