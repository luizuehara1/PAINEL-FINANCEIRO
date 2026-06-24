"use client";

import React, { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  CreditCard, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { PaymentMethod } from "@/types/finance";

interface PaymentMethodManagerProps {
  userEmail: string;
}

export default function PaymentMethodManager({ userEmail }: PaymentMethodManagerProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch Payment Methods in real-time
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "financeiro", "geral", "formasPagamento"),
      orderBy("nome", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: PaymentMethod[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            nome: data.nome,
            descricao: data.descricao || "",
            ativo: data.ativo ?? true,
            criadoEm: data.criadoEm,
            atualizadoEm: data.atualizadoEm,
            criadoPorEmail: data.criadoPorEmail || ""
          });
        });
        setMethods(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "financeiro/geral/formasPagamento");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Show auto-dismissing feedback
  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // Submit Add / Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedNome = nome.trim();
    if (!trimmedNome) {
      showFeedback("error", "O nome da forma de pagamento não pode ser vazio.");
      return;
    }

    // Check duplication (case insensitive, ignoring current editing item if editing)
    const exists = methods.some(
      (m) => 
        m.nome.toLowerCase() === trimmedNome.toLowerCase() && 
        m.id !== editingId
    );

    if (exists) {
      showFeedback("error", `Já existe uma forma de pagamento cadastrada com o nome "${trimmedNome}".`);
      return;
    }

    setSaveLoading(true);
    try {
      if (editingId) {
        // Update existing payment method
        const docRef = doc(db, "financeiro", "geral", "formasPagamento", editingId);
        await updateDoc(docRef, {
          nome: trimmedNome,
          descricao: descricao.trim(),
          atualizadoEm: serverTimestamp()
        });
        showFeedback("success", "Forma de pagamento atualizada com sucesso!");
      } else {
        // Add new payment method
        const colRef = collection(db, "financeiro", "geral", "formasPagamento");
        await addDoc(colRef, {
          nome: trimmedNome,
          descricao: descricao.trim(),
          ativo: true,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
          criadoPorEmail: userEmail
        });
        showFeedback("success", "Forma de pagamento adicionada com sucesso!");
      }

      // Reset form
      setNome("");
      setDescricao("");
      setEditingId(null);
    } catch (err) {
      console.error(err);
      showFeedback("error", "Ocorreu um erro ao salvar a forma de pagamento.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Delete Payment Method
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir a forma de pagamento "${name}"?`)) return;

    try {
      const docRef = doc(db, "financeiro", "geral", "formasPagamento", id);
      await deleteDoc(docRef);
      showFeedback("success", `Forma de pagamento "${name}" excluída com sucesso!`);
      if (editingId === id) {
        setNome("");
        setDescricao("");
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
      showFeedback("error", "Erro ao excluir a forma de pagamento.");
    }
  };

  // Toggle active status
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const docRef = doc(db, "financeiro", "geral", "formasPagamento", id);
      await updateDoc(docRef, {
        ativo: !currentStatus,
        atualizadoEm: serverTimestamp()
      });
      showFeedback("success", `Forma de pagamento ${!currentStatus ? "ativada" : "desativada"} com sucesso!`);
    } catch (err) {
      console.error(err);
      showFeedback("error", "Erro ao alterar o status da forma de pagamento.");
    }
  };

  // Select for edit
  const handleEditSelect = (m: PaymentMethod) => {
    setEditingId(m.id);
    setNome(m.nome);
    setDescricao(m.descricao || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNome("");
    setDescricao("");
  };

  return (
    <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-5 md:p-6 backdrop-blur-md shadow-xl flex flex-col gap-6" id="payment-method-manager">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Formas de Pagamento
          </h3>
        </div>
        <p className="text-xs text-zinc-500">
          Gerencie os canais de recebimento e quitação de despesas no sistema.
        </p>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div 
          className={`flex items-center gap-2 p-3.5 rounded-xl border text-xs font-medium animate-fadeIn ${
            feedback.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
          id="feedback-payment-method"
        >
          {feedback.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Create / Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-4 bg-zinc-900/30 border border-white/5 rounded-xl p-4">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
          {editingId ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Pix, Cartão de Crédito..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs text-white outline-none font-sans"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
              Descrição (Opcional)
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição rápida da forma..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs text-white outline-none font-sans"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl border border-white/5 transition-all cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={saveLoading}
            className="bg-gradient-to-r from-emerald-500 to-lime-400 hover:from-emerald-400 hover:to-lime-300 disabled:opacity-50 text-black font-bold text-xs px-5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/5"
          >
            {saveLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            )}
            <span>{editingId ? "Salvar Alterações" : "Adicionar Forma"}</span>
          </button>
        </div>
      </form>

      {/* Items list */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
          Formas de Pagamento Cadastradas ({methods.length})
        </h4>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Carregando formas...</span>
          </div>
        ) : methods.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
            Nenhuma forma de pagamento cadastrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-zinc-500 uppercase tracking-wider text-[9px] font-bold">
                  <th className="py-2.5 px-3">Nome</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {methods.map((method) => (
                  <tr key={method.id} className="hover:bg-white/[0.01] transition-all">
                    <td className="py-3 px-3 font-medium text-white truncate max-w-[150px]">
                      {method.nome}
                    </td>
                    <td className="py-3 px-3 text-zinc-400 truncate max-w-[200px]" title={method.descricao}>
                      {method.descricao || <span className="text-zinc-600 font-mono text-[10px]">-</span>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                        method.ativo 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${method.ativo ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                        {method.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => handleToggleActive(method.id, method.ativo)}
                          title={method.ativo ? "Desativar" : "Ativar"}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            method.ativo 
                              ? "bg-zinc-900 text-red-400 border-white/5 hover:border-red-500/15 hover:bg-red-950/10" 
                              : "bg-zinc-900 text-emerald-400 border-white/5 hover:border-emerald-500/15 hover:bg-emerald-950/10"
                          }`}
                        >
                          {method.ativo ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleEditSelect(method)}
                          title="Editar"
                          className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 border border-white/5 hover:text-white hover:border-white/10 transition-all cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(method.id, method.nome)}
                          title="Excluir"
                          className="p-1.5 rounded-lg bg-zinc-900 text-zinc-500 border border-white/5 hover:text-red-400 hover:border-red-500/15 hover:bg-red-950/10 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
