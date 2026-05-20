// Versión Deno del servicio Facturama para Edge Functions
// (imports con extensión .ts, sin node_modules)

export interface StampResult {
  pacInvoiceId: string;
  folioFiscal:  string;
  xmlContent:   string;
  pdfBytes:     ArrayBuffer;
}

export interface CancelResult {
  success:   boolean;
  acuseXml?: string;
}

interface FacturamaTax {
  Total:       number;
  Name:        string;
  Base:        number;
  Rate:        number;
  IsRetention: boolean;
}

interface FacturamaItem {
  ProductCode: string;
  UnitCode:    string;
  Unit:        string;
  Description: string;
  Quantity:    number;
  UnitPrice:   number;
  Subtotal:    number;
  Taxes:       FacturamaTax[];
  Total:       number;
}

interface FacturamaCfdiRequest {
  Date:          string;
  PaymentForm:   string;
  PaymentMethod: string;
  Currency:      string;
  Issuer:  { FiscalRegime: string; Rfc: string; Name: string };
  Receiver: { Rfc: string; Name: string; FiscalRegime: string; TaxZipCode: string; CfdiUse: string };
  Items:   FacturamaItem[];
}

interface FacturamaCfdiResponse {
  Id:       string;
  CfdiData: { Folio: string; Uuid: string; XmlContent: string };
}

interface FacturamaError {
  Message?:  string;
  Details?:  string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export class FacturamaService {
  private readonly baseUrl:    string;
  private readonly authHeader: string;

  constructor(username: string, password: string, env: 'production' | 'sandbox' = 'sandbox') {
    this.baseUrl    = env === 'production'
      ? 'https://api.facturama.mx'
      : 'https://apisandbox.facturama.mx';
    // Deno tiene btoa nativo
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

    if (res.status === 204) return undefined as T;

    if (!res.ok) {
      let msg = `Facturama ${method} ${path} → HTTP ${res.status}`;
      try {
        const err = await res.json() as FacturamaError;
        msg += `: ${err.Message ?? JSON.stringify(err)}`;
        if (err.Details) msg += ` — ${err.Details}`;
      } catch {
        msg += `: ${res.statusText}`;
      }
      throw new Error(msg);
    }

    return res.json() as Promise<T>;
  }

  async createInvoice(cfdiData: Record<string, unknown>): Promise<StampResult> {
    const payload = this.mapToFacturama(cfdiData);

    const response = await this.request<FacturamaCfdiResponse>('POST', '/3/cfdis', payload);

    // Descarga PDF inmediatamente después de timbrar
    const pdfRes = await fetch(`${this.baseUrl}/3/cfdis/${response.Id}/pdf`, {
      headers: { Authorization: this.authHeader },
    });
    if (!pdfRes.ok) {
      throw new Error(
        `FacturamaService: fallo descarga PDF HTTP ${pdfRes.status} para ID ${response.Id}`
      );
    }
    const pdfBytes = await pdfRes.arrayBuffer();

    // XmlContent viene en Base64
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
    const qs   = folioSustitucion ? `?folioSustitucion=${encodeURIComponent(folioSustitucion)}` : '';
    const path = `/3/cfdis/${encodeURIComponent(folioFiscal)}/cancellation/${motivo}${qs}`;
    await this.request<void>('DELETE', path);
    return { success: true };
  }

  // Mapeo desde nuestro CfdiRequest (JSONB) al formato Facturama
  private mapToFacturama(cfdi: Record<string, unknown>): FacturamaCfdiRequest {
    const emisor   = cfdi.emisor   as Record<string, string>;
    const receptor = cfdi.receptor as Record<string, string>;
    const conceptos = cfdi.conceptos as Array<Record<string, unknown>>;

    return {
      Date:          cfdi.fecha as string,
      PaymentForm:   cfdi.formaPago as string,
      PaymentMethod: cfdi.metodoPago as string,
      Currency:      'MXN',
      Issuer: {
        FiscalRegime: emisor.regimenFiscal,
        Rfc:          emisor.rfc,
        Name:         emisor.nombre,
      },
      Receiver: {
        Rfc:          receptor.rfc,
        Name:         receptor.nombre,
        FiscalRegime: receptor.regimenFiscalReceptor,
        TaxZipCode:   receptor.domicilioFiscalReceptor,
        CfdiUse:      receptor.usoCFDI,
      },
      Items: conceptos.map((c) => {
        const ivaVal    = c.iva === 'exempt' ? 0 : (c.iva as number);
        const importe   = round2((c.cantidad as number) * (c.valorUnitario as number));
        const ivaAmount = c.iva === 'exempt' ? 0 : round2(importe * ivaVal);
        return {
          ProductCode: c.claveProdServ as string,
          UnitCode:    c.claveUnidad as string,
          Unit:        'Unidad',
          Description: c.descripcion as string,
          Quantity:    c.cantidad as number,
          UnitPrice:   c.valorUnitario as number,
          Subtotal:    importe,
          Taxes:       c.iva === 'exempt'
            ? []
            : [{ Total: ivaAmount, Name: 'IVA', Base: importe, Rate: ivaVal, IsRetention: false }],
          Total: round2(importe + ivaAmount),
        };
      }),
    };
  }
}
