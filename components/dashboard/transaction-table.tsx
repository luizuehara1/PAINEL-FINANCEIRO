"use client";

import React, { useState } from "react";
import { Edit2, Trash2, Search, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Transaction } from "@/types/finance";
import NoteViewerModal from "./note-viewer-modal";

interface TransactionTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

export default function TransactionTable({ transactions, onEdit, onDelete }: TransactionTableProps) {
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"todos" | "entrada" | "saida">("todos");
  const [selectedNote, setSelectedNote] = useState<{ url: string; tipo: string; nome: string } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Search debounce
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(inputValue);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [inputValue]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.descricao.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === "todos" || t.tipo === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, typeFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const displayedTransactions = React.useMemo(() => {
    return filteredTransactions.slice(
      (activePage - 1) * pageSize,
      activePage * pageSize
    );
  }, [filteredTransactions, activePage, pageSize]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6">
      
      {/* Top green glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/30 to-transparent" />

      {/* Header and filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-semibold text-white tracking-wide">
            Entradas & Saídas Recentes
          </h3>
          <p className="text-zinc-500 text-xs mt-0.5">
            Lista de fluxos monetários registrados na plataforma
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Pesquisar..."
              className="bg-zinc-950 border border-zinc-800 focus:border-emerald-500/50 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 outline-none transition-all w-full sm:w-48"
            />
          </div>

          {/* Type Filter */}
          <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-0.5">
            <button
              onClick={() => { setTypeFilter("todos"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                typeFilter === "todos" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => { setTypeFilter("entrada"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                typeFilter === "entrada" ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Entradas
            </button>
            <button
              onClick={() => { setTypeFilter("saida"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                typeFilter === "saida" ? "bg-red-500/10 text-red-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Saídas
            </button>
          </div>
        </div>
      </div>

      {/* Table container with horizontal scroll support */}
      <div className="overflow-x-auto">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/30">
            <p className="text-zinc-400 text-sm">Nenhuma transação encontrada.</p>
            <p className="text-zinc-600 text-xs mt-1">Experimente mudar o filtro ou cadastrar uma nova entrada/saída.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-[11px] font-semibold tracking-wider uppercase">
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Nota</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4">Criado por</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {displayedTransactions.map((t) => (
                <tr 
                  key={t.id} 
                  className="hover:bg-white/[0.02] text-xs text-zinc-300 transition-colors"
                >
                  {/* Data */}
                  <td className="py-3.5 px-4 font-mono text-zinc-400 whitespace-nowrap">
                    {formatDate(t.data)}
                  </td>
                  
                  {/* Tipo */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {t.tipo === "entrada" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ArrowUpRight className="w-3 h-3" />
                        Entrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                        <ArrowDownRight className="w-3 h-3" />
                        Saída
                      </span>
                    )}
                  </td>

                  {/* Nome */}
                  <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t.nome}</span>
                      {t.origem === "despesa" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 uppercase font-mono">
                          Automático
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Categoria */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="px-2 py-1 rounded-lg bg-zinc-950 border border-white/5 text-zinc-400">
                      {t.categoria}
                    </span>
                  </td>

                  {/* Forma Pagamento */}
                  <td className="py-3.5 px-4 text-zinc-400 whitespace-nowrap">
                    {t.formaPagamento}
                  </td>

                  {/* Valor */}
                  <td className={`py-3.5 px-4 font-bold font-mono whitespace-nowrap ${
                    t.tipo === "entrada" ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {t.tipo === "entrada" ? "+" : "-"} {formatCurrency(Math.abs(t.valor || 0))}
                  </td>

                  {/* Nota */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {t.notaUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNote({ url: t.notaUrl!, tipo: t.notaTipo || "", nome: t.notaNome || "" });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-white transition-all cursor-pointer"
                      >
                        Ver Nota
                      </button>
                    ) : (
                      <span className="text-zinc-600 text-xs font-mono">Sem nota</span>
                    )}
                  </td>

                  {/* Origem */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {t.origem === "despesa" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Despesa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-white/5">
                        Manual
                      </span>
                    )}
                  </td>

                  {/* Criado por */}
                  <td className="py-3.5 px-4 text-zinc-500 max-w-[150px] truncate" title={t.criadoPorEmail}>
                    {t.criadoPorEmail ? t.criadoPorEmail.split("@")[0] : "-"}
                  </td>

                  {/* Ações */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(t)}
                        className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(t.id);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-950 hover:bg-red-950/40 border border-white/5 hover:border-red-500/20 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination & Footer Info */}
      <div className="mt-4 pt-4 border-t border-zinc-800/40 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-zinc-500">
        <div className="flex items-center gap-2">
          <span>Mostrar</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-400 outline-none focus:border-emerald-500/30"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>por página</span>
          <span className="ml-2 text-zinc-800">|</span>
          <span>
            Mostrando {filteredTransactions.length === 0 ? 0 : (activePage - 1) * pageSize + 1} - {Math.min(activePage * pageSize, filteredTransactions.length)} de {filteredTransactions.length} registros
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={activePage === 1}
            className="px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400 transition-all cursor-pointer"
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 text-zinc-400 font-mono">
            Pág. {activePage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={activePage === totalPages}
            className="px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400 transition-all cursor-pointer"
          >
            Próxima
          </button>
        </div>
      </div>

      {/* Note Viewer Modal */}
      <NoteViewerModal
        isOpen={!!selectedNote}
        onClose={() => setSelectedNote(null)}
        notaUrl={selectedNote?.url}
        notaTipo={selectedNote?.tipo}
        notaNome={selectedNote?.nome}
      />

    </div>
  );
}
