import { InvoiceForm } from '../components/InvoiceForm';

export default function CreateInvoice() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Nueva Factura Electrónica</h1>
        <p className="text-muted-foreground">
          Completa los datos para generar un CFDI 4.0 timbrado ante el SAT
        </p>
      </div>
      <InvoiceForm />
    </div>
  );
}
