import type { PacService, StampResult, CancelResult, InvoiceStatusResult } from '../pac.interface';
import type { CfdiRequest, IvaRate } from '../../../types/cfdi.types';
import type {
  FacturamaCfdiRequest,
  FacturamaCfdiResponse,
  FacturamaStatusResponse,
  FacturamaError,
} from './facturama.types';
import { round2 } from '../../../lib/tax-calculator';

const FACTURAMA_PRODUCTION = 'https://api.facturama.mx';
const FACTURAMA_SANDBOX    = 'https://apisandbox.facturama.mx';

export class FacturamaService implements PacService {
  private readonly baseUrl:    string;
  private readonly authHeader: string;

  constructor(
    username: string,
    password: string,
    env: 'production' | 'sandbox' = 'sandbox'
  ) {
    this.baseUrl    = env === 'production' ? FACTURAMA_PRODUCTION : FACTURAMA_SANDBOX;
    this.authHeader = `Basic ${btoa(`${username}:${password}`)}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization:  this.authHeader,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // 204 No Content (cancelación exitosa)
    if (res.status === 204) return undefined as T;

    if (!res.ok) {
      let errorMsg = `Facturama ${method} ${path} → HTTP ${res.status}`;
      try {
        const err = (await res.json()) as FacturamaError;
        errorMsg += `: ${err.Message ?? JSON.stringify(err)}`;
        if (err.Details) errorMsg += ` — ${err.Details}`;
      } catch {
        errorMsg += `: ${res.statusText}`;
      }
      throw new Error(errorMsg);
    }

    return res.json() as Promise<T>;
  }

  async createInvoice(cfdi: CfdiRequest): Promise<StampResult> {
    const payload = this.mapToFacturama(cfdi);

    // Paso 1: Timbrar CFDI
    const response = await this.request<FacturamaCfdiResponse>('POST', '/3/cfdis', payload);

    // Paso 2: Descargar PDF generado por Facturama (petición separada obligatoria)
    const pdfRes = await fetch(`${this.baseUrl}/3/cfdis/${response.Id}/pdf`, {
      headers: { Authorization: this.authHeader },
    });
    if (!pdfRes.ok) {
      throw new Error(
        `FacturamaService: falló la descarga del PDF (HTTP ${pdfRes.status}) para ID ${response.Id}`
      );
    }
    const pdfBytes = await pdfRes.arrayBuffer();

    // El XML viene en Base64; decodificar a string
    const xmlContent = atob(response.CfdiData.XmlContent);

    return {
      pacInvoiceId: response.Id,
      folioFiscal:  response.CfdiData.Uuid,
      xmlContent,
      pdfBytes,
    };
  }

  async cancelInvoice(
    folioFiscal: string,
    motivo: string,
    folioSustitucion?: string
  ): Promise<CancelResult> {
    const qs = folioSustitucion ? `?folioSustitucion=${encodeURIComponent(folioSustitucion)}` : '';
    const path = `/3/cfdis/${encodeURIComponent(folioFiscal)}/cancellation/${motivo}${qs}`;
    await this.request<void>('DELETE', path);
    return { success: true };
  }

  async getInvoiceStatus(folioFiscal: string): Promise<InvoiceStatusResult> {
    const data = await this.request<FacturamaStatusResponse>(
      'GET',
      `/3/cfdis/${encodeURIComponent(folioFiscal)}/status`
    );
    const statusMap: Record<string, InvoiceStatusResult['status']> = {
      active:    'active',
      cancelled: 'cancelled',
    };
    return {
      folioFiscal,
      status: statusMap[data.Status?.toLowerCase()] ?? 'not_found',
    };
  }

  // Convierte nuestro CfdiRequest al formato específico de Facturama
  private mapToFacturama(cfdi: CfdiRequest): FacturamaCfdiRequest {
    return {
      Date:          cfdi.fecha,
      PaymentForm:   cfdi.formaPago,
      PaymentMethod: cfdi.metodoPago,
      Currency:      'MXN',
      Issuer: {
        FiscalRegime: cfdi.emisor.regimenFiscal,
        Rfc:          cfdi.emisor.rfc,
        Name:         cfdi.emisor.nombre,
      },
      Receiver: {
        Rfc:          cfdi.receptor.rfc,
        Name:         cfdi.receptor.nombre,
        FiscalRegime: cfdi.receptor.regimenFiscalReceptor,
        TaxZipCode:   cfdi.receptor.domicilioFiscalReceptor,
        CfdiUse:      cfdi.receptor.usoCFDI,
      },
      Items: cfdi.conceptos.map((c) => {
        const ivaRate   = c.iva === 'exempt' ? 0 : (c.iva as number);
        const ivaAmount = c.iva === 'exempt' ? 0 : round2(c.importe * ivaRate);
        return {
          ProductCode: c.claveProdServ,
          UnitCode:    c.claveUnidad,
          Unit:        'Unidad',
          Description: c.descripcion,
          Quantity:    c.cantidad,
          UnitPrice:   c.valorUnitario,
          Subtotal:    c.importe,
          Taxes:
            c.iva === 'exempt'
              ? []
              : [
                  {
                    Total:       ivaAmount,
                    Name:        'IVA' as const,
                    Base:        c.importe,
                    Rate:        ivaRate,
                    IsRetention: false,
                  },
                ],
          Total: round2(c.importe + ivaAmount),
        };
      }),
    };
  }
}
