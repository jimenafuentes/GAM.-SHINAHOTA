// ============================================================
// frontend/src/components/PrivateRoute.jsx - Guardián de Rutas
// ============================================================
// Este componente de React actúa como un "Guardián de Rutas" (Route Guard).
// Protege los endpoints del frontend de la siguiente manera:
//   1. Muestra una animación de carga mientras se valida la sesión.
//   2. Si no hay usuario activo, redirige al inicio de sesión (/login).
//   3. Si hay roles definidos para la ruta y el usuario actual no los posee,
//      lo redirige a una zona segura (/dashboard).
//   4. Si cumple los requisitos, renderiza los componentes hijos (children).
// ============================================================

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();

  // 1. Mostrar pantalla intermedia de carga mientras el estado auth está inicializándose
  if (loading) {
    return (
      <div className="loading-container" style={{ height: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  // 2. Si no hay sesión válida, redirigir inmediatamente a la página de login
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // 3. Si el componente requiere roles especiales y el rol del usuario no está incluido
  if (roles && !roles.includes(user.rol)) {
    return <Navigate to={user.rol === 'AUDITOR' ? '/reportes' : '/dashboard'} replace />;
  }

  // 4. Si todo está correcto, permite el acceso
  return children;
}
