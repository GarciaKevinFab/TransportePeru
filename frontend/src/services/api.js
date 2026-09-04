import axios from 'axios';
import { instalarCache, limpiarCache } from './cache';

// Vacio = mismo origen, que es como se sirve en produccion: el backend publica
// la SPA y la API bajo el mismo dominio, asi que basta con pedir /api.
// El respaldo no es cosmetico: sin el, una compilacion sin la variable deja
// baseURL en "undefined/api" y todas las llamadas fallan. Los otros ocho
// lugares que leen esta variable ya usaban `|| ''`.
const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Helpers to set/clear the auth token on the shared `api` instance.
// This is the single source of truth for the Authorization header — the
// AuthContext must use these instead of touching the global `axios` object.
//
// Las dos vacian ademas el cache de lecturas. Es el unico sitio por el que
// pasan TODOS los cambios de sesion -- login, alta, entrada de chofer con PIN,
// logout y la renovacion del token --, asi que enganchar aqui evita repetirlo
// en AuthContext y, sobre todo, evita el olvido: sin esto, el cambio de turno
// en una oficina dejaria al siguiente usuario viendo los viajes y la caja del
// anterior, que siguen en memoria. En la renovacion del token el vaciado no
// hace falta, pero cuesta unas relecturas cada varias horas y no merece la
// pena distinguir el caso a cambio de arriesgarse a filtrar datos entre
// sesiones.
export const setAuthToken = (token) => {
  limpiarCache();
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const clearAuthToken = () => {
  limpiarCache();
  delete api.defaults.headers.common.Authorization;
};

// Initialize the Authorization header from any persisted token on load.
setAuthToken(localStorage.getItem('access_token'));

// Request interceptor to add auth token
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

// --- Refresh lock + queue to avoid multiple simultaneous refresh calls ---
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  refreshQueue = [];
};

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // La sesion es de otra empresa: se entro por el subdominio equivocado, o
    // el slug de la empresa cambio. Ningun refresh arregla esto -el token
    // renovado seguiria siendo de la misma empresa-, asi que lo unico util es
    // cerrar sesion y volver al login DE ESTE host, que es el de la empresa
    // correcta. Se mira la cabecera y no el texto del error para no atar el
    // frontend a la redaccion de un mensaje.
    if (error.response?.status === 403 && error.response?.headers?.['x-tenant-mismatch']) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      clearAuthToken();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        return Promise.reject(error);
      }

      // If a refresh is already in flight, queue this request until it resolves.
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        }, { headers: { 'ngrok-skip-browser-warning': 'true' } });

        const { access_token, refresh_token: newRefresh } = response.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', newRefresh);
        setAuthToken(access_token);

        processQueue(null, access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        clearAuthToken();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Cache de lecturas. Va DESPUES de los interceptores de arriba a proposito:
// axios ejecuta los de peticion en orden inverso al registro, asi que este
// corre primero y decide si hace falta viajar, y el que pone la cabecera
// Authorization corre despues sobre el mismo objeto de configuracion.
//
// Convive con la renovacion del token: los errores no se guardan, de modo que
// el `api(originalRequest)` de mas arriba vuelve a salir a la red de verdad en
// lugar de releer el 401 de memoria. Ver services/cache.js.
instalarCache(api);

// Auth API
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  // Alta de una transportista nueva. Publico: no lleva token, porque la
  // empresa y su dueno se crean en esta misma llamada.
  signup: (datos) => api.post('/auth/signup', datos),
  refresh: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
  getMe: () => api.get('/auth/me'),
  // Recuperacion. Las dos primeras son publicas: se usan justamente cuando no
  // se puede entrar.
  olvide: (email) => api.post('/auth/olvide', { email }),
  restablecer: (token, password) => api.post('/auth/restablecer', { token, password }),
  cambiarPassword: (passwordActual, passwordNueva) =>
    api.post('/auth/cambiar-password', {
      password_actual: passwordActual,
      password_nueva: passwordNueva,
    }),
};

// Users API
export const usersApi = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  resetPin: (id, pin) => api.post(`/users/${id}/reset-pin`, { pin }),
  resetPassword: (id, password) => api.post(`/users/${id}/reset-password`, { password }),
};

