// Tipos del estándar CFDI 4.0 (SAT México)

export type IvaRate = 0.16 | 0 | 'exempt';

export type RegimenFiscal =
  | '601' | '603' | '605' | '606' | '607' | '608' | '610'
  | '611' | '612' | '614' | '615' | '616' | '620' | '621'
  | '622' | '623' | '624' | '625' | '626';

export type UsoCFDI =
  | 'G01' | 'G02' | 'G03' | 'I01' | 'I02' | 'I03' | 'I04'
  | 'I05' | 'I06' | 'I07' | 'I08' | 'D01' | 'D02' | 'D03'
  | 'D04' | 'D05' | 'D06' | 'D07' | 'D08' | 'D09' | 'D10'
  | 'S01' | 'CP01' | 'CN01';

export type MotivoSAT = '01' | '02' | '03' | '04';

export type MetodoPago = 'PUE' | 'PPD';

export interface CfdiEmisor {
  rfc: string;
  nombre: string;
  regimenFiscal: RegimenFiscal;
}

export interface CfdiReceptor {
  rfc: string;
  nombre: string;
  domicilioFiscalReceptor: string; // CP 5 dígitos
  regimenFiscalReceptor: RegimenFiscal;
  usoCFDI: UsoCFDI;
  email: string;
}

export interface CfdiTraslado {
  impuesto: '002'; // IVA
  tipoFactor: 'Tasa' | 'Exento';
  tasaOCuota: string; // '0.160000' | '0.000000'
  base: number;
  importe: number;
}

export interface CfdiConcepto {
  claveProdServ: string; // Catálogo SAT c_ClaveProdServ
  claveUnidad: string;   // Catálogo SAT c_ClaveUnidad
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;       // cantidad * valorUnitario, redondeado a 2 decimales
  iva: IvaRate;
}

export interface CfdiImpuestos {
  totalImpuestosTrasladados: number;
  traslados: CfdiTraslado[];
}

export interface CfdiRequest {
  serie?: string;
  folio?: string;
  fecha: string;           // ISO 8601: "2024-01-15T12:00:00"
  metodoPago: MetodoPago;
  formaPago: string;       // '01' efectivo, '03' transferencia, etc.
  moneda: 'MXN';
  emisor: CfdiEmisor;
  receptor: CfdiReceptor;
  conceptos: CfdiConcepto[];
  subTotal: number;
  total: number;
  impuestos: CfdiImpuestos;
}
