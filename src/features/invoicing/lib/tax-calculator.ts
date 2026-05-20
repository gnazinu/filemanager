import type { IvaRate, CfdiConcepto, CfdiImpuestos } from '../types/cfdi.types';

// Redondeo seguro a 2 decimales — nunca usar .toFixed() para cálculos financieros
// porque introduce drift de punto flotante que el PAC rechazaría.
export const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface ConceptoCalc {
  importe:    number; // baseGravable = cantidad * valorUnitario
  ivaAmount:  number; // 0 si exento
  total:      number; // importe + ivaAmount
}

/**
 * Calcula impuestos para un concepto individual.
 * @param cantidad      - número de unidades
 * @param valorUnitario - precio antes de impuestos
 * @param iva           - 0.16 | 0 | 'exempt'
 */
export function calcConceptoTax(
  cantidad: number,
  valorUnitario: number,
  iva: IvaRate
): ConceptoCalc {
  const importe   = round2(cantidad * valorUnitario);
  const ivaAmount = iva === 'exempt' ? 0 : round2(importe * (iva as number));
  return { importe, ivaAmount, total: round2(importe + ivaAmount) };
}

export interface InvoiceTotals {
  subTotal:  number;
  totalIva:  number;
  total:     number;
  impuestos: CfdiImpuestos;
}

/**
 * Agrega totales para todos los conceptos y construye el nodo impuestos CFDI.
 */
export function calcInvoiceTotals(
  items: Array<{ importe: number; iva: IvaRate; ivaAmount: number }>
): InvoiceTotals {
  const subTotal = round2(items.reduce((acc, i) => acc + i.importe, 0));
  const totalIva = round2(items.reduce((acc, i) => acc + i.ivaAmount, 0));
  const total    = round2(subTotal + totalIva);

  // Agrupar traslados por tasa (puede haber conceptos al 16% y al 0% en la misma factura)
  const byRate = new Map<number, { base: number; importe: number }>();
  for (const item of items) {
    if (item.iva === 'exempt') continue;
    const rate = item.iva as number;
    const prev = byRate.get(rate) ?? { base: 0, importe: 0 };
    byRate.set(rate, {
      base:    round2(prev.base + item.importe),
      importe: round2(prev.importe + item.ivaAmount),
    });
  }

  const traslados = Array.from(byRate.entries()).map(([rate, { base, importe }]) => ({
    impuesto:    '002' as const,
    tipoFactor:  (rate === 0 ? 'Tasa' : 'Tasa') as 'Tasa',
    tasaOCuota:  rate.toFixed(6),  // '0.160000' | '0.000000'
    base,
    importe,
  }));

  return {
    subTotal,
    totalIva,
    total,
    impuestos: {
      totalImpuestosTrasladados: totalIva,
      traslados,
    },
  };
}

/**
 * Construye los conceptos CFDI completos desde los datos del formulario.
 */
export function buildCfdiConceptos(
  items: Array<{
    claveProdServ: string;
    claveUnidad: string;
    descripcion: string;
    cantidad: number;
    valorUnitario: number;
    iva: IvaRate;
  }>
): CfdiConcepto[] {
  return items.map((item) => {
    const { importe } = calcConceptoTax(item.cantidad, item.valorUnitario, item.iva);
    return {
      claveProdServ: item.claveProdServ,
      claveUnidad:   item.claveUnidad,
      descripcion:   item.descripcion,
      cantidad:      item.cantidad,
      valorUnitario: item.valorUnitario,
      importe,
      iva:           item.iva,
    };
  });
}