// Vehicles API
export const vehiclesApi = {
  getAll: (params) => api.get('/vehicles', { params }),
  getById: (id) => api.get(`/vehicles/${id}`),
  create: (data) => api.post('/vehicles', data),
  update: (id, data) => api.put(`/vehicles/${id}`, data),
  delete: (id) => api.delete(`/vehicles/${id}`),
  assignDriver: (id, driverId) => api.post(`/vehicles/${id}/assign-driver`, { driver_id: driverId }),
  getEquipment: (id) => api.get(`/vehicles/${id}/equipment`),
  updateEquipment: (id, data) => api.put(`/vehicles/${id}/equipment`, data),
};

// Units API (tracto + carreta + chofer + EPP de unidad)
export const unitsApi = {
  getAll: (params) => api.get('/units', { params }),
  create: (data) => api.post('/units', data),
  update: (id, data) => api.put(`/units/${id}`, data),
  delete: (id) => api.delete(`/units/${id}`),
};

// Couplings API
export const couplingsApi = {
  getAll: (params) => api.get('/couplings', { params }),
  create: (data) => api.post('/couplings', data),
  update: (id, data) => api.put(`/couplings/${id}`, data),
};

// Document Types API
export const documentTypesApi = {
  getAll: (params) => api.get('/document-types', { params }),
  create: (data) => api.post('/document-types', data),
};

// Documents API
export const documentsApi = {
  getAll: (params) => api.get('/documents', { params }),
  create: (data) => api.post('/documents', data),
  update: (id, data) => api.put(`/documents/${id}`, data),
  approve: (id) => api.post(`/documents/${id}/approve`),
  getMatrix: (entityType) => api.get('/documents/matrix', { params: { entity_type: entityType } }),
};

// Alerts API
export const alertsApi = {
  getAll: (params) => api.get('/alerts', { params }),
  resolve: (id) => api.post(`/alerts/${id}/resolve`),
};

// Routes API
export const routesApi = {
  getAll: () => api.get('/routes'),
  create: (data) => api.post('/routes', data),
};

// Trips API
export const tripsApi = {
  getAll: (params) => api.get('/trips', { params }),
  getById: (id) => api.get(`/trips/${id}`),
  create: (data) => api.post('/trips', data),
  update: (id, data) => api.put(`/trips/${id}`, data),
  start: (id, data) => api.post(`/trips/${id}/start`, data),
  complete: (id, data) => api.post(`/trips/${id}/complete`, data),
  getAdvances: (tripId) => api.get(`/trips/${tripId}/advances`),
  createAdvance: (tripId, data) => api.post(`/trips/${tripId}/advances`, data),
  getExpenses: (tripId) => api.get(`/trips/${tripId}/expenses`),
  createExpense: (tripId, data) => api.post(`/trips/${tripId}/expenses`, data),
  setViaticoBudget: (tripId, data) => api.post(`/trips/${tripId}/viatico-budget`, data),
  getViaticoStatus: (id) => api.get(`/trips/${id}/viatico-status`),
};

// Checklists API
export const checklistsApi = {
  getAll: (params) => api.get('/checklists', { params }),
  create: (data) => api.post('/checklists', data),
  getTemplates: (params) => api.get('/checklist-templates', { params }),
  createTemplate: (data) => api.post('/checklist-templates', data),
  updateTemplate: (id, data) => api.put(`/checklist-templates/${id}`, data),
  getByTrip: (tripId) => api.get(`/checklists/trip/${tripId}`),
  start: (data) => api.post('/checklists/start', data),
  submit: (id, data) => api.post(`/checklists/${id}/submit`, data),
};

// Fuel API
export const fuelApi = {
  getVouchers: (params) => api.get('/fuel/vouchers', { params }),
  createVoucher: (data) => api.post('/fuel/vouchers', data),
  getLoads: (params) => api.get('/fuel/loads', { params }),
  createLoad: (data) => api.post('/fuel/loads', data),
  getConciliation: (params) => api.get('/fuel/conciliation', { params }),
  getKPIs: (params) => api.get('/fuel/kpis', { params }),
};

