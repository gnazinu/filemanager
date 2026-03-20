import { ReceiptStatus } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, Search, CheckCircle, Archive } from 'lucide-react';

interface StatusBadgeProps {
  status: ReceiptStatus;
  className?: string;
  showDescription?: boolean;
}

const statusConfig: Record<
  ReceiptStatus,
  { label: string; description: string; className: string; icon: React.ElementType }
> = {
  new: {
    label: 'Pendiente',
    description: 'En espera de revisión',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200',
    icon: Clock,
  },
  reviewed: {
    label: 'Revisado',
    description: 'Tu recibo fue revisado',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200',
    icon: Search,
  },
  invoiced: {
    label: 'Facturado',
    description: '¡Listo! Tu recibo fue procesado',
    className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
    icon: CheckCircle,
  },
  archived: {
    label: 'Archivado',
    description: 'Recibo archivado',
    className: 'bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-200',
    icon: Archive,
  },
};

export function StatusBadge({ status, className, showDescription = false }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  if (showDescription) {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="outline" className={cn(config.className, className)}>
          <Icon className="mr-1 h-3 w-3" />
          {config.label}
        </Badge>
        <span className="text-xs text-muted-foreground">{config.description}</span>
      </div>
    );
  }

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
