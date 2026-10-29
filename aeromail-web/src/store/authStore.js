import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set, get) => ({
    token: null,
    email: null,
    setAuth: (token, email) => set({ token, email }),
    clearAuth: () => set({ token: null, email: null }),
    isAuthenticated: () => get().token !== null,
}), {
    name: 'aeromail-auth',
}));
