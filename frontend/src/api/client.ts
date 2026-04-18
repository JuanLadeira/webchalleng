import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export interface Room {
  id: string;
  name: string;
  capacity: number;
  location: string;
  description: string | null;
  is_active: boolean;
}

export interface Participant {
  id: string;
  email: string;
  name: string;
}

export interface Booking {
  id: string;
  title: string;
  room_id: string;
  user_id: string;
  start_at: string;
  end_at: string;
  status: string;
  participants: Participant[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// Auth
export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return api.post<LoginResponse>("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
  register: (name: string, email: string, password: string) =>
    api.post<User>("/auth/register", { name, email, password }),
  me: () => api.get<User>("/auth/me"),
};

// Rooms
export const roomsApi = {
  list: (activeOnly = true) =>
    api.get<Room[]>("/rooms", { params: { active_only: activeOnly } }),
  get: (id: string) => api.get<Room>(`/rooms/${id}`),
  create: (data: Omit<Room, "id" | "is_active">) =>
    api.post<Room>("/rooms", { ...data, is_active: true }),
  update: (id: string, data: Partial<Omit<Room, "id">>) =>
    api.patch<Room>(`/rooms/${id}`, data),
  getBookings: (roomId: string) =>
    api.get<Booking[]>(`/rooms/${roomId}/bookings`),
};

// Bookings
export const bookingsApi = {
  listMine: () => api.get<Booking[]>("/bookings"),
  get: (id: string) => api.get<Booking>(`/bookings/${id}`),
  create: (data: {
    title: string;
    start_at: string;
    end_at: string;
    participant_emails?: string[];
    recurrence?: "none" | "daily" | "weekly";
    recurrence_count?: number;
  }) => api.post<Booking>("/bookings", data),
  update: (id: string, data: {
    title?: string;
    start_at?: string;
    end_at?: string;
    participant_emails?: string[];
  }) => api.patch<Booking>(`/bookings/${id}`, data),
  cancel: (id: string) => api.delete<Booking>(`/bookings/${id}`),
};

// Admin
export const adminApi = {
  listUsers: () => api.get<User[]>("/admin/users"),
  toggleRole: (userId: string) => api.patch<User>(`/admin/users/${userId}/role`),
};
