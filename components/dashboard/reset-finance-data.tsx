"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, Loader2, X } from "lucide-react";
import { collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ResetFinanceDataProps {
  onSuccess?: () => void;
  userEmail: string;
}

export default function ResetFinanceData({ onSuccess, userEmail }: ResetFinanceDataProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-6 backdrop-blur-md">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="text-lg font-bold text-red-400">Zona de Manutenção</h3>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
            Essa ação apaga todo o histórico de entradas, saídas, despesas fixas e despesas variáveis.
            Categorias e formas de pagamento serão mantidas.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setIsOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors shadow-lg shadow-red-900/20 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Zerar financeiro
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-white">Confirmar limpeza do financeiro?</h4>
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

            <div className="space-y-4">
              <p className="text-zinc-400 text-sm leading-relaxed">
                Essa ação vai apagar todas as entradas, saídas, despesas fixas e despesas variáveis do Firestore.
                <strong className="text-red-400 block mt-1">Essa ação não pode ser desfeita.</strong>
              </p>

              <div className="space-y-1.5">
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block">
                  Digite ZERAR para confirmar
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
                  className="flex-1 px-4 py-3 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={resetFinancialData}
                  disabled={isLoading || confirmationText !== "ZERAR"}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-950/40 text-white disabled:text-zinc-500 text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Confirmar e zerar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
