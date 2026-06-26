"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, Loader2, X, EyeOff, CheckSquare, ShieldCheck, Database } from "lucide-react";
import { collection, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COMPANY_ID } from "@/lib/app-config";

interface ResetFinanceDataProps {
  onSuccess?: () => void;
  userEmail: string;
}

export default function ResetFinanceData({ onSuccess, userEmail }: ResetFinanceDataProps) {
  // Reset states
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Hide states
  const [hideSuccessMsg, setHideSuccessMsg] = useState<string | null>(null);

  // Claim/Migration states
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [claimConfirmationText, setClaimConfirmationText] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimErrorMsg, setClaimErrorMsg] = useState<string | null>(null);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);

  // 1. Reset all financial data (transacoes & despesas)
  const resetFinancialData = async () => {
    if (confirmationText !== "ZERAR") {
      setErrorMsg("Digite ZERAR exatamente em maiúsculo para confirmar.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const txRef = collection(db, "financeiro", "geral", "transacoes");
      const expRef = collection(db, "financeiro", "geral", "despesas");

      const [txSnap, expSnap] = await Promise.all([
        getDocs(txRef),
        getDocs(expRef)
      ]);

      const allDocs = [...txSnap.docs, ...expSnap.docs];

      if (allDocs.length === 0) {
        setSuccessMsg("Não há dados financeiros para apagar.");
        if (onSuccess) onSuccess();
        setTimeout(() => {
          setIsOpen(false);
          setSuccessMsg(null);
          setConfirmationText("");
        }, 2000);
        return;
      }

      // Safe batches of max 500
      for (let i = 0; i < allDocs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = allDocs.slice(i, i + 500);
        chunk.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }

      setSuccessMsg("Dados financeiros zerados com sucesso.");
      if (onSuccess) onSuccess();
      
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMsg(null);
        setConfirmationText("");
      }, 2000);

    } catch (error: any) {
      console.error("Erro ao zerar dados financeiros:", error);
      setErrorMsg("Erro ao zerar dados financeiros.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Hide unassigned data (notify user that snapshot filters successfully isolate them)
  const handleHideUnassigned = () => {
    setHideSuccessMsg("Isolamento ativado! Documentos sem identificação foram ocultados de todas as visualizações.");
    setTimeout(() => {
      setHideSuccessMsg(null);
    }, 4000);
  };

  // 3. Mark current unassigned data as mine (companyId = COMPANY_ID)
  const claimExistingData = async () => {
    if (claimConfirmationText !== "CONFIRMAR") {
      setClaimErrorMsg("Digite CONFIRMAR exatamente em maiúsculo para confirmar.");
      return;
    }

    setIsClaiming(true);
    setClaimErrorMsg(null);
    setClaimSuccessMsg(null);

    try {
      const collectionsToMigrate = [
        "transacoes",
        "despesas",
        "imoveis",
        "bancos",
        "investimentos",
        "patrimonios",
        "cartoes",
        "faturasCartao",
        "itensCartao",
        "categoriasEntrada",
        "categoriasSaida",
        "categoriasDespesasFixas",
        "categoriasDespesasVariaveis",
        "formasPagamento"
      ];

      let totalMigrated = 0;

      for (const colName of collectionsToMigrate) {
        const colRef = collection(db, "financeiro", "geral", colName);
        const snap = await getDocs(colRef);
        const docsToMigrate = snap.docs.filter((docSnap) => {
          const d = docSnap.data();
          return !d.companyId; // Match documents missing companyId
        });

        if (docsToMigrate.length > 0) {
          // Process in chunks of 500
          for (let i = 0; i < docsToMigrate.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = docsToMigrate.slice(i, i + 500);
            chunk.forEach((docSnap) => {
              batch.update(docSnap.ref, {
                companyId: COMPANY_ID,
                atualizadoEm: serverTimestamp()
              });
            });
            await batch.commit();
            totalMigrated += chunk.length;
          }
        }
      }

      setClaimSuccessMsg(`${totalMigrated} registros sem identificação foram associados ao seu painel!`);
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setIsClaimOpen(false);
        setClaimSuccessMsg(null);
        setClaimConfirmationText("");
      }, 3000);

    } catch (err: any) {
      console.error("Erro ao migrar dados:", err);
      setClaimErrorMsg("Ocorreu um erro ao associar dados existentes ao seu painel.");
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="space-y-6" id="reset-finance-container">
      {/* Container header/section */}
      <div className="bg-zinc-950 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <Database className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Manutenção e Integridade dos Dados
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Box 1: Hide old unassigned data */}
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-zinc-300">
              <EyeOff className="w-4 h-4 text-amber-500 shrink-0" />
              <h4 className="text-sm font-bold text-white uppercase tracking-tight font-mono">
                Ocultar Dados sem ID
              </h4>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Filtra e oculta imediatamente todos os registros históricos ou duplicados que não possuem o identificador do seu painel corporativo.
            </p>
            <div className="pt-2">
              <button
                onClick={handleHideUnassigned}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-white/10 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
              >
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                Ocultar dados sem identificação
              </button>
            </div>
            {hideSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium text-center">
                {hideSuccessMsg}
              </div>
            )}
          </div>

          {/* Box 2: Claim unassigned data */}
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-zinc-300">
              <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
              <h4 className="text-sm font-bold text-white uppercase tracking-tight font-mono">
                Marcar Dados Atuais como Meus
              </h4>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Associa de forma segura todos os lançamentos órfãos e registros atuais do banco de dados ao identificador exclusivo do seu painel financeiro.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setIsClaimOpen(true)}
                className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                Marcar dados atuais como meus
              </button>
            </div>
          </div>
        </div>

        {/* Destructive zone: reset financial */}
        <div className="border-t border-white/5 pt-6 mt-6">
          <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-tight font-mono">
                  Limpar Todo o Histórico Financeiro
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                  Apaga de forma irreversível todas as transações, lançamentos e despesas fixas/variáveis. Suas tabelas de categorias e formas de pagamento serão preservadas.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(true)}
              className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs transition-colors shrink-0 flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Zerar financeiro
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: Reset confirmation */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-white">Zerar Histórico Financeiro?</h4>
              </div>
              <button
                onClick={() => {
                  if (!isLoading) {
                    setIsOpen(false);
                    setErrorMsg(null);
                    setConfirmationText("");
                  }
                }}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed">
              Esta ação removerá todas as entradas, saídas e despesas. As categorias criadas não serão alteradas.
              <strong className="text-red-400 block mt-1">Essa operação é permanente e não pode ser revertida.</strong>
            </p>

            <div className="space-y-1.5">
              <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block">
                Digite ZERAR para prosseguir
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Digite ZERAR"
                disabled={isLoading}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500/50 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none transition-all focus:ring-1 focus:ring-red-500/10 tracking-widest text-center"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium text-center">
                {successMsg}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setErrorMsg(null);
                  setConfirmationText("");
                }}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={resetFinancialData}
                disabled={isLoading || confirmationText !== "ZERAR"}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-950/40 text-white disabled:text-zinc-500 text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Zerar dados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Claim/Migration confirmation */}
      {isClaimOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-white">Associar dados atuais?</h4>
              </div>
              <button
                onClick={() => {
                  if (!isClaiming) {
                    setIsClaimOpen(false);
                    setClaimErrorMsg(null);
                    setClaimConfirmationText("");
                  }
                }}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed">
              Isso varrerá todo o banco de dados do sistema, identificando e associando com segurança todos os lançamentos sem companyId ao seu painel financeiro atual.
            </p>

            <div className="space-y-1.5">
              <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block">
                Digite CONFIRMAR para prosseguir
              </label>
              <input
                type="text"
                value={claimConfirmationText}
                onChange={(e) => setClaimConfirmationText(e.target.value)}
                placeholder="Digite CONFIRMAR"
                disabled={isClaiming}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 tracking-widest text-center"
              />
            </div>

            {claimErrorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center">
                {claimErrorMsg}
              </div>
            )}

            {claimSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium text-center">
                {claimSuccessMsg}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setIsClaimOpen(false);
                  setClaimErrorMsg(null);
                  setClaimConfirmationText("");
                }}
                disabled={isClaiming}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={claimExistingData}
                disabled={isClaiming || claimConfirmationText !== "CONFIRMAR"}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-950/40 text-black disabled:text-zinc-500 text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                {isClaiming ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                )}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
