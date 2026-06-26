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
  Tags, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { FinanceCategory } from "@/types/finance";
import { COMPANY_ID } from "@/lib/app-config";

interface CategoryManagerProps {
  collectionName: "categoriasEntrada" | "categoriasSaida" | "categoriasDespesasFixas" | "categoriasDespesasVariaveis";
  title: string;
  subtitle: string;
  userEmail: string;
}

export default function CategoryManager({ collectionName, title, subtitle, userEmail }: CategoryManagerProps) {
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch Categories in real-time
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "financeiro", "geral", collectionName),
      orderBy("nome", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: FinanceCategory[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.companyId === COMPANY_ID) {
            list.push({
              id: docSnap.id,
              companyId: data.companyId,
              nome: data.nome,
              descricao: data.descricao || "",
              ativo: data.ativo ?? true,
              criadoEm: data.criadoEm,
              atualizadoEm: data.atualizadoEm,
              criadoPorEmail: data.criadoPorEmail || ""
            });
          }
        });
        setCategories(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `financeiro/geral/${collectionName}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName]);

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
      showFeedback("error", "O nome da categoria não pode ser vazio.");
      return;
    }

    // Check duplication (case insensitive, ignoring current editing item if editing)
    const exists = categories.some(
      (cat) => 
        cat.nome.toLowerCase() === trimmedNome.toLowerCase() && 
        cat.id !== editingId
    );

    if (exists) {
      showFeedback("error", `Já existe uma categoria cadastrada com o nome "${trimmedNome}".`);
      return;
    }

    setSaveLoading(true);
    try {
      if (editingId) {
        // Update existing category
        const docRef = doc(db, "financeiro", "geral", collectionName, editingId);
        await updateDoc(docRef, {
          nome: trimmedNome,
          descricao: descricao.trim(),
          atualizadoEm: serverTimestamp()
        });
        showFeedback("success", "Categoria atualizada com sucesso!");
      } else {
        // Add new category
        const colRef = collection(db, "financeiro", "geral", collectionName);
        await addDoc(colRef, {
          companyId: COMPANY_ID,
          nome: trimmedNome,
          descricao: descricao.trim(),
          ativo: true,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
          criadoPorEmail: userEmail
        });
        showFeedback("success", "Categoria adicionada com sucesso!");
      }

      // Reset form
      setNome("");
      setDescricao("");
      setEditingId(null);
    } catch (err) {
      console.error(err);
      showFeedback("error", "Ocorreu um erro ao salvar a categoria.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Delete Category
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir a categoria "${name}"?`)) return;

    try {
      const docRef = doc(db, "financeiro", "geral", collectionName, id);
      await deleteDoc(docRef);
      showFeedback("success", `Categoria "${name}" excluída com sucesso!`);
      if (editingId === id) {
        setNome("");
        setDescricao("");
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
      showFeedback("error", "Erro ao excluir a categoria.");
    }
  };

  // Toggle active status
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const docRef = doc(db, "financeiro", "geral", collectionName, id);
      await updateDoc(docRef, {
        ativo: !currentStatus,
        atualizadoEm: serverTimestamp()
      });
      showFeedback("success", `Categoria ${!currentStatus ? "ativada" : "desativada"} com sucesso!`);
    } catch (err) {
      console.error(err);
      showFeedback("error", "Erro ao alterar o status da categoria.");
    }
  };

  // Select for edit
  const handleEditSelect = (cat: FinanceCategory) => {
    setEditingId(cat.id);
    setNome(cat.nome);
    setDescricao(cat.descricao || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNome("");
    setDescricao("");
  };

  return (
    <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-5 md:p-6 backdrop-blur-md shadow-xl flex flex-col gap-6" id={`category-manager-${collectionName}`}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Tags className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            {title}
          </h3>
        </div>
        <p className="text-xs text-zinc-500">
          {subtitle}
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
          id={`feedback-category-${collectionName}`}
        >
          {feedback.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Create / Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-4 bg-zinc-900/30 border border-white/5 rounded-xl p-4">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
          {editingId ? "Editar Categoria" : "Nova Categoria"}
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
              placeholder="Ex: Consultoria, Aluguel..."
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
              placeholder="Descrição rápida da categoria..."
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
            <span>{editingId ? "Salvar Alterações" : "Adicionar Categoria"}</span>
          </button>
        </div>
      </form>

      {/* Items list */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
          Categorias Cadastradas ({categories.length})
        </h4>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Carregando categorias...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
            Nenhuma categoria cadastrada.
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
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-white/[0.01] transition-all">
                    <td className="py-3 px-3 font-medium text-white truncate max-w-[150px]">
                      {cat.nome}
                    </td>
                    <td className="py-3 px-3 text-zinc-400 truncate max-w-[200px]" title={cat.descricao}>
                      {cat.descricao || <span className="text-zinc-600 font-mono text-[10px]">-</span>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                        cat.ativo 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${cat.ativo ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                        {cat.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => handleToggleActive(cat.id, cat.ativo)}
                          title={cat.ativo ? "Desativar" : "Ativar"}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            cat.ativo 
                              ? "bg-zinc-900 text-red-400 border-white/5 hover:border-red-500/15 hover:bg-red-950/10" 
                              : "bg-zinc-900 text-emerald-400 border-white/5 hover:border-emerald-500/15 hover:bg-emerald-950/10"
                          }`}
                        >
                          {cat.ativo ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleEditSelect(cat)}
                          title="Editar"
                          className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 border border-white/5 hover:text-white hover:border-white/10 transition-all cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id, cat.nome)}
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
