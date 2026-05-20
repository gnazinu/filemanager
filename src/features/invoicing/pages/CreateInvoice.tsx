import { AppLayout } from '@/components/layout/AppLayout';
import { InvoiceForm } from '../components/InvoiceForm';

export default function CreateInvoice() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nueva Factura Electrónica</h1>
          <p className="text-muted-foreground">
            Completa los datos para generar un CFDI 4.0 timbrado ante el SAT
          </p>
        </div>
        <InvoiceForm />
      </div>
    </AppLayout>
  );
}
