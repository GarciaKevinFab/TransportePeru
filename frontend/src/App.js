import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VehiclesPage from './pages/VehiclesPage';
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

// Placeholder pages for routes not yet implemented
const PlaceholderPage = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-96 text-slate-400">
    <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-900 mb-2">
      {title}
    </h2>
    <p>Esta sección está en desarrollo</p>
  </div>
);

function AppRoutes() {
  return (
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
        path="/vehicles/:vehicleId/tires"
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'flota', 'mantenimiento']}>
            <TireSchemaPage />
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
            <PlaceholderPage title="Reportes" />
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
            <PlaceholderPage title="Configuración" />
          </ProtectedRoute>
        }
      />
      
      {/* Driver Routes */}
      <Route
        path="/driver/trips"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <PlaceholderPage title="Mis Viajes" />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/driver/checklist"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <PlaceholderPage title="Checklist" />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/driver/fuel"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <PlaceholderPage title="Combustible" />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/driver/expenses"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <PlaceholderPage title="Gastos" />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/driver/issues"
        element={
          <ProtectedRoute allowedRoles={['chofer']}>
            <PlaceholderPage title="Reportar Incidente" />
          </ProtectedRoute>
        }
      />
      
      {/* Default Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
