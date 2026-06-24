"use client";

import React from "react";
import { 
  AlertTriangle, 
  CalendarClock, 
  CheckSquare, 
  HelpCircle,
  TrendingDown,
  Sparkles
} from "lucide-react";
import { Expense } from "@/types/finance";
import { motion } from "framer-motion";

interface PaymentAlertsProps {
  expenses: Expense[];
}

export default function PaymentAlerts({ expenses }: PaymentAlertsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const getDaysDiff = (dateStr: string) => {
    const itemDate = new Date(dateStr + "T00:00:00");
    const todayDate = new Date(todayStr + "T00:00:00");
    const diffTime = itemDate.getTime() - todayDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const vencidas = expenses.filter(
    (e) => e.status !== "pago" && e.tipo === "fixa" && e.dataVencimento < todayStr
  );

  const vencemHoje = expenses.filter(
    (e) => e.status !== "pago" && e.tipo === "fixa" && e.dataVencimento === todayStr
  );

  const vencemProximosDias = expenses.filter((e) => {
    if (e.status === "pago" || e.tipo !== "fixa") return false;
    const diff = getDaysDiff(e.dataVencimento);
    return diff > 0 && diff <= 3;
  });

  const recorrentesAtivas = expenses.filter(
    (e) => e.tipo === "fixa" && e.recorrente === true && e.recorrenciaAtiva === true && e.status === "pendente"
  );

  const totalPendente = expenses
    .filter((e) => e.status !== "pago")
    .reduce((sum, e) => sum + e.valor, 0);

  // Simple auto suggestion
  let suggestion = "Seu caixa está saudável e todas as contas prioritárias estão em dia.";
  let alertLevel: "safe" | "warning" | "danger" = "safe";

  if (vencidas.length > 0) {
    suggestion = `Atenção: Você tem ${vencidas.length} despesa(s) fixa(s) vencida(s). Recomendamos priorizar a quitação para evitar multas de atraso.`;
    alertLevel = "danger";
  } else if (vencemHoje.length > 0) {
    suggestion = "Existem contas importantes com vencimento hoje. Efetue o pagamento e marque-as como pagas para manter o painel atualizado.";
    alertLevel = "warning";
  } else if (vencemProximosDias.length > 0) {
    suggestion = "Atenção ao fluxo de caixa dos próximos dias: despesas recorrentes importantes estão prestes a vencer nos próximos 3 dias.";
    alertLevel = "warning";
  } else if (totalPendente > 5000) {
    suggestion = "O montante total pendente de despesas está elevado. Certifique-se de que o fluxo de recebíveis suportará essas saídas.";
    alertLevel = "warning";
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6">
      
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/30 via-lime-400/20 to-transparent" />

      <div className="flex items-center gap-2.5 mb-5">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Sparkles className="w-4 h-4 animate-pulse" />
        </div>
        <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
          Atenção Financeira e IA
        </h3>
      </div>

      <div className="space-y-4">
        {/* Vencidas Alert */}
        {vencidas.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-200">
                Você tem {vencidas.length} despesas fixas vencidas.
              </p>
              <p className="mt-0.5 text-red-400/90 leading-relaxed">
                Total em atraso: <span className="font-bold">{formatCurrency(vencidas.reduce((s, e) => s + e.valor, 0))}</span>.
              </p>
            </div>
          </motion.div>
        )}

        {/* Recorrentes Ativas Alert */}
        {recorrentesAtivas.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-xs"
          >
            <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-200">
                Você tem {recorrentesAtivas.length} despesas fixas recorrentes ativas.
              </p>
              <p className="mt-0.5 text-emerald-400/90 leading-relaxed">
                Estas despesas serão renovadas automaticamente a cada confirmação de pagamento.
              </p>
            </div>
          </motion.div>
        )}

        {/* Vencem Hoje Alert */}
        {vencemHoje.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/20 text-amber-300 text-xs"
          >
            <CalendarClock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">
                Atenção: {vencemHoje.length} despesa(s) vence(m) hoje!
              </p>
              <ul className="mt-1 space-y-0.5 list-disc pl-4 text-amber-400/90 leading-relaxed">
                {vencemHoje.map((e) => (
                  <li key={e.id}>
                    {e.nome} - <span className="font-bold">{formatCurrency(e.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        {/* Vencem Próximos 3 Dias Alert */}
        {vencemProximosDias.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs"
          >
            <CalendarClock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-zinc-200">
                Existem despesas que vencem nos próximos 3 dias:
              </p>
              <ul className="mt-1 space-y-1 text-zinc-400 list-disc pl-4 leading-relaxed">
                {vencemProximosDias.map((e) => {
                  const diff = getDaysDiff(e.dataVencimento);
                  return (
                    <li key={e.id}>
                      {e.nome} ({formatCurrency(e.valor)}) - vence em {diff} {diff === 1 ? "dia" : "dias"}
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}

        {/* Total Pendente card */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TrendingDown className="w-4.5 h-4.5 text-zinc-400" />
            <span className="text-xs text-zinc-400">Total pendente a pagar:</span>
          </div>
          <span className="text-xs font-bold text-white font-mono bg-zinc-900 px-2.5 py-1 rounded-md border border-white/5">
            {formatCurrency(totalPendente)}
          </span>
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
