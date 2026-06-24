import React, { useState, useEffect } from "react";
import { CreditCard } from "@/types/finance";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { X, Check } from "lucide-react";

interface CreditCardFormProps {
  card?: CreditCard | null;
  userEmail: string;
  onClose: () => void;
  onSave: () => void;
}

export function CreditCardForm({ card, userEmail, onClose, onSave }: CreditCardFormProps) {
  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const [finalCartao, setFinalCartao] = useState("");
  const [diaInicioCiclo, setDiaInicioCiclo] = useState<number>(1);
  const [diaFimCiclo, setDiaFimCiclo] = useState<number>(30);
  const [diaVencimento, setDiaVencimento] = useState<number>(15);
  const [vencimentoMesSeguinte, setVencimentoMesSeguinte] = useState(true);
  const [limite, setLimite] = useState<string>("");
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (card) {
      setNome(card.nome || "");
      setBanco(card.banco || "");
      setFinalCartao(card.finalCartao || "");
      setDiaInicioCiclo(card.diaInicioCiclo ?? 1);
      setDiaFimCiclo(card.diaFimCiclo ?? 30);
      setDiaVencimento(card.diaVencimento ?? 15);
      setVencimentoMesSeguinte(card.vencimentoMesSeguinte ?? true);
      setLimite(card.limite ? String(card.limite) : "");
      setAtivo(card.ativo ?? true);
    }
  }, [card]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !banco.trim() || !finalCartao.trim()) {
      setError("Por favor, preencha o nome do cartão, banco e final do cartão.");
      return;
    }

    if (finalCartao.trim().length !== 4 || isNaN(Number(finalCartao))) {
      setError("O final do cartão deve conter exatamente 4 dígitos numéricos.");
      return;
    }

    if (
      diaInicioCiclo < 1 || diaInicioCiclo > 31 ||
      diaFimCiclo < 1 || diaFimCiclo > 31 ||
      diaVencimento < 1 || diaVencimento > 31
    ) {
      setError("Os dias de ciclo e vencimento devem ser números entre 1 e 31.");
      return;
    }

    setLoading(true);
    setError(null);

    const limitVal = limite.trim() !== "" ? parseFloat(limite.replace(",", ".")) : null;

    try {
      const payload = {
        nome: nome.trim(),
        banco: banco.trim(),
        finalCartao: finalCartao.trim(),
        diaInicioCiclo: Number(diaInicioCiclo),
        diaFimCiclo: Number(diaFimCiclo),
        diaVencimento: Number(diaVencimento),
        vencimentoMesSeguinte,
        limite: limitVal,
        ativo,
        atualizadoEm: serverTimestamp()
      };

      if (card?.id) {
        // Edit Mode
        const docRef = doc(db, "financeiro", "geral", "cartoes", card.id);
        await updateDoc(docRef, payload);
      } else {
        // Create Mode
        const newPayload = {
          ...payload,
          criadoEm: serverTimestamp(),
          criadoPorEmail: userEmail
        };
        await addDoc(collection(db, "financeiro", "geral", "cartoes"), newPayload);
      }
      
      onSave();
    } catch (err: any) {
      console.error("Erro ao salvar cartão:", err);
      setError("Ocorreu um erro ao salvar as configurações do cartão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
      />

      {/* Modal Card */}
      <div 
        id="credit-card-form"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl p-[1px] bg-gradient-to-tr from-emerald-500/30 via-zinc-800 to-zinc-800 shadow-2xl z-10"
      >
        <div className="bg-zinc-950 rounded-[23px] px-6 py-7 border border-white/5">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                {card ? "Editar Cartão de Crédito" : "Cadastrar Novo Cartão"}
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                CONFIGURAÇÕES DE FATURA E CICLO
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all hover:scale-105 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nome do Cartão
                </label>
                <input
                  type="text"
                  placeholder="Ex: Cartão Sicredi"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  Banco Emissor
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sicredi"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  4 Últimos Dígitos
                </label>
                <input
                  type="text"
                  placeholder="Ex: 6117"
                  maxLength={4}
                  value={finalCartao}
                  onChange={(e) => setFinalCartao(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  Limite de Crédito (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 15000.00"
                  value={limite}
                  onChange={(e) => setLimite(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-3.5">
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest block">
                Definições de Ciclo de Compras e Fatura
              </span>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Dia Início Ciclo
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={diaInicioCiclo}
                    onChange={(e) => setDiaInicioCiclo(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Dia Fim Ciclo
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={diaFimCiclo}
                    onChange={(e) => setDiaFimCiclo(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Vencimento
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-200">
                    Vencimento no mês seguinte
                  </span>
                  <span className="text-[10px] text-zinc-500 leading-relaxed">
                    Ex: Compras de Junho vencem no dia {diaVencimento || 15} de Julho.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vencimentoMesSeguinte}
                    onChange={(e) => setVencimentoMesSeguinte(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white" />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-zinc-200">Cartão Ativo</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white" />
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-xs text-zinc-400 hover:text-white transition-all cursor-pointer border border-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-55"
              >
                <Check className="w-4 h-4" />
                {loading ? "Salvando..." : "Salvar Cartão"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
