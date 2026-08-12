import { cn } from '@utils/cn';

export default function Surface({ children, className, as: Tag = 'div', ...props }) {
  return (
    <Tag
      className={cn(
        'relative border border-[var(--mb-border-soft)] bg-[var(--mb-surface-900)] shadow-[var(--mb-shadow-card)]',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
