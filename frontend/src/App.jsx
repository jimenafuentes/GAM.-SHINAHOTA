// ============================================================
// frontend/src/App.jsx - Componente Raíz y Enrutamiento Global
// ============================================================
// Este archivo actúa como el orquestador principal del frontend:
//   1. Proveedor de Estado de Consultas (React Query / TanStack Query):
//      Maneja la caché de red y las peticiones al backend de forma automatizada.
//   2. Proveedor de Contexto de Autenticación (AuthContext):
//      Expone la sesión del usuario (roles, tokens) a toda la aplicación.
//   3. Enrutador Declarativo (React Router):
//      Define los paths (URLs) y protege las rutas privadas (requiere login).
//   4. Sistema de Notificaciones Flotantes (React Hot Toast).
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MaterialesPage from './pages/MaterialesPage';
import ActivosPage from './pages/ActivosPage';
import SolicitudesPage from './pages/SolicitudesPage';
import BlockchainPage from './pages/BlockchainPage';
import TransaccionesPage from './pages/TransaccionesPage';
import ReportesPage from './pages/ReportesPage';
import UsuariosPage from './pages/UsuariosPage';
import IntegridadPage from './pages/IntegridadPage';

// Inicialización de QueryClient de TanStack Query para manejo de caché de datos API
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,            // Si una petición falla, intenta re-solicitar 1 vez antes de dar error
      staleTime: 30000,    // Los datos en caché se consideran válidos por 30 segundos
    },
  },
});

function IndexRedirect() {
  const { user } = useAuth();
  if (user?.rol === 'AUDITOR') {
    return <Navigate to="/reportes" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    // 1. Proveemos la caché de TanStack Query a todos los componentes
    <QueryClientProvider client={queryClient}>
      
      {/* 2. Proveemos el contexto de sesión de usuario (tokens, rol) */}
      <AuthProvider>
        
        {/* 3. Iniciamos el enrutador del navegador */}
        <BrowserRouter>
          
          {/* Componente global para renderizar notificaciones/toasts flotantes */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#1f2937',
                color: '#f9fafb',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '0.875rem',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#f9fafb' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#f9fafb' },
              },
            }}
          />
          
          {/* Definición de la tabla de enrutamiento */}
          <Routes>
            {/* Ruta pública para inicio de sesión */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Rutas Privadas: Enclavas dentro de PrivateRoute y con el diseño del Layout general */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              {/* Redirección automática de la raíz según rol */}
              <Route index element={<IndexRedirect />} />
              
              {/* Páginas interiores del sistema */}
              <Route path="dashboard" element={
                <PrivateRoute roles={['ADMIN', 'JEFE_ALMACEN', 'SOLICITANTE']}>
                  <DashboardPage />
                </PrivateRoute>
              } />
              <Route path="materiales" element={
                <PrivateRoute roles={['ADMIN', 'JEFE_ALMACEN', 'SOLICITANTE']}>
                  <MaterialesPage />
                </PrivateRoute>
              } />
              <Route path="activos" element={
                <PrivateRoute roles={['ADMIN', 'JEFE_ALMACEN', 'SOLICITANTE']}>
                  <ActivosPage />
                </PrivateRoute>
              } />
              <Route path="solicitudes" element={
                <PrivateRoute roles={['ADMIN', 'JEFE_ALMACEN', 'SOLICITANTE']}>
                  <SolicitudesPage />
                </PrivateRoute>
              } />
              
              {/* Rutas protegidas para personal de administración y almacén */}
              <Route path="blockchain" element={
                <PrivateRoute roles={['ADMIN', 'JEFE_ALMACEN']}>
                  <BlockchainPage />
                </PrivateRoute>
              } />
              <Route path="transacciones" element={
                <PrivateRoute roles={['ADMIN', 'JEFE_ALMACEN']}>
                  <TransaccionesPage />
                </PrivateRoute>
              } />
              <Route path="reportes" element={
                <PrivateRoute roles={['ADMIN', 'JEFE_ALMACEN', 'AUDITOR']}>
                  <ReportesPage />
                </PrivateRoute>
              } />
              <Route path="integridad" element={
                <PrivateRoute roles={['ADMIN', 'JEFE_ALMACEN']}>
                  <IntegridadPage />
                </PrivateRoute>
              } />
              
              {/* Ruta de administración de usuarios protegida a nivel de rol (Solo ADMIN) */}
              <Route path="usuarios" element={
                <PrivateRoute roles={['ADMIN']}>
                  <UsuariosPage />
                </PrivateRoute>
              } />
            </Route>
            
            {/* Comodín: Cualquier otra ruta no registrada redirige al dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
