-- =============================================================================
-- MÓDULO DE FACTURACIÓN ELECTRÓNICA CFDI 4.0
-- PAC: Facturama | Cola: pgmq | Storage: Supabase Storage
-- =============================================================================

-- 1. ENUM
-- =============================================================================

CREATE TYPE public.invoice_status AS ENUM ('PENDING', 'STAMPED', 'FAILED', 'CANCELLED');

-- 2. TABLAS
-- =============================================================================

-- Configuración fiscal por usuario (datos del emisor + credenciales PAC)
CREATE TABLE public.fiscal_config (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    rfc_emisor            TEXT NOT NULL,
    razon_social_emisor   TEXT NOT NULL,
    regimen_fiscal        TEXT NOT NULL,
    cp_emisor             TEXT NOT NULL CHECK (cp_emisor ~ '^\d{5}$'),
    facturama_username    TEXT NOT NULL,
    facturama_password    TEXT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Facturas electrónicas
CREATE TABLE public.invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receipt_id        UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
    folio_fiscal      UUID,
    pac_invoice_id    TEXT,
    xml_storage_path  TEXT,
    pdf_storage_path  TEXT,
    status            public.invoice_status NOT NULL DEFAULT 'PENDING',
    cancel_reason     TEXT,
    cancel_motivo_sat TEXT CHECK (cancel_motivo_sat IN ('01','02','03','04')),
    cfdi_data         JSONB NOT NULL,
    error_message     TEXT,
    attempt_count     SMALLINT NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_folio_fiscal UNIQUE (folio_fiscal)
);

-- Conceptos (líneas) de cada factura
CREATE TABLE public.invoice_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id   UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description  TEXT NOT NULL,
    quantity     NUMERIC(10,4) NOT NULL,
    unit_value   NUMERIC(14,6) NOT NULL,
    amount       NUMERIC(14,2) NOT NULL,
    iva_rate     NUMERIC(5,4) NOT NULL,
    iva_amount   NUMERIC(14,2) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ÍNDICES
-- =============================================================================

CREATE INDEX idx_invoices_user_id     ON public.invoices(user_id);
CREATE INDEX idx_invoices_status      ON public.invoices(status);
CREATE INDEX idx_invoices_receipt_id  ON public.invoices(receipt_id);
CREATE INDEX idx_invoice_items_inv_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_fiscal_config_user   ON public.fiscal_config(user_id);

-- 4. TRIGGERS updated_at (reutiliza función existente)
-- =============================================================================

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fiscal_config_updated_at
    BEFORE UPDATE ON public.fiscal_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_config ENABLE ROW LEVEL SECURITY;

-- invoices: el usuario lee/inserta las suyas; admin lee todas
-- Los Edge Functions usan service_role (bypassea RLS) para INSERT/UPDATE
CREATE POLICY "invoices_select_own"
    ON public.invoices FOR SELECT TO authenticated
    USING (auth.uid() = user_id AND public.is_approved(auth.uid()));

CREATE POLICY "invoices_select_admin"
    ON public.invoices FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

-- invoice_items: acceso mediante la factura propietaria
CREATE POLICY "invoice_items_select_own"
    ON public.invoice_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices i
            WHERE i.id = invoice_items.invoice_id
              AND i.user_id = auth.uid()
        )
    );

CREATE POLICY "invoice_items_select_admin"
    ON public.invoice_items FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

-- fiscal_config: el usuario gestiona la suya
CREATE POLICY "fiscal_config_select_own"
    ON public.fiscal_config FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "fiscal_config_insert_own"
    ON public.fiscal_config FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));

CREATE POLICY "fiscal_config_update_own"
    ON public.fiscal_config FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. SUPABASE REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;

-- 7. STORAGE BUCKETS (privados)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('invoices-xml', 'invoices-xml', false, 5242880,  ARRAY['application/xml','text/xml']),
    ('invoices-pdf', 'invoices-pdf', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- RLS storage invoices-xml
CREATE POLICY "xml_select_own"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'invoices-xml'
        AND public.is_approved(auth.uid())
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "xml_select_admin"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'invoices-xml' AND public.is_admin(auth.uid()));

-- RLS storage invoices-pdf
CREATE POLICY "pdf_select_own"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'invoices-pdf'
        AND public.is_approved(auth.uid())
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "pdf_select_admin"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'invoices-pdf' AND public.is_admin(auth.uid()));

-- 8. COLA pgmq
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgmq;
SELECT pgmq.create('invoice_stamp_queue');

-- 9. CRON WORKER (pg_cron dispara stamp-invoice cada minuto)
-- Descomentar y ajustar la URL del proyecto antes de desplegar en producción:
-- SELECT cron.schedule(
--     'stamp-invoice-worker',
--     '* * * * *',
--     $$SELECT net.http_post(
--         url        := 'https://<PROJECT_REF>.supabase.co/functions/v1/stamp-invoice',
--         headers    := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
--         body       := '{}'::jsonb
--     )$$
-- );
