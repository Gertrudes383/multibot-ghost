import Surface from './Surface';

export default function StatCard({ title, value, icon: Icon, accent = 'var(--mb-accent-300)' }) {
  return (
    <Surface className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium text-[var(--mb-text-muted)]">{title}</span>
        {Icon && <Icon className="w-4 h-4" style={{ color: accent }} />}
      </div>
      <p className="text-xl font-bold text-[var(--mb-text-primary)]">{value}</p>
    </Surface>
  );
}
