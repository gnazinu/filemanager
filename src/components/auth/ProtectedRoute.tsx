import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireApproved?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireApproved = false 
}: ProtectedRouteProps) {
  const { user, isLoading, isAdmin, isApproved, isPending, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is inactive
  if (profile?.account_status === 'inactive') {
    return <Navigate to="/account-inactive" replace />;
  }

  // Requires admin but user is not admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Requires approved status but user is pending (and not admin)
  if (requireApproved && !isApproved && !isAdmin) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}
