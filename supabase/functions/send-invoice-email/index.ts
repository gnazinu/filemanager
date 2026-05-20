import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id requerido' }), { status: 422 });
    }

    // Cargar factura
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Factura no encontrada' }), { status: 404 });
    }

    if (invoice.status !== 'STAMPED') {
      return new Response(
        JSON.stringify({ error: 'Solo se pueden enviar facturas con status STAMPED' }),
        { status: 422 }
      );
    }

    // Descargar XML y PDF de Supabase Storage
    const [xmlResult, pdfResult] = await Promise.all([
      supabase.storage.from('invoices-xml').download(invoice.xml_storage_path),
      supabase.storage.from('invoices-pdf').download(invoice.pdf_storage_path),
    ]);

    if (xmlResult.error) throw new Error(`Descarga XML: ${xmlResult.error.message}`);
    if (pdfResult.error) throw new Error(`Descarga PDF: ${pdfResult.error.message}`);

    const xmlText   = await xmlResult.data!.text();
    const pdfBuffer = await pdfResult.data!.arrayBuffer();

    // Convertir a Base64 para adjuntos de Resend
    const xmlBase64 = btoa(xmlText);
    // Para PDF binario: convertir ArrayBuffer → Base64
    const pdfUint8  = new Uint8Array(pdfBuffer);
    let pdfBase64   = '';
    const chunkSize = 8192;
    for (let i = 0; i < pdfUint8.length; i += chunkSize) {
      pdfBase64 += String.fromCharCode(...pdfUint8.slice(i, i + chunkSize));
    }
    pdfBase64 = btoa(pdfBase64);

    const folio      = invoice.folio_fiscal ?? invoice.id;
    const cfdiData   = invoice.cfdi_data as Record<string, unknown>;
    const receptor   = cfdiData?.receptor as Record<string, string> | undefined;
    const toEmail    = receptor?.email ?? '';

    if (!toEmail) {
      return new Response(
        JSON.stringify({ error: 'El receptor no tiene correo electrónico en el CFDI' }),
        { status: 422 }
      );
    }

    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'facturacion@filemanager.app';

    const emailPayload = {
      from:    fromEmail,
      to:      [toEmail],
      subject: `Factura Electrónica CFDI — UUID ${folio}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a1a1a">Tu factura electrónica está lista</h2>
          <p>Hola, adjunto encontrarás tu Comprobante Fiscal Digital por Internet (CFDI 4.0).</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr>
              <td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">UUID (Folio Fiscal)</td>
              <td style="padding:8px;border:1px solid #e2e8f0;font-family:monospace">${folio}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Receptor</td>
              <td style="padding:8px;border:1px solid #e2e8f0">${receptor?.nombre ?? ''}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">RFC Receptor</td>
              <td style="padding:8px;border:1px solid #e2e8f0">${receptor?.rfc ?? ''}</td>
            </tr>
          </table>
          <p style="color:#6b7280;font-size:14px">
            Este CFDI fue timbrado ante el SAT a través de un PAC autorizado.
            Conserva este comprobante para efectos fiscales.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `factura-${folio}.xml`,
          content:  xmlBase64,
        },
        {
          filename: `factura-${folio}.pdf`,
          content:  pdfBase64,
        },
      ],
    };

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY no configurada');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500 });
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      throw new Error(`Resend API error ${resendRes.status}: ${errText}`);
    }

    console.log(`send-invoice-email: correo enviado a ${toEmail} para factura ${invoice_id}`);
    return new Response(JSON.stringify({ sent: true, to: toEmail }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-invoice-email error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
