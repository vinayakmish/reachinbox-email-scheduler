import axios, { AxiosError } from 'axios';
import { ApiResponse, User, Sender, EmailCampaign, EmailJob, PaginatedResult } from '../types';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      // Redirect to login on auth failure (unless we're already on login)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiResponse>;
    return axiosError.response?.data?.error || axiosError.message || 'An error occurred';
  }
  if (error instanceof Error) return error.message;
  return 'An unknown error occurred';
}

// Auth
export const authApi = {
  me: () => api.get<ApiResponse<User>>('/auth/me'),
  logout: () => api.post<ApiResponse>('/auth/logout'),
  loginWithGoogle: () => { window.location.href = '/api/auth/google'; },
};

// Senders
export const senderApi = {
  list: () => api.get<ApiResponse<Sender[]>>('/senders'),
  create: (displayName: string) =>
    api.post<ApiResponse<Sender>>('/senders', { displayName }),
};

// Campaigns
export const campaignApi = {
  list: () => api.get<ApiResponse<EmailCampaign[]>>('/campaigns'),
  get: (id: string) => api.get<ApiResponse<EmailCampaign>>(`/campaigns/${id}`),
  create: (formData: FormData) =>
    api.post<ApiResponse<{ campaign: EmailCampaign; recipientsSummary: { valid: number; invalid: number; duplicatesRemoved: number } }>>('/campaigns', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  cancel: (id: string) => api.post<ApiResponse<EmailCampaign>>(`/campaigns/${id}/cancel`),
};

// Email Jobs
export const emailApi = {
  scheduled: (page = 1, limit = 20) =>
    api.get<ApiResponse<PaginatedResult<EmailJob>>>(`/emails/scheduled?page=${page}&limit=${limit}`),
  sent: (page = 1, limit = 20) =>
    api.get<ApiResponse<PaginatedResult<EmailJob>>>(`/emails/sent?page=${page}&limit=${limit}`),
  getById: (id: string) =>
    api.get<ApiResponse<EmailJob>>(`/emails/${id}`),
};

export default api;
