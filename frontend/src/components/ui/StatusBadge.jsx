import { cn } from '@utils/cn';

const PRESETS = {
  active: 'bg-[rgba(92,236,174,0.12)] text-[var(--mb-success)]',
  inactive: 'bg-[rgba(111,141,184,0.12)] text-[var(--mb-text-caption)]',
  pending: 'bg-[rgba(255,211,119,0.12)] text-[var(--mb-warning)]',
  error: 'bg-[rgba(255,157,168,0.12)] text-[var(--mb-error)]',
  info: 'bg-[rgba(104,202,255,0.12)] text-[var(--mb-info)]',
};

export default function StatusBadge({ status, label, className }) {
  return (
    <span className={cn('inline-flex px-2 py-0.5 text-[11px] font-medium', PRESETS[status] || PRESETS.info, className)}>
      {label || status}
    </span>
  );
}
