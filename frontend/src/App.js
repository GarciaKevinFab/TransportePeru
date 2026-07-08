import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from './components/ui/sonner';
import MainLayout from './layouts/MainLayout';
import MobileLayout from './layouts/MobileLayout';
import LoginPage from './pages/LoginPage';
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
  
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
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

function AppRoutes() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
    <Routes>
      {/* Public Routes */}
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
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
          <AppRoutes />
          <PushRegistrar />
          <Toaster />
          <OfflineIndicator />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
