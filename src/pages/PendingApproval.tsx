import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle, LogOut, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

const steps = [
  { label: 'Registraste tu cuenta', done: true },
  { label: 'Un administrador revisa tu solicitud', done: false, current: true },
  { label: 'Recibirás acceso completo', done: false },
];

export default function PendingApproval() {
  const { signOut, isApproved, isAdmin, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isApproved || isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isApproved, isAdmin, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setIsRefreshing(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Solicitud en revisión</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu cuenta ha sido creada exitosamente. Solo falta que un administrador la apruebe.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress steps */}
          <div className="flex flex-col gap-3 text-left">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    step.done
                      ? 'bg-green-100 text-green-700'
                      : step.current
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step.done ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`text-sm ${
                    step.done
                      ? 'font-medium text-green-700'
                      : step.current
                      ? 'font-medium text-amber-700'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {user && (
            <p className="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
              Cuenta registrada con:{' '}
              <span className="font-medium text-foreground">{user.email}</span>
            </p>
          )}

          <p className="text-sm text-muted-foreground">
            Este proceso normalmente toma poco tiempo. Si tu cuenta ya fue aprobada, haz clic en &quot;Verificar estado&quot;.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Button className="w-full" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Verificar estado
          </Button>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
