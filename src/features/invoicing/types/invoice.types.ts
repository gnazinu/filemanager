import type { CfdiRequest, MotivoSAT } from './cfdi.types';

export type InvoiceStatus = 'PENDING' | 'STAMPED' | 'FAILED' | 'CANCELLED';

export interface Invoice {
  id: string;
  user_id: string;
  receipt_id: string | null;
  folio_fiscal: string | null;
  pac_invoice_id: string | null;
  xml_storage_path: string | null;
  pdf_storage_path: string | null;
  status: InvoiceStatus;
  cancel_reason: string | null;
  cancel_motivo_sat: MotivoSAT | null;
  cfdi_data: CfdiRequest;
  error_message: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_value: number;
  amount: number;
  iva_rate: number;
  iva_amount: number;
  created_at: string;
}

export interface FiscalConfig {
  id: string;
  user_id: string;
  rfc_emisor: string;
  razon_social_emisor: string;
  regimen_fiscal: string;
  cp_emisor: string;
  facturama_username: string;
  facturama_password: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceInput {
  receipt_id?: string;
  receptor: {
    rfc: string;
    nombre: string;
    domicilioFiscalReceptor: string;
    regimenFiscalReceptor: string;
    usoCFDI: string;
    email: string;
  };
  conceptos: Array<{
    claveProdServ: string;
    claveUnidad: string;
    descripcion: string;
    cantidad: number;
    valorUnitario: number;
    iva: 0.16 | 0 | 'exempt';
  }>;
  metodoPago: 'PUE' | 'PPD';
  formaPago: string;
}

export interface CancelInvoiceInput {
  invoice_id: string;
  motivo: MotivoSAT;
  folioSustitucion?: string; // obligatorio cuando motivo = '01'
}

export interface CreateInvoiceResponse {
  invoice_id: string;
  status: 'PENDING';
}
