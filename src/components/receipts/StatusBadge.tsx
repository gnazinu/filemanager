import { ReceiptStatus } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ReceiptStatus;
  className?: string;
}

const statusConfig: Record<ReceiptStatus, { label: string; className: string }> = {
  new: {
    label: 'Nuevo',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200',
  },
  reviewed: {
    label: 'Revisado',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200',
  },
  invoiced: {
    label: 'Facturado',
    className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
  },
  archived: {
    label: 'Archivado',
    className: 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
