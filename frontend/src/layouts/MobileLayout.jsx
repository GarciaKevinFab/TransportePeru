import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Truck, 
  Fuel, 
  FileText, 
  AlertTriangle,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  MapPin
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useState, useEffect } from 'react';
import { alertsApi } from '../services/api';

const MobileLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await alertsApi.getAll({ resolved: false });
        setAlertCount(res.data.length);
      } catch (e) {
        console.log('Error fetching alerts');
      }
    };
    fetchAlerts();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/driver/login');
  };

  const navItems = [
    { path: '/driver', icon: Home, label: 'Inicio', exact: true },
    { path: '/driver/trip', icon: Truck, label: 'Mi Viaje' },
    { path: '/driver/fuel', icon: Fuel, label: 'Combustible' },
    { path: '/driver/checklist', icon: FileText, label: 'Checklist' },
    { path: '/driver/issues', icon: AlertTriangle, label: 'Reportar' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Mobile Header */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 safe-area-top">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <div>
            <p className="font-bold text-sm">{user?.name || 'Chofer'}</p>
            <p className="text-xs text-slate-400">Chofer</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white relative"
            onClick={() => navigate('/driver/alerts')}
          >
            <Bell className="w-5 h-5" />
            {alertCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-xs">
                {alertCount}
              </Badge>
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="text-white"
            onClick={() => setShowMenu(!showMenu)}
          >
            {showMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Slide Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowMenu(false)}>
          <div 
            className="absolute right-0 top-0 h-full w-64 bg-white shadow-xl p-4 pt-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => { navigate('/driver/profile'); setShowMenu(false); }}
              >
                <User className="w-5 h-5 mr-3" />
                Mi Perfil
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-red-600"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5 mr-3" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-area-bottom z-40">
        <div className="flex justify-around items-center py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'text-orange-600 bg-orange-50' 
                    : 'text-slate-500 hover:text-slate-700'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default MobileLayout;
