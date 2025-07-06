
'use client';

import axios from 'axios';

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

export default api;
