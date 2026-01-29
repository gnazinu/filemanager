import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { AccountStatusBadge } from '@/components/users/AccountStatusBadge';
import { Button } from '@/components/ui/button';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Profile, AccountStatus } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export default function AdminClients() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const initialStatus = searchParams.get('status') as AccountStatus | 'all' | null;
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>(initialStatus || 'all');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'approve' | 'deactivate';
    profile: Profile | null;
  }>({ open: false, type: 'approve', profile: null });

  // Fetch clients
  const { data: clients, isLoading } = useQuery({
    queryKey: ['admin-clients', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('account_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Profile[];
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: AccountStatus }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: status })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setConfirmDialog({ open: false, type: 'approve', profile: null });
      
      toast({
        title: variables.status === 'approved' ? 'Usuario aprobado' : 'Usuario desactivado',
        description: 'El estado del usuario ha sido actualizado',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado del usuario',
      });
    },
  });

  const handleApprove = (profile: Profile) => {
    setConfirmDialog({ open: true, type: 'approve', profile });
  };

  const handleDeactivate = (profile: Profile) => {
    setConfirmDialog({ open: true, type: 'deactivate', profile });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.profile) return;

    const newStatus = confirmDialog.type === 'approve' ? 'approved' : 'inactive';
    updateStatusMutation.mutate({
      userId: confirmDialog.profile.user_id,
      status: newStatus,
    });
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

  const pendingCount = clients?.filter((c) => c.account_status === 'pending').length ?? 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Clientes</h1>
          <p className="text-muted-foreground">
            Administra las cuentas de los clientes
          </p>
        </div>

        {pendingCount > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-800">
                  {pendingCount} {pendingCount === 1 ? 'cuenta pendiente' : 'cuentas pendientes'} de aprobación
                </p>
                <p className="text-sm text-amber-700">
                  Revisa y aprueba las nuevas solicitudes de registro
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Lista de clientes</CardTitle>
                <CardDescription>
                  {clients?.length ?? 0} clientes registrados
                </CardDescription>
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as AccountStatus | 'all')}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : clients && clients.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha de registro</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          {client.full_name}
                        </TableCell>
                        <TableCell>
                          <AccountStatusBadge status={client.account_status} />
                        </TableCell>
                        <TableCell>
                          {format(new Date(client.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {client.account_status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => handleApprove(client)}
                                disabled={updateStatusMutation.isPending}
                              >
                                <CheckCircle className="mr-1 h-4 w-4" />
                                Aprobar
                              </Button>
                            )}
                            {client.account_status === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeactivate(client)}
                                disabled={updateStatusMutation.isPending}
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                Desactivar
                              </Button>
                            )}
                            {client.account_status === 'inactive' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(client)}
                                disabled={updateStatusMutation.isPending}
                              >
                                <CheckCircle className="mr-1 h-4 w-4" />
                                Reactivar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-medium">No hay clientes</h3>
                <p className="text-sm text-muted-foreground">
                  No se encontraron clientes con los filtros seleccionados
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'approve' ? 'Aprobar usuario' : 'Desactivar usuario'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'approve' ? (
                <>
                  ¿Estás seguro de aprobar la cuenta de{' '}
                  <strong>{confirmDialog.profile?.full_name}</strong>? 
                  El usuario podrá acceder al sistema y subir recibos.
                </>
              ) : (
                <>
                  ¿Estás seguro de desactivar la cuenta de{' '}
                  <strong>{confirmDialog.profile?.full_name}</strong>? 
                  El usuario no podrá acceder al sistema.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={confirmDialog.type === 'deactivate' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {updateStatusMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {confirmDialog.type === 'approve' ? 'Aprobar' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
