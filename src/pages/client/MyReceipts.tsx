import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { Download, Eye, FileText, Loader2, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Receipt, ReceiptStatus } from '@/types/database';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

type SortField = 'expense_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function MyReceipts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { data: receipts, isLoading } = useQuery({
    queryKey: ['my-receipts', user?.id, statusFilter, sortField, sortDirection],
    queryFn: async () => {
      let query = supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user?.id)
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Receipt[];
    },
    enabled: !!user,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo descargar el archivo',
      });
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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo abrir el archivo',
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mis Recibos</h1>
            <p className="text-muted-foreground">
              Gestiona tus recibos y documentos
            </p>
          </div>
          <Button asChild>
            <Link to="/upload">
              <FileText className="mr-2 h-4 w-4" />
              Subir recibo
            </Link>
          </Button>
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
              <div className="flex items-center gap-2">
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
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="max-w-[200px] truncate">
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
                <p className="mb-4 text-sm text-muted-foreground">
                  Comienza subiendo tu primer recibo
                </p>
                <Button asChild>
                  <Link to="/upload">Subir recibo</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
