"use client";

import React, { useState } from "react";
import { 
  Database, 
  Search, 
  Link, 
  X, 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle,
  FileSpreadsheet
} from "lucide-react";
import { 
  findLegacyDocumentsWithoutCompanyId, 
  attachCompanyIdToLegacyDocuments,
  LegacyCounts 
} from "@/lib/data-recovery-utils";

interface DataRecoveryPanelProps {
  onSuccess?: () => void;
}

const FRIENDLY_NAMES: Record<string, string> = {
  transacoes: "Transações",
  despesas: "Despesas (Fixas/Variáveis)",
  cartoes: "Cartões de Crédito",
  faturasCartao: "Faturas de Cartão",
  itensCartao: "Itens de Fatura",
  bancos: "Contas Bancárias",
  investimentos: "Investimentos",
  patrimonios: "Patrimônios",
  imoveis: "Imóveis",
  categoriasEntrada: "Categorias de Entrada",
  categoriasSaida: "Categorias de Saída",
  categoriasDespesasFixas: "Categorias de Despesas Fixas",
  categoriasDespesasVariaveis: "Categorias de Despesas Variáveis",
  formasPagamento: "Formas de Pagamento",
  notas: "Notas e Anexos"
};

export default function DataRecoveryPanel({ onSuccess }: DataRecoveryPanelProps) {
  const [counts, setCounts] = useState<LegacyCounts | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check legacy documents
  const handleCheckData = async () => {
    setIsChecking(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await findLegacyDocumentsWithoutCompanyId();
      setCounts(result);
    } catch (err) {
      console.error("Erro ao verificar dados antigos:", err);
      setErrorMsg("Ocorreu um erro ao verificar documentos antigos.");
    } finally {
      setIsChecking(false);
    }
  };

  // Attach companyId to legacy documents
  const handleRecoverData = async () => {
    if (confirmationText !== "RECUPERAR") {
      setErrorMsg("Digite RECUPERAR exatamente em maiúsculo para prosseguir.");
      return;
    }

    setIsRecovering(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await attachCompanyIdToLegacyDocuments();
      setSuccessMsg(`${result.totalMigrated} documentos antigos foram vinculados com sucesso ao seu painel principal!`);
      
      // Clear checking counts state
      setCounts(null);
      setConfirmationText("");
      
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMsg(null);
      }, 3500);

    } catch (err) {
      console.error("Erro ao vincular dados antigos:", err);
      setErrorMsg("Erro ao vincular dados antigos. Tente novamente mais tarde.");
    } finally {
      setIsRecovering(false);
    }
  };

  // Helper to calculate total count
  const totalLegacyDocs = counts 
    ? Object.keys(counts).reduce((sum: number, key: string) => sum + (counts[key] || 0), 0)
    : 0;

  return (
    <div className="bg-zinc-950 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6" id="data-recovery-panel-container">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <Database className="w-5 h-5 text-emerald-400" />
        <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
          Recuperar dados antigos
        </h2>
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
        Encontramos documentos antigos sem identificação do painel. Você pode vincular esses dados ao painel atual para que voltem a aparecer.
      </p>

      {/* Buttons zone */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleCheckData}
          disabled={isChecking || isRecovering}
          className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-white/10 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isChecking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : (
            <Search className="w-3.5 h-3.5 text-emerald-400" />
          )}
          Verificar dados antigos
        </button>

        <button
          onClick={() => {
            setErrorMsg(null);
            setSuccessMsg(null);
            setConfirmationText("");
            setIsModalOpen(true);
          }}
          disabled={isChecking || isRecovering}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Link className="w-3.5 h-3.5" />
          Vincular dados antigos ao painel
        </button>
      </div>

      {/* Verification results display */}
      {counts && (
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Resumo da busca
            </h3>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
              {totalLegacyDocs} encontrados
            </span>
          </div>

          {totalLegacyDocs === 0 ? (
            <div className="text-center py-4 text-zinc-500 text-xs">
              Nenhum documento sem identificação foi encontrado. Seus dados estão 100% atualizados!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(counts).map(([colName, count]) => {
                if (count === 0) return null;
                return (
                  <div key={colName} className="bg-zinc-950/50 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">{FRIENDLY_NAMES[colName] || colName}</span>
                    <span className="font-mono font-bold text-emerald-400 bg-emerald-500/5 px-2 py-1 rounded-md border border-emerald-500/10">
                      {count} {count === 1 ? "antigo" : "antigos"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Database className="w-5 h-5 animate-pulse" />
                </div>
                <h4 className="text-lg font-bold text-white">Vincular dados antigos?</h4>
              </div>
              <button
                onClick={() => {
                  if (!isRecovering) {
                    setIsModalOpen(false);
                  }
                }}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warn or Details */}
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl p-3 text-[11px] leading-relaxed flex gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Atenção:</strong> Essa ação não apaga nada. Ela apenas adiciona <strong>companyId</strong> aos documentos antigos para que eles voltem a aparecer no painel.
              </div>
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed">
              Todos os lançamentos, despesas, cartões, categorias e demais registros históricos serão associados de forma segura e imediata ao seu identificador exclusivo corporativo.
            </p>

            {/* Input Confirmation code */}
            <div className="space-y-1.5">
              <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block">
                Digite RECUPERAR para confirmar
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Digite RECUPERAR"
                disabled={isRecovering}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 tracking-widest text-center"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium text-center flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isRecovering}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRecoverData}
                disabled={isRecovering || confirmationText !== "RECUPERAR"}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-950/40 text-black disabled:text-zinc-500 text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                {isRecovering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Vinculando...</span>
                  </>
                ) : (
                  <>
                    <Link className="w-3.5 h-3.5" />
                    <span>Confirmar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
