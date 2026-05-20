import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { FilePlus, Download, FileText, Ban, Loader2, Receipt } from 'lucide-react';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { useInvoices } from '../hooks/useInvoices';
import { useCancelInvoice } from '../hooks/useCancelInvoice';
import { downloadXml, downloadPdf } from '../services/invoice-storage.service';
import { MOTIVO_CANCELACION } from '../lib/cfdi-catalogs';
import type { Invoice, InvoiceStatus, MotivoSAT } from '../types/invoice.types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Skeleton ────────────────────────────────────────────────────────────────
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
function SummaryCards({ invoices }: { invoices: Invoice[] }) {
  const total     = invoices.length;
  const stamped   = invoices.filter((i) => i.status === 'STAMPED').length;
  const pending   = invoices.filter((i) => i.status === 'PENDING').length;
  const failed    = invoices.filter((i) => i.status === 'FAILED').length;

  const cards = [
    { label: 'Total',      value: total,   color: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: 'Timbradas',  value: stamped, color: 'bg-green-50 text-green-700 border-green-100' },
    { label: 'Pendientes', value: pending, color: 'bg-amber-50 text-amber-700 border-amber-100' },
    { label: 'Fallidas',   value: failed,  color: 'bg-red-50 text-red-700 border-red-100' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border p-3 text-center ${c.color}`}>
          <p className="text-2xl font-bold">{c.value}</p>
          <p className="text-xs font-medium">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function InvoiceList() {
  const { data: invoices = [], isLoading } = useInvoices();
  const cancelInvoice = useCancelInvoice();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [cancelTarget, setCancelTarget]   = useState<Invoice | null>(null);
  const [cancelMotivo, setCancelMotivo]   = useState<MotivoSAT>('02');

  const filtered = statusFilter === 'ALL'
    ? invoices
    : invoices.filter((inv) => inv.status === statusFilter);

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

  const handleConfirmCancel = () => {
    if (!cancelTarget) return;
    cancelInvoice.mutate(
      { invoice_id: cancelTarget.id, motivo: cancelMotivo },
      {
        onSuccess: () => {
          toast({ title: 'Factura cancelada correctamente' });
          setCancelTarget(null);
        },
        onError: (err) => {
          toast({ variant: 'destructive', title: 'Error al cancelar', description: err.message });
        },
      }
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mis Facturas</h1>
            <p className="text-muted-foreground">Historial de CFDI 4.0 generados</p>
          </div>
          <Button asChild>
            <Link to="/invoices/new">
              <FilePlus className="mr-2 h-4 w-4" />
              Nueva Factura
            </Link>
          </Button>
        </div>

        {/* Summary — solo si hay facturas */}
        {invoices.length > 0 && <SummaryCards invoices={invoices} />}

        {/* Filtro */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} factura{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          </p>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus | 'ALL')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              <SelectItem value="PENDING">Procesando</SelectItem>
              <SelectItem value="STAMPED">Timbradas</SelectItem>
              <SelectItem value="FAILED">Fallidas</SelectItem>
              <SelectItem value="CANCELLED">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((inv) => {
              const cfdi     = inv.cfdi_data as Record<string, unknown>;
              const receptor = cfdi?.receptor as Record<string, string> | undefined;
              const folio    = inv.folio_fiscal ?? null;

              return (
                <Card key={inv.id} className="overflow-hidden transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      {/* Izquierda: ícono + datos */}
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {receptor?.nombre ?? 'Sin receptor'}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            RFC: <span className="font-medium">{receptor?.rfc ?? '—'}</span>
                          </p>
                          {folio && (
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              UUID: {folio}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(inv.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                          </p>
                          {inv.status === 'FAILED' && inv.error_message && (
                            <div className="mt-2 rounded-md bg-red-50 px-2 py-1.5">
                              <p className="text-xs text-red-700 truncate">
                                <span className="font-medium">Error:</span> {inv.error_message}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Derecha: badge + acciones */}
                      <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                        <InvoiceStatusBadge status={inv.status} />
                        {inv.status === 'STAMPED' && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Descargar XML"
                              onClick={() => handleDownloadXml(inv)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Descargar PDF"
                              onClick={() => handleDownloadPdf(inv)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Cancelar factura"
                              onClick={() => setCancelTarget(inv)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Receipt className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="mb-1 text-lg font-medium">
              {statusFilter === 'ALL' ? 'Aún no tienes facturas' : 'Sin facturas en esta categoría'}
            </h3>
            <p className="mb-6 max-w-xs text-sm text-muted-foreground">
              {statusFilter === 'ALL'
                ? 'Genera tu primera factura electrónica CFDI 4.0.'
                : 'Prueba cambiando el filtro o genera una nueva factura.'}
            </p>
            <Button asChild>
              <Link to="/invoices/new">
                <FilePlus className="mr-2 h-4 w-4" />
                Nueva Factura
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Diálogo de cancelación */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción solicitará la cancelación ante el SAT a través del PAC. Es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm font-medium">Motivo de cancelación (catálogo SAT)</p>
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
              onClick={handleConfirmCancel}
              disabled={cancelInvoice.isPending}
            >
              {cancelInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
