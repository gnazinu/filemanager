import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Ban, Loader2 } from 'lucide-react';
import type { InvoiceStatus } from '../types/invoice.types';

interface Props {
  status: InvoiceStatus;
}

const config: Record<InvoiceStatus, {
  label:   string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon:    React.ElementType;
  spin?:   boolean;
}> = {
  PENDING:   { label: 'Procesando',  variant: 'secondary',    icon: Loader2,      spin: true },
  STAMPED:   { label: 'Timbrada',    variant: 'default',      icon: CheckCircle2 },
  FAILED:    { label: 'Fallida',     variant: 'destructive',  icon: XCircle },
  CANCELLED: { label: 'Cancelada',   variant: 'outline',      icon: Ban },
};

export function InvoiceStatusBadge({ status }: Props) {
  const { label, variant, icon: Icon, spin } = config[status] ?? config.PENDING;

  return (
    <Badge variant={variant} className="flex w-fit items-center gap-1">
      <Icon className={`h-3 w-3 ${spin ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  );
}
