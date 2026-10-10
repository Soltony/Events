

'use client';

import axios from 'axios';
import { CSRF_HEADER, ensureCsrfToken, refreshCsrfToken } from '@/lib/csrf-client';

const api = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // This is crucial for sending cookies with requests
});

// No longer need to set auth token manually
export const setAuthToken = (token: string | null) => {
    // This function is now a no-op as tokens are handled by HttpOnly cookies.
};

api.interceptors.request.use(async config => {
  // Every method: the middleware also checks scripted reads made with a session cookie.
  const csrfToken = await ensureCsrfToken().catch(() => '');
  if (csrfToken) {
    config.headers[CSRF_HEADER] = csrfToken;
  } else {
    console.warn('[API Interceptor] CSRF token not available.');
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});


let refreshInFlight: Promise<void> | null = null;

/**
 * Exchanges the refresh token for a new access token. Concurrent callers share one request:
 * refresh tokens are single-use, and presenting a rotated one again is treated as theft and
 * revokes the session.
 */
export function refreshSession(): Promise<void> {
  refreshInFlight ??= api.post('/api/auth/refresh').then(() => undefined).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

// Add a response interceptor to handle token refresh logic
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // A stale in-memory token (e.g. the csrf_secret cookie was cleared): fetch the
    // current one and retry once.
    if (error.response?.status === 403 && error.response?.data?.message === 'Invalid CSRF token.' && originalRequest && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      const csrfToken = await refreshCsrfToken().catch(() => '');
      if (csrfToken) {
        originalRequest.headers[CSRF_HEADER] = csrfToken;
        return api(originalRequest);
      }
    }
    
    // Check if the error is 401, not a retry, and NOT the refresh or login endpoint
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/api/auth/refresh' && originalRequest.url !== '/api/auth/login') {
      originalRequest._retry = true;
      
      try {
        await refreshSession();

        // The /api/auth/refresh endpoint now sets the new access token cookie itself.
        // We can just retry the original request.
        return api(originalRequest);

      } catch (refreshError) {
        // If refresh fails, we should log the user out.
        // This will be caught by the AuthGuard or page logic.
        console.warn("Session refresh failed. User should be logged out.");
        // Important: Use a different error to avoid re-triggering the interceptor
        return Promise.reject(new Error("Session refresh failed"));
      }
    }
    
    return Promise.reject(error);
  }
);


export default api;
