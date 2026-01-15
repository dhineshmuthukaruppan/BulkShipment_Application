import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? 'https://bulk-shipping-backend.onrender.com/api' : 'http://localhost:8000/api');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Base delay in ms

// Exponential backoff delay calculation
const getRetryDelay = (attempt: number): number => {
  return RETRY_DELAY * Math.pow(2, attempt);
};

// Check if error is retryable
const isRetryableError = (error: AxiosError): boolean => {
  if (!error.response) {
    // Network error - always retry
    return true;
  }
  
  const status = error.response.status;
  // Retry on 5xx errors and 429 (rate limit)
  return status >= 500 || status === 429;
};

// Retry interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as AxiosRequestConfig & { __retryCount?: number };
    
    if (!config || !isRetryableError(error)) {
      return Promise.reject(error);
    }

    config.__retryCount = config.__retryCount || 0;

    if (config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }

    config.__retryCount += 1;
    const delay = getRetryDelay(config.__retryCount - 1);

    await new Promise((resolve) => setTimeout(resolve, delay));

    return api(config);
  }
);

export default api;
