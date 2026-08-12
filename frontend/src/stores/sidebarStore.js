import { create } from 'zustand';

export const useSidebarStore = create((set) => ({
  isCollapsed: false,
  isMobileOpen: false,

  toggleCollapsed: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
  setCollapsed: (v) => set({ isCollapsed: v }),

  openMobile: () => set({ isMobileOpen: true }),
  closeMobile: () => set({ isMobileOpen: false }),
  toggleMobile: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),
}));
