// Tipos de request/response específicos de la API de Facturama v3

export interface FacturamaTax {
  Total:       number;
  Name:        'IVA' | 'ISR' | 'IEPS';
  Base:        number;
  Rate:        number;
  IsRetention: boolean;
}

export interface FacturamaItem {
  ProductCode:  string; // c_ClaveProdServ
  UnitCode:     string; // c_ClaveUnidad
  Unit:         string; // descripción de la unidad
  Description:  string;
  Quantity:     number;
  UnitPrice:    number;
  Subtotal:     number; // Quantity * UnitPrice
  Taxes:        FacturamaTax[];
  Total:        number; // Subtotal + sum(Taxes)
}

export interface FacturamaCfdiRequest {
  Serie?:         string;
  Folio?:         string;
  Date:           string; // "YYYY-MM-DDTHH:mm:ss"
  PaymentForm:    string; // c_FormaPago: '03', '28', etc.
  PaymentMethod:  string; // 'PUE' | 'PPD'
  Currency:       string; // 'MXN'
  Issuer: {
    FiscalRegime: string; // c_RegimenFiscal
    Rfc:          string;
    Name:         string;
  };
  Receiver: {
    Rfc:          string;
    Name:         string;
    FiscalRegime: string;
    TaxZipCode:   string;
    CfdiUse:      string; // c_UsoCFDI
  };
  Items: FacturamaItem[];
}

export interface FacturamaCfdiData {
  Folio:      string;
  Uuid:       string; // Folio Fiscal (UUID)
  XmlContent: string; // Base64 encoded XML timbrado
}

export interface FacturamaCfdiResponse {
  Id:       string; // ID interno de Facturama
  CfdiData: FacturamaCfdiData;
}

export interface FacturamaError {
  Message:     string;
  Details?:    string;
  ModelState?: Record<string, string[]>;
}

export interface FacturamaStatusResponse {
  Status: string; // "active" | "cancelled"
}
