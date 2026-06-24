"use client";

import React from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Activity, 
  AlertTriangle,
  Layers
} from "lucide-react";
import { motion } from "framer-motion";
import { Transaction, Expense } from "@/types/finance";

interface FinanceSummaryCardsProps {
  transactions: Transaction[];
  expenses: Expense[];
}

export default function FinanceSummaryCards({ transactions, expenses }: FinanceSummaryCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Calculations
  const totalEntradas = transactions
    .filter((t) => t.tipo === "entrada")
    .reduce((sum, t) => sum + t.valor, 0);

  const totalSaidas = transactions
    .filter((t) => t.tipo === "saida")
    .reduce((sum, t) => sum + t.valor, 0);

  // Despesas pagas
  const totalDespesasPagas = expenses
    .filter((e) => e.status === "pago")
    .reduce((sum, e) => sum + e.valor, 0);

  // Saldo atual = total entradas - total saídas - despesas pagas
  const saldoAtual = totalEntradas - totalSaidas - totalDespesasPagas;

  // Despesas fixas do mês (let's assume all registered fixed expenses are for the current month)
  const totalDespesasFixas = expenses
    .filter((e) => e.tipo === "fixa")
    .reduce((sum, e) => sum + e.valor, 0);

  // Despesas variáveis do mês
  const totalDespesasVariaveis = expenses
    .filter((e) => e.tipo === "variavel")
    .reduce((sum, e) => sum + e.valor, 0);

  // Resultado do mês = entradas do mês - saídas do mês - despesas do mês
  const totalDespesasGeral = expenses.reduce((sum, e) => sum + e.valor, 0);
  const resultadoMes = totalEntradas - totalSaidas - totalDespesasGeral;

  // Despesas vencidas = dataVencimento < hoje e status diferente de pago
  const despesasVencidasList = expenses.filter(
    (e) => e.tipo === "fixa" && e.status !== "pago" && e.dataVencimento < todayStr
  );
  const totalDespesasVencidas = despesasVencidasList.reduce((sum, e) => sum + e.valor, 0);

  const cardsData = [
    {
      title: "Saldo Atual",
      value: saldoAtual,
      description: "Cálculo consolidado em tempo real",
      icon: DollarSign,
      color: "from-emerald-500 to-teal-400",
      textColor: "text-emerald-400",
      bgHover: "hover:border-emerald-500/30",
    },
    {
      title: "Total de Entradas",
      value: totalEntradas,
      description: "Faturamento e receitas brutas",
      icon: TrendingUp,
      color: "from-emerald-500 to-lime-400",
      textColor: "text-emerald-400",
      bgHover: "hover:border-emerald-500/30",
    },
    {
      title: "Total de Saídas",
      value: totalSaidas,
      description: "Saídas operacionais registradas",
      icon: TrendingDown,
      color: "from-red-500 to-orange-400",
      textColor: "text-red-400",
      bgHover: "hover:border-red-500/30",
    },
    {
      title: "Despesas Fixas",
      value: totalDespesasFixas,
      description: "Custos fixos recorrentes",
      icon: Calendar,
      color: "from-amber-500 to-orange-400",
      textColor: "text-amber-400",
      bgHover: "hover:border-amber-500/30",
    },
    {
      title: "Despesas Variáveis",
      value: totalDespesasVariaveis,
      description: "Gastos flexíveis do período",
      icon: Layers,
      color: "from-blue-500 to-indigo-400",
      textColor: "text-blue-400",
      bgHover: "hover:border-blue-500/30",
    },
    {
      title: "Resultado do Mês",
      value: resultadoMes,
      description: "Lucro ou prejuízo projetado",
      icon: Activity,
      color: resultadoMes >= 0 ? "from-emerald-500 to-teal-400" : "from-red-500 to-rose-400",
      textColor: resultadoMes >= 0 ? "text-emerald-400" : "text-red-400",
      bgHover: resultadoMes >= 0 ? "hover:border-emerald-500/30" : "hover:border-red-500/30",
    },
    {
      title: "Despesas Vencidas",
      value: totalDespesasVencidas,
      description: `${despesasVencidasList.length} item(ns) pendente(s) atrasado(s)`,
      icon: AlertTriangle,
      color: "from-rose-500 to-red-400",
      textColor: "text-rose-400",
      bgHover: "hover:border-rose-500/30",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
    >
      {cardsData.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            variants={itemVariants}
            className={`relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6 ${card.bgHover} transition-all duration-300 group`}
          >
            {/* Top color accent light */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-50 group-hover:opacity-100 transition-opacity duration-300 from-emerald-500/10 via-lime-400/20 to-transparent" />

            <div className="flex justify-between items-start mb-4">
              <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`p-2.5 rounded-xl bg-zinc-950 border border-white/5 ${card.textColor} shadow-inner group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-mono">
                {formatCurrency(card.value)}
              </h2>
              <p className="text-zinc-500 text-xs tracking-wide">
                {card.description}
              </p>
            </div>

            {/* Ambient hover glowing circle */}
            <div className="absolute -bottom-10 -right-10 w-24 h-24 rounded-full bg-emerald-500/5 blur-xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
