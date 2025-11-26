
'use client';

import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: '/', // All requests will go to the Next.js server
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Include cookies with every request
});

export const setAuthToken = (token: string | null) => {
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }
};

// Add a request interceptor to automatically include required tokens.
api.interceptors.request.use(config => {
  // CSRF token for state-changing methods.
  const method = config.method?.toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const csrfToken = Cookies.get('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    } else {
      console.warn('[API Interceptor] CSRF token cookie not found for state-changing request.');
    }
  }
  
  return config;
});

export default api;
