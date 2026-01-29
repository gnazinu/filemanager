import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function PendingApproval() {
  const { signOut, isApproved, isAdmin, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is approved or admin, redirect to home
    if (isApproved || isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isApproved, isAdmin, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Cuenta pendiente de aprobación</CardTitle>
          <CardDescription className="text-base">
            Tu cuenta ha sido creada exitosamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Un administrador revisará tu solicitud y aprobará tu cuenta pronto. 
            Recibirás acceso completo una vez que tu cuenta sea aprobada.
          </p>
          {user && (
            <p className="text-sm text-muted-foreground">
              Registrado como: <span className="font-medium">{user.email}</span>
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
