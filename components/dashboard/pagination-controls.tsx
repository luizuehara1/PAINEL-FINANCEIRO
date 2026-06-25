import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  id?: string;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  totalItems: number;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  id,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalItems,
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      id={id || "pagination-controls"}
      className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-zinc-800 bg-zinc-950/20 text-xs text-zinc-400"
    >
      <div className="flex items-center gap-2">
        <span>Mostrar</span>
        <select
          id={`${id || "pagination"}-size-select`}
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
          }}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
        <span>por página</span>
        <span className="ml-2 text-zinc-500">
          (Exibindo {startItem}-{endItem} de {totalItems})
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          id={`${id || "pagination"}-prev-btn`}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-200">
          Página <strong>{currentPage}</strong> de <strong>{totalPages || 1}</strong>
        </span>
        <button
          id={`${id || "pagination"}-next-btn`}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PaginationControls;
