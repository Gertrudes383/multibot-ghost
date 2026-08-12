import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'Nenhum resultado', description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-10 h-10 text-[var(--mb-text-caption)] mb-3" />
      <p className="text-[14px] font-medium text-[var(--mb-text-muted)]">{title}</p>
      {description && (
        <p className="text-[12px] text-[var(--mb-text-caption)] mt-1 max-w-xs">{description}</p>
      )}
    </div>
  );
}
