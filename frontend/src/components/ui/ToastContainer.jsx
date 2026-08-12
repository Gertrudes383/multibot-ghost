import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useToastStore } from '@stores/toastStore';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: 'border-[var(--mb-success)] text-[var(--mb-success)]',
  error: 'border-[var(--mb-error)] text-[var(--mb-error)]',
  warning: 'border-[var(--mb-warning)] text-[var(--mb-warning)]',
  info: 'border-[var(--mb-info)] text-[var(--mb-info)]',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 border-l-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] shadow-[var(--mb-shadow-card)] animate-[slideIn_0.2s_var(--mb-ease-standard)] ${COLORS[t.type]}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="flex-1 text-[13px] text-[var(--mb-text-primary)]">{t.message}</p>
            <button onClick={() => removeToast(t.id)} className="shrink-0 text-[var(--mb-text-caption)] hover:text-[var(--mb-text-primary)]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
