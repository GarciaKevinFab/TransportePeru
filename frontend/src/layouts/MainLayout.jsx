import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Truck,
  FileText,
  Route,
  Fuel,
  CircleDot,
  Wrench,
  Package,
  AlertTriangle,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  Receipt,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';

const menuItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['owner', 'admin', 'operaciones', 'flota', 'mantenimiento', 'almacen', 'contabilidad'] },
  { path: '/vehicles', icon: Truck, label: 'Vehículos', roles: ['owner', 'admin', 'operaciones', 'flota', 'mantenimiento'] },
  { path: '/documents', icon: FileText, label: 'Documentos', roles: ['owner', 'admin', 'flota'] },
  { path: '/trips', icon: Route, label: 'Viajes', roles: ['owner', 'admin', 'operaciones', 'contabilidad', 'chofer'] },
  { path: '/settlements', icon: Receipt, label: 'Viáticos', roles: ['owner', 'admin', 'contabilidad', 'operaciones'] },
  { path: '/fuel', icon: Fuel, label: 'Combustible', roles: ['owner', 'admin', 'operaciones', 'chofer'] },
  { path: '/tires', icon: CircleDot, label: 'Llantas', roles: ['owner', 'admin', 'flota', 'mantenimiento'] },
  { path: '/maintenance', icon: Wrench, label: 'Mantenimiento', roles: ['owner', 'admin', 'mantenimiento'] },
  { path: '/inventory', icon: Package, label: 'Inventario', roles: ['owner', 'admin', 'almacen'] },
  { path: '/issues', icon: AlertTriangle, label: 'Incidentes', roles: ['owner', 'admin', 'operaciones', 'chofer'] },
  { path: '/reports', icon: BarChart3, label: 'Reportes', roles: ['owner', 'admin', 'contabilidad'] },
  { path: '/users', icon: Users, label: 'Usuarios', roles: ['owner', 'admin'] },
  { path: '/settings', icon: Settings, label: 'Configuración', roles: ['owner', 'admin'] },
];

// Driver-specific menu items
const driverMenuItems = [
  { path: '/driver/trips', icon: Route, label: 'Mis Viajes', roles: ['chofer'] },
  { path: '/driver/checklist', icon: FileText, label: 'Checklist', roles: ['chofer'] },
  { path: '/driver/fuel', icon: Fuel, label: 'Combustible', roles: ['chofer'] },
  { path: '/driver/expenses', icon: Package, label: 'Gastos', roles: ['chofer'] },
  { path: '/driver/issues', icon: AlertTriangle, label: 'Reportar Incidente', roles: ['chofer'] },
];

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isDriver = user?.role === 'chofer';
  const currentMenuItems = isDriver ? driverMenuItems : menuItems;
  const filteredMenuItems = currentMenuItems.filter(
    (item) => item.roles.includes(user?.role)
  );

  const NavItem = ({ item, onClick }) => (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={({ isActive }) =>
        `sidebar-item ${isActive ? 'active' : ''}`
      }
      data-testid={`nav-${item.path.replace('/', '')}`}
    >
      <item.icon className="w-5 h-5" />
      {(sidebarOpen || mobileSidebarOpen) && (
        <span className="font-medium">{item.label}</span>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-slate-900 text-white sidebar-transition ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-sm flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <span className="font-heading font-bold text-lg tracking-tight uppercase">
                TransPeru
              </span>
            </div>
          ) : (
            <div className="w-10 h-10 bg-orange-500 rounded-sm flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6 text-white" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="toggle-sidebar-btn"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1">
            {filteredMenuItems.map((item) => (
              <NavItem key={item.path} item={item} />
            ))}
          </nav>
        </ScrollArea>

        {/* User Section */}
        <div className="p-4 border-t border-slate-800">
          <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-orange-500 font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 uppercase">{user?.role}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <div
        className={`md:hidden fixed inset-0 z-50 ${
          mobileSidebarOpen ? 'visible' : 'invisible'
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity ${
            mobileSidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileSidebarOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-64 bg-slate-900 text-white transform transition-transform ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-sm flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <span className="font-heading font-bold text-lg tracking-tight uppercase">
                TransPeru
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1">
              {filteredMenuItems.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  onClick={() => setMobileSidebarOpen(false)}
                />
              ))}
            </nav>
          </ScrollArea>
        </aside>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              data-testid="notifications-btn"
            >
              <Bell className="w-5 h-5" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                3
              </Badge>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2" data-testid="user-menu-btn">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline font-medium">{user?.name}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.email || user?.dni}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Configuración
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600" data-testid="logout-btn">
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