// Tires API
export const tiresApi = {
  getAll: (params) => api.get('/tires', { params }),
  getById: (id) => api.get(`/tires/${id}`),
  create: (data) => api.post('/tires', data),
  update: (id, data) => api.put(`/tires/${id}`, data),
  delete: (id) => api.delete(`/tires/${id}`),
  mount: (data) => api.post('/tires/mount', data),
  unmount: (id, data) => api.post(`/tires/${id}/unmount`, data),
  getByVehicle: (vehicleId) => api.get(`/tires/vehicle/${vehicleId}`),
  createInspection: (data) => api.post('/tires/inspect', data),
  getInspections: (tireId) => api.get(`/tires/${tireId}/inspections`),
  updateInspection: (inspectionId, data) => api.put(`/tires/inspections/${inspectionId}`, data),
  rotate: (data) => api.post('/tires/rotate', data),
  align: (data) => api.post('/tires/align', data),
  getRequiredReport: (params) => api.get('/tires/reports/required', { params }),
  getHistory: (tireId) => api.get(`/tires/${tireId}/history`),
  getDiagnostics: (vehicleId, params) => api.get(`/tires/vehicle/${vehicleId}/diagnostics`, { params }),
  retread: (id, data) => api.post(`/tires/${id}/retread`, data),
  regroove: (id, data) => api.post(`/tires/${id}/regroove`, data),
  scrap: (id, data) => api.post(`/tires/${id}/scrap`, data),
  scrapPile: (params) => api.get('/tires/reports/scrap-pile', { params }),
  getProjection: (id) => api.get(`/tires/${id}/projection`),
};

// Maintenance API
export const maintenanceApi = {
  getPlans: () => api.get('/maintenance/plans'),
  createPlan: (data) => api.post('/maintenance/plans', data),
  getWorkOrders: (params) => api.get('/maintenance/work-orders', { params }),
  createWorkOrder: (data) => api.post('/maintenance/work-orders', data),
  updateWorkOrder: (id, data) => api.put(`/maintenance/work-orders/${id}`, data),
  startWorkOrder: (id, data) => api.post(`/maintenance/work-orders/${id}/start`, data),
  completeWorkOrder: (id, data) => api.post(`/maintenance/work-orders/${id}/complete`, data),
  // Matrix plans (Excel-based like E MAX 540)
  getMatrixPlans: () => api.get('/maintenance/matrix-plans'),
  getMatrixPlan: (id) => api.get(`/maintenance/matrix-plans/${id}`),
  createMatrixPlan: (data) => api.post('/maintenance/matrix-plans', data),
  updateMatrixPlan: (id, data) => api.put(`/maintenance/matrix-plans/${id}`, data),
  deleteMatrixPlan: (id) => api.delete(`/maintenance/matrix-plans/${id}`),
  importMatrixPlanExcel: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/maintenance/matrix-plans/import-excel', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getStatus: (vehicleId) => api.get(`/vehicles/${vehicleId}/maintenance-status`),
};

// Settlement API
export const settlementsApi = {
  getAll: (params) => api.get('/settlements', { params }),
  getByTrip: (tripId) => api.get(`/trips/${tripId}/settlement`),
  createOrUpdate: (tripId, data) => api.post(`/trips/${tripId}/settlement`, data),
  close: (id, data) => api.post(`/settlements/${id}/close`, data),
};

// Inventory API
export const inventoryApi = {
  getItems: (params) => api.get('/inventory/items', { params }),
  createItem: (data) => api.post('/inventory/items', data),
  createMove: (data) => api.post('/inventory/moves', data),
  getKardex: (itemId) => api.get(`/inventory/kardex/${itemId}`),
};

// Suppliers API
export const suppliersApi = {
  getAll: () => api.get('/suppliers'),
  create: (data) => api.post('/suppliers', data),
};

// Issues API
export const issuesApi = {
  getAll: (params) => api.get('/issues', { params }),
  create: (data) => api.post('/issues', data),
  update: (id, data) => api.put(`/issues/${id}`, data),
};

// Notifications API (Web Push)
export const notificationsApi = {
  getVapidKey: () => api.get('/notifications/vapid-public-key'),
  subscribe: (sub) => api.post('/notifications/subscribe', sub),
};

// Reports API
export const reportsApi = {
  costPerKm: (params) => api.get('/reports/cost-per-km', { params }),
  documentsExpiring: (params) => api.get('/reports/documents-expiring', { params }),
  viaticos: (params) => api.get('/reports/viaticos', { params }),
};

