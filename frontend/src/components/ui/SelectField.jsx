import { forwardRef } from 'react';
import { cn } from '@utils/cn';

const SelectField = forwardRef(function SelectField(
  { label, error, options = [], className, id, placeholder, ...props },
  ref,
) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-[12px] font-medium text-[var(--mb-text-muted)]">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)]',
          'bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]',
          'outline-none transition-all duration-200',
          'focus:border-[var(--mb-accent-300)] focus:shadow-[var(--mb-shadow-focus)]',
          error && 'border-[var(--mb-error)]',
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-[11px] text-[var(--mb-error)]">{error}</p>}
    </div>
  );
});

export default SelectField;
