"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Transaction, FinanceCategory, PaymentMethod } from "@/types/finance";
import FileUpload from "./file-upload";
import { uploadToCloudinary } from "@/lib/cloudinary";

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transactionData: Omit<Transaction, "id" | "criadoEm"> & { id?: string }) => void;
  editingTransaction?: Transaction | null;
}

export default function TransactionForm({
  isOpen,
  onClose,
  onSubmit,
  editingTransaction,
}: TransactionFormProps) {
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState<number | "">("");
  const [descricao, setDescricao] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [data, setData] = useState("");
  const [categoria, setCategoria] = useState("");

  // DB States
  const [dbCategoriasEntrada, setDbCategoriasEntrada] = useState<FinanceCategory[]>([]);
  const [dbCategoriasSaida, setDbCategoriasSaida] = useState<FinanceCategory[]>([]);
  const [dbFormasPagamento, setDbFormasPagamento] = useState<PaymentMethod[]>([]);

  // Attachment states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingNoteUrl, setExistingNoteUrl] = useState<string | null>(null);
  const [existingNoteName, setExistingNoteName] = useState<string | null>(null);
  const [existingNoteTipo, setExistingNoteTipo] = useState<string | null>(null);
  const [existingNotePublicId, setExistingNotePublicId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Load Categories and Payment Methods from Firestore
  useEffect(() => {
    if (!isOpen) return;

    const qEntradas = query(
      collection(db, "financeiro", "geral", "categoriasEntrada"),
      orderBy("nome", "asc")
    );
    const qSaidas = query(
      collection(db, "financeiro", "geral", "categoriasSaida"),
      orderBy("nome", "asc")
    );
    const qFormas = query(
      collection(db, "financeiro", "geral", "formasPagamento"),
      orderBy("nome", "asc")
    );

    const unsubEntradas = onSnapshot(qEntradas, (snap) => {
      const list: FinanceCategory[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.ativo ?? true) {
          list.push({
            id: docSnap.id,
            nome: d.nome,
            ativo: d.ativo ?? true,
          });
        }
      });
      setDbCategoriasEntrada(list);
    });

    const unsubSaidas = onSnapshot(qSaidas, (snap) => {
      const list: FinanceCategory[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.ativo ?? true) {
          list.push({
            id: docSnap.id,
            nome: d.nome,
            ativo: d.ativo ?? true,
          });
        }
      });
      setDbCategoriasSaida(list);
    });

    const unsubFormas = onSnapshot(qFormas, (snap) => {
      const list: PaymentMethod[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.ativo ?? true) {
          list.push({
            id: docSnap.id,
            nome: d.nome,
            ativo: d.ativo ?? true,
          });
        }
      });
      setDbFormasPagamento(list);
    });

    return () => {
      unsubEntradas();
      unsubSaidas();
      unsubFormas();
    };
  }, [isOpen]);

  useEffect(() => {
    if (editingTransaction) {
      setTipo(editingTransaction.tipo);
      setNome(editingTransaction.nome);
      setValor(editingTransaction.valor);
      setDescricao(editingTransaction.descricao);
      setFormaPagamento(editingTransaction.formaPagamento);
      setData(editingTransaction.data);
      setCategoria(editingTransaction.categoria);

      setExistingNoteUrl(editingTransaction.notaUrl || null);
      setExistingNoteName(editingTransaction.notaNome || null);
      setExistingNoteTipo(editingTransaction.notaTipo || null);
      setExistingNotePublicId(editingTransaction.notaPublicId || null);
      setSelectedFile(null);
    } else {
      // Default initial states
      setTipo("entrada");
      setNome("");
      setValor("");
      setDescricao("");
      setData(new Date().toISOString().split("T")[0]);

      setExistingNoteUrl(null);
      setExistingNoteName(null);
      setExistingNoteTipo(null);
      setExistingNotePublicId(null);
      setSelectedFile(null);
    }
  }, [editingTransaction, isOpen]);

  // Synchronize category selection when list or type changes
  useEffect(() => {
    if (editingTransaction) return;

    const currentList = tipo === "entrada" ? dbCategoriasEntrada : dbCategoriasSaida;
    if (currentList.length > 0) {
      const exists = currentList.some((cat) => cat.nome === categoria);
      if (!exists) {
        setCategoria(currentList[0].nome);
      }
    } else {
      setCategoria("");
    }
  }, [tipo, dbCategoriasEntrada, dbCategoriasSaida, editingTransaction, categoria]);

  // Synchronize payment method selection
  useEffect(() => {
    if (editingTransaction) return;

    if (dbFormasPagamento.length > 0) {
      const exists = dbFormasPagamento.some((m) => m.nome === formaPagamento);
      if (!exists) {
        setFormaPagamento(dbFormasPagamento[0].nome);
      }
    } else {
      setFormaPagamento("");
    }
  }, [dbFormasPagamento, editingTransaction, formaPagamento]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !valor || !data || !categoria || !formaPagamento) {
      alert("Por favor, preencha todos os campos obrigatórios. Certifique-se de que possui categorias e formas de pagamento cadastradas.");
      return;
    }

    setIsUploading(true);
    try {
      let finalNotaUrl = existingNoteUrl;
      let finalNotaPublicId = existingNotePublicId;
      let finalNotaTipo = existingNoteTipo;
      let finalNotaName = existingNoteName;

      // If a new file is selected, upload it to Cloudinary
      if (selectedFile) {
        const res = await uploadToCloudinary(selectedFile);
        finalNotaUrl = res.url;
        finalNotaPublicId = res.publicId;
        finalNotaTipo = res.tipo;
        finalNotaName = res.nome;
      }

      onSubmit({
        tipo,
        nome,
        valor: Number(valor),
        descricao,
        formaPagamento,
        data,
        categoria,
        notaUrl: finalNotaUrl,
        notaPublicId: finalNotaPublicId,
        notaTipo: finalNotaTipo,
        notaNome: finalNotaName,
        id: editingTransaction?.id,
      });
      onClose();
    } catch (error: any) {
      console.error("Erro ao enviar nota para Cloudinary:", error);
      let errMsg = "Erro ao enviar arquivo. Verifique se o preset do Cloudinary permite upload deste tamanho.";
      if (error.message) {
        if (error.message.includes("preset") || error.message.includes("Preset")) {
          errMsg = "Upload preset inválido ou não está como Unsigned. Verifique se o preset do Cloudinary permite upload deste tamanho.";
        } else if (error.message.includes("configurado") || error.message.includes("Configuração")) {
          errMsg = "Cloudinary não configurado. Verifique .env.local.";
        } else if (error.message.includes("máximo")) {
          errMsg = error.message;
        } else {
          errMsg = `Erro ao enviar arquivo. Verifique se o preset do Cloudinary permite upload deste tamanho. Detalhes: ${error.message}`;
        }
      }
      alert(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveExistingNote = () => {
    setExistingNoteUrl(null);
    setExistingNoteName(null);
    setExistingNoteTipo(null);
    setExistingNotePublicId(null);
  };

  const currentCategories = tipo === "entrada" ? dbCategoriasEntrada : dbCategoriasSaida;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl p-[1px] bg-gradient-to-tr from-emerald-500/30 to-lime-400/20 shadow-2xl z-10"
          >
            {/* Modal Body */}
            <div className="bg-zinc-950 rounded-[23px] px-6 py-7 md:p-8 border border-white/5 max-h-[90vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  {editingTransaction ? "Editar Transação" : "Nova Entrada / Saída"}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-white/10 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Tipo Selector */}
                <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-zinc-900 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setTipo("entrada")}
                    className={`py-2 px-4 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                      tipo === "entrada"
                        ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/10"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo("saida")}
                    className={`py-2 px-4 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                      tipo === "saida"
                        ? "bg-red-500 text-white shadow-lg shadow-red-500/10"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Saída
                  </button>
                </div>

                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Nome / Título <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Venda de Licença SaaS, Campanha de Ads..."
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:ring-1 focus:ring-emerald-500/10"
                  />
                </div>

                {/* Valor & Data Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Valor */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Valor (R$) <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={valor}
                      onChange={(e) => setValor(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0,00"
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 font-mono"
                    />
                  </div>

                  {/* Data */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Data <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 font-mono"
                    />
                  </div>
                </div>

                {/* Categoria & Forma de Pagamento Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Categoria */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Categoria <span className="text-emerald-400">*</span>
                    </label>
                    <select
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      disabled={currentCategories.length === 0}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 cursor-pointer disabled:opacity-60"
                    >
                      {currentCategories.length === 0 ? (
                        <option value="">Nenhuma categoria cadastrada</option>
                      ) : (
                        currentCategories.map((cat) => (
                          <option key={cat.id} value={cat.nome}>
                            {cat.nome}
                          </option>
                        ))
                      )}
                    </select>
                    {currentCategories.length === 0 && (
                      <p className="text-[11px] text-amber-500/90 mt-1 font-medium">
                        Cadastre uma categoria na aba Cadastros.
                      </p>
                    )}
                  </div>

                  {/* Forma de Pagamento */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Forma de Pagamento <span className="text-emerald-400">*</span>
                    </label>
                    <select
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      disabled={dbFormasPagamento.length === 0}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 cursor-pointer disabled:opacity-60"
                    >
                      {dbFormasPagamento.length === 0 ? (
                        <option value="">Nenhuma forma de pagamento cadastrada</option>
                      ) : (
                        dbFormasPagamento.map((forma) => (
                          <option key={forma.id} value={forma.nome}>
                            {forma.nome}
                          </option>
                        ))
                      )}
                    </select>
                    {dbFormasPagamento.length === 0 && (
                      <p className="text-[11px] text-amber-500/90 mt-1 font-medium">
                        Cadastre uma forma de pagamento na aba Cadastros.
                      </p>
                    )}
                  </div>
                </div>

                {/* Descricao */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Descrição (Opcional)</label>
                  <textarea
                    rows={2}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Adicione observações complementares..."
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 resize-none"
                  />
                </div>

                {/* Optional Note Upload */}
                <FileUpload
                  onFileSelect={setSelectedFile}
                  onFileRemove={() => setSelectedFile(null)}
                  selectedFile={selectedFile}
                  existingNoteUrl={existingNoteUrl}
                  existingNoteName={existingNoteName}
                  existingNoteTipo={existingNoteTipo}
                  onRemoveExistingNote={handleRemoveExistingNote}
                  isLoading={isUploading}
                />

                {/* Buttons Action */}
                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isUploading}
                    className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-white/5 hover:border-white/10 hover:bg-zinc-800 font-medium text-sm text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 hover:from-emerald-400 hover:to-lime-300 font-semibold text-sm text-black transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-lg hover:shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Salvar Transação</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
