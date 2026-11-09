import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import { Toaster } from './components/ui/sonner';
import LandingPage from './pages/LandingPage';
import OfflineIndicator from './components/OfflineIndicator';
import { TITULOS } from './config/seo';
import { usePush } from './hooks/usePush';
import './App.css';
import { quitarPrerender } from './lib/prerender';

// Todo lo que no es la portada se carga a demanda. Antes App.js importaba las
// 40 pantallas del panel de golpe y la landing bajaba un main.js de 1,7 MB
// (recharts, tablas, formularios) para pintar una pagina de venta: el LCP en
// movil llegaba a 14 s. La portada va en el bundle principal porque es la
// pagina que entra por buscadores; el panel, la app del chofer y las paginas
// secundarias bajan su propio trozo cuando se visitan.
const MainLayout = lazy(() => import('./layouts/MainLayout'));
const MobileLayout = lazy(() => import('./layouts/MobileLayout'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const SuscripcionPage = lazy(() => import('./pages/SuscripcionPage'));
const AdminComprobantesPage = lazy(() => import('./pages/AdminComprobantesPage'));
const OlvidePage = lazy(() => import('./pages/RecuperarPage').then((m) => ({ default: m.OlvidePage })));
const RestablecerPage = lazy(() => import('./pages/RecuperarPage').then((m) => ({ default: m.RestablecerPage })));
const CambiarPasswordPage = lazy(() => import('./pages/CambiarPasswordPage'));
const PrivacidadPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.PrivacidadPage })));
const TerminosPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.TerminosPage })));
const ReclamacionesPage = lazy(() => import('./pages/ReclamacionesPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const VehiclesPage = lazy(() => import('./pages/VehiclesPage'));
const UnitsPage = lazy(() => import('./pages/UnitsPage'));
const TripsPage = lazy(() => import('./pages/TripsPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const TireSchemaPage = lazy(() => import('./pages/TireSchemaPage'));
const TiresPage = lazy(() => import('./pages/TiresPage'));
const FuelPage = lazy(() => import('./pages/FuelPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const IssuesPage = lazy(() => import('./pages/IssuesPage'));
const SettlementsPage = lazy(() => import('./pages/SettlementsPage'));
const ChecklistWizardPage = lazy(() => import('./pages/ChecklistWizardPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const DetraccionesPage = lazy(() => import('./pages/DetraccionesPage'));
const CashboxPage = lazy(() => import('./pages/CashboxPage'));
const LiquidacionFletePage = lazy(() => import('./pages/LiquidacionFletePage'));
const LiquidacionFleteDetailPage = lazy(() => import('./pages/LiquidacionFleteDetailPage'));
// Driver Mobile App Pages
const DriverLoginPage = lazy(() => import('./pages/driver/DriverLoginPage'));
const DriverHomePage = lazy(() => import('./pages/driver/DriverHomePage'));
const DriverTripPage = lazy(() => import('./pages/driver/DriverTripPage'));
const DriverFuelPage = lazy(() => import('./pages/driver/DriverFuelPage'));
const DriverIssuesPage = lazy(() => import('./pages/driver/DriverIssuesPage'));
const DriverExpensesPage = lazy(() => import('./pages/driver/DriverExpensesPage'));
// Tire feature pages (created by other agents) — lazy loaded
const RotateTiresPage = lazy(() => import('./pages/RotateTiresPage'));
const AlignTiresPage = lazy(() => import('./pages/AlignTiresPage'));
const TireGraphsPage = lazy(() => import('./pages/TireGraphsPage'));
const TireDimensionReportPage = lazy(() => import('./pages/TireDimensionReportPage'));
const TireLifecyclePage = lazy(() => import('./pages/TireLifecyclePage'));


// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-grafito-50">
        <div className="w-8 h-8 border-4 border-marca-500 border-t-transparent rounded-full animate-spin" />
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
  // Contraseña puesta por otra persona: no se entra a ningun sitio hasta
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
      <div className="min-h-screen flex items-center justify-center bg-grafito-50">
        <div className="w-8 h-8 border-4 border-marca-500 border-t-transparent rounded-full animate-spin" />
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
  <div className="min-h-screen flex items-center justify-center bg-grafito-50">
    <div className="w-8 h-8 border-4 border-marca-500 border-t-transparent rounded-full animate-spin" />
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

// El titulo de la pestana al navegar dentro de la SPA. El de la primera carga
// lo pone el servidor (backend/seo_rutas.py); al cambiar de ruta sin recargar,
// la pestana se quedaba con el de la pagina por la que se entro. En el
// subdominio de un cliente manda TenantContext (el nombre de su empresa).
const TituloPorRuta = () => {
  const { pathname } = useLocation();
  const { tenant } = useTenant();
  useEffect(() => {
    const titulo = TITULOS[pathname.replace(/\/+$/, '') || '/'];
    if (titulo && !tenant) document.title = titulo;
  }, [pathname, tenant]);
  return null;
};

// Si se sale de la ruta por la que se entro (la raiz manda al tablero a quien
// ya tiene sesion, el subdominio de una empresa manda al login), el texto que
// puso el servidor para la ruta de entrada ya no corresponde: se quita.
const PrerenderPorRuta = () => {
  const { pathname } = useLocation();
  const [inicial] = React.useState(pathname);
  useEffect(() => {
    if (pathname !== inicial) quitarPrerender();
  }, [pathname, inicial]);
  return null;
};

function AppRoutes() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
    <PrerenderPorRuta />
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
      {/* Libro de Reclamaciones: igual, publico y fuera de PublicRoute. La Ley
          29571 obliga a que cualquiera pueda llegar a el desde la web, tenga o
          no cuenta -y el cliente molesto que quiere reclamar suele tener la
          sesion abierta: rebotarlo al tablero seria justo lo contrario-. */}
      <Route path="/reclamaciones" element={<ReclamacionesPage />} />
      <Route path="/olvide" element={<OlvidePage />} />
      {/* Fuera de PublicRoute: quien llega con el enlace puede tener una
          sesion vieja abierta, y PublicRoute lo mandaria al tablero sin
          dejarle cambiar la contrasena que vino a cambiar. */}
      <Route path="/restablecer" element={<RestablecerPage />} />
      {/* Checkout del plan Pro. Tambien fuera de PublicRoute: un cliente con
          sesion abierta que quiere pasarse a Pro tiene que poder pagar sin
          que se le rebote al tablero. */}
      <Route path="/comprar" element={<CheckoutPage />} />
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

      {/* Suscripcion de la empresa. Mercado Pago devuelve aqui al cliente
          (back_url). Vive dentro de la app y no en /comprar porque la sesion
          esta en el subdominio de cada empresa. */}
      <Route
        path="/suscripcion"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin']}>
            <SuscripcionPage />
          </ProtectedRoute>
        }
      />

      {/* Comprobantes emitidos a mano: solo el dueno de la plataforma. La
          pagina comprueba el rol ademas, porque ProtectedRoute deja pasar al
          superadmin a todo pero aqui no hay ningun otro rol que deba entrar. */}
      <Route
        path="/admin/comprobantes"
        element={
          <ProtectedRoute allowedRoles={['superadmin']}>
            <AdminComprobantesPage />
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
            <TituloPorRuta />
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
