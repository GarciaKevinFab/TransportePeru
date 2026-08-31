import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import { Toaster } from './components/ui/sonner';
import MainLayout from './layouts/MainLayout';
import MobileLayout from './layouts/MobileLayout';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import { OlvidePage, RestablecerPage } from './pages/RecuperarPage';
import CambiarPasswordPage from './pages/CambiarPasswordPage';
import { PrivacidadPage, TerminosPage } from './pages/LegalPage';
import DashboardPage from './pages/DashboardPage';
import VehiclesPage from './pages/VehiclesPage';
import UnitsPage from './pages/UnitsPage';
import TripsPage from './pages/TripsPage';
import DocumentsPage from './pages/DocumentsPage';
import UsersPage from './pages/UsersPage';
import TireSchemaPage from './pages/TireSchemaPage';
import TiresPage from './pages/TiresPage';
import FuelPage from './pages/FuelPage';
import MaintenancePage from './pages/MaintenancePage';
import InventoryPage from './pages/InventoryPage';
import IssuesPage from './pages/IssuesPage';
import SettlementsPage from './pages/SettlementsPage';
import ChecklistWizardPage from './pages/ChecklistWizardPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import CompaniesPage from './pages/CompaniesPage';
import EquipmentPage from './pages/EquipmentPage';
import BillingPage from './pages/BillingPage';
import DetraccionesPage from './pages/DetraccionesPage';
import CashboxPage from './pages/CashboxPage';
import LiquidacionFletePage from './pages/LiquidacionFletePage';
import LiquidacionFleteDetailPage from './pages/LiquidacionFleteDetailPage';
import OfflineIndicator from './components/OfflineIndicator';
import { usePush } from './hooks/usePush';
// Driver Mobile App Pages
import DriverLoginPage from './pages/driver/DriverLoginPage';
import DriverHomePage from './pages/driver/DriverHomePage';
import DriverTripPage from './pages/driver/DriverTripPage';
import DriverFuelPage from './pages/driver/DriverFuelPage';
import DriverIssuesPage from './pages/driver/DriverIssuesPage';
import DriverExpensesPage from './pages/driver/DriverExpensesPage';
// Tire feature pages (created by other agents) — lazy loaded
const RotateTiresPage = lazy(() => import('./pages/RotateTiresPage'));
const AlignTiresPage = lazy(() => import('./pages/AlignTiresPage'));
const TireGraphsPage = lazy(() => import('./pages/TireGraphsPage'));
const TireDimensionReportPage = lazy(() => import('./pages/TireDimensionReportPage'));
const TireLifecyclePage = lazy(() => import('./pages/TireLifecyclePage'));
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // El superadmin pasa siempre, igual que en el backend: require_roles() lo
  // autoriza en TODOS los endpoints, esten o no en su lista de roles. Aqui no,
  // y esa asimetria se nota justo cuando el superadmin entra en una empresa
  // para atenderla: el backend le responde y la interfaz lo rebota al tablero,
  // asi que la mitad del sistema le parece rota sin que nada falle.
  // Contrasena puesta por otra persona: no se entra a ningun sitio hasta
  // cambiarla. Va ANTES del filtro de roles a proposito -da igual a que
  // pantalla apuntara, la respuesta es la misma- y sustituye al sistema en
  // vez de avisar encima: un aviso que se puede cerrar se cierra, y la clave
  // que conocen dos personas se queda asi para siempre.
  if (user?.force_password_change) {
    return <CambiarPasswordPage />;
  }

  if (allowedRoles && user?.role !== 'superadmin' && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <MainLayout>{children}</MainLayout>;
};

// Public Route Component (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Registra el Web Push solo cuando hay un usuario autenticado.
// Se separa en dos componentes para respetar las reglas de hooks
// (usePush nunca se llama condicionalmente).
const PushHook = () => {
  usePush();
  return null;
};

const PushRegistrar = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading || !isAuthenticated) return null;
  return <PushHook />;
};

const SuspenseFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// En la direccion de una empresa la raiz NO es la landing. Quien abre
// gye.sisac.pe viene a trabajar, no a que le vendan el producto -y menos a que
// le ofrezcan darse de alta en algo que su empresa ya tiene contratado-. La
// pagina de venta solo tiene sentido en el host de la marca.
//
// Se espera a saber de que host se trata antes de pintar: renderizar la
// landing y cambiarla medio segundo despues es peor que un momento de spinner.
const RaizSegunElHost = () => {
  const { tenant, loading } = useTenant();
  if (loading) return <SuspenseFallback />;
  return tenant ? <Navigate to="/login" replace /> : <LandingPage />;
};

