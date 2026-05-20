import type { CfdiRequest } from '../../types/cfdi.types';

export interface StampResult {
  pacInvoiceId: string;
  folioFiscal:  string;      // UUID del SAT (Folio Fiscal / UUID del CFDI)
  xmlContent:   string;      // XML timbrado como string
  pdfBytes:     ArrayBuffer; // PDF generado por el PAC
}

export interface CancelResult {
  success:   boolean;
  acuseXml?: string; // Acuse de cancelación (XML opcional según PAC)
}

export interface InvoiceStatusResult {
  folioFiscal: string;
  status:      'active' | 'cancelled' | 'not_found';
}

/**
 * Interfaz de abstracción para cualquier PAC (Proveedor Autorizado de Certificación).
 * Implementar esta interfaz para Facturama, Finkok, SW Sapien, etc.
 * El módulo de facturación nunca depende de un PAC concreto.
 */
export interface PacService {
  /**
   * Genera y timbra un CFDI 4.0.
   * Retorna el XML timbrado y el PDF binario.
   */
  createInvoice(cfdi: CfdiRequest): Promise<StampResult>;

  /**
   * Solicita la cancelación de un CFDI ante el SAT.
   * @param folioFiscal      - UUID del CFDI a cancelar
   * @param motivo           - '01' | '02' | '03' | '04' (catálogo SAT)
   * @param folioSustitucion - UUID del CFDI que sustituye (requerido cuando motivo='01')
   */
  cancelInvoice(
    folioFiscal: string,
    motivo: string,
    folioSustitucion?: string
  ): Promise<CancelResult>;

  /**
   * Consulta el estado vigente de un CFDI en el SAT.
   */
  getInvoiceStatus(folioFiscal: string): Promise<InvoiceStatusResult>;
}
