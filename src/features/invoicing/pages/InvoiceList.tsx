import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { FilePlus, Download, FileText, Ban, Loader2 } from 'lucide-react';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { useInvoices } from '../hooks/useInvoices';
import { useCancelInvoice } from '../hooks/useCancelInvoice';
import { downloadXml, downloadPdf } from '../services/invoice-storage.service';
import { MOTIVO_CANCELACION } from '../lib/cfdi-catalogs';
import type { Invoice, MotivoSAT } from '../types/invoice.types';
import type { InvoiceStatus } from '../types/invoice.types';

export default function InvoiceList() {
  const { data: invoices = [], isLoading } = useInvoices();
  const cancelInvoice = useCancelInvoice();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [cancelMotivo, setCancelMotivo] = useState<MotivoSAT>('02');

  const filtered = statusFilter === 'ALL'
    ? invoices
    : invoices.filter((inv) => inv.status === statusFilter);

  const counts = {
    total:     invoices.length,
    stamped:   invoices.filter((i) => i.status === 'STAMPED').length,
    pending:   invoices.filter((i) => i.status === 'PENDING').length,
    failed:    invoices.filter((i) => i.status === 'FAILED').length,
    cancelled: invoices.filter((i) => i.status === 'CANCELLED').length,
  };

  const handleDownloadXml = async (inv: Invoice) => {
    if (!inv.xml_storage_path) return;
    try {
      const folio = inv.folio_fiscal?.slice(0, 8) ?? inv.id.slice(0, 8);
      await downloadXml(inv.xml_storage_path, `factura-${folio}.xml`);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error descargando XML', description: String(err) });
    }
  };

  const handleDownloadPdf = async (inv: Invoice) => {
    if (!inv.pdf_storage_path) return;
    try {
      const folio = inv.folio_fiscal?.slice(0, 8) ?? inv.id.slice(0, 8);
      await downloadPdf(inv.pdf_storage_path, `factura-${folio}.pdf`);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error descargando PDF', description: String(err) });
    }
  };

  const handleCancel = (invoiceId: string) => {
    cancelInvoice.mutate(
      { invoice_id: invoiceId, motivo: cancelMotivo },
      {
        onSuccess: () => {
          toast({ title: 'Factura cancelada correctamente' });
        },
        onError: (err) => {
          toast({ variant: 'destructive', title: 'Error al cancelar', description: err.message });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Facturas</h1>
          <p className="text-muted-foreground">Historial de CFDI 4.0 generados</p>
        </div>
        <Button asChild>
          <Link to="/invoices/new">
            <FilePlus className="mr-2 h-4 w-4" />
            Nueva Factura
          </Link>
        </Button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',      value: counts.total,     color: '' },
          { label: 'Timbradas',  value: counts.stamped,   color: 'text-green-600' },
          { label: 'Pendientes', value: counts.pending,   color: 'text-yellow-600' },
          { label: 'Fallidas',   value: counts.failed,    color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtro de estado */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar por:</span>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus | 'ALL')}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="PENDING">Procesando</SelectItem>
            <SelectItem value="STAMPED">Timbradas</SelectItem>
            <SelectItem value="FAILED">Fallidas</SelectItem>
            <SelectItem value="CANCELLED">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de facturas */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No se encontraron facturas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => {
            const cfdi     = inv.cfdi_data as Record<string, unknown>;
            const receptor = cfdi?.receptor as Record<string, string> | undefined;
            const folio    = inv.folio_fiscal
              ? `${inv.folio_fiscal.slice(0, 18)}…`
              : '—';

            return (
              <Card key={inv.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <InvoiceStatusBadge status={inv.status} />
                        <span className="text-xs text-muted-foreground font-mono truncate">
                          {folio}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {receptor?.nombre ?? 'Sin receptor'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        RFC: {receptor?.rfc ?? '—'} ·{' '}
                        {new Date(inv.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                      {inv.status === 'FAILED' && inv.error_message && (
                        <p className="text-xs text-destructive truncate">
                          Error: {inv.error_message}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {inv.status === 'STAMPED' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadXml(inv)}
                            title="Descargar XML"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="ml-1 hidden sm:inline">XML</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPdf(inv)}
                            title="Descargar PDF"
                          >
                            <Download className="h-4 w-4" />
                            <span className="ml-1 hidden sm:inline">PDF</span>
                          </Button>

                          {/* Cancelar factura */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                                <Ban className="h-4 w-4" />
                                <span className="ml-1 hidden sm:inline">Cancelar</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancelar factura</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción solicitará la cancelación ante el SAT. Es irreversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="py-2 space-y-2">
                                <label className="text-sm font-medium">Motivo de cancelación (SAT)</label>
                                <Select value={cancelMotivo} onValueChange={(v) => setCancelMotivo(v as MotivoSAT)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(MOTIVO_CANCELACION).map(([code, label]) => (
                                      <SelectItem key={code} value={code}>
                                        {code} – {label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Volver</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => handleCancel(inv.id)}
                                  disabled={cancelInvoice.isPending}
                                >
                                  {cancelInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Sí, cancelar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
