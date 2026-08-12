import { forwardRef } from 'react';
import { cn } from '@utils/cn';

const InputField = forwardRef(function InputField(
  { label, error, className, id, type = 'text', ...props },
  ref,
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-[12px] font-medium text-[var(--mb-text-muted)]">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={cn(
          'w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] placeholder-[var(--mb-text-caption)]',
          'bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]',
          'outline-none transition-all duration-200',
          'focus:border-[var(--mb-accent-300)] focus:shadow-[var(--mb-shadow-focus)]',
          error && 'border-[var(--mb-error)]',
          className,
        )}
        {...props}
      />
      {error && (
        <p className="text-[11px] text-[var(--mb-error)]">{error}</p>
      )}
    </div>
  );
});

export default InputField;
