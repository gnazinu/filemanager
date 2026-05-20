import { z } from 'zod';
import { REGIMEN_FISCAL, USO_CFDI, FORMA_PAGO } from './cfdi-catalogs';

// RFC patterns per SAT specification
// Persona Moral: 3 letras (nombre) + 6 dígitos (fecha) + 3 homoclave
// Persona Física: 4 letras (nombre) + 6 dígitos (fecha) + 3 homoclave
const RFC_MORAL_RE  = /^[A-ZÑ&]{3}[0-9]{6}[A-Z0-9]{3}$/;
const RFC_FISICA_RE = /^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$/;
const RFC_GENERICO   = 'XAXX010101000'; // Público en general
const RFC_EXTRANJERO = 'XEXX010101000'; // Extranjero

export function isValidRfc(rfc: string): boolean {
  const upper = rfc.toUpperCase().trim();
  return (
    RFC_MORAL_RE.test(upper) ||
    RFC_FISICA_RE.test(upper) ||
    upper === RFC_GENERICO ||
    upper === RFC_EXTRANJERO
  );
}

export function normalizeRfc(rfc: string): string {
  return rfc.toUpperCase().trim();
}

/**
 * Normaliza Razón Social: MAYÚSCULAS + trim.
 *
 * IMPORTANTE: NO se eliminan sufijos societarios (S.A. de C.V., S. de R.L., A.C., etc.)
 * porque el SAT exige coincidencia exacta con la Constancia de Situación Fiscal.
 * El usuario debe ingresar el nombre TAL CUAL aparece en su Constancia.
 */
export function normalizeRazonSocial(name: string): string {
  return name.toUpperCase().trim();
}

export const RAZON_SOCIAL_WARNING =
  'Verifica que la Razón Social coincida exactamente con tu Constancia de Situación Fiscal ' +
  'del SAT, incluyendo sufijos como S.A. de C.V., S. de R.L. de C.V., A.C., etc. ' +
  'Un error tipográfico causará el rechazo del CFDI por el PAC.';

// Schema Zod para datos del receptor (frontend)
export const receptorSchema = z.object({
  rfc: z
    .string()
    .min(12, 'El RFC debe tener al menos 12 caracteres')
    .max(13, 'El RFC no puede exceder 13 caracteres')
    .transform(normalizeRfc)
    .refine(isValidRfc, 'RFC inválido. Verifica el formato según el SAT.'),

  nombre: z
    .string()
    .min(1, 'La Razón Social es obligatoria')
    .max(300, 'La Razón Social no puede exceder 300 caracteres')
    .transform(normalizeRazonSocial),

  domicilioFiscalReceptor: z
    .string()
    .regex(/^\d{5}$/, 'El Código Postal debe ser exactamente 5 dígitos numéricos'),

  regimenFiscalReceptor: z
    .string()
    .refine((v) => v in REGIMEN_FISCAL, 'Régimen fiscal no válido según catálogo SAT'),

  usoCFDI: z
    .string()
    .refine((v) => v in USO_CFDI, 'Uso de CFDI no válido según catálogo SAT'),

  email: z
    .string()
    .email('Correo electrónico inválido')
    .max(200),
});

// Schema para un concepto de factura
export const conceptoSchema = z.object({
  claveProdServ: z
    .string()
    .min(1, 'La clave de producto/servicio es obligatoria')
    .max(10),

  claveUnidad: z
    .string()
    .min(1, 'La clave de unidad es obligatoria')
    .max(10),

  descripcion: z
    .string()
    .min(1, 'La descripción es obligatoria')
    .max(1000),

  cantidad: z
    .number({ invalid_type_error: 'La cantidad debe ser un número' })
    .positive('La cantidad debe ser mayor a 0')
    .max(999999.9999),

  valorUnitario: z
    .number({ invalid_type_error: 'El valor unitario debe ser un número' })
    .positive('El valor unitario debe ser mayor a 0')
    .max(9999999999.999999),

  iva: z
    .union([z.literal(0.16), z.literal(0), z.literal('exempt')]),
});

// Schema emisor (desde fiscal_config)
export const emisorSchema = z.object({
  rfc_emisor: z
    .string()
    .transform(normalizeRfc)
    .refine(isValidRfc, 'RFC del emisor inválido'),

  razon_social_emisor: z
    .string()
    .min(1, 'La Razón Social del emisor es obligatoria')
    .transform(normalizeRazonSocial),

  regimen_fiscal: z
    .string()
    .refine((v) => v in REGIMEN_FISCAL, 'Régimen fiscal del emisor inválido'),

  cp_emisor: z
    .string()
    .regex(/^\d{5}$/, 'El Código Postal del emisor debe ser exactamente 5 dígitos'),

  facturama_username: z.string().min(1),
  facturama_password: z.string().min(1),
});

// Schema completo del formulario de factura
export const invoiceFormSchema = z.object({
  receptor: receptorSchema,
  conceptos: z.array(conceptoSchema).min(1, 'Debe agregar al menos un concepto'),
  metodoPago: z.enum(['PUE', 'PPD']),
  formaPago: z
    .string()
    .refine((v) => v in FORMA_PAGO, 'Forma de pago no válida según catálogo SAT'),
  receipt_id: z.string().uuid().optional(),
});

export type ReceptorFormValues  = z.infer<typeof receptorSchema>;
export type ConceptoFormValues  = z.infer<typeof conceptoSchema>;
export type EmisorFormValues    = z.infer<typeof emisorSchema>;
export type InvoiceFormValues   = z.infer<typeof invoiceFormSchema>;
