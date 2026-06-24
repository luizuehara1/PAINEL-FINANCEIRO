"use client";

import React, { useState } from "react";
import { BankAccount } from "@/types/finance";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Power, 
  DollarSign, 
  ShieldCheck, 
  Wallet, 
  FileText,
  PiggyBank,
  Building,
  CreditCard
} from "lucide-react";

interface BankManagerProps {
  banks: BankAccount[];
  userEmail: string;
}

export function BankManager({ banks, userEmail }: BankManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);

  // Form states
  const [nome, setNome] = useState("");
  const [tipoConta, setTipoConta] = useState<BankAccount["tipoConta"]>("corrente");
  const [banco, setBanco] = useState("");
  const [saldoAtual, setSaldoAtual] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);

  // Quick balance state
  const [updatingBalanceId, setUpdatingBalanceId] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState("");

  const handleOpenCreate = () => {
    setEditingBank(null);
    setNome("");
    setTipoConta("corrente");
    setBanco("");
    setSaldoAtual("");
    setDescricao("");
    setAtivo(true);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (bank: BankAccount) => {
    setEditingBank(bank);
    setNome(bank.nome);
    setTipoConta(bank.tipoConta);
    setBanco(bank.banco);
    setSaldoAtual(String(bank.saldoAtual));
    setDescricao(bank.descricao || "");
    setAtivo(bank.ativo);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !banco) {
      alert("Por favor, preencha os campos obrigatórios (Nome da conta e Banco/Instituição).");
      return;
    }

    const parsedSaldo = parseFloat(saldoAtual.replace(",", "."));
    if (isNaN(parsedSaldo)) {
      alert("Por favor, informe um saldo atual válido.");
      return;
    }

    const path = "financeiro/geral/bancos";
    try {
      if (editingBank) {
        const bankRef = doc(db, path, editingBank.id);
        await updateDoc(bankRef, {
          nome,
          tipoConta,
          banco,
          saldoAtual: parsedSaldo,
          descricao,
          ativo,
          atualizadoEm: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, path), {
          nome,
          tipoConta,
          banco,
          saldoAtual: parsedSaldo,
          descricao,
          ativo,
          criadoEm: Timestamp.now(),
          atualizadoEm: Timestamp.now(),
          criadoPorEmail: userEmail
        });
      }
      setIsFormOpen(false);
      setEditingBank(null);
    } catch (error) {
      handleFirestoreError(error, editingBank ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDelete = async (bank: BankAccount) => {
    if (!confirm(`Tem certeza que deseja excluir a conta/banco "${bank.nome}"?`)) {
      return;
    }
    const path = "financeiro/geral/bancos";
    try {
      await deleteDoc(doc(db, path, bank.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleToggleAtivo = async (bank: BankAccount) => {
    const path = "financeiro/geral/bancos";
    try {
      await updateDoc(doc(db, path, bank.id), {
        ativo: !bank.ativo,
        atualizadoEm: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleQuickBalanceSubmit = async (bank: BankAccount) => {
    const parsedSaldo = parseFloat(newBalance.replace(",", "."));
    if (isNaN(parsedSaldo)) {
      alert("Por favor, insira um valor numérico válido.");
      return;
    }

    const path = "financeiro/geral/bancos";
    try {
      await updateDoc(doc(db, path, bank.id), {
        saldoAtual: parsedSaldo,
        atualizadoEm: Timestamp.now()
      });
      setUpdatingBalanceId(null);
      setNewBalance("");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const getAccountTypeIcon = (type: BankAccount["tipoConta"]) => {
    switch (type) {
      case "corrente":
        return <Building className="w-4 h-4 text-zinc-400" />;
      case "poupanca":
        return <PiggyBank className="w-4 h-4 text-emerald-400" />;
      case "caixa":
        return <CreditCard className="w-4 h-4 text-amber-400" />;
      case "carteira":
        return <Wallet className="w-4 h-4 text-blue-400" />;
      default:
        return <DollarSign className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getAccountTypeLabel = (type: BankAccount["tipoConta"]) => {
    switch (type) {
      case "corrente":
        return "Conta Corrente";
      case "poupanca":
        return "Conta Poupança";
      case "caixa":
        return "Caixa / Operações";
      case "carteira":
        return "Dinheiro em Espécie / Carteira";
      default:
        return "Outros";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          Contas Bancárias e Caixas ({banks.length})
        </h3>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Conta/Banco
        </button>
      </div>

      {/* Grid listing */}
      {banks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10 space-y-3">
          <Wallet className="w-8 h-8 text-zinc-600" />
          <p className="text-xs text-zinc-500 font-medium">Nenhum banco ou caixa cadastrado ainda.</p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-all underline cursor-pointer"
          >
            Cadastrar conta bancária ou saldo em caixa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {banks.map((bank) => (
            <div
              key={bank.id}
              className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-48 relative overflow-hidden group ${
                bank.ativo 
                  ? "border-white/5 bg-zinc-900/10 hover:border-emerald-500/20 hover:bg-zinc-900/20" 
                  : "border-white/5 bg-zinc-900/50 opacity-60"
              }`}
            >
              {/* Subtle background decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all" />

              {/* Top row: Name & Actions */}
              <div className="flex justify-between items-start z-10">
                <div>
                  <div className="flex items-center gap-1.5">
                    {getAccountTypeIcon(bank.tipoConta)}
                    <span className="text-[10px] font-bold text-zinc-400 font-mono uppercase">
                      {bank.banco}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-emerald-300 transition-colors">
                    {bank.nome}
                  </h4>
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleAtivo(bank)}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      bank.ativo 
                        ? "bg-zinc-950 border-white/5 text-emerald-400 hover:bg-zinc-900" 
                        : "bg-zinc-950 border-white/5 text-zinc-500 hover:bg-zinc-900"
                    }`}
                    title={bank.ativo ? "Desativar conta" : "Ativar conta"}
                  >
                    <Power className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(bank)}
                    className="p-1.5 rounded-lg bg-zinc-950 border border-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(bank)}
                    className="p-1.5 rounded-lg bg-zinc-950 border border-white/5 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Description if any */}
              <div className="z-10 text-[11px] text-zinc-400 line-clamp-2 mt-1 select-none pr-4">
                {bank.descricao || <span className="text-zinc-600 italic">Sem descrição adicional</span>}
              </div>

              {/* Bottom row: Balance & Quick Update */}
              <div className="border-t border-white/5 pt-3 mt-2 z-10 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono block">Saldo Atual</span>
                  {updatingBalanceId === bank.id ? (
                    <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={newBalance}
                        onChange={(e) => setNewBalance(e.target.value)}
                        placeholder="R$ 0,00"
                        className="w-24 bg-zinc-950 border border-white/10 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-mono font-bold"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickBalanceSubmit(bank)}
                        className="p-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer transition-all"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpdatingBalanceId(null)}
                        className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group/balance">
                      <span className="text-base font-bold font-mono text-emerald-400">
                        R$ {bank.saldoAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setUpdatingBalanceId(bank.id);
                          setNewBalance(String(bank.saldoAtual));
                        }}
                        className="opacity-0 group-hover/balance:opacity-100 p-0.5 rounded text-zinc-400 hover:text-emerald-400 transition-opacity cursor-pointer text-[10px] font-bold"
                        title="Ajustar saldo rápido"
                      >
                        [ajustar]
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono block">Tipo</span>
                  <span className="text-[10px] font-bold text-zinc-300 mt-0.5 block font-sans">
                    {getAccountTypeLabel(bank.tipoConta)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation/Editing Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl shadow-black">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                {editingBank ? "Editar Conta Bancária / Caixa" : "Nova Conta Bancária / Caixa"}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Nome da Conta / Caixa*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Conta Principal PJ"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Banco / Instituição*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Nubank, Sicredi, Espécie"
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Tipo de Conta</label>
                  <select
                    value={tipoConta}
                    onChange={(e) => setTipoConta(e.target.value as BankAccount["tipoConta"])}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-bold"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Conta Poupança</option>
                    <option value="caixa">Caixa / Operações</option>
                    <option value="carteira">Dinheiro em Espécie</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Saldo Atual (R$)*</label>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={saldoAtual}
                    onChange={(e) => setSaldoAtual(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 font-bold font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Descrição (Opcional)</label>
                <textarea
                  placeholder="Observações sobre essa conta ou limite especial, etc."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 h-20 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="bankAtivo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded bg-zinc-900 border-white/5 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="bankAtivo" className="text-xs font-bold text-zinc-300 cursor-pointer font-mono uppercase tracking-wider select-none">
                  Conta Ativa (Ativo true)
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
                >
                  {editingBank ? "Salvar Alterações" : "Criar Conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
