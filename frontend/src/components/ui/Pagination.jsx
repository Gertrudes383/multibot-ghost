import { ChevronLeft, ChevronRight } from 'lucide-react';
import ActionButton from './ActionButton';

export default function Pagination({ page, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-[12px] text-[var(--mb-text-caption)]">
        Pagina {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <ActionButton variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Anterior
        </ActionButton>
        <ActionButton variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Proximo <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </ActionButton>
      </div>
    </div>
  );
}
