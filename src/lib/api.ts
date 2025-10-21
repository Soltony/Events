
'use client';

import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: '/', // All requests will go to the Next.js server
  headers: { 'Content-Type': 'application/json' },
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
  const isApiRequest = config.url?.startsWith('/api/');
  const isAuthRequest = config.url?.startsWith('/api/auth/');

  // Only attach the CSRF token for state-changing API requests that are NOT auth requests.
  if (isApiRequest && !isAuthRequest && (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH')) {
    const csrfToken = Cookies.get('csrf_token'); // Read the client-readable CSRF token
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

export default api;
