"use client";

import React, { useState, useEffect } from "react";
import { BankAccount, Investment, Asset } from "@/types/finance";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Wallet, 
  PiggyBank, 
  Home, 
  TrendingUp, 
  FileDown, 
  Building2, 
  DollarSign, 
  Layers 
} from "lucide-react";
import { BankManager } from "./bank-manager";
import { InvestmentManager } from "./investment-manager";
import { AssetsManager } from "./assets-manager";
import { exportApplicationsPDF } from "@/lib/pdf-utils";

interface ApplicationsSectionProps {
  userEmail: string;
}

type TabType = "bancos" | "investimentos" | "patrimonios";

export function ApplicationsSection({ userEmail }: ApplicationsSectionProps) {
  const [activeTab, setActiveTab] = useState<TabType>("bancos");
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time listeners for all three domains
  useEffect(() => {
    if (!userEmail) return;

    setLoading(true);
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3) {
        setLoading(false);
      }
    };

    // 1. Subscribe to Banks
    const qBanks = query(
      collection(db, "financeiro", "geral", "bancos"),
      where("criadoPorEmail", "==", userEmail)
    );
    const unsubBanks = onSnapshot(qBanks, (snap) => {
      const list: BankAccount[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as BankAccount);
      });
      // Sort alphabetically by name
      list.sort((a, b) => a.nome.localeCompare(b.nome));
      setBanks(list);
      checkLoaded();
    }, (err) => {
      console.error("Erro bancos snapshot:", err);
      checkLoaded();
    });

    // 2. Subscribe to Investments
    const qInvs = query(
      collection(db, "financeiro", "geral", "investimentos"),
      where("criadoPorEmail", "==", userEmail)
    );
    const unsubInvs = onSnapshot(qInvs, (snap) => {
      const list: Investment[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Investment);
      });
      list.sort((a, b) => a.nome.localeCompare(b.nome));
      setInvestments(list);
      checkLoaded();
    }, (err) => {
      console.error("Erro investimentos snapshot:", err);
      checkLoaded();
    });

    // 3. Subscribe to Assets (Patrimônios)
    const qAssets = query(
      collection(db, "financeiro", "geral", "patrimonios"),
      where("criadoPorEmail", "==", userEmail)
    );
    const unsubAssets = onSnapshot(qAssets, (snap) => {
      const list: Asset[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Asset);
      });
      list.sort((a, b) => a.nome.localeCompare(b.nome));
      setAssets(list);
      checkLoaded();
    }, (err) => {
      console.error("Erro patrimonios snapshot:", err);
      checkLoaded();
    });

    return () => {
      unsubBanks();
      unsubInvs();
      unsubAssets();
    };
  }, [userEmail]);

  // Calculations (only sum active assets)
  const totalBanks = banks
    .filter((b) => b.ativo)
    .reduce((sum, b) => sum + b.saldoAtual, 0);

  const totalInvested = investments
    .filter((i) => i.ativo)
    .reduce((sum, i) => sum + i.valorAtual, 0);

  const totalAssets = assets
    .filter((a) => a.ativo)
    .reduce((sum, a) => sum + a.valorEstimado, 0);

  const consolidatedTotal = totalBanks + totalInvested + totalAssets;

  const handleExportPDF = () => {
    exportApplicationsPDF(banks, investments, assets, userEmail);
  };

  return (
    <div className="space-y-7 pb-10">
      {/* Upper Title Row & PDF trigger */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            Aplicações e Patrimônio
          </h2>
          <p className="text-xs text-zinc-400 font-medium mt-1">
            Controle integrado de contas bancárias, caixa físico, portfólio de investimentos e bens consolidados.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportPDF}
          className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-black/25 cursor-pointer self-stretch sm:self-auto justify-center"
        >
          <FileDown className="w-4 h-4 text-emerald-400" />
          Exportar Relatório PDF
        </button>
      </div>

      {/* Overview Cards Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Bancos */}
        <div className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Disponível em Bancos</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xl font-extrabold text-white font-mono">
              R$ {totalBanks.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-1">
              {banks.filter(b => b.ativo).length} conta(s) bancária(s) ativa(s)
            </span>
          </div>
        </div>

        {/* Total Investido */}
        <div className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Total Investido</span>
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xl font-extrabold text-white font-mono">
              R$ {totalInvested.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-1">
              {investments.filter(i => i.ativo).length} aplicação(ões) ativa(s)
            </span>
          </div>
        </div>

        {/* Total Bens */}
        <div className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Patrimônio em Bens</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Home className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xl font-extrabold text-white font-mono">
              R$ {totalAssets.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-1">
              {assets.filter(a => a.ativo).length} bem(bens) ativo(s)
            </span>
          </div>
        </div>

        {/* Consolidated Total */}
        <div className="p-5 rounded-2xl bg-zinc-950/40 border border-emerald-500/10 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-500/[0.01] pointer-events-none" />
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider font-mono">Patrimônio Consolidado</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 animate-pulse">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xl font-extrabold text-emerald-400 font-mono">
              R$ {consolidatedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-zinc-400 block mt-1 font-medium">
              Soma global de liquidez e ativos fixos
            </span>
          </div>
        </div>
      </div>

      {/* Internal Menu Tabs */}
      <div className="flex gap-2 p-1.5 rounded-2xl bg-zinc-950/40 border border-white/5 max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab("bancos")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "bancos"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-md"
              : "text-zinc-400 hover:text-white border border-transparent"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Bancos e Caixas
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("investimentos")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "investimentos"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-md"
              : "text-zinc-400 hover:text-white border border-transparent"
          }`}
        >
          <PiggyBank className="w-3.5 h-3.5" />
          Investimentos
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("patrimonios")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "patrimonios"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-md"
              : "text-zinc-400 hover:text-white border border-transparent"
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          Patrimônios
        </button>
      </div>

      {/* Render sub managers based on active tab */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-emerald-500/10 border-t-emerald-400 animate-spin" />
          <p className="text-xs text-zinc-500 font-mono">Sincronizando ativos e aplicações...</p>
        </div>
      ) : (
        <div className="bg-zinc-950/20 border border-white/5 p-6 rounded-3xl">
          {activeTab === "bancos" && (
            <BankManager banks={banks} userEmail={userEmail} />
          )}

          {activeTab === "investimentos" && (
            <InvestmentManager investments={investments} banks={banks} userEmail={userEmail} />
          )}

          {activeTab === "patrimonios" && (
            <AssetsManager assets={assets} userEmail={userEmail} />
          )}
        </div>
      )}
    </div>
  );
}
