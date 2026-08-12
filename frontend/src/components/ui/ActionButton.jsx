import { cn } from '@utils/cn';

const VARIANTS = {
  primary: 'bg-[var(--mb-accent-500)] text-white hover:bg-[var(--mb-accent-400)] active:bg-[var(--mb-accent-600)]',
  accent: 'bg-[var(--mb-accent-300)] text-[var(--mb-bg-950)] hover:bg-[var(--mb-accent-400)]',
  ghost: 'text-[var(--mb-text-muted)] hover:bg-[rgba(53,197,255,0.08)] hover:text-[var(--mb-text-primary)]',
  danger: 'bg-[rgba(255,157,168,0.12)] text-[var(--mb-error)] hover:bg-[rgba(255,157,168,0.2)]',
  outline: 'border border-[var(--mb-border-mid)] text-[var(--mb-text-secondary)] hover:border-[var(--mb-accent-300)] hover:text-[var(--mb-accent-300)]',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-[12px]',
  md: 'px-4 py-2 text-[13px]',
  lg: 'px-5 py-2.5 text-[14px]',
};

export default function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  loading,
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
}
