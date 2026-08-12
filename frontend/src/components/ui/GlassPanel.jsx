import { cn } from '@utils/cn';

export default function GlassPanel({ children, className, as: Tag = 'div', ...props }) {
  return (
    <Tag
      className={cn(
        'relative overflow-hidden border border-[var(--mb-border-mid)] bg-[rgba(6,17,42,0.72)] backdrop-blur-md shadow-[var(--mb-shadow-panel)]',
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_80%_at_0%_0%,rgba(53,197,255,0.08),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(194,230,255,0.2),transparent)]" />
      <div className="relative">{children}</div>
    </Tag>
  );
}
