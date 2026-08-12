import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@utils/cn';

export default function Modal({ open, onClose, title, children, className }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-[rgba(1,4,13,0.8)] backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      <div
        className={cn(
          'relative w-full max-w-lg mx-4 border border-[var(--mb-border-mid)] bg-[var(--mb-surface-900)] shadow-[var(--mb-shadow-panel)]',
          'animate-[slideIn_0.2s_var(--mb-ease-standard)]',
          className,
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--mb-border-soft)]">
          <h3 className="text-[15px] font-semibold text-[var(--mb-text-primary)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--mb-text-caption)] hover:text-[var(--mb-text-primary)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
