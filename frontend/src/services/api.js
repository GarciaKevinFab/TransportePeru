import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });
          
          const { access_token, refresh_token: newRefresh } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', newRefresh);
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
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

// Company API
export const companyApi = {
  getCurrent: () => api.get('/company'),
  getAll: () => api.get('/companies'),
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
};

// Couplings API
export const couplingsApi = {
  getAll: (params) => api.get('/couplings', { params }),
  create: (data) => api.post('/couplings', data),
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

// Blocks API
export const blocksApi = {
  getAll: (params) => api.get('/blocks', { params }),
  resolve: (id, data) => api.post(`/blocks/${id}/resolve`, data),
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
};

// Checklists API
export const checklistsApi = {
  getAll: (params) => api.get('/checklists', { params }),
  create: (data) => api.post('/checklists', data),
};

// Fuel API
export const fuelApi = {
  getVouchers: (params) => api.get('/fuel/vouchers', { params }),
  createVoucher: (data) => api.post('/fuel/vouchers', data),
  getLoads: (params) => api.get('/fuel/loads', { params }),
  createLoad: (data) => api.post('/fuel/loads', data),
};

// Tires API
export const tiresApi = {
  getAll: (params) => api.get('/tires', { params }),
  getById: (id) => api.get(`/tires/${id}`),
  create: (data) => api.post('/tires', data),
  mount: (data) => api.post('/tires/mount', data),
  unmount: (id, data) => api.post(`/tires/${id}/unmount`, data),
  getByVehicle: (vehicleId) => api.get(`/tires/vehicle/${vehicleId}`),
  createInspection: (data) => api.post('/tires/inspect', data),
  getInspections: (tireId) => api.get(`/tires/${tireId}/inspections`),
};

// Maintenance API
export const maintenanceApi = {
  getPlans: () => api.get('/maintenance/plans'),
  createPlan: (data) => api.post('/maintenance/plans', data),
  getWorkOrders: (params) => api.get('/maintenance/work-orders', { params }),
  createWorkOrder: (data) => api.post('/maintenance/work-orders', data),
  updateWorkOrder: (id, data) => api.put(`/maintenance/work-orders/${id}`, data),
};

// Issues API
export const issuesApi = {
  getAll: (params) => api.get('/issues', { params }),
  create: (data) => api.post('/issues', data),
  update: (id, data) => api.put(`/issues/${id}`, data),
};

// Dashboard API
export const dashboardApi = {
  getKPIs: () => api.get('/dashboard/kpis'),
  getRecentActivity: () => api.get('/dashboard/recent-activity'),
};

// Seed API
export const seedApi = {
  seed: () => api.post('/seed'),
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
