// src/store/authStore.js
import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  })(),
  jwt: localStorage.getItem('jwt') || null,
  isAuthenticated: !!localStorage.getItem('jwt'),

  setAuth: (user, jwt) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('jwt', jwt);
    set({ user, jwt, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('jwt');
    set({ user: null, jwt: null, isAuthenticated: false });
  },

  updateUser: (updates) =>
    set((state) => {
      const updated = { ...state.user, ...updates };
      localStorage.setItem('user', JSON.stringify(updated));
      return { user: updated };
    }),
}));

export default useAuthStore;
