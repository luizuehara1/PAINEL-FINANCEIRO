"use client";

import React, { useState } from "react";
import { Investment, BankAccount } from "@/types/finance";
import { 
  collection, 
  writeBatch, 
  doc, 
  Timestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { X, ArrowDownRight, DollarSign, Wallet, Calendar, FileText } from "lucide-react";

interface InvestmentRedeemModalProps {
  investment: Investment;
  banks: BankAccount[];
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function InvestmentRedeemModal({ 
  investment, 
  banks, 
  userEmail, 
  onClose, 
  onSuccess 
}: InvestmentRedeemModalProps) {
  const [valor, setValor] = useState("");
  const [dataResgate, setDataResgate] = useState(new Date().toISOString().split("T")[0]);
  const [bancoDestinoId, setBancoDestinoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);

  // Filter only active bank accounts
  const activeBanks = banks.filter(b => b.ativo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedValor = parseFloat(valor.replace(",", "."));
    if (isNaN(parsedValor) || parsedValor <= 0) {
      alert("Por favor, insira um valor de resgate válido e maior que zero.");
      return;
    }

    if (parsedValor > investment.valorAtual) {
      alert(`Erro: O valor do resgate (R$ ${parsedValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) não pode ser maior que o valor atual do investimento (R$ ${investment.valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`);
      return;
    }

    if (!bancoDestinoId) {
      alert("Por favor, selecione a conta bancária/caixa que receberá o saldo.");
      return;
    }

    setLoading(true);

    const batch = writeBatch(db);

    try {
      const selectedBank = banks.find(b => b.id === bancoDestinoId);
      if (!selectedBank) {
        throw new Error("Banco selecionado não encontrado.");
      }

      // 1. Update Investment Document
      const newValorAtual = investment.valorAtual - parsedValor;
      const investmentRef = doc(db, "financeiro", "geral", "investimentos", investment.id);
      batch.update(investmentRef, {
        valorAtual: newValorAtual,
        // If investment is fully redeemed, mark it as inactive (encerrado)
        ativo: newValorAtual > 0,
        atualizadoEm: Timestamp.now()
      });

      // 2. Update Bank Account Document (increment balance)
      const bankRef = doc(db, "financeiro", "geral", "bancos", bancoDestinoId);
      batch.update(bankRef, {
        saldoAtual: selectedBank.saldoAtual + parsedValor,
        atualizadoEm: Timestamp.now()
      });

      // 3. Create automatic financial transaction (Entrada in 'transacoes')
      const transRef = doc(collection(db, "financeiro", "geral", "transacoes"));
      const transPayload = {
        tipo: "entrada" as const,
        nome: `Resgate - ${investment.nome}`,
        descricao: descricao || `Resgate parcial/total do investimento ${investment.nome}`,
        categoria: "Resgate de investimento",
        valor: parsedValor,
        formaPagamento: "Transferência",
        data: dataResgate,
        origem: "investimento",
        investimentoId: investment.id,
        bancoDestinoId: bancoDestinoId,
        criadoEm: new Date().toISOString(),
        criadoPorEmail: userEmail,
      };
      batch.set(transRef, transPayload);

      // 4. Create Investment Movement log (movimentacoesInvestimentos)
      const moveRef = doc(collection(db, "financeiro", "geral", "movimentacoesInvestimentos"));
      const [year, month, day] = dataResgate.split("-").map(Number);
      const dataMov = Timestamp.fromDate(new Date(year, month - 1, day, 12, 0, 0));

      const movePayload = {
        investimentoId: investment.id,
        tipo: "resgate" as const,
        valor: parsedValor,
        data: dataMov,
        bancoDestinoId: bancoDestinoId,
        descricao: descricao || `Resgate para conta ${selectedBank.nome}`,
        criadoEm: Timestamp.now(),
        criadoPorEmail: userEmail
      };
      batch.set(moveRef, movePayload);

      // Commit the batch
      await batch.commit();

      alert(`Resgate de R$ ${parsedValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} concluído com sucesso!`);
      onSuccess();
    } catch (error) {
      console.error("Erro no resgate:", error);
      alert("Houve um erro ao processar o resgate.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl shadow-black relative overflow-hidden">
        {/* Decorative accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex justify-between items-center pb-2 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Resgatar Investimento</h3>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{investment.nome} • {investment.instituicao}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info card of current state */}
        <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 flex justify-between items-center relative z-10 font-mono">
          <div>
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Saldo Disponível</span>
            <span className="text-sm font-extrabold text-white block mt-0.5">
              R$ {investment.valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Taxa/Rend.</span>
            <span className="text-xs font-bold text-emerald-400 block mt-1">
              {investment.rentabilidade ? `${investment.rentabilidade}% a.a.` : "Não inf."}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Valor do Resgate (R$)*</label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs text-zinc-500 font-bold font-mono">R$</span>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 font-bold font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Data do Resgate*</label>
              <input
                type="date"
                required
                value={dataResgate}
                onChange={(e) => setDataResgate(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 font-bold font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Conta/Caixa de Destino*</label>
            <select
              required
              value={bancoDestinoId}
              onChange={(e) => setBancoDestinoId(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 font-bold"
            >
              <option value="">Selecione uma conta...</option>
              {activeBanks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.nome} ({bank.banco}) - Saldo: R$ {bank.saldoAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </option>
              ))}
            </select>
            {activeBanks.length === 0 && (
              <span className="text-[10px] text-red-400 font-semibold block mt-1">
                Atenção: Nenhuma conta bancária ativa disponível para destino. Por favor, crie uma conta primeiro.
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Descrição (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Resgate parcial para cobrir despesas operacionais"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 placeholder-zinc-500"
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-bold text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || activeBanks.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-all cursor-pointer shadow-lg shadow-amber-950/20 disabled:opacity-50"
            >
              {loading ? "Processando..." : "Confirmar Resgate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
