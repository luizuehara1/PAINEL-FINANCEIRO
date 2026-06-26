"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Building2, 
  AlertTriangle,
  Loader2,
  MapPin,
  FileText,
  Building,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { PropertyCostCenter } from "@/types/finance";
import { COMPANY_ID } from "@/lib/app-config";
import { ConfirmDialog } from "./confirm-dialog";
import { PaginationControls } from "./pagination-controls";

interface PropertyManagerProps {
  userEmail: string;
}

export default function PropertyManager({ userEmail }: PropertyManagerProps) {
  const [properties, setProperties] = useState<PropertyCostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Memoize paginated properties list
  const paginatedProperties = useMemo(() => {
    const activePage = Math.min(currentPage, Math.ceil(properties.length / pageSize) || 1);
    return properties.slice((activePage - 1) * pageSize, activePage * pageSize);
  }, [properties, currentPage, pageSize]);

  // Form State
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<PropertyCostCenter["tipo"]>("casa");
  const [endereco, setEndereco] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Confirm Dialog State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Fetch properties in real-time
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "financeiro", "geral", "imoveis"),
      orderBy("nome", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: PropertyCostCenter[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.companyId === COMPANY_ID) {
            list.push({
              id: docSnap.id,
              companyId: data.companyId,
              nome: data.nome,
              tipo: data.tipo || "casa",
              endereco: data.endereco || "",
              descricao: data.descricao || "",
              ativo: data.ativo ?? true,
              criadoEm: data.criadoEm,
              atualizadoEm: data.atualizadoEm,
              criadoPorEmail: data.criadoPorEmail || ""
            });
          }
        });
        setProperties(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "financeiro/geral/imoveis");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Show feedback
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
      showFeedback("error", "O nome do imóvel não pode ser vazio.");
      return;
    }

    // Check duplication (case insensitive, ignoring current editing item if editing)
    const exists = properties.some(
      (prop) => 
        prop.nome.toLowerCase() === trimmedNome.toLowerCase() && 
        prop.id !== editingId
    );

    if (exists) {
      showFeedback("error", `Já existe um imóvel cadastrado com o nome "${trimmedNome}".`);
      return;
    }

    setSaveLoading(true);
    try {
      if (editingId) {
        // Update existing property
        const docRef = doc(db, "financeiro", "geral", "imoveis", editingId);
        await updateDoc(docRef, {
          nome: trimmedNome,
          tipo,
          endereco: endereco.trim(),
          descricao: descricao.trim(),
          ativo,
          atualizadoEm: serverTimestamp()
        });
        showFeedback("success", `Imóvel "${trimmedNome}" atualizado com sucesso!`);
      } else {
        // Create new property
        await addDoc(collection(db, "financeiro", "geral", "imoveis"), {
          companyId: COMPANY_ID,
          nome: trimmedNome,
          tipo,
          endereco: endereco.trim(),
          descricao: descricao.trim(),
          ativo: true,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
          criadoPorEmail: userEmail
        });
        showFeedback("success", `Imóvel "${trimmedNome}" cadastrado com sucesso!`);
      }

      // Reset Form
      resetForm();
    } catch (err: any) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, "financeiro/geral/imoveis");
      showFeedback("error", "Ocorreu um erro ao salvar o imóvel.");
    } finally {
      setSaveLoading(false);
    }
  };

  const resetForm = () => {
    setNome("");
    setTipo("casa");
    setEndereco("");
    setDescricao("");
    setAtivo(true);
    setEditingId(null);
  };

  // Start Edit Mode
  const startEdit = (prop: PropertyCostCenter) => {
    setNome(prop.nome);
    setTipo(prop.tipo);
    setEndereco(prop.endereco || "");
    setDescricao(prop.descricao || "");
    setAtivo(prop.ativo);
    setEditingId(prop.id);
  };

  // Delete Action Trigger
  const handleDeleteTrigger = (id: string) => {
    setConfirmId(id);
    setConfirmOpen(true);
  };

  // Execute Delete
  const executeDelete = async () => {
    if (!confirmId) return;

    try {
      const docRef = doc(db, "financeiro", "geral", "imoveis", confirmId);
      await deleteDoc(docRef);
      showFeedback("success", "Imóvel excluído com sucesso!");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, "financeiro/geral/imoveis");
      showFeedback("error", "Não foi possível excluir o imóvel.");
    } finally {
      setConfirmOpen(false);
      setConfirmId(null);
    }
  };

  // Toggle Active Status
  const toggleActive = async (prop: PropertyCostCenter) => {
    try {
      const docRef = doc(db, "financeiro", "geral", "imoveis", prop.id);
      await updateDoc(docRef, {
        ativo: !prop.ativo,
        atualizadoEm: serverTimestamp()
      });
      showFeedback("success", `Status do imóvel "${prop.nome}" atualizado!`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, "financeiro/geral/imoveis");
      showFeedback("error", "Não foi possível atualizar o status do imóvel.");
    }
  };

  const getTipoLabel = (t: PropertyCostCenter["tipo"]) => {
    switch (t) {
      case "casa": return "Casa";
      case "apartamento": return "Apartamento";
      case "sala_comercial": return "Sala Comercial";
      case "terreno": return "Terreno";
      case "galpao": return "Galpão";
      case "outro": return "Outro";
      default: return "Outro";
    }
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-950 p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/25 text-emerald-400">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white uppercase tracking-tight font-mono">
            Imóveis / Centros de Custo
          </h2>
          <p className="text-xs text-zinc-400">
            Cadastre os imóveis para associar às despesas e controlar os custos separadamente.
          </p>
        </div>
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-zinc-900/30 border border-white/5 space-y-4">
        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
          {editingId ? "Editar Imóvel" : "Cadastrar Novo Imóvel"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nome */}
          <div className="space-y-1">
            <label htmlFor="prop-nome" className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Nome do Imóvel *
            </label>
            <input
              id="prop-nome"
              type="text"
              required
              placeholder="Ex: Apartamento Centro, Casa 1"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1">
            <label htmlFor="prop-tipo" className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Tipo
            </label>
            <select
              id="prop-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as PropertyCostCenter["tipo"])}
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer"
            >
              <option value="casa">Casa</option>
              <option value="apartamento">Apartamento</option>
              <option value="sala_comercial">Sala Comercial</option>
              <option value="terreno">Terreno</option>
              <option value="galpao">Galpão</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          {/* Endereço */}
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="prop-endereco" className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Endereço (opcional)
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-600" />
              <input
                id="prop-endereco"
                type="text"
                placeholder="Ex: Av. Paulista, 1000 - São Paulo"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="prop-desc" className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Descrição (opcional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-600" />
              <input
                id="prop-desc"
                type="text"
                placeholder="Ex: Informações sobre aluguel, IPTU, etc."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Ativo (Only visible when editing) */}
          {editingId && (
            <div className="flex items-center gap-2.5 py-1">
              <button
                type="button"
                onClick={() => setAtivo(!ativo)}
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {ativo ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-zinc-600" />}
              </button>
              <span className="text-xs font-semibold text-zinc-300">
                Imóvel {ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-white/5">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold transition-all"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={saveLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-950/20 transition-all flex items-center gap-2"
          >
            {saveLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>{editingId ? "Salvar Alterações" : "Cadastrar"}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Feedback Messages */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex gap-2.5 items-center ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* List / Table of Properties */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
          Imóveis Cadastrados ({properties.length})
        </h3>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs">Carregando imóveis...</span>
          </div>
        ) : properties.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
            Nenhum imóvel ou centro de custo cadastrado.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-white/5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Endereço</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-zinc-900/10">
                  {paginatedProperties.map((prop) => (
                    <tr 
                      key={prop.id} 
                      className="hover:bg-zinc-900/30 transition-colors text-xs text-zinc-300"
                    >
                      <td className="px-4 py-3 font-semibold text-white">
                        {prop.nome}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase">
                          {getTipoLabel(prop.tipo)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">
                        {prop.endereco || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleActive(prop)}
                          className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide cursor-pointer select-none transition-all border ${
                            prop.ativo
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                          }`}
                        >
                          {prop.ativo ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(prop)}
                            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 rounded-lg transition-colors"
                            title="Editar imóvel"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTrigger(prop.id)}
                            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Excluir imóvel"
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

            <PaginationControls
              currentPage={currentPage}
              totalPages={Math.ceil(properties.length / pageSize) || 1}
              pageSize={pageSize}
              totalRecords={properties.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {confirmOpen && (
        <ConfirmDialog
          open={confirmOpen}
          title="Excluir imóvel do cadastro?"
          description="Tem certeza que deseja excluir este imóvel? Despesas que já estão vinculadas a ele continuarão no sistema, mas você não poderá mais vincular novas despesas a ele."
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          variant="danger"
          onConfirm={executeDelete}
          onCancel={() => {
            setConfirmOpen(false);
            setConfirmId(null);
          }}
        />
      )}
    </div>
  );
}
