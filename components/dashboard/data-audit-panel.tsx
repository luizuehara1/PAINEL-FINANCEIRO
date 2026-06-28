"use client";

import React, { useState } from "react";
import { 
  ShieldCheck, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle,
  FileText,
  AlertCircle,
  TrendingDown,
  Coins,
  CreditCard,
  Building,
  Loader2,
  Copy
} from "lucide-react";
import { fetchCollectionDocs } from "@/lib/firestore-queries";
import { normalizeExpenseType, normalizeTransactionType, toDateSafe } from "@/lib/filter-utils";
import { COMPANY_ID } from "@/lib/app-config";

interface AuditStats {
  totalTransactions: number;
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  totalBanks: number;
  totalCardInvoices: number;
  
  // Integrity alerts
  withoutCompanyId: number;
  withoutDate: number;
  withoutType: number;
  withInvalidValue: number;

  // Potential duplicates
  possibleDuplicateExpenses: number;
  possibleDuplicateTransactions: number;
}

export default function DataAuditPanel() {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const runAudit = async () => {
    setIsAuditing(true);
    setIsCompleted(false);

    try {
      const [txs, exps, banks, invoices] = await Promise.all([
        fetchCollectionDocs("transacoes"),
        fetchCollectionDocs("despesas"),
        fetchCollectionDocs("bancos"),
        fetchCollectionDocs("faturasCartao")
      ]);

      let withoutCompanyId = 0;
      let withoutDate = 0;
      let withoutType = 0;
      let withInvalidValue = 0;

      // Track occurrences to detect possible duplicates
      const txKeys = new Set<string>();
      let possibleDuplicateTransactions = 0;

      txs.forEach((t) => {
        if (!t.companyId) withoutCompanyId++;
        if (!t.data) withoutDate++;
        if (!t.tipo) withoutType++;
        
        const val = parseFloat(t.valor);
        if (isNaN(val)) withInvalidValue++;

        // Duplicate rule: same date, same value, same type, same category
        const key = `${t.data}_${t.valor}_${t.tipo}_${t.categoria || ""}`;
        if (txKeys.has(key)) {
          possibleDuplicateTransactions++;
        } else {
          txKeys.add(key);
        }
      });

      let totalFixedExpenses = 0;
      let totalVariableExpenses = 0;
      const expKeys = new Set<string>();
      let possibleDuplicateExpenses = 0;

      exps.forEach((e) => {
        if (!e.companyId) withoutCompanyId++;
        if (!e.tipo) {
          withoutType++;
        } else {
          const type = normalizeExpenseType(e.tipo);
          if (type === "fixa") {
            totalFixedExpenses++;
            if (!e.dataVencimento) withoutDate++;
          } else if (type === "variavel") {
            totalVariableExpenses++;
            if (!e.data) withoutDate++;
          } else {
            withoutType++;
          }
        }

        const val = parseFloat(e.valor);
        if (isNaN(val)) withInvalidValue++;

        // Duplicate rule: same description/name, same value, same date/vencimento
        const dateKey = e.dataVencimento || e.data || "";
        const key = `${e.nome || ""}_${e.valor}_${dateKey}`;
        if (expKeys.has(key)) {
          possibleDuplicateExpenses++;
        } else {
          expKeys.add(key);
        }
      });

      banks.forEach((b) => {
        if (!b.companyId) withoutCompanyId++;
        const val = parseFloat(b.saldoAtual);
        if (isNaN(val)) withInvalidValue++;
      });

      invoices.forEach((inv) => {
        if (!inv.companyId) withoutCompanyId++;
        const val = parseFloat(inv.valorTotal);
        if (isNaN(val)) withInvalidValue++;
      });

      setStats({
        totalTransactions: txs.length,
        totalFixedExpenses,
        totalVariableExpenses,
        totalBanks: banks.length,
        totalCardInvoices: invoices.length,
        withoutCompanyId,
        withoutDate,
        withoutType,
        withInvalidValue,
        possibleDuplicateExpenses,
        possibleDuplicateTransactions
      });
      setIsCompleted(true);
    } catch (error) {
      console.error("Erro ao rodar auditoria:", error);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6" id="data-audit-panel-container">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Auditoria dos Dados e Integridade
          </h2>
        </div>
        <button
          onClick={runAudit}
          disabled={isAuditing}
          className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-950/40 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
        >
          {isAuditing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Verificando...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verificar agora</span>
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
        A auditoria analisa de forma passiva todos os documentos cadastrados no banco para identificar inconsistências, duplicidades ou registros perdidos que possam distorcer seus relatórios financeiros.
      </p>

      {stats ? (
        <div className="space-y-6 animate-fadeIn">
          {/* General counts row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 text-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Transações</span>
              <span className="text-sm font-bold text-white font-mono">{stats.totalTransactions}</span>
            </div>
            <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 text-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Despesas Fixas</span>
              <span className="text-sm font-bold text-white font-mono">{stats.totalFixedExpenses}</span>
            </div>
            <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 text-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Despesas Var.</span>
              <span className="text-sm font-bold text-white font-mono">{stats.totalVariableExpenses}</span>
            </div>
            <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 text-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Contas</span>
              <span className="text-sm font-bold text-white font-mono">{stats.totalBanks}</span>
            </div>
            <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 text-center col-span-2 md:col-span-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Faturas</span>
              <span className="text-sm font-bold text-white font-mono">{stats.totalCardInvoices}</span>
            </div>
          </div>

          {/* Analysis grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Integrity issues */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-white/5 pb-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                Divergências de Cadastro
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Sem identificação (companyId):</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                    stats.withoutCompanyId > 0 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {stats.withoutCompanyId} {stats.withoutCompanyId === 1 ? "documento" : "documentos"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Sem data cadastrada:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                    stats.withoutDate > 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {stats.withoutDate}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Sem tipo definido:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                    stats.withoutType > 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {stats.withoutType}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Valores inválidos ou corrompidos:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                    stats.withInvalidValue > 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {stats.withInvalidValue}
                  </span>
                </div>
              </div>
            </div>

            {/* Possible duplicates */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-white/5 pb-2.5">
                <Copy className="w-4 h-4 text-amber-400" />
                Duplicidades Suspeitas
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Despesas duplicadas em potencial:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                    stats.possibleDuplicateExpenses > 0 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {stats.possibleDuplicateExpenses}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Transações duplicadas em potencial:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                    stats.possibleDuplicateTransactions > 0 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {stats.possibleDuplicateTransactions}
                  </span>
                </div>
              </div>

              {/* Advice */}
              <div className="bg-zinc-950/80 border border-white/5 rounded-xl p-3 text-[10px] text-zinc-400 leading-relaxed">
                As duplicidades são detectadas ao cruzar registros com datas, valores e identificadores idênticos na mesma seção. Caso encontre problemas, edite ou apague os lançamentos manualmente nas tabelas.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl py-8 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
          <span>Nenhum relatório de auditoria gerado na sessão atual.</span>
          <button
            onClick={runAudit}
            className="text-emerald-400 hover:underline font-semibold font-mono"
          >
            Iniciar auditoria rápida
          </button>
        </div>
      )}
    </div>
  );
}
