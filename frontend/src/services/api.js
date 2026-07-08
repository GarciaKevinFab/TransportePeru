import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const clearAuthToken = () => {
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

// Auth API
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  refresh: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
  getMe: () => api.get('/auth/me'),
};

// Users API
export const usersApi = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  resetPin: (id, pin) => api.post(`/users/${id}/reset-pin`, { pin }),
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
