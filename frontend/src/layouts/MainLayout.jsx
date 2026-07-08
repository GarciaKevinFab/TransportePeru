import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
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
  ChevronDown,
  Receipt,
  Building2,
  Shield,
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
import NotificationsPopover from '../components/NotificationsPopover';

const menuItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['superadmin', 'owner', 'admin', 'operaciones', 'flota', 'mantenimiento', 'almacen', 'contabilidad'] },
  { path: '/companies', icon: Building2, label: 'Empresas', roles: ['superadmin', 'owner'] },
  { path: '/vehicles', icon: Truck, label: 'Vehículos', roles: ['superadmin', 'owner', 'admin', 'operaciones', 'flota', 'mantenimiento'] },
  { path: '/equipment', icon: Shield, label: 'Equipamiento', roles: ['superadmin', 'owner', 'admin', 'flota', 'almacen', 'operaciones'] },
  { path: '/documents', icon: FileText, label: 'Documentos', roles: ['superadmin', 'owner', 'admin', 'flota'] },
  { path: '/trips', icon: Route, label: 'Viajes', roles: ['superadmin', 'owner', 'admin', 'operaciones', 'contabilidad', 'chofer'] },
  { path: '/settlements', icon: Receipt, label: 'Viáticos', roles: ['superadmin', 'owner', 'admin', 'contabilidad', 'operaciones'] },
  { path: '/fuel', icon: Fuel, label: 'Combustible', roles: ['superadmin', 'owner', 'admin', 'operaciones', 'chofer'] },
  { path: '/tires', icon: CircleDot, label: 'Llantas', roles: ['superadmin', 'owner', 'admin', 'flota', 'mantenimiento'] },
  { path: '/maintenance', icon: Wrench, label: 'Mantenimiento', roles: ['superadmin', 'owner', 'admin', 'mantenimiento'] },
  { path: '/inventory', icon: Package, label: 'Inventario', roles: ['superadmin', 'owner', 'admin', 'almacen'] },
  { path: '/issues', icon: AlertTriangle, label: 'Incidentes', roles: ['superadmin', 'owner', 'admin', 'operaciones', 'chofer'] },
  { path: '/billing', icon: FileText, label: 'Facturación', roles: ['superadmin', 'owner', 'admin', 'contabilidad'] },
  { path: '/reports', icon: BarChart3, label: 'Reportes', roles: ['superadmin', 'owner', 'admin', 'contabilidad'] },
  { path: '/users', icon: Users, label: 'Usuarios', roles: ['superadmin', 'owner', 'admin'] },
  { path: '/settings', icon: Settings, label: 'Configuración', roles: ['superadmin', 'owner', 'admin'] },
];

