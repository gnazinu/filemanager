import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, Users, FileText, Clock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Get total receipts count
      const { count: totalReceipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true });

      if (receiptsError) throw receiptsError;

      // Get new receipts count
      const { count: newReceipts, error: newError } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');

      if (newError) throw newError;

      // Get receipts uploaded today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayReceipts, error: todayError } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      if (todayError) throw todayError;

      // Get pending users count
      const { count: pendingUsers, error: pendingError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('account_status', 'pending');

      if (pendingError) throw pendingError;

      // Get total clients count
      const { count: totalClients, error: clientsError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (clientsError) throw clientsError;

      return {
        totalReceipts: totalReceipts ?? 0,
        newReceipts: newReceipts ?? 0,
        todayReceipts: todayReceipts ?? 0,
        pendingUsers: pendingUsers ?? 0,
        totalClients: totalClients ?? 0,
      };
    },
  });

  const statCards = [
    {
      title: 'Total Recibos',
      value: stats?.totalReceipts ?? 0,
      description: 'Recibos en el sistema',
      icon: Receipt,
      href: '/admin/receipts',
    },
    {
      title: 'Nuevos',
      value: stats?.newReceipts ?? 0,
      description: 'Pendientes de revisar',
      icon: FileText,
      href: '/admin/receipts?status=new',
      highlight: (stats?.newReceipts ?? 0) > 0,
    },
    {
      title: 'Hoy',
      value: stats?.todayReceipts ?? 0,
      description: 'Subidos hoy',
      icon: Clock,
      href: '/admin/receipts',
    },
    {
      title: 'Clientes',
      value: stats?.totalClients ?? 0,
      description: stats?.pendingUsers ? `${stats.pendingUsers} pendientes` : 'Total registrados',
      icon: Users,
      href: '/admin/clients',
      highlight: (stats?.pendingUsers ?? 0) > 0,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen general del sistema de recibos
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Link key={stat.title} to={stat.href}>
                <Card className={`transition-shadow hover:shadow-md ${stat.highlight ? 'border-primary' : ''}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    <stat.icon className={`h-4 w-4 ${stat.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${stat.highlight ? 'text-primary' : ''}`}>
                      {stat.value}
                    </div>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
            <CardDescription>Accesos directos a las funciones principales</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button asChild>
              <Link to="/admin/receipts?status=new">
                <FileText className="mr-2 h-4 w-4" />
                Ver recibos nuevos
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/clients?status=pending">
                <Users className="mr-2 h-4 w-4" />
                Aprobar usuarios
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
