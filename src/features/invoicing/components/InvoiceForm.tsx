import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Plus, Trash2, Loader2 } from 'lucide-react';
import { invoiceFormSchema, RAZON_SOCIAL_WARNING, type InvoiceFormValues } from '../lib/cfdi-validators';
import { REGIMEN_FISCAL, USO_CFDI, FORMA_PAGO, CLAVE_UNIDAD, CLAVE_PROD_SERV_COMUNES } from '../lib/cfdi-catalogs';
import { calcConceptoTax, calcInvoiceTotals } from '../lib/tax-calculator';
import { useCreateInvoice } from '../hooks/useCreateInvoice';

const IVA_OPTIONS = [
  { value: '0.16', label: 'IVA 16%' },
  { value: '0',    label: 'IVA 0%' },
  { value: 'exempt', label: 'Exento' },
];

export function InvoiceForm() {
  const navigate     = useNavigate();
  const { toast }    = useToast();
  const createInvoice = useCreateInvoice();

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      receptor: {
        rfc:                     '',
        nombre:                  '',
        domicilioFiscalReceptor: '',
        regimenFiscalReceptor:   '',
        usoCFDI:                 '',
        email:                   '',
      },
      conceptos: [
        { claveProdServ: '', claveUnidad: 'E48', descripcion: '', cantidad: 1, valorUnitario: 0, iva: 0.16 },
      ],
      metodoPago: 'PUE',
      formaPago:  '03',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name:    'conceptos',
  });

  const watchConceptos = form.watch('conceptos');

  // Calcular totales en tiempo real
  const conceptosCalc = (watchConceptos ?? []).map((c) =>
    calcConceptoTax(
      Number(c.cantidad) || 0,
      Number(c.valorUnitario) || 0,
      c.iva ?? 0.16
    )
  );
  const totals = calcInvoiceTotals(
    conceptosCalc.map((c, i) => ({
      importe:   c.importe,
      iva:       watchConceptos[i]?.iva ?? 0.16,
      ivaAmount: c.ivaAmount,
    }))
  );

  const onSubmit = (values: InvoiceFormValues) => {
    createInvoice.mutate(
      {
        receptor:   values.receptor,
        conceptos:  values.conceptos.map((c) => ({
          ...c,
          iva: c.iva as 0.16 | 0 | 'exempt',
        })),
        metodoPago: values.metodoPago,
        formaPago:  values.formaPago,
        receipt_id: values.receipt_id,
      },
      {
        onSuccess: ({ invoice_id }) => {
          toast({
            title:       'Factura en proceso',
            description: `Tu factura está siendo timbrada. ID: ${invoice_id.slice(0, 8)}…`,
          });
          navigate('/invoices');
        },
        onError: (err) => {
          toast({
            variant:     'destructive',
            title:       'Error al generar la factura',
            description: err.message,
          });
        },
      }
    );
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Sección 1: Datos del Receptor ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del Receptor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* RFC */}
            <div className="space-y-1">
              <Label htmlFor="rfc">RFC del Receptor *</Label>
              <Input
                id="rfc"
                placeholder="RFC12345678ABC"
                {...form.register('receptor.rfc')}
              />
              {form.formState.errors.receptor?.rfc && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.receptor.rfc.message}
                </p>
              )}
            </div>

            {/* Razón Social */}
            <div className="space-y-1">
              <Label htmlFor="nombre">Razón Social / Nombre *</Label>
              <Input
                id="nombre"
                placeholder="EMPRESA S.A. DE C.V."
                {...form.register('receptor.nombre')}
              />
              {form.formState.errors.receptor?.nombre && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.receptor.nombre.message}
                </p>
              )}
              {/* Advertencia SIEMPRE visible — requerimiento crítico SAT */}
              <Alert className="mt-1 border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-xs leading-snug">
                  {RAZON_SOCIAL_WARNING}
                </AlertDescription>
              </Alert>
            </div>

            {/* Código Postal */}
            <div className="space-y-1">
              <Label htmlFor="cp">Código Postal Fiscal *</Label>
              <Input
                id="cp"
                placeholder="06600"
                maxLength={5}
                {...form.register('receptor.domicilioFiscalReceptor')}
              />
              {form.formState.errors.receptor?.domicilioFiscalReceptor && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.receptor.domicilioFiscalReceptor.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="email">Correo electrónico *</Label>
              <Input
                id="email"
                type="email"
                placeholder="facturacion@empresa.com"
                {...form.register('receptor.email')}
              />
              {form.formState.errors.receptor?.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.receptor.email.message}
                </p>
              )}
            </div>

            {/* Régimen Fiscal */}
            <div className="space-y-1">
              <Label>Régimen Fiscal *</Label>
              <Controller
                name="receptor.regimenFiscalReceptor"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona régimen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REGIMEN_FISCAL).map(([code, label]) => (
                        <SelectItem key={code} value={code}>
                          {code} – {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.receptor?.regimenFiscalReceptor && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.receptor.regimenFiscalReceptor.message}
                </p>
              )}
            </div>

            {/* Uso CFDI */}
            <div className="space-y-1">
              <Label>Uso del CFDI *</Label>
              <Controller
                name="receptor.usoCFDI"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona uso…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(USO_CFDI).map(([code, label]) => (
                        <SelectItem key={code} value={code}>
                          {code} – {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.receptor?.usoCFDI && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.receptor.usoCFDI.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sección 2: Conceptos ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Conceptos</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ claveProdServ: '', claveUnidad: 'E48', descripcion: '', cantidad: 1, valorUnitario: 0, iva: 0.16 })
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Agregar concepto
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => {
            const calc = conceptosCalc[index];
            return (
              <div key={field.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Concepto {index + 1}
                  </span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Descripción */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Descripción *</Label>
                    <Input
                      placeholder="Servicio de consultoría"
                      {...form.register(`conceptos.${index}.descripcion`)}
                    />
                    {form.formState.errors.conceptos?.[index]?.descripcion && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.conceptos[index].descripcion?.message}
                      </p>
                    )}
                  </div>

                  {/* Clave Prod/Serv */}
                  <div className="space-y-1">
                    <Label>Clave Prod/Serv SAT *</Label>
                    <Controller
                      name={`conceptos.${index}.claveProdServ`}
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona clave…" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CLAVE_PROD_SERV_COMUNES).map(([code, label]) => (
                              <SelectItem key={code} value={code}>
                                {code} – {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Clave Unidad */}
                  <div className="space-y-1">
                    <Label>Unidad *</Label>
                    <Controller
                      name={`conceptos.${index}.claveUnidad`}
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Unidad…" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CLAVE_UNIDAD).map(([code, label]) => (
                              <SelectItem key={code} value={code}>
                                {code} – {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Cantidad */}
                  <div className="space-y-1">
                    <Label>Cantidad *</Label>
                    <Input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      {...form.register(`conceptos.${index}.cantidad`, { valueAsNumber: true })}
                    />
                  </div>

                  {/* Valor Unitario */}
                  <div className="space-y-1">
                    <Label>Valor Unitario (sin IVA) *</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      {...form.register(`conceptos.${index}.valorUnitario`, { valueAsNumber: true })}
                    />
                  </div>

                  {/* IVA */}
                  <div className="space-y-1">
                    <Label>Tasa de IVA *</Label>
                    <Controller
                      name={`conceptos.${index}.iva`}
                      control={form.control}
                      render={({ field }) => (
                        <Select
                          onValueChange={(v) => {
                            if (v === 'exempt') field.onChange('exempt');
                            else field.onChange(Number(v));
                          }}
                          value={String(field.value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IVA_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Totales calculados del concepto */}
                  {calc && (
                    <div className="sm:col-span-2 grid grid-cols-3 gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Importe:</span>{' '}
                        <span className="font-medium">${calc.importe.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IVA:</span>{' '}
                        <span className="font-medium">${calc.ivaAmount.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total:</span>{' '}
                        <span className="font-medium">${calc.total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {form.formState.errors.conceptos?.root && (
            <p className="text-sm text-destructive">
              {form.formState.errors.conceptos.root.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Sección 3: Pago y Totales ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Método de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Método de Pago *</Label>
              <Controller
                name="metodoPago"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUE">PUE – Pago en una sola exhibición</SelectItem>
                      <SelectItem value="PPD">PPD – Pago en parcialidades o diferido</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1">
              <Label>Forma de Pago *</Label>
              <Controller
                name="formaPago"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona forma…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FORMA_PAGO).map(([code, label]) => (
                        <SelectItem key={code} value={code}>
                          {code} – {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Resumen de totales */}
          <div className="mt-4 rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${totals.subTotal.toFixed(2)} MXN</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span className="font-medium">${totals.totalIva.toFixed(2)} MXN</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>${totals.total.toFixed(2)} MXN</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/invoices')}
          disabled={createInvoice.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={createInvoice.isPending}>
          {createInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generar Factura
        </Button>
      </div>
    </form>
  );
}
