import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { FacturamaService } from '../_shared/facturama.service.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Autenticar
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { invoice_id, motivo, folioSustitucion } = await req.json();

    // Validar motivo SAT
    if (!['01', '02', '03', '04'].includes(motivo)) {
      return new Response(
        JSON.stringify({ error: 'Motivo de cancelación inválido. Valores válidos: 01, 02, 03, 04' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // motivo '01' requiere folio de sustitución
    if (motivo === '01' && !folioSustitucion) {
      return new Response(
        JSON.stringify({ error: 'El motivo 01 requiere el UUID del CFDI de sustitución (folioSustitucion)' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cargar la factura (verificar que pertenece al usuario o el usuario es admin)
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, user_id, status, folio_fiscal')
      .eq('id', invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Factura no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (invoice.status !== 'STAMPED') {
      return new Response(
        JSON.stringify({ error: 'Solo se pueden cancelar facturas con status STAMPED' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!invoice.folio_fiscal) {
      return new Response(
        JSON.stringify({ error: 'La factura no tiene Folio Fiscal (UUID SAT)' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cargar credenciales Facturama
    const { data: fiscalConfig, error: fcErr } = await supabase
      .from('fiscal_config')
      .select('facturama_username, facturama_password')
      .eq('user_id', invoice.user_id)
      .single();

    if (fcErr || !fiscalConfig) {
      return new Response(
        JSON.stringify({ error: 'Configuración fiscal del emisor no encontrada' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const facturmaEnv = (Deno.env.get('FACTURAMA_ENV') ?? 'sandbox') as 'production' | 'sandbox';
    const pac = new FacturamaService(
      fiscalConfig.facturama_username,
      fiscalConfig.facturama_password,
      facturmaEnv
    );

    // Solicitar cancelación al PAC/SAT
    await pac.cancelInvoice(invoice.folio_fiscal, motivo, folioSustitucion);

    // Actualizar estado en base de datos
    await supabase.from('invoices').update({
      status:           'CANCELLED',
      cancel_motivo_sat: motivo,
      cancel_reason:    folioSustitucion ? `Folio sustitución: ${folioSustitucion}` : null,
    }).eq('id', invoice_id);

    console.log(`cancel-invoice: factura ${invoice_id} cancelada con motivo ${motivo}`);
    return new Response(
      JSON.stringify({ cancelled: true, invoice_id, motivo }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('cancel-invoice error:', message);
    return new Response(
      JSON.stringify({ error: 'Error al cancelar la factura', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
