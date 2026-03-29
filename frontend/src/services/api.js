// src/services/api.js
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('jwt');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login:    (identifier, password) => api.post('/auth/local', { identifier, password }),
  register: (username, email, password) => api.post('/auth/local/register', { username, email, password }),
  me:       () => api.get('/users/me'),
};

export const documentsAPI = {
  list:         ()            => api.get('/documents'),
  get:          (id)          => api.get(`/documents/${id}`),
  create:       (data)        => api.post('/documents', data),
  update:       (id, data)    => api.put(`/documents/${id}`, data),
  delete:       (id)          => api.delete(`/documents/${id}`),
  invite:       (id, data)    => api.post(`/documents/${id}/invite`, data),
  acceptInvite: (token)       => api.post(`/documents/accept-invite/${token}`),
  versions:     (id)          => api.get(`/documents/${id}/versions`),
  rollback:     (id, version) => api.post(`/documents/${id}/rollback`, { version }),
  parseFile:    (id)          => api.post(`/documents/${id}/parse-file`),
};

export const signaturesAPI = {
  create:         (data)       => api.post('/signatures', data),
  byDocument:     (documentId) => api.get(`/signatures/document/${documentId}`),
  // Update position/size of a placed signature
  updatePosition: (id, data)   => api.put(`/signatures/${id}/position`, data),
};

export const collaboratorsAPI = {
  byDocument: (documentId) => api.get('/collaborators', { params: { documentId } }),
  update:     (id, data)   => api.put(`/collaborators/${id}`, data),
  remove:     (id)         => api.delete(`/collaborators/${id}`),
};

export const auditAPI = {
  byDocument: (documentId) => api.get(`/audit-logs/document/${documentId}`),
};

export const uploadAPI = {
  upload: (formData) => axios.post(`${BASE_URL}/api/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${localStorage.getItem('jwt')}`,
    },
  }),
};

export default api;

