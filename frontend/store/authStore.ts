import { create } from 'zustand';

export interface StaffUser {
  id: string;
  vendorId: string;
  fullName: string;
  email: string;
  role: 'owner' | 'assistant';
  isActive: boolean;
}

interface AuthState {
  user: StaffUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: StaffUser, token: string) => void;
  clearAuth: () => void;
  setLoading: (isLoading: boolean) => void;
}

// Enforcing the curried syntax ()() resolves all implicit type errors
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, 

  setAuth: (user, token) => set({
    user,
    token,
    isAuthenticated: true,
    isLoading: false,
  }),

  clearAuth: () => set({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  }),

  setLoading: (isLoading) => set({ isLoading }),
}));