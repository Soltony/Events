
'use client';

import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: '/', // All requests will go to the Next.js server
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // ✅ Include cookies with every request
});

export const setAuthToken = (token: string | null) => {
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }
};

// Add a request interceptor to automatically include the CSRF token.
api.interceptors.request.use(config => {
  const method = config.method?.toUpperCase();
   // Only attach the CSRF token for state-changing methods.
  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const csrfToken = Cookies.get('csrf_token'); // Read the client-readable CSRF token
    if (csrfToken) {
      console.log('[API Interceptor] Attaching CSRF Token to header:', csrfToken);
      config.headers['X-CSRF-Token'] = csrfToken;
    } else {
      console.warn('[API Interceptor] CSRF token cookie not found.');
    }
  }
  return config;
});

export default api;
