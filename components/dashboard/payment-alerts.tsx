"use client";

import React from "react";
import { 
  AlertTriangle, 
  CalendarClock, 
  CheckSquare, 
  HelpCircle,
  TrendingDown,
  Sparkles,
  Wallet,
  CreditCard,
  Layers,
  ArrowRight
} from "lucide-react";
import { Expense, BankAccount, CardInvoice, Transaction } from "@/types/finance";
import { motion } from "motion/react";
import { calculateFinancialAlerts } from "@/lib/financial-alerts-utils";

interface PaymentAlertsProps {
  expenses: Expense[];
  transactions: Transaction[];
  cardInvoices: CardInvoice[];
  banks: BankAccount[];
  selectedCycle?: string;
}

export default function PaymentAlerts({ 
  expenses = [], 
  transactions = [], 
  cardInvoices = [], 
  banks = [], 
  selectedCycle = "" 
}: PaymentAlertsProps) {
  
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Perform correct real-time calculations using our helper
  const alerts = calculateFinancialAlerts({
    expenses,
    transactions,
    cardInvoices,
    banks,
    selectedCycle,
    todayStr
  });

  const {
    overdueExpenses,
    dueTodayExpenses,
    upcomingExpenses,
    pendingTotal,
    activeRecurring,
    activeInstallments,
    upcomingInvoices,
    availableBalance,
    filteredExpenses
  } = alerts;

  // TEMPORARY DEBUG LOGS as requested
  console.log("Despesas usadas no alerta:", expenses);
  console.log("Despesas filtradas no alerta:", filteredExpenses);
  console.log("Recorrências únicas:", activeRecurring);
  console.log("Total pendente calculado:", pendingTotal);
  console.log("Alertas calculados:", alerts);

  // Dynamic Intelligence Analysis
  let suggestion = "Não há alertas financeiros para este período.";
  let alertLevel: "safe" | "warning" | "danger" = "safe";

  if (overdueExpenses.length > 0) {
    suggestion = `Você tem ${overdueExpenses.length} despesa(s) vencida(s), totalizando ${formatCurrency(overdueExpenses.reduce((s, e) => s + Math.abs(e.valor || 0), 0))}.`;
    alertLevel = "danger";
  } else if (dueTodayExpenses.length > 0) {
    suggestion = `Existem ${dueTodayExpenses.length} contas importantes com vencimento hoje. Efetue o pagamento e marque-as como pagas para manter o painel atualizado.`;
    alertLevel = "warning";
  } else if (upcomingInvoices.length > 0) {
    suggestion = `Você tem ${upcomingInvoices.length} fatura(s) de cartão próximas do vencimento.`;
    alertLevel = "warning";
  } else if (upcomingExpenses.length > 0) {
    suggestion = "Atenção ao fluxo de caixa dos próximos dias: despesas recorrentes importantes estão prestes a vencer nos próximos 3 dias.";
    alertLevel = "warning";
  } else if (pendingTotal > availableBalance) {
    suggestion = "O total pendente é maior que o saldo disponível em bancos. Revise o fluxo de caixa.";
    alertLevel = "danger";
  } else if (pendingTotal > 0 && pendingTotal <= availableBalance) {
    suggestion = "Seu saldo disponível cobre as despesas pendentes do período.";
    alertLevel = "safe";
  } else if (expenses.length === 0) {
    suggestion = "Não há alertas financeiros para este período.";
    alertLevel = "safe";
  } else {
    suggestion = "Sua caixa está saudável e não há despesas vencidas.";
    alertLevel = "safe";
  }

  // Check if we have absolutely no alerts to show
  const hasAlerts = 
    overdueExpenses.length > 0 || 
    dueTodayExpenses.length > 0 || 
    upcomingExpenses.length > 0 || 
    upcomingInvoices.length > 0 ||
    activeRecurring.length > 0 ||
    activeInstallments.length > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6">
      
      {/* Top accent line based on alert levels */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] transition-all duration-500 ${
        alertLevel === "danger" 
          ? "bg-gradient-to-r from-red-500/50 via-red-400/30 to-transparent" 
          : alertLevel === "warning" 
            ? "bg-gradient-to-r from-amber-500/50 via-amber-400/30 to-transparent" 
            : "bg-gradient-to-r from-emerald-500/50 via-emerald-400/30 to-transparent"
      }`} />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg border transition-all duration-500 ${
            alertLevel === "danger"
              ? "bg-red-500/10 text-red-400 border-red-500/20"
              : alertLevel === "warning"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          }`}>
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
              Atenção Financeira e IA
            </h3>
            {selectedCycle && selectedCycle !== "all" && (
              <p className="text-[10px] text-zinc-500 font-mono">CICLO: {selectedCycle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* If no data exists, show clean fallback */}
        {!hasAlerts && (
          <div className="flex flex-col items-center justify-center py-6 text-center text-zinc-500 text-xs gap-2">
            <CheckSquare className="w-8 h-8 text-emerald-500/40" />
            <p className="font-medium text-zinc-400">Nenhum alerta crítico encontrado</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">Não há alertas financeiros para este período.</p>
          </div>
        )}

        {/* 1. Vencidas Alert */}
        {overdueExpenses.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-red-950/20 border border-red-500/15 text-red-300 text-xs"
          >
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-red-200">
                Você tem {overdueExpenses.length} despesa(s) vencida(s).
              </p>
              <p className="text-red-400/90 leading-relaxed">
                Total em atraso: <span className="font-bold">{formatCurrency(overdueExpenses.reduce((s, e) => s + Math.abs(e.valor || 0), 0))}</span>.
              </p>
              <div className="max-h-24 overflow-y-auto pt-1.5 space-y-1 border-t border-red-500/10 mt-1">
                {overdueExpenses.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex justify-between text-[11px] text-red-400/80 font-mono">
                    <span className="truncate max-w-[150px]">{e.nome}</span>
                    <span className="font-semibold">{formatCurrency(e.valor)}</span>
                  </div>
                ))}
                {overdueExpenses.length > 3 && (
                  <div className="text-[10px] text-red-500/60 text-right">
                    + {overdueExpenses.length - 3} despesa(s)
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* 2. Vencem Hoje Alert */}
        {dueTodayExpenses.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/15 text-amber-300 text-xs"
          >
            <CalendarClock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <p className="font-semibold text-amber-200">
                Atenção: {dueTodayExpenses.length} despesa(s) vence(m) hoje!
              </p>
              <div className="space-y-1 pt-1.5 mt-1 border-t border-amber-500/10">
                {dueTodayExpenses.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex justify-between text-[11px] text-amber-400/80 font-mono">
                    <span className="truncate max-w-[150px]">{e.nome}</span>
                    <span className="font-bold">{formatCurrency(e.valor)}</span>
                  </div>
                ))}
                {dueTodayExpenses.length > 3 && (
                  <div className="text-[10px] text-amber-500/60 text-right">
                    + {dueTodayExpenses.length - 3} despesa(s)
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* 3. Vencem Próximos 3 Dias Alert */}
        {upcomingExpenses.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-950/40 border border-white/5 text-zinc-300 text-xs"
          >
            <CalendarClock className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <p className="font-semibold text-zinc-200">
                Despesas vencendo nos próximos 3 dias:
              </p>
              <div className="space-y-1 pt-1.5 mt-1 border-t border-white/5">
                {upcomingExpenses.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex justify-between text-[11px] text-zinc-400 font-mono">
                    <span className="truncate max-w-[150px]">{e.nome}</span>
                    <span className="font-semibold text-zinc-300">{formatCurrency(e.valor)} ({e.dataVencimento.split("-")[2]})</span>
                  </div>
                ))}
                {upcomingExpenses.length > 3 && (
                  <div className="text-[10px] text-zinc-500 text-right">
                    + {upcomingExpenses.length - 3} despesa(s)
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* 4. Upcoming Card Invoices */}
        {upcomingInvoices.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/15 text-indigo-300 text-xs"
          >
            <CreditCard className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <p className="font-semibold text-indigo-200">
                Você tem {upcomingInvoices.length} fatura(s) de cartão próximas.
              </p>
              <div className="space-y-1 pt-1.5 mt-1 border-t border-indigo-500/10">
                {upcomingInvoices.slice(0, 3).map((ci) => (
                  <div key={ci.id} className="flex justify-between text-[11px] text-indigo-400/80 font-mono">
                    <span className="truncate max-w-[130px]">{ci.cartaoNome} ({ci.competencia})</span>
                    <span className="font-bold">{formatCurrency(ci.valorTotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 5. Recorrências Ativas Count */}
        {activeRecurring.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/15 text-emerald-300 text-xs"
          >
            <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-emerald-200">
                Você tem {activeRecurring.length} recorrência(s) ativa(s).
              </p>
              <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                Estes contratos/despesas geram novas cobranças periodicamente conforme o fluxo de competências.
              </p>
            </div>
          </motion.div>
        )}

        {/* 6. Parcelamentos Ativos Count */}
        {activeInstallments.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-950/50 border border-white/5 text-zinc-300 text-xs"
          >
            <Layers className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-zinc-200">
                Você tem {activeInstallments.length} parcelamento(s) ativo(s).
              </p>
              <p className="text-[11px] text-zinc-400/80 leading-relaxed">
                Acompanhe o cronograma de parcelas para evitar surpresas nas faturas e contas fixas.
              </p>
            </div>
          </motion.div>
        )}

        {/* Summary Balance vs Pending card */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span className="text-zinc-400">Saldo disponível em bancos:</span>
            </div>
            <span className="font-bold text-white font-mono bg-zinc-900 px-2.5 py-1 rounded-md border border-white/5">
              {formatCurrency(availableBalance)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-400">Total pendente a pagar:</span>
            </div>
            <span className="font-bold text-white font-mono bg-zinc-900 px-2.5 py-1 rounded-md border border-white/5">
              {formatCurrency(pendingTotal)}
            </span>
          </div>
        </div>

        {/* AI automated suggestion */}
        <div className="mt-2 pt-4 border-t border-zinc-800/60">
          <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Recomendação do Painel
          </h4>
          <div className="text-xs text-zinc-300 bg-zinc-950/60 rounded-xl p-3 border border-white/5 leading-relaxed flex gap-2.5">
            <HelpCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>{suggestion}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
