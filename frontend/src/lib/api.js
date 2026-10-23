import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 20000,
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401 && !err.config?.url?.startsWith('/auth/')) onUnauthorized();
    return Promise.reject(err);
  },
);

export function errorMessage(err, fallback = 'Something went wrong. Please try again') {
  if (!err?.response) return 'Cannot reach the server. Check that the API is running';
  return err.response.data?.error || fallback;
}

export const fieldErrors = (err) => err?.response?.data?.fields || {};
