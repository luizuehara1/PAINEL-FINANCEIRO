"use client";

import React, { useState } from "react";
import { 
  Edit2, 
  Trash2, 
  Search, 
  AlertTriangle, 
  Clock, 
  Check,
  X,
  HelpCircle,
  RefreshCw,
  Ban
} from "lucide-react";
import { Expense } from "@/types/finance";
import { motion, AnimatePresence } from "framer-motion";
import NoteViewerModal from "./note-viewer-modal";

interface ExpenseTableProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onConfirmPaid: (id: string) => void;
  onCloseRecurring: (id: string, motivo: string) => void;
}

export default function ExpenseTable({ 
  expenses, 
  onEdit, 
  onDelete, 
  onConfirmPaid,
  onCloseRecurring
}: ExpenseTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"todas" | "fixa" | "variavel">("todas");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pago" | "pendente" | "vencido" | "baixada">("todos");
  const [selectedNote, setSelectedNote] = useState<{ url: string; tipo: string; nome: string } | null>(null);

  // State for "Baixar completamente" modal
  const [baixarModalOpen, setBaixarModalOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState("");
  const [motivoBaixa, setMotivoBaixa] = useState("");

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

  const todayStr = new Date().toISOString().split("T")[0];

  const getStatusDetails = (expense: Expense) => {
    if (expense.baixadaCompletamente) {
      return {
        label: "Baixada",
        bgClass: "bg-zinc-800 text-zinc-400 border-zinc-700/50",
        indicatorColor: "bg-zinc-600",
        rowClass: "bg-zinc-950/20 text-zinc-500 border-l-[3px] border-zinc-800 opacity-60",
      };
    }

    if (expense.status === "pago") {
      return {
        label: "Pago",
        bgClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        indicatorColor: "bg-emerald-400",
        rowClass: "text-zinc-300 hover:bg-emerald-500/[0.01] border-l-[3px] border-emerald-500/10",
      };
    }

    // Pendente types
    if (expense.tipo === "fixa") {
      if (expense.dataVencimento < todayStr) {
        return {
          label: "Vencido",
          bgClass: "bg-red-500/10 text-red-400 border-red-500/20",
          indicatorColor: "bg-red-400",
          rowClass: "text-red-300/90 bg-red-950/[0.03] hover:bg-red-950/[0.06] border-l-[3px] border-red-500/40",
        };
      } else if (expense.dataVencimento === todayStr) {
        return {
          label: "Vence Hoje",
          bgClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          indicatorColor: "bg-amber-400",
          rowClass: "text-amber-200/90 bg-amber-950/[0.03] hover:bg-amber-950/[0.06] border-l-[3px] border-amber-500/40",
        };
      }
    }

    return {
      label: "Pendente",
      bgClass: "bg-zinc-800 text-zinc-400 border-zinc-700",
      indicatorColor: "bg-zinc-500",
      rowClass: "text-zinc-300 hover:bg-zinc-800/[0.01] border-l-[3px] border-zinc-700",
    };
  };

  const handleOpenBaixarModal = (id: string) => {
    setSelectedExpenseId(id);
    setMotivoBaixa("");
    setBaixarModalOpen(true);
  };

  const handleConfirmBaixar = () => {
    if (onCloseRecurring && selectedExpenseId) {
      onCloseRecurring(selectedExpenseId, motivoBaixa);
    }
    setBaixarModalOpen(false);
  };

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.descricao || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "todas" || e.tipo === typeFilter;

    let matchesStatus = true;
    if (statusFilter === "pago") {
      matchesStatus = e.status === "pago" && !e.baixadaCompletamente;
    } else if (statusFilter === "pendente") {
      matchesStatus = e.status === "pendente" && !e.baixadaCompletamente && (e.tipo !== "fixa" || e.dataVencimento >= todayStr);
    } else if (statusFilter === "vencido") {
      matchesStatus = e.status === "pendente" && !e.baixadaCompletamente && e.tipo === "fixa" && e.dataVencimento < todayStr;
    } else if (statusFilter === "baixada") {
      matchesStatus = !!e.baixadaCompletamente;
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6">
      
      {/* Top green glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/30 to-transparent" />

      {/* Header and filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-semibold text-white tracking-wide">
            Registro Geral de Despesas
          </h3>
          <p className="text-zinc-500 text-xs mt-0.5">
            Gerenciamento de custos fixos recorrentes e gastos variáveis avulsos
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar despesas..."
              className="bg-zinc-950 border border-zinc-800 focus:border-emerald-500/50 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 outline-none transition-all w-full sm:w-48"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 outline-none transition-all cursor-pointer focus:border-emerald-500/50"
          >
            <option value="todas">Todas as Despesas</option>
            <option value="fixa">Apenas Fixas</option>
            <option value="variavel">Apenas Variáveis</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 outline-none transition-all cursor-pointer focus:border-emerald-500/50"
          >
            <option value="todos">Todos os Status</option>
            <option value="pago">Pagas / Liquidadas</option>
            <option value="pendente">Pendentes</option>
            <option value="vencido">Vencidas</option>
            <option value="baixada">Baixadas / Encerradas</option>
          </select>
        </div>
      </div>

      {/* Table Container with horizontal scroll support */}
      <div className="overflow-x-auto">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/30">
            <p className="text-zinc-400 text-sm">Nenhuma despesa localizada.</p>
            <p className="text-zinc-600 text-xs mt-1">Experimente mudar os filtros ou adicione um novo registro corporativo.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-[11px] font-semibold tracking-wider uppercase">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Vencimento / Data</th>
                <th className="py-3 px-4">Competência</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Recorrência</th>
                <th className="py-3 px-4">Nota</th>
                <th className="py-3 px-4">Forma de pagamento</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredExpenses.map((e) => {
                const statusDetails = getStatusDetails(e);
                const isFixed = e.tipo === "fixa";
                const dateToShow = isFixed ? e.dataVencimento : e.data;
                const competence = e.competencia || (isFixed && dateToShow ? dateToShow.substring(0, 7) : "-");

                return (
                  <tr 
                    key={e.id} 
                    className={`hover:bg-white/[0.015] text-xs transition-colors ${statusDetails.rowClass}`}
                  >
                    {/* Nome */}
                    <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">
                      <div>
                        <span>{e.nome}</span>
                        {e.baixadaCompletamente && e.motivoBaixa && (
                          <p className="text-[10px] text-zinc-500 font-normal italic mt-0.5">
                            Motivo baixa: {e.motivoBaixa}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Valor */}
                    <td className="py-3.5 px-4 font-bold font-mono text-zinc-100 whitespace-nowrap">
                      {formatCurrency(e.valor)}
                    </td>

                    {/* Date / Vencimento */}
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap flex items-center gap-1.5 mt-0.5">
                      {isFixed && !e.baixadaCompletamente && e.status === "pendente" && e.dataVencimento < todayStr ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      ) : isFixed && !e.baixadaCompletamente && e.status === "pendente" && e.dataVencimento === todayStr ? (
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : null}
                      <span>{formatDate(dateToShow)}</span>
                    </td>

                    {/* Competência */}
                    <td className="py-3.5 px-4 font-mono text-zinc-400 whitespace-nowrap">
                      {competence}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusDetails.bgClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDetails.indicatorColor}`} />
                        {statusDetails.label}
                      </span>
                    </td>

                    {/* Recorrência */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isFixed ? (
                        e.baixadaCompletamente ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50 text-[10px] font-medium">
                            Baixada
                          </span>
                        ) : e.recorrente ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                            Recorrente
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-white/5 text-[10px] font-medium">
                            Única
                          </span>
                        )
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>

                    {/* Nota */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {e.notaUrl ? (
                        <button
                          type="button"
                          onClick={(eBtn) => {
                            eBtn.stopPropagation();
                            setSelectedNote({ url: e.notaUrl!, tipo: e.notaTipo || "", nome: e.notaNome || "" });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-white transition-all cursor-pointer"
                        >
                          Ver Nota
                        </button>
                      ) : (
                        <span className="text-zinc-600 text-xs font-mono">Sem nota</span>
                      )}
                    </td>

                    {/* Forma Pagamento */}
                    <td className="py-3.5 px-4 text-zinc-400 whitespace-nowrap">
                      {e.formaPagamento}
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Confirmar pago */}
                        {e.status === "pendente" && !e.baixadaCompletamente && (
                          <button
                            type="button"
                            onClick={(eBtn) => {
                              eBtn.stopPropagation();
                              onConfirmPaid(e.id);
                            }}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/20 hover:border-emerald-400 transition-all cursor-pointer"
                            title="Confirmar pagamento"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        )}

                        {/* Baixar completamente (only for active recurring fixed) */}
                        {isFixed && e.recorrente && !e.baixadaCompletamente && (
                          <button
                            type="button"
                            onClick={(eBtn) => {
                              eBtn.stopPropagation();
                              handleOpenBaixarModal(e.id);
                            }}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-black border border-red-500/20 hover:border-red-400 transition-all cursor-pointer"
                            title="Baixar completamente"
                          >
                            <Ban className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        )}

                        {/* Editar */}
                        <button
                          type="button"
                          onClick={(eBtn) => {
                            eBtn.stopPropagation();
                            onEdit(e);
                          }}
                          className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Excluir */}
                        <button
                          type="button"
                          onClick={(eBtn) => {
                            eBtn.stopPropagation();
                            onDelete(e.id);
                          }}
                          className="p-1.5 rounded-lg bg-zinc-950 hover:bg-red-950/40 border border-white/5 hover:border-red-500/20 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-4 border-t border-zinc-800/40 flex justify-between items-center text-[11px] text-zinc-500">
        <span>Mostrando {filteredExpenses.length} despesas</span>
        <span>Sincronizado com Firestore</span>
      </div>

      {/* Baixar completamente modal */}
      <AnimatePresence>
        {baixarModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBaixarModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl p-[1px] bg-gradient-to-tr from-red-500/30 to-zinc-800 shadow-2xl z-10"
            >
              <div className="bg-zinc-950 rounded-[23px] px-6 py-7 border border-white/5">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Baixar despesa fixa?
                  </h4>
                  <button
                    onClick={() => setBaixarModalOpen(false)}
                    className="p-1 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-xs text-zinc-300 leading-relaxed mb-5">
                  Essa ação vai encerrar a recorrência desta despesa. Os históricos já pagos continuarão salvos, mas os próximos meses não serão mais gerados.
                </p>

                <div className="space-y-1.5 mb-6">
                  <label className="text-xs font-semibold text-zinc-400">Motivo da baixa (Opcional)</label>
                  <input
                    type="text"
                    value={motivoBaixa}
                    onChange={(e) => setMotivoBaixa(e.target.value)}
                    placeholder="Ex: Cancelamento de contrato, mudança de plano..."
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setBaixarModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-xs text-zinc-300 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBaixar}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-semibold text-xs text-white transition-all cursor-pointer"
                  >
                    Confirmar baixa
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
