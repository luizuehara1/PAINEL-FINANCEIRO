"use client";

import React, { useState, useEffect } from "react";
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
import { Transaction, Expense, BankAccount, Investment, Asset } from "@/types/finance";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { calculateOverviewCards } from "@/lib/finance-calculations";
import { isAccumulatedFilter } from "@/lib/filter-utils";

interface FinanceSummaryCardsProps {
  transactions: Transaction[];
  expenses: Expense[];
  selectedCycle?: string | null;
}

export default function FinanceSummaryCards({ transactions, expenses, selectedCycle = "" }: FinanceSummaryCardsProps) {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [userEmail, setUserEmail] = useState("");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Get current user email
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email || "");
      }
    });
    return () => unsubAuth();
  }, []);

  // Real-time subscribe to financial sources for consolidation
  useEffect(() => {
    if (!userEmail) return;

    const qBanks = query(
      collection(db, "financeiro", "geral", "bancos"),
      where("criadoPorEmail", "==", userEmail)
    );
    const unsubBanks = onSnapshot(qBanks, (snap) => {
      const list: BankAccount[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as BankAccount);
      });
      setBanks(list);
    });

    const qInvs = query(
      collection(db, "financeiro", "geral", "investimentos"),
      where("criadoPorEmail", "==", userEmail)
    );
    const unsubInvs = onSnapshot(qInvs, (snap) => {
      const list: Investment[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Investment);
      });
      setInvestments(list);
    });

    const qAssets = query(
      collection(db, "financeiro", "geral", "patrimonios"),
      where("criadoPorEmail", "==", userEmail)
    );
    const unsubAssets = onSnapshot(qAssets, (snap) => {
      const list: Asset[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Asset);
      });
      setAssets(list);
    });

    return () => {
      unsubBanks();
      unsubInvs();
      unsubAssets();
    };
  }, [userEmail]);

  // 1. Core calculations via centralized overview cards calculator
  const overviewMetrics = React.useMemo(() => {
    return calculateOverviewCards({
      transactions,
      expenses,
      banks,
      selectedCycle
    });
  }, [transactions, expenses, banks, selectedCycle]);

  const totalBancosAtivos = overviewMetrics.saldoAtual;
  const totalEntradas = overviewMetrics.entradas;
  const totalSaidas = overviewMetrics.saidas;
  const resultadoCiclo = overviewMetrics.resultadoCiclo;

  const totalInvested = investments
    .filter((i) => i.ativo)
    .reduce((sum, i) => sum + (i.valorAtual || 0), 0);

  const totalAssets = assets
    .filter((a) => a.ativo)
    .reduce((sum, a) => sum + (a.valorEstimado || 0), 0);

  const patrimonConsolidado = totalBancosAtivos + totalInvested + totalAssets;

  const cardsData = [
    {
      title: "Saldo Atual",
      value: totalBancosAtivos,
      description: "Consolidado total de bancos ativos",
      icon: DollarSign,
      color: "from-emerald-500 to-teal-400",
      textColor: "text-emerald-400",
      bgHover: "hover:border-emerald-500/30",
    },
    {
      title: "Disponível em Bancos",
      value: totalBancosAtivos,
      description: "Disponibilidade líquida total",
      icon: Layers,
      color: "from-emerald-500 to-teal-400",
      textColor: "text-emerald-400",
      bgHover: "hover:border-emerald-500/30",
    },
    {
      title: "Entradas",
      value: totalEntradas,
      description: "Faturamento bruto do ciclo",
      icon: TrendingUp,
      color: "from-emerald-500 to-lime-400",
      textColor: "text-emerald-400",
      bgHover: "hover:border-emerald-500/30",
    },
    {
      title: "Saídas",
      value: totalSaidas,
      description: "Fluxos de saída operacional",
      icon: TrendingDown,
      color: "from-red-500 to-orange-400",
      textColor: "text-red-400",
      bgHover: "hover:border-red-500/30",
    },
    {
      title: "Resultado do Ciclo",
      value: resultadoCiclo,
      description: "Resultado líquido (Entradas - Saídas)",
      icon: Activity,
      color: resultadoCiclo >= 0 ? "from-emerald-500 to-teal-400" : "from-red-500 to-rose-400",
      textColor: resultadoCiclo >= 0 ? "text-emerald-400" : "text-red-400",
      bgHover: resultadoCiclo >= 0 ? "hover:border-emerald-500/30" : "hover:border-red-500/30",
    },
    {
      title: "Total Investido",
      value: totalInvested,
      description: "Aplicações financeiras ativas",
      icon: Calendar,
      color: "from-amber-500 to-orange-400",
      textColor: "text-amber-400",
      bgHover: "hover:border-amber-500/30",
    },
    {
      title: "Patrimônio em Bens",
      value: totalAssets,
      description: "Bens e patrimônios ativos",
      icon: AlertTriangle,
      color: "from-blue-500 to-indigo-400",
      textColor: "text-blue-400",
      bgHover: "hover:border-blue-500/30",
    },
    {
      title: "Patrimônio Consolidado",
      value: patrimonConsolidado,
      description: "Disponível + Investido + Bens",
      icon: DollarSign,
      color: "from-purple-500 to-indigo-400",
      textColor: "text-purple-400",
      bgHover: "hover:border-purple-500/30",
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
      {cardsData.map((card) => {
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
