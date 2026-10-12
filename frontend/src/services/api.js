// ============================================================
// frontend/src/services/api.js - Cliente Axios e Integración API
// ============================================================
// Este archivo centraliza todas las llamadas HTTP al backend del Sistema WEB.
//
// Características Clave:
//   1. Instancia Axios configurable mediante variables de entorno (VITE_API_URL).
//   2. Interceptor de Solicitudes (Request Interceptor):
//      Inserta de forma automática la cabecera 'Authorization: Bearer <token>'
//      en cada petición HTTP cuando el usuario está logueado.
//   3. Interceptor de Respuestas (Response Interceptor):
//      Monitorea respuestas 401 (No autorizado). Si el token de acceso expira,
//      intenta silenciosamente refrescarlo utilizando el token de refresco
//      (Silent Token Refresh) y re-intenta la petición original.
//   4. Objetos de servicio modularizados por dominio para mayor orden.
// ============================================================

import axios from 'axios';

// URL del backend configurada en entorno, con fallback al puerto 8000 local
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Crear instancia reutilizable de Axios
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor de Solicitudes: Adjunta el JWT Access Token dinámicamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de Respuestas: Refresca el token automáticamente si expira (error 401)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Si la respuesta es 401 (Expirado/No autorizado) y la petición no ha sido re-intentada aún
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Evita bucle infinito de reintentos
      try {
        const refresh = localStorage.getItem('refresh_token');
        
        // Petición especial para renovar el token de acceso
        const res = await axios.post(`${API_URL}/auth/token/refresh/`, { refresh });
        
        // Guarda el nuevo token de acceso en el almacenamiento local
        localStorage.setItem('access_token', res.data.access);
        
        // Actualiza la cabecera de la petición original y la re-ejecuta
        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
        return api(originalRequest);
      } catch (e) {
        // Si el refresh token también expiró, desloguea al usuario y lo manda al login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;


// ============================================================
// SERVICIOS ESPECÍFICOS POR COMPONENTE / MÓDULO
// ============================================================

// 1. Módulo: Autenticación y Perfil
export const authService = {
  login: (email, password) => api.post('/auth/login/', { email, password }),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  getMe: () => api.get('/auth/usuarios/me/'),
  register: (data) => api.post('/auth/usuarios/registrar/', data),
};

// 2. Módulo: Administración de Usuarios y Departamentos
export const usuariosService = {
  getAll: (params) => api.get('/auth/usuarios/', { params }),
  create: (data) => {
    // Si hay foto (File), se debe enviar como multipart/form-data
    if (data.foto instanceof File) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formData.append(key, value);
        }
      });
      return api.post('/auth/usuarios/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/auth/usuarios/', data);
  },
  update: (id, data) => {
    // Si hay foto (File), se debe enviar como multipart/form-data
    if (data.foto instanceof File) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formData.append(key, value);
        }
      });
      return api.patch(`/auth/usuarios/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.patch(`/auth/usuarios/${id}/`, data);
  },
  delete: (id) => api.delete(`/auth/usuarios/${id}/`),
  getDepartamentos: () => api.get('/auth/departamentos/'),
  createDepartamento: (data) => api.post('/auth/departamentos/', data),
};

// Helper para construir FormData cuando hay un archivo (File) presente
function buildFormData(data) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value instanceof File) {
      formData.append(key, value);
    } else if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value);
    }
  });
  return formData;
}

// 3. Módulo: Inventario y Materiales (Almacenes)
export const materialesService = {
  getAll: (params) => api.get('/materiales/items/', { params }),
  getOne: (id) => api.get(`/materiales/items/${id}/`),
  create: (data) => {
    if (data.imagen instanceof File) {
      return api.post('/materiales/items/', buildFormData(data), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    const cleanData = { ...data };
    if (cleanData.proveedor === '') cleanData.proveedor = null;
    if (!(cleanData.imagen instanceof File)) delete cleanData.imagen;
    return api.post('/materiales/items/', cleanData);
  },
  update: (id, data) => {
    if (data.imagen instanceof File) {
      return api.patch(`/materiales/items/${id}/`, buildFormData(data), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    const cleanData = { ...data };
    if (cleanData.proveedor === '') cleanData.proveedor = null;
    if (cleanData.eliminar_imagen) {
      cleanData.imagen = null;
      delete cleanData.eliminar_imagen;
    } else if (!(cleanData.imagen instanceof File)) {
      delete cleanData.imagen;
    }
    return api.patch(`/materiales/items/${id}/`, cleanData);
  },
  delete: (id) => api.delete(`/materiales/items/${id}/`),
  getAlertasStock: () => api.get('/materiales/items/alertas_stock/'),
  getEstadisticas: () => api.get('/materiales/items/estadisticas/'),
  getCategorias: () => api.get('/materiales/categorias/'),
  getProveedores: () => api.get('/materiales/proveedores/'),
  getMovimientos: (params) => api.get('/materiales/movimientos/', { params }),
  createMovimiento: (data) => api.post('/materiales/movimientos/', data),
};

// 4. Módulo: Activos Fijos (Bienes Patrimoniales)
export const activosService = {
  getAll: (params) => api.get('/activos/items/', { params }),
  getOne: (id) => api.get(`/activos/items/${id}/`),
  create: (data) => {
    if (data.imagen instanceof File) {
      return api.post('/activos/items/', buildFormData(data), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    const cleanData = { ...data };
    if (!(cleanData.imagen instanceof File)) delete cleanData.imagen;
    return api.post('/activos/items/', cleanData);
  },
  update: (id, data) => {
    if (data.imagen instanceof File) {
      return api.patch(`/activos/items/${id}/`, buildFormData(data), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    const cleanData = { ...data };
    if (cleanData.eliminar_imagen) {
      cleanData.imagen = null;
      delete cleanData.eliminar_imagen;
    } else if (!(cleanData.imagen instanceof File)) {
      delete cleanData.imagen;
    }
    return api.patch(`/activos/items/${id}/`, cleanData);
  },
  darBaja: (id) => api.post(`/activos/items/${id}/dar_baja/`),
  getEstadisticas: () => api.get('/activos/items/estadisticas/'),
  getAsignaciones: (params) => api.get('/activos/asignaciones/', { params }),
  createAsignacion: (data) => api.post('/activos/asignaciones/', data),
};

// 5. Módulo: Solicitudes de Pedidos de Materiales
export const solicitudesService = {
  getAll: (params) => api.get('/solicitudes/', { params }),
  getOne: (id) => api.get(`/solicitudes/${id}/`),
  create: (data) => api.post('/solicitudes/', data),
  aprobar: (id, data) => api.post(`/solicitudes/${id}/aprobar/`, data),
  rechazar: (id, data) => api.post(`/solicitudes/${id}/rechazar/`, data),
  entregar: (id) => api.post(`/solicitudes/${id}/entregar/`),
  getEstadisticas: () => api.get('/solicitudes/estadisticas/'),
};

// 6. Módulo: Trazabilidad y Blockchain
export const blockchainService = {
  getAll: (params) => api.get('/blockchain/', { params }),
  verificar: (hash) => api.post('/blockchain/verificar/', { hash }),
  getEstadisticas: () => api.get('/blockchain/estadisticas/'),
  getEstadoRed: () => api.get('/blockchain/estado_red/'),
};

// 7. Módulo: Reportes Consolidados y Gráficos (Dashboard)
export const reportesService = {
  getDashboard: () => api.get('/reportes/dashboard/'),
  getMovimientos: (params) => api.get('/reportes/movimientos/', { params }),
};
