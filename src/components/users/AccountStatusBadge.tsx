import { AccountStatus } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AccountStatusBadgeProps {
  status: AccountStatus;
  className?: string;
}

const statusConfig: Record<AccountStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pendiente',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200',
  },
  approved: {
    label: 'Aprobado',
    className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
  },
  inactive: {
    label: 'Inactivo',
    className: 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200',
  },
};

export function AccountStatusBadge({ status, className }: AccountStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