// El alta crea una empresa NUEVA, y eso solo se hace desde el host de la
// marca. Ofrecerla dentro del subdominio de un cliente invita a sus empleados
// a abrir una empresa paralela por error.
const AltaSoloEnLaMarca = () => {
  const { tenant, loading } = useTenant();
  if (loading) return <SuspenseFallback />;
  return tenant ? <Navigate to="/login" replace /> : <SignupPage />;
};

function AppRoutes() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
    <Routes>
      {/* Public Routes */}
      {/* La raiz es la landing del producto. Antes redirigia a /dashboard, que
          sin sesion rebotaba a /login: quien llegaba al dominio se encontraba
          un formulario de acceso y ninguna explicacion de que es esto.
          Va dentro de PublicRoute para que a quien YA tiene sesion se le lleve
          a su tablero en vez de a la pagina de venta. */}
      <Route
        path="/"
        element={
          <PublicRoute>
            <RaizSegunElHost />
          </PublicRoute>
        }
      />
      <Route
        path="/registro"
        element={
          <PublicRoute>
            <AltaSoloEnLaMarca />
          </PublicRoute>
        }
      />
      {/* Legales: publicas y sin PublicRoute. Tienen que poder leerse con la
          sesion abierta o sin ella, y desde un correo o un buscador. */}
      <Route path="/privacidad" element={<PrivacidadPage />} />
      <Route path="/terminos" element={<TerminosPage />} />
      <Route path="/olvide" element={<OlvidePage />} />
      {/* Fuera de PublicRoute: quien llega con el enlace puede tener una
          sesion vieja abierta, y PublicRoute lo mandaria al tablero sin
          dejarle cambiar la contrasena que vino a cambiar. */}
      <Route path="/restablecer" element={<RestablecerPage />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      
      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/vehicles"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'operaciones', 'flota', 'mantenimiento']}>
            <VehiclesPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/units"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota']}>
            <UnitsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vehicles/:vehicleId/tires"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota', 'mantenimiento']}>
            <TireSchemaPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vehicles/:vehicleId/tires/rotate"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota', 'mantenimiento']}>
            <RotateTiresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vehicles/:vehicleId/tires/align"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota', 'mantenimiento']}>
            <AlignTiresPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vehicles/:vehicleId/tires/graphs"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota', 'mantenimiento']}>
            <TireGraphsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tires/required-by-dimension"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota', 'mantenimiento']}>
            <TireDimensionReportPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tires/lifecycle"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota', 'mantenimiento']}>
            <TireLifecyclePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/equipment"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota', 'almacen', 'operaciones']}>
            <EquipmentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/documents"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota']}>
            <DocumentsPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/trips"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'operaciones', 'contabilidad']}>
            <TripsPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/fuel"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'operaciones']}>
            <FuelPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/tires"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota', 'mantenimiento']}>
            <TiresPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/maintenance"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'mantenimiento']}>
            <MaintenancePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'almacen']}>
            <InventoryPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/issues"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'operaciones']}>
            <IssuesPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/settlements"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'contabilidad', 'operaciones']}>
            <SettlementsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/billing"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'contabilidad']}>
            <BillingPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/detracciones"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'owner', 'admin', 'contabilidad']}>
            <DetraccionesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cashbox"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'owner', 'admin', 'contabilidad']}>
            <CashboxPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/liquidacion-flete"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'owner', 'admin', 'contabilidad', 'operaciones']}>
            <LiquidacionFletePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/liquidacion-flete/:id"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'owner', 'admin', 'contabilidad', 'operaciones']}>
            <LiquidacionFleteDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/trips/:tripId/checklist"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'operaciones', 'chofer']}>
            <ChecklistWizardPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'contabilidad']}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin']}>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin']}>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/companies"
        element={
          <ProtectedRoute allowedRoles={['superadmin', 'owner']}>
            <CompaniesPage />
          </ProtectedRoute>
        }
      />
      
      {/* Driver Mobile App Routes */}
      <Route
        path="/driver/login"
        element={<DriverLoginPage />}
      />
      
      <Route
        path="/driver"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <MobileLayout><DriverHomePage /></MobileLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/driver/trip"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <MobileLayout><DriverTripPage /></MobileLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/driver/checklist"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <MobileLayout><ChecklistWizardPage /></MobileLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/driver/fuel"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <MobileLayout><DriverFuelPage /></MobileLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/driver/expenses"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <MobileLayout><DriverExpensesPage /></MobileLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/driver/issues"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <MobileLayout><DriverIssuesPage /></MobileLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Default Routes */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          {/* Dentro de AuthProvider porque quien consulta /api/tenant es la
              instancia de axios que este ya dejo configurada. Fuera de
              BrowserRouter no serviria: el Navigate de RaizSegunElHost
              necesita el router. */}
          <TenantProvider>
            <AppRoutes />
            <PushRegistrar />
            <Toaster />
            <OfflineIndicator />
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
