import Surface from './Surface';
import EmptyState from './EmptyState';
import Spinner from './Spinner';

export default function DataTable({ columns, data, isLoading, emptyTitle, emptyDescription, onRowClick }) {
  return (
    <Surface className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--mb-border-soft)] bg-[rgba(6,17,42,0.5)]">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]" style={col.width ? { width: col.width } : undefined}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <div className="flex justify-center"><Spinner /></div>
                </td>
              </tr>
            ) : !data?.length ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={row._id || row.id || i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-[var(--mb-border-soft)] last:border-0 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-[rgba(53,197,255,0.04)]' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-[var(--mb-text-secondary)]">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}
