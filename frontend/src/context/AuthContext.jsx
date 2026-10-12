// ============================================================
// frontend/src/context/AuthContext.jsx - Contexto de Autenticación
// ============================================================
// Este archivo provee un contexto global en React para controlar
// el estado de la sesión del usuario (Usuario conectado, Carga, Roles).
//
// Métodos expuestos a la aplicación:
//   - user: Información general del usuario (id, nombre, email, rol, etc.).
//   - loading: Estado de carga inicial mientras valida los tokens en localStorage.
//   - login(email, password): Llama al backend, guarda los tokens JWT e inicia sesión.
//   - logout(): Invalida el refresh token en el backend y limpia localStorage.
//   - hasRole(...roles): Helper rápido para verificar si el usuario tiene ciertos privilegios.
//   - loadUser(): Re-valida el token de acceso actual y carga el perfil del usuario.
// ============================================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';

// Crear el contexto de autenticación vacío
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);       // Perfil del usuario autenticado
  const [loading, setLoading] = useState(true);  // Bandera de carga inicial para evitar parpadeos visuales

  /**
   * Carga los datos del usuario actual si hay un token de acceso guardado en localStorage.
   */
  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { 
      setLoading(false); 
      return; 
    }
    try {
      // Intenta obtener el perfil del usuario utilizando el token guardado
      const res = await authService.getMe();
      setUser(res.data);
    } catch {
      // Si el token es inválido o expiró, limpia el almacenamiento
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setLoading(false);
    }
  }, []);

  // Efecto ejecutado al montar la aplicación para validar si hay sesión activa
  useEffect(() => { 
    loadUser(); 
  }, [loadUser]);

  /**
   * Inicia sesión con credenciales, guarda los tokens en localStorage y actualiza el estado.
   */
  const login = async (email, password) => {
    const res = await authService.login(email, password);
    const { access, refresh, user: userData } = res.data;
    
    // Almacena localmente las credenciales JWT para persistir la sesión
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    setUser(userData);
    return userData;
  };

  /**
   * Cierra sesión, enviando el token de refresco a la lista negra del backend para su anulación.
   */
  const logout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      await authService.logout(refresh);
    } catch {
      // Ignora errores si la red falla o el token ya expiró en backend
    }
    // Remueve tokens locales y resetea el estado del usuario
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  /**
   * Comprueba si el rol del usuario conectado coincide con los roles requeridos.
   * Ej: hasRole('ADMIN', 'JEFE_ALMACEN')
   */
  const hasRole = (...roles) => user && roles.includes(user.rol);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para consumir el contexto de autenticación de forma simplificada
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
};
