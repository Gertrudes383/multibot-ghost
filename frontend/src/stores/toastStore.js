import { create } from 'zustand';

let _id = 0;

export const useToastStore = create((set) => ({
  toasts: [],

  addToast: ({ type = 'info', message, duration = 4000 }) => {
    const id = ++_id;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export function toast(message, type = 'info') {
  return useToastStore.getState().addToast({ type, message });
}

toast.success = (msg) => toast(msg, 'success');
toast.error = (msg) => toast(msg, 'error');
toast.warning = (msg) => toast(msg, 'warning');
toast.info = (msg) => toast(msg, 'info');
