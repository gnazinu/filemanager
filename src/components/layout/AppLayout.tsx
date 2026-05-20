import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  FileText,
  Upload,
  LayoutDashboard,
  Users,
  Receipt,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from 'lucide-react';


interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const clientNavItems: NavItem[] = [
    { label: 'Mis Recibos', href: '/my-receipts', icon: Receipt },
    { label: 'Subir Recibo', href: '/upload', icon: Upload },
  ];

  const adminNavItems: NavItem[] = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Todos los Recibos', href: '/admin/receipts', icon: Receipt },
    { label: 'Gestión de Clientes', href: '/admin/clients', icon: Users },
  ];

  const navItems = isAdmin ? adminNavItems : clientNavItems;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden border-r bg-card transition-all duration-300 lg:flex lg:flex-col',
          isSidebarOpen ? 'lg:w-64' : 'lg:w-16'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {isSidebarOpen && (
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Receipt className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">GestorDoc</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="h-8 w-8"
          >
            <ChevronLeft
              className={cn('h-4 w-4 transition-transform', !isSidebarOpen && 'rotate-180')}
            />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {isSidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t p-4">
          {isSidebarOpen && (
            <div className="mb-3">
              <p className="truncate text-sm font-medium">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? 'Administrador' : 'Cliente'}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size={isSidebarOpen ? 'default' : 'icon'}
            onClick={handleLogout}
            className={cn('w-full justify-start', !isSidebarOpen && 'justify-center')}
          >
            <LogOut className="h-4 w-4" />
            {isSidebarOpen && <span className="ml-2">Cerrar sesión</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Receipt className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">GestorDoc</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="absolute inset-x-0 top-16 z-50 border-b bg-card p-4 lg:hidden">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 border-t pt-4">
              <div className="mb-3">
                <p className="text-sm font-medium">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? 'Administrador' : 'Cliente'}
                </p>
              </div>
              <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
