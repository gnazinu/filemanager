import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload as UploadIcon, FileText, X, Loader2, CheckCircle, PartyPopper } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export default function UploadReceipt() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [expenseDate, setExpenseDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Solo se permiten archivos PDF';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'El archivo no debe superar los 20MB';
    }
    return null;
  };

  const handleFileSelect = (selectedFile: File) => {
    const error = validateFile(selectedFile);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Archivo inválido',
        description: error,
      });
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileSelect(selectedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !expenseDate || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor completa todos los campos',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const secureFilename = `${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${user.id}/${secureFilename}`;

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: false });

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      setUploadProgress(95);

      const { error: insertError } = await supabase.from('receipts').insert({
        user_id: user.id,
        original_filename: file.name,
        storage_path: storagePath,
        expense_date: expenseDate,
        status: 'new',
      });

      if (insertError) {
        await supabase.storage.from('receipts').remove([storagePath]);
        throw insertError;
      }

      setUploadProgress(100);
      setUploadSuccess(true);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Error al subir',
        description: 'No se pudo subir el recibo. Intenta nuevamente.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Success Screen ───────────────────────────────────────────────
  if (uploadSuccess) {
    return (
      <AppLayout>
        <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
            <PartyPopper className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">¡Recibo enviado!</h1>
          <p className="mb-2 text-muted-foreground">
            Tu recibo fue subido exitosamente y está pendiente de revisión.
          </p>
          <p className="mb-8 text-sm text-muted-foreground">
            Pronto un administrador lo revisará y actualizará su estado.
          </p>
          <div className="flex w-full flex-col gap-3">
            <Button onClick={() => navigate('/my-receipts')} className="w-full">
              Ver mis recibos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setUploadSuccess(false);
                setFile(null);
                setExpenseDate('');
                setUploadProgress(0);
              }}
              className="w-full"
            >
              Subir otro recibo
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── Upload Form ──────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subir Recibo</h1>
          <p className="text-muted-foreground">
            Sube un nuevo recibo en formato PDF
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo recibo</CardTitle>
            <CardDescription>
              Selecciona un archivo PDF y la fecha del gasto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File Upload Area */}
              <div className="space-y-2">
                <Label>Archivo PDF</Label>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                    isDragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50',
                    file && 'border-green-500 bg-green-50'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleInputChange}
                    className="hidden"
                    disabled={isUploading}
                  />

                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle className="h-10 w-10 text-green-500" />
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile();
                          }}
                          disabled={isUploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <UploadIcon className="h-10 w-10 text-muted-foreground" />
                      <p className="font-medium">
                        Arrastra un archivo o haz clic para seleccionar
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Solo archivos PDF, máximo 20MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Expense Date */}
              <div className="space-y-2">
                <Label htmlFor="expenseDate">Fecha del gasto</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  required
                  disabled={isUploading}
                />
                <p className="text-sm text-muted-foreground">
                  Fecha en que se realizó el gasto
                </p>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Subiendo... {uploadProgress}%
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/my-receipts')}
                  disabled={isUploading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={!file || !expenseDate || isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="mr-2 h-4 w-4" />
                      Subir recibo
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