// Driver-specific menu items
const driverMenuItems = [
  { path: '/driver/trips', icon: Route, label: 'Mis Viajes', roles: ['chofer'] },
  { path: '/driver/checklist', icon: FileText, label: 'Checklist', roles: ['chofer'] },
  { path: '/driver/fuel', icon: Fuel, label: 'Combustible', roles: ['chofer'] },
  { path: '/driver/expenses', icon: Receipt, label: 'Gastos/Viáticos', roles: ['chofer'] },
  { path: '/driver/issues', icon: AlertTriangle, label: 'Reportar Incidente', roles: ['chofer'] },
];

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [companyBrand, setCompanyBrand] = useState({ name: 'TransPeru', logo_url: '', brand_color: '#f97316' });
  const [logoError, setLogoError] = useState(false);

  const loadCompanyBrand = () => {
    api.get('/config/company').then(res => {
      if (res.data) {
        setCompanyBrand({
          name: res.data.name || 'TransPeru',
          logo_url: res.data.logo_url || '',
          brand_color: res.data.brand_color || '#f97316',
        });
        setLogoError(false);
        // Apply brand color as CSS variable for the whole app
        document.documentElement.style.setProperty('--brand-color', res.data.brand_color || '#f97316');
      }
    }).catch(() => {});
  };

  useEffect(() => {
    loadCompanyBrand();
    // Listen for company config updates from SettingsPage
    const handleBrandUpdate = () => loadCompanyBrand();
    window.addEventListener('company-brand-updated', handleBrandUpdate);
    return () => window.removeEventListener('company-brand-updated', handleBrandUpdate);
  }, []);

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
        `sidebar-item sidebar-item-animated tap-scale ${isActive ? 'active' : ''}`
      }
      style={({ isActive }) => isActive ? { color: companyBrand.brand_color, borderLeftColor: companyBrand.brand_color } : {}}
      data-testid={`nav-${item.path.replace('/', '')}`}
    >
      <item.icon className="w-5 h-5 sidebar-icon" />
      {(sidebarOpen || mobileSidebarOpen) && (
        <span className="font-medium">{item.label}</span>
      )}
    </NavLink>
  );

  // Sidebar gradient background (subtle inner glow with brand color hint)
  const sidebarBg = {
    backgroundImage: `linear-gradient(180deg, #0b1220 0%, #0f172a 55%, color-mix(in srgb, ${companyBrand.brand_color} 12%, #0f172a) 100%)`,
  };

  // Header bottom gradient
  const headerStyle = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.85) 100%)',
    boxShadow:
      `0 1px 0 color-mix(in srgb, ${companyBrand.brand_color} 22%, transparent),` +
      ` 0 1px 12px rgba(15, 23, 42, 0.04)`,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col text-white sidebar-transition relative overflow-hidden ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
        style={sidebarBg}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm flex items-center justify-center overflow-hidden" style={{ backgroundColor: (companyBrand.logo_url && !logoError) ? 'transparent' : companyBrand.brand_color }}>
                {companyBrand.logo_url && !logoError ? (
                  <img src={companyBrand.logo_url} alt="Logo" className="w-full h-full object-contain" onError={() => setLogoError(true)} />
                ) : (
                  <Truck className="w-6 h-6 text-white" />
                )}
              </div>
              <span className="font-heading font-bold text-lg tracking-tight uppercase truncate max-w-[140px]">
                {companyBrand.name}
              </span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-sm flex items-center justify-center mx-auto overflow-hidden" style={{ backgroundColor: (companyBrand.logo_url && !logoError) ? 'transparent' : companyBrand.brand_color }}>
              {companyBrand.logo_url && !logoError ? (
                <img src={companyBrand.logo_url} alt="Logo" className="w-full h-full object-contain" onError={() => setLogoError(true)} />
              ) : (
                <Truck className="w-6 h-6 text-white" />
              )}
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
        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-0.5">
            {filteredMenuItems.map((item) => (
              <NavItem key={item.path} item={item} />
            ))}
          </nav>
        </ScrollArea>

        {/* User Section */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/60">
          <div className={`flex items-center rounded-lg p-2 transition-colors hover:bg-slate-800/60 ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-2 ring-slate-800"
              style={{
                backgroundColor: `color-mix(in srgb, ${companyBrand.brand_color} 18%, #1e293b)`,
                color: companyBrand.brand_color,
              }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name}</p>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">{user?.role}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <div
        className={`md:hidden fixed inset-0 z-50 ${
          mobileSidebarOpen ? 'visible' : 'invisible pointer-events-none'
        }`}
      >
        <div
          className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileSidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileSidebarOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-72 flex flex-col text-white transform shadow-2xl ${
            mobileSidebarOpen ? 'translate-x-0 sidebar-slide-in' : '-translate-x-full'
          }`}
          style={{ ...sidebarBg, transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden shadow-md"
                style={{ backgroundColor: (companyBrand.logo_url && !logoError) ? 'transparent' : companyBrand.brand_color }}
              >
                {companyBrand.logo_url && !logoError ? (
                  <img src={companyBrand.logo_url} alt="Logo" className="w-full h-full object-contain" onError={() => setLogoError(true)} />
                ) : (
                  <Truck className="w-6 h-6 text-white" />
                )}
              </div>
              <span className="font-heading font-bold text-lg tracking-tight uppercase truncate max-w-[160px]">
                {companyBrand.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-800 touch-target"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <ScrollArea className="flex-1 py-3">
            <nav className="space-y-0.5">
              {filteredMenuItems.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  onClick={() => setMobileSidebarOpen(false)}
                />
              ))}
            </nav>
          </ScrollArea>
          {/* Mobile sidebar user info */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/60">
            <div className="flex items-center gap-3 rounded-lg p-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-2 ring-slate-800"
                style={{
                  backgroundColor: `color-mix(in srgb, ${companyBrand.brand_color} 18%, #1e293b)`,
                  color: companyBrand.brand_color,
                }}
              >
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name}</p>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">{user?.role}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header
          className="h-16 backdrop-blur-md border-b border-transparent flex items-center justify-between px-3 sm:px-4 md:px-6 sticky top-0 z-30"
          style={headerStyle}
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden touch-target"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </Button>
            {/* Mobile logo in header */}
            <div className="flex md:hidden items-center gap-2">
              <div className="w-8 h-8 rounded-sm flex items-center justify-center overflow-hidden" style={{ backgroundColor: (companyBrand.logo_url && !logoError) ? 'transparent' : companyBrand.brand_color }}>
                {companyBrand.logo_url && !logoError ? (
                  <img src={companyBrand.logo_url} alt="Logo" className="w-full h-full object-contain" onError={() => setLogoError(true)} />
                ) : (
                  <Truck className="w-5 h-5 text-white" />
                )}
              </div>
              <span className="font-heading font-bold text-sm tracking-tight uppercase text-slate-900">
                {companyBrand.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            <div className="rounded-full transition-shadow">
              <NotificationsPopover />
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 h-10 px-2 sm:px-3 rounded-full hover:bg-slate-100 transition-colors"
                  data-testid="user-menu-btn"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ring-2 ring-white avatar-ring"
                    style={{
                      backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${companyBrand.brand_color} 22%, #ffffff) 0%, color-mix(in srgb, ${companyBrand.brand_color} 8%, #f1f5f9) 100%)`,
                      color: companyBrand.brand_color,
                    }}
                  >
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline font-medium text-sm text-slate-700">{user?.name}</span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
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
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto page-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
