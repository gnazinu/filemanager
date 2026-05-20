import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Autenticar al usuario mediante el JWT del header
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { receipt_id, receptor, conceptos, metodoPago, formaPago } = body;

    // Validación básica
    if (!receptor || !conceptos || !metodoPago || !formaPago) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos obligatorios: receptor, conceptos, metodoPago, formaPago' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cargar configuración fiscal del usuario (emisor)
    const { data: fiscalConfig, error: fcErr } = await supabase
      .from('fiscal_config')
      .select('rfc_emisor, razon_social_emisor, regimen_fiscal, cp_emisor')
      .eq('user_id', user.id)
      .single();

    if (fcErr || !fiscalConfig) {
      return new Response(
        JSON.stringify({ error: 'No se encontró la configuración fiscal del emisor. Configure sus datos fiscales primero.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir el payload CFDI que se almacenará como JSONB
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const conceptosMapped = conceptos.map((c: Record<string, unknown>) => {
      const qty  = c.cantidad as number;
      const uv   = c.valorUnitario as number;
      const iva  = c.iva;
      const imp  = round2(qty * uv);
      return { ...c, importe: imp, iva };
    });

    const subTotal = round2(conceptosMapped.reduce((a: number, c: Record<string, unknown>) => a + (c.importe as number), 0));
    const totalIva = round2(conceptosMapped.reduce((a: number, c: Record<string, unknown>) => {
      const iva = c.iva;
      if (iva === 'exempt' || iva === 0) return a;
      return a + round2((c.importe as number) * (iva as number));
    }, 0));

    const now = new Date();
    // Formato requerido por el SAT: "YYYY-MM-DDTHH:mm:ss"
    const fecha = now.toISOString().substring(0, 19);

    const cfdiData = {
      fecha,
      metodoPago,
      formaPago,
      moneda: 'MXN',
      emisor: {
        rfc:            fiscalConfig.rfc_emisor,
        nombre:         fiscalConfig.razon_social_emisor,
        regimenFiscal:  fiscalConfig.regimen_fiscal,
      },
      receptor,
      conceptos: conceptosMapped,
      subTotal,
      total:     round2(subTotal + totalIva),
      impuestos: {
        totalImpuestosTrasladados: totalIva,
        traslados: totalIva > 0
          ? [{ impuesto: '002', tipoFactor: 'Tasa', tasaOCuota: '0.160000', base: subTotal, importe: totalIva }]
          : [],
      },
    };

    // Insertar factura en estado PENDING
    const { data: invoice, error: insErr } = await supabase
      .from('invoices')
      .insert({
        user_id:    user.id,
        receipt_id: receipt_id ?? null,
        cfdi_data:  cfdiData,
        status:     'PENDING',
      })
      .select('id')
      .single();

    if (insErr || !invoice) {
      console.error('Error insertando factura:', insErr);
      return new Response(
        JSON.stringify({ error: 'Error al crear la factura en la base de datos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encolar en pgmq para procesamiento asíncrono
    const { error: qErr } = await supabase.rpc('pgmq_send', {
      queue_name: 'invoice_stamp_queue',
      msg:        { invoice_id: invoice.id },
    });

    if (qErr) {
      // La factura ya está en DB con PENDING; el worker la procesará si la cola falla,
      // pero registrar el error para diagnóstico
      console.error('Error encolando factura:', qErr);
    }

    // HTTP 202 Accepted — el frontend NO espera el timbrado
    return new Response(
      JSON.stringify({ invoice_id: invoice.id, status: 'PENDING' }),
      {
        status:  202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('create-invoice error:', message);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
