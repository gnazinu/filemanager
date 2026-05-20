import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { FacturamaService } from '../_shared/facturama.service.ts';

const MAX_ATTEMPTS = 3;
// Visibility timeout en segundos: el mensaje se vuelve visible de nuevo si no se elimina
const VT_SECONDS = 120;

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Leer un mensaje de la cola (visibility timeout = 120s)
    const { data: msgs, error: readErr } = await supabase.rpc('pgmq_read', {
      queue_name: 'invoice_stamp_queue',
      vt:         VT_SECONDS,
      qty:        1,
    });

    if (readErr) {
      console.error('pgmq_read error:', readErr.message);
      return new Response('Queue read error', { status: 500 });
    }

    if (!msgs || msgs.length === 0) {
      return new Response('No messages in queue', { status: 200 });
    }

    const { msg_id, message } = msgs[0];
    const invoiceId: string = message.invoice_id;

    // Cargar la factura junto con la fiscal_config del usuario (JOIN mediante user_id)
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invErr || !invoice) {
      console.error(`stamp-invoice: factura ${invoiceId} no encontrada`);
      await supabase.rpc('pgmq_delete', { queue_name: 'invoice_stamp_queue', msg_id });
      return new Response('Invoice not found', { status: 200 });
    }

    // IDEMPOTENCIA: si ya fue timbrada, eliminar de la cola y salir
    if (invoice.status === 'STAMPED' && invoice.folio_fiscal) {
      await supabase.rpc('pgmq_delete', { queue_name: 'invoice_stamp_queue', msg_id });
      return new Response('Already stamped', { status: 200 });
    }

    // Verificar límite de reintentos
    const newAttemptCount = (invoice.attempt_count ?? 0) + 1;

    if (newAttemptCount > MAX_ATTEMPTS) {
      await supabase.from('invoices').update({
        status:        'FAILED',
        error_message: `Superado el límite de ${MAX_ATTEMPTS} intentos de timbrado`,
        attempt_count: newAttemptCount,
      }).eq('id', invoiceId);
      await supabase.rpc('pgmq_delete', { queue_name: 'invoice_stamp_queue', msg_id });
      console.error(`stamp-invoice: factura ${invoiceId} marcada como FAILED tras ${MAX_ATTEMPTS} intentos`);
      return new Response('Max retries exceeded', { status: 200 });
    }

    // Incrementar contador de intentos
    await supabase.from('invoices')
      .update({ attempt_count: newAttemptCount })
      .eq('id', invoiceId);

    // Cargar credenciales Facturama desde fiscal_config (service_role bypasea RLS)
    const { data: fiscalConfig, error: fcErr } = await supabase
      .from('fiscal_config')
      .select('facturama_username, facturama_password')
      .eq('user_id', invoice.user_id)
      .single();

    if (fcErr || !fiscalConfig) {
      await supabase.from('invoices')
        .update({ error_message: 'Configuración fiscal no encontrada' })
        .eq('id', invoiceId);
      // No eliminar de la cola → reintento automático tras vt
      return new Response('Fiscal config not found', { status: 500 });
    }

    const facturmaEnv = (Deno.env.get('FACTURAMA_ENV') ?? 'sandbox') as 'production' | 'sandbox';
    const pac = new FacturamaService(
      fiscalConfig.facturama_username,
      fiscalConfig.facturama_password,
      facturmaEnv
    );

    // Timbrar + descargar PDF
    const result = await pac.createInvoice(invoice.cfdi_data as Record<string, unknown>);

    // Subir XML a Supabase Storage
    const xmlPath = `${invoice.user_id}/${invoiceId}.xml`;
    const { error: xmlErr } = await supabase.storage
      .from('invoices-xml')
      .upload(xmlPath, new TextEncoder().encode(result.xmlContent), {
        contentType: 'application/xml',
        upsert:      true,
      });
    if (xmlErr) throw new Error(`Storage XML upload: ${xmlErr.message}`);

    // Subir PDF a Supabase Storage
    const pdfPath = `${invoice.user_id}/${invoiceId}.pdf`;
    const { error: pdfErr } = await supabase.storage
      .from('invoices-pdf')
      .upload(pdfPath, result.pdfBytes, {
        contentType: 'application/pdf',
        upsert:      true,
      });
    if (pdfErr) throw new Error(`Storage PDF upload: ${pdfErr.message}`);

    // Actualizar factura a STAMPED
    await supabase.from('invoices').update({
      status:           'STAMPED',
      folio_fiscal:     result.folioFiscal,
      pac_invoice_id:   result.pacInvoiceId,
      xml_storage_path: xmlPath,
      pdf_storage_path: pdfPath,
      error_message:    null,
    }).eq('id', invoiceId);

    // Si la factura tiene un recibo vinculado, marcarlo como invoiced
    if (invoice.receipt_id) {
      await supabase.from('receipts')
        .update({ status: 'invoiced' })
        .eq('id', invoice.receipt_id);
    }

    // Eliminar de la cola (timbrado exitoso)
    await supabase.rpc('pgmq_delete', { queue_name: 'invoice_stamp_queue', msg_id });

    // Disparar envío de correo (fire-and-forget, no bloquea)
    supabase.functions.invoke('send-invoice-email', {
      body: { invoice_id: invoiceId },
    }).catch((e: Error) => console.error('send-invoice-email invoke error:', e.message));

    console.log(`stamp-invoice: factura ${invoiceId} timbrada con UUID ${result.folioFiscal}`);
    return new Response('OK', { status: 200 });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('stamp-invoice error:', message);
    // Actualizar error_message pero NO eliminar de cola → reintento automático
    try {
      const { data: msgs } = await supabase.rpc('pgmq_read', {
        queue_name: 'invoice_stamp_queue', vt: 0, qty: 1,
      });
      if (msgs?.[0]?.message?.invoice_id) {
        await supabase.from('invoices')
          .update({ error_message: message })
          .eq('id', msgs[0].message.invoice_id);
      }
    } catch { /* ignore secondary error */ }
    return new Response(`Stamp failed: ${message}`, { status: 500 });
  }
});
