import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, isLoading, isAdmin, isApproved, isPending, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    // Not logged in
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Account inactive
    if (profile?.account_status === 'inactive') {
      navigate('/account-inactive', { replace: true });
      return;
    }

    // Pending approval
    if (isPending && !isAdmin) {
      navigate('/pending-approval', { replace: true });
      return;
    }

    // Admin goes to dashboard
    if (isAdmin) {
      navigate('/admin', { replace: true });
      return;
    }

    // Approved client goes to receipts
    if (isApproved) {
      navigate('/my-receipts', { replace: true });
      return;
    }
  }, [user, isLoading, isAdmin, isApproved, isPending, profile, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
};

export default Index;