// Detracciones API (SPOT - Sistema de Pago de Obligaciones Tributarias)
export const detraccionesApi = {
  getAll: (params) => api.get('/detracciones', { params }),
  getById: (id) => api.get(`/detracciones/${id}`),
  create: (data) => api.post('/detracciones', data),
  update: (id, data) => api.put(`/detracciones/${id}`, data),
  registerDeposit: (id, data) => api.post(`/detracciones/${id}/register-deposit`, data),
  delete: (id) => api.delete(`/detracciones/${id}`),
  fromFactura: (facturaId) => api.post(`/detracciones/from-factura/${facturaId}`),
  getSummary: (params) => api.get('/detracciones/summary', { params }),
};

// Cashbox API (Caja: movimientos, kardex y reportes por rubro)
export const cashboxApi = {
  getMovements: (params) => api.get('/cashbox/movements', { params }),
  createMovement: (data) => api.post('/cashbox/movements', data),
  updateMovement: (id, data) => api.put(`/cashbox/movements/${id}`, data),
  deleteMovement: (id) => api.delete(`/cashbox/movements/${id}`),
  getBalance: (params) => api.get('/cashbox/balance', { params }),
  getKardex: (params) => api.get('/cashbox/kardex', { params }),
  getReportByCategory: (params) => api.get('/cashbox/report-by-category', { params }),
};

// Proveedores (empresa propia o subcontratistas de flete)
export const proveedoresApi = {
  getAll: () => api.get('/proveedores'),
  getById: (id) => api.get(`/proveedores/${id}`),
  create: (data) => api.post('/proveedores', data),
  update: (id, data) => api.put(`/proveedores/${id}`, data),
  delete: (id) => api.delete(`/proveedores/${id}`),
};

// Tipos de carga (bolsa, tonelada, ...) — registro editable por empresa
export const tiposCargaApi = {
  getAll: () => api.get('/tipos-carga'),
  create: (data) => api.post('/tipos-carga', data),
  update: (id, data) => api.put(`/tipos-carga/${id}`, data),
};

// Liquidación de Flete — cabecera (proveedor + periodo + tipo de carga)
export const liquidacionesFleteApi = {
  getAll: (params) => api.get('/liquidaciones-flete', { params }),
  getById: (id) => api.get(`/liquidaciones-flete/${id}`),
  getLineas: (id) => api.get(`/liquidaciones-flete/${id}/lineas`),
  create: (data) => api.post('/liquidaciones-flete', data),
  update: (id, data) => api.put(`/liquidaciones-flete/${id}`, data),
  close: (id) => api.post(`/liquidaciones-flete/${id}/close`),
  delete: (id) => api.delete(`/liquidaciones-flete/${id}`),
};

// Liquidación de Flete — líneas (un viaje por línea) + documentos adjuntos
export const liquidacionLineasApi = {
  getById: (id) => api.get(`/liquidacion-lineas/${id}`),
  create: (liquidacionId, data) => api.post(`/liquidaciones-flete/${liquidacionId}/lineas`, data),
  update: (id, data) => api.put(`/liquidacion-lineas/${id}`, data),
  delete: (id) => api.delete(`/liquidacion-lineas/${id}`),
  attachDocumento: (id, data) => api.post(`/liquidacion-lineas/${id}/documento`, data),
};

// OCR generalizado (guía remitente, ticket UNACEM, vale/factura de combustible, vale de entrega)
export const documentosOcrApi = {
  extract: (data) => api.post('/documentos/ocr', data),
};

// Bandeja de documentos recibidos por el bot de WhatsApp, pendientes de asignar
export const whatsappPendientesApi = {
  getAll: (status = 'pendiente') => api.get('/whatsapp/pendientes', { params: { status } }),
  asignar: (id, data) => api.post(`/whatsapp/pendientes/${id}/asignar`, data),
};

// Dashboard API
export const dashboardApi = {
  getKPIs: () => api.get('/dashboard/kpis'),
  getRecentActivity: () => api.get('/dashboard/recent-activity'),
};

// Upload API
export const uploadApi = {
  upload: (file, entityType, entityId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
