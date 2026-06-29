"use client";

import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  CheckCircle, 
  Trash2, 
  RefreshCw, 
  ShieldAlert, 
  Info,
  Calendar,
  Layers,
  Sparkles,
  Loader2
} from "lucide-react";
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COMPANY_ID } from "@/lib/app-config";
import { Expense } from "@/types/finance";
import { normalizeDateToISO } from "@/lib/date-utils";
import { getCompetenceFromDateStr } from "@/lib/cycle-utils";
import { motion, AnimatePresence } from "framer-motion";

interface SuspiciousItem {
  expense: Expense;
  reasons: string[];
  isDuplicate: boolean;
  isFuture2027: boolean;
}

export default function RecurringRepairPanel() {
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [items, setItems] = useState<SuspiciousItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalScanned: 0, totalSuspicious: 0, totalDuplicates: 0, totalFuture2027: 0 });

  const runDiagnosis = async () => {
    setScanning(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setItems([]);
    setSelectedIds([]);

    try {
      const q = query(
        collection(db, "financeiro", "geral", "despesas"),
        where("companyId", "==", COMPANY_ID),
        where("tipo", "==", "fixa")
      );
      
      const snapshot = await getDocs(q);
      const allExpenses: Expense[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        allExpenses.push({
          id: docSnap.id,
          ...data,
          criadoEm: data.criadoEm?.toDate?.() || data.criadoEm || null
        } as Expense);
      });

      const suspiciousList: SuspiciousItem[] = [];
      let duplicateCount = 0;
      let future2027Count = 0;

      // Group recurring expenses by grupoRecorrenciaId and competence
      // to identify duplicates
      const recurrenceGroups: { [key: string]: Expense[] } = {};

      allExpenses.forEach((exp) => {
        if (exp.recorrente && exp.grupoRecorrenciaId) {
          const comp = exp.competencia || getCompetenceFromDateStr(exp.dataVencimento);
          const key = `${exp.grupoRecorrenciaId}_${comp}`;
          if (!recurrenceGroups[key]) {
            recurrenceGroups[key] = [];
          }
          recurrenceGroups[key].push(exp);
        }
      });

      // Now analyze all expenses
      allExpenses.forEach((exp) => {
        const reasons: string[] = [];
        let isDuplicate = false;
        let isFuture2027 = false;

        // 1. Check for duplicates (same grupoRecorrenciaId and competence)
        if (exp.recorrente && exp.grupoRecorrenciaId) {
          const comp = exp.competencia || getCompetenceFromDateStr(exp.dataVencimento);
          const key = `${exp.grupoRecorrenciaId}_${comp}`;
          const group = recurrenceGroups[key] || [];
          
          if (group.length > 1) {
            // Sort by created date or ID so we keep the first one and flag subsequent ones as duplicates
            const sortedGroup = [...group].sort((a, b) => {
              const dateA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
              const dateB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
              if (dateA !== dateB) return dateA - dateB;
              return a.id.localeCompare(b.id);
            });

            // If this item is not the first in the sorted group, it's a duplicate candidate for removal
            if (sortedGroup[0].id !== exp.id) {
              isDuplicate = true;
              reasons.push("Lançamento Duplicado (Mesma competência para a mesma recorrência)");
            }
          }
        }

        // 2. Check for suspicious 2027 or skipped far future dates
        const isoDueDate = normalizeDateToISO(exp.dataVencimento);
        if (isoDueDate && (isoDueDate.startsWith("2027") || isoDueDate.startsWith("2028") || isoDueDate.startsWith("2029"))) {
          isFuture2027 = true;
          reasons.push(`Competência muito distante: Ano ${isoDueDate.split("-")[0]}`);
        }

        if (reasons.length > 0) {
          suspiciousList.push({
            expense: exp,
            reasons,
            isDuplicate,
            isFuture2027
          });

          if (isDuplicate) duplicateCount++;
          if (isFuture2027) future2027Count++;
        }
      });

      // Sort suspicious list chronologically
      suspiciousList.sort((a, b) => {
        const dateA = normalizeDateToISO(a.expense.dataVencimento);
        const dateB = normalizeDateToISO(b.expense.dataVencimento);
        return dateA.localeCompare(dateB);
      });

      setItems(suspiciousList);
      setStats({
        totalScanned: allExpenses.length,
        totalSuspicious: suspiciousList.length,
        totalDuplicates: duplicateCount,
        totalFuture2027: future2027Count
      });

      // Pre-select all duplicates and far future 2027 items for easy cleanup
      setSelectedIds(suspiciousList.map(item => item.expense.id));

      if (suspiciousList.length === 0) {
        setSuccessMessage("Nenhuma inconsistência encontrada! Sua base de dados de despesas fixas está 100% íntegra.");
      }
    } catch (err: any) {
      console.error("Erro durante o diagnóstico:", err);
      setErrorMessage(`Falha no diagnóstico: ${err.message || err}`);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    runDiagnosis();
  }, []);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(item => item.expense.id));
    }
  };

  const handleRepair = async () => {
    if (selectedIds.length === 0) return;
    
    if (!window.confirm(`Deseja realmente excluir permanentemente os ${selectedIds.length} lançamentos selecionados? Esta ação não afetará suas despesas legítimas.`)) {
      return;
    }

    setRepairing(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      let deletedCount = 0;
      for (const id of selectedIds) {
        await deleteDoc(doc(db, "financeiro", "geral", "despesas", id));
        deletedCount++;
      }

      setSuccessMessage(`Reparo concluído com sucesso! ${deletedCount} lançamentos incorretos foram removidos permanentemente.`);
      // Refresh diagnosis
      await runDiagnosis();
    } catch (err: any) {
      console.error("Erro ao reparar despesas:", err);
      setErrorMessage(`Erro durante o reparo de dados: ${err.message || err}`);
    } finally {
      setRepairing(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (!window.confirm("Deseja realmente remover esta despesa individualmente?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "financeiro", "geral", "despesas", id));
      setSuccessMessage("Lançamento removido com sucesso.");
      setItems(prev => prev.filter(item => item.expense.id !== id));
      setSelectedIds(prev => prev.filter(x => x !== id));
      setStats(prev => ({
        ...prev,
        totalSuspicious: prev.totalSuspicious - 1
      }));
    } catch (err: any) {
      console.error("Erro ao remover despesa:", err);
      setErrorMessage(`Falha ao remover item: ${err.message || err}`);
    }
  };

  return (
    <div id="repair-panel-container" className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500/30 via-amber-500/30 to-transparent" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500 animate-pulse" />
            <h3 className="text-base font-semibold text-white tracking-wide">
              Integridade & Diagnóstico de Recorrências
            </h3>
          </div>
          <p className="text-zinc-500 text-xs mt-0.5">
            Varredura inteligente contra furos de competência, pulos de ano (2027) ou duplicatas
          </p>
        </div>

        <button
          id="btn-trigger-diagnosis"
          onClick={runDiagnosis}
          disabled={scanning || repairing}
          className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/30 text-zinc-400 hover:text-emerald-400 rounded-xl px-4 py-2 text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scanning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {scanning ? "Analisando..." : "Escanear Banco de Dados"}
        </button>
      </div>

      {/* Info Warning */}
      <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-400 leading-relaxed">
            <span className="text-amber-400 font-semibold block mb-1">Como funciona a correção segura?</span>
            O corretor analisa despesas fixas recorrentes e identifica discrepâncias: lançamentos gerados incorretamente para 2027+ ou registros idênticos na mesma competência. Você pode revisar e excluir apenas as fatias inválidas sem perder o histórico do seu dashboard.
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-400 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-400 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-zinc-950 border border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Analisadas</p>
          <p className="text-xl font-bold text-white mt-1 font-mono">{stats.totalScanned}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950 border border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Inconsistentes</p>
          <p className="text-xl font-bold text-amber-500 mt-1 font-mono">{stats.totalSuspicious}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950 border border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Duplicatas</p>
          <p className="text-xl font-bold text-red-400 mt-1 font-mono">{stats.totalDuplicates}</p>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950 border border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Fora da Janela (2027)</p>
          <p className="text-xl font-bold text-purple-400 mt-1 font-mono">{stats.totalFuture2027}</p>
        </div>
      </div>

      {scanning ? (
        <div className="py-12 flex flex-col items-center justify-center text-zinc-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-xs">Realizando varredura inteligente em Firestore...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-zinc-600 text-center border border-dashed border-zinc-800 rounded-xl">
          <CheckCircle className="w-8 h-8 text-emerald-500/40 mb-3" />
          <p className="text-xs font-medium text-zinc-400">Banco de dados íntegro</p>
          <p className="text-[10px] text-zinc-500 mt-1 max-w-xs">Nenhum lançamento pulado para 2027 ou duplicata de competência detectado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-zinc-950/60 p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2">
              <input
                id="checkbox-select-all-suspicious"
                type="checkbox"
                checked={selectedIds.length === items.length}
                onChange={handleToggleAll}
                className="rounded border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-zinc-950 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="checkbox-select-all-suspicious" className="text-xs font-medium text-zinc-400 cursor-pointer">
                Selecionar todos ({items.length})
              </label>
            </div>

            <button
              id="btn-bulk-repair"
              onClick={handleRepair}
              disabled={selectedIds.length === 0 || repairing}
              className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {repairing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              {repairing ? "Excluindo..." : `Apagar Selecionados (${selectedIds.length})`}
            </button>
          </div>

          <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.div
                  key={item.expense.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-start md:items-center justify-between p-3.5 rounded-xl bg-zinc-950/40 hover:bg-zinc-950/70 border border-white/5 hover:border-white/[0.08] transition-all gap-4"
                >
                  <div className="flex items-center gap-3 shrink-0">
                    <input
                      id={`checkbox-select-${item.expense.id}`}
                      type="checkbox"
                      checked={selectedIds.includes(item.expense.id)}
                      onChange={() => handleToggleSelect(item.expense.id)}
                      className="rounded border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-zinc-950 w-4 h-4 cursor-pointer"
                    />
                    <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                      {item.isDuplicate ? (
                        <Layers className="w-4 h-4 text-red-400" />
                      ) : (
                        <Calendar className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-semibold text-white truncate max-w-[150px] sm:max-w-[240px]">
                        {item.expense.nome}
                      </span>
                      <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono font-medium">
                        R$ {item.expense.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-600" />
                        Vencimento: <span className="text-zinc-300 font-mono">{item.expense.dataVencimento}</span>
                      </span>
                      {item.expense.competencia && (
                        <span>
                          Competência: <span className="text-zinc-300 font-mono">{item.expense.competencia}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.reasons.map((reason, idx) => (
                        <span 
                          key={idx} 
                          className={`inline-flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-full border ${
                            item.isDuplicate 
                              ? "bg-red-500/5 text-red-400 border-red-500/10" 
                              : "bg-purple-500/5 text-purple-400 border-purple-500/10"
                          }`}
                        >
                          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    id={`btn-delete-${item.expense.id}`}
                    onClick={() => handleDeleteSingle(item.expense.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all shrink-0 cursor-pointer"
                    title="Excluir despesa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
