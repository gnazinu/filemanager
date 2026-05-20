import { supabase } from '@/integrations/supabase/client';

export async function getXmlSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('invoices-xml')
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function getPdfSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('invoices-pdf')
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadXml(storagePath: string, filename: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from('invoices-xml')
    .download(storagePath);
  if (error) throw error;
  triggerDownload(data, filename);
}

export async function downloadPdf(storagePath: string, filename: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from('invoices-pdf')
    .download(storagePath);
  if (error) throw error;
  triggerDownload(data, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
