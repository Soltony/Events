
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
  // 1. Attach the Authorization token (SuperApp token or our JWT)
  const authToken = Cookies.get('auth_token');
  if (authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
  } else {
      console.warn('[API Interceptor] Auth token cookie not found.');
  }

  // 2. Attach the CSRF token for state-changing methods.
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
