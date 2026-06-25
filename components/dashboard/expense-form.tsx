"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Expense, FinanceCategory, PaymentMethod, PropertyCostCenter } from "@/types/finance";
import FileUpload from "./file-upload";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { 
  generateInstallmentDates, 
  calculateInstallmentValues, 
  normalizeText, 
  isCreditCardPayment 
} from "@/lib/installment-utils";
import { getCompetenceFromDateStr } from "@/lib/cycle-utils";

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expenseData: Omit<Expense, "id" | "criadoEm"> & { id?: string }) => void;
  editingExpense?: Expense | null;
  preselectedType?: "fixa" | "variavel";
}

export default function ExpenseForm({
  isOpen,
  onClose,
  onSubmit,
  editingExpense,
  preselectedType = "fixa",
}: ExpenseFormProps) {
  const [tipo, setTipo] = useState<"fixa" | "variavel">(preselectedType);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState<number | "">("");
  const [descricao, setDescricao] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [data, setData] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [status, setStatus] = useState<"pendente" | "pago">("pendente");
  const [categoria, setCategoria] = useState("");

  // Recurrence states
  const [recorrente, setRecorrente] = useState(true);
  const [diaVencimento, setDiaVencimento] = useState<number | "">("");

  // Installment states
  const [parcelado, setParcelado] = useState(false);
  const [tipoPagamentoCartao, setTipoPagamentoCartao] = useState<"avista" | "parcelado">("avista");
  const [quantidadeParcelas, setQuantidadeParcelas] = useState<number>(12);
  const [valorTotalParcelado, setValorTotalParcelado] = useState<number>(0);
  const [valorParcela, setValorParcela] = useState<number>(0);
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>("");

  // DB States
  const [dbCategoriasFixas, setDbCategoriasFixas] = useState<FinanceCategory[]>([]);
  const [dbCategoriasVariaveis, setDbCategoriasVariaveis] = useState<FinanceCategory[]>([]);
  const [dbFormasPagamento, setDbFormasPagamento] = useState<PaymentMethod[]>([]);
  const [dbImoveis, setDbImoveis] = useState<PropertyCostCenter[]>([]);
  const [selectedImovelId, setSelectedImovelId] = useState<string>("");

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

    const qFixas = query(
      collection(db, "financeiro", "geral", "categoriasDespesasFixas"),
      orderBy("nome", "asc")
    );
    const qVariaveis = query(
      collection(db, "financeiro", "geral", "categoriasDespesasVariaveis"),
      orderBy("nome", "asc")
    );
    const qFormas = query(
      collection(db, "financeiro", "geral", "formasPagamento"),
      orderBy("nome", "asc")
    );
    const qImoveis = query(
      collection(db, "financeiro", "geral", "imoveis"),
      orderBy("nome", "asc")
    );

    const unsubFixas = onSnapshot(qFixas, (snap) => {
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
      setDbCategoriasFixas(list);
    });

    const unsubVariaveis = onSnapshot(qVariaveis, (snap) => {
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
      setDbCategoriasVariaveis(list);
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

    const unsubImoveis = onSnapshot(qImoveis, (snap) => {
      const list: PropertyCostCenter[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.ativo ?? true) {
          list.push({
            id: docSnap.id,
            nome: d.nome,
            tipo: d.tipo || "casa",
            ativo: d.ativo ?? true,
          });
        }
      });
      setDbImoveis(list);
    });

    return () => {
      unsubFixas();
      unsubVariaveis();
      unsubFormas();
      unsubImoveis();
    };
  }, [isOpen]);

  useEffect(() => {
    if (editingExpense) {
      setTipo(editingExpense.tipo);
      setNome(editingExpense.nome);
      setValor(editingExpense.valor);
      setDescricao(editingExpense.descricao);
      setFormaPagamento(editingExpense.formaPagamento);
      setData(editingExpense.data);
      setDataVencimento(editingExpense.dataVencimento);
      setStatus(editingExpense.status);
      setCategoria(editingExpense.categoria);
      setRecorrente(editingExpense.recorrente ?? false);
      setDiaVencimento(editingExpense.diaVencimento ?? "");
      setParcelado(editingExpense.parcelado ?? false);
      setTipoPagamentoCartao(editingExpense.parcelado ? "parcelado" : "avista");
      setQuantidadeParcelas(editingExpense.totalParcelas ?? 12);
      setValorTotalParcelado(editingExpense.valorTotalParcelado ?? (editingExpense.valor || 0));
      setValorParcela(editingExpense.valorParcela ?? 0);
      setDataPrimeiraParcela(editingExpense.dataVencimento || "");

      setExistingNoteUrl(editingExpense.notaUrl || null);
      setExistingNoteName(editingExpense.notaNome || null);
      setExistingNoteTipo(editingExpense.notaTipo || null);
      setExistingNotePublicId(editingExpense.notaPublicId || null);
      setSelectedFile(null);
      setSelectedImovelId(editingExpense.imovelId || "");
    } else {
      setTipo(preselectedType);
      setNome("");
      setValor("");
      setDescricao("");
      const todayStr = new Date().toISOString().split("T")[0];
      setData(todayStr);
      setDataVencimento(todayStr);
      setStatus("pendente");
      setRecorrente(true);
      setDiaVencimento(new Date().getDate());
      setParcelado(false);
      setTipoPagamentoCartao("avista");
      setQuantidadeParcelas(12);
      setValorTotalParcelado(0);
      setValorParcela(0);
      setDataPrimeiraParcela(todayStr);
      setSelectedImovelId("");

      setExistingNoteUrl(null);
      setExistingNoteName(null);
      setExistingNoteTipo(null);
      setExistingNotePublicId(null);
      setSelectedFile(null);
    }
  }, [editingExpense, isOpen, preselectedType]);

  // Handle dataVencimento automatic day derivation
  const handleDataVencimentoChange = (val: string) => {
    setDataVencimento(val);
    setDataPrimeiraParcela(val);
    if (val) {
      const day = Number(val.split("-")[2]);
      if (!isNaN(day) && day >= 1 && day <= 31) {
        setDiaVencimento(day);
      }
    }
  };

  // Synchronize category selection when list or type changes
  useEffect(() => {
    if (editingExpense) return;

    const currentList = tipo === "fixa" ? dbCategoriasFixas : dbCategoriasVariaveis;
    if (currentList.length > 0) {
      const exists = currentList.some((cat) => cat.nome === categoria);
      if (!exists) {
        setCategoria(currentList[0].nome);
      }
    } else {
      setCategoria("");
    }
  }, [tipo, dbCategoriasFixas, dbCategoriasVariaveis, editingExpense, categoria]);

  // Synchronize payment method selection
  useEffect(() => {
    if (editingExpense) return;

    if (dbFormasPagamento.length > 0) {
      const exists = dbFormasPagamento.some((m) => m.nome === formaPagamento);
      if (!exists) {
        setFormaPagamento(dbFormasPagamento[0].nome);
      }
    } else {
      setFormaPagamento("");
    }
  }, [dbFormasPagamento, editingExpense, formaPagamento]);

  const isCardSelected = isCreditCardPayment(formaPagamento);
  const showInstallments = tipo === "fixa" && isCardSelected;

  // DEBUG Logs
  console.log("Forma de pagamento selecionada:", formaPagamento);
  console.log("Forma normalizada:", normalizeText(formaPagamento));
  console.log("É cartão de crédito?", isCreditCardPayment(formaPagamento));
  console.log("Mostrar parcelamento?", showInstallments);

  // Synchronize card installment states whenever values change
  useEffect(() => {
    const valTotal = Number(valor) || 0;
    setValorTotalParcelado(valTotal);
    if (quantidadeParcelas > 0) {
      setValorParcela(Number((valTotal / quantidadeParcelas).toFixed(2)));
    } else {
      setValorParcela(0);
    }
  }, [valor, quantidadeParcelas]);

  // Handle automatic resets when changing to non-card payment
  useEffect(() => {
    if (formaPagamento && !isCreditCardPayment(formaPagamento)) {
      setParcelado(false);
      setTipoPagamentoCartao("avista");
      setQuantidadeParcelas(1);
    }
  }, [formaPagamento]);

  useEffect(() => {
    if (showInstallments && parcelado) {
      setRecorrente(false);
    }
  }, [showInstallments, parcelado]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !valor || !categoria || !formaPagamento) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setIsUploading(true);
    try {
      let finalNotaUrl = existingNoteUrl;
      let finalNotaPublicId = existingNotePublicId;
      let finalNotaTipo = existingNoteTipo;
      let finalNotaName = existingNoteName;

      // If a new file is selected, upload to Cloudinary
      if (selectedFile) {
        const res = await uploadToCloudinary(selectedFile);
        finalNotaUrl = res.url;
        finalNotaPublicId = res.publicId;
        finalNotaTipo = res.tipo;
        finalNotaName = res.nome;
      }

      // Set correct date variables
      const finalData = tipo === "variavel" ? data : "";
      const finalVencimento = tipo === "fixa" ? dataVencimento : "";

      const matchingImovel = dbImoveis.find((p) => p.id === selectedImovelId);
      const finalImovelId = selectedImovelId ? selectedImovelId : null;
      const finalImovelNome = matchingImovel ? matchingImovel.nome : null;
      const finalCentroCustoTipo = selectedImovelId ? ("imovel" as const) : null;

      onSubmit({
        tipo,
        nome,
        valor: Number(valor),
        descricao,
        formaPagamento,
        data: finalData,
        dataVencimento: finalVencimento,
        status,
        categoria,
        id: editingExpense?.id,
        pagoEm: status === "pago" ? (editingExpense?.pagoEm || new Date().toISOString().split("T")[0]) : undefined,
        transacaoGeradaId: editingExpense?.transacaoGeradaId || null,
        saidaGerada: editingExpense?.saidaGerada ?? false,
        recorrente: tipo === "fixa" ? (showInstallments && parcelado ? false : recorrente) : false,
        recorrenciaAtiva: tipo === "fixa" ? (showInstallments && parcelado ? false : (editingExpense?.id ? (editingExpense.recorrenciaAtiva ?? recorrente) : recorrente)) : false,
        diaVencimento: tipo === "fixa" && diaVencimento !== "" ? Number(diaVencimento) : undefined,
        competencia: tipo === "fixa" ? getCompetenceFromDateStr(finalVencimento) : undefined,
        grupoRecorrenciaId: editingExpense?.grupoRecorrenciaId,
        despesaOrigemId: editingExpense?.despesaOrigemId,
        baixadaCompletamente: editingExpense?.baixadaCompletamente,
        baixadaEm: editingExpense?.baixadaEm,
        motivoBaixa: editingExpense?.motivoBaixa,
        notaUrl: finalNotaUrl,
        notaPublicId: finalNotaPublicId,
        notaTipo: finalNotaTipo,
        notaNome: finalNotaName,
        imovelId: finalImovelId,
        imovelNome: finalImovelNome,
        centroCustoTipo: finalCentroCustoTipo,
        
        // Installment fields
        parcelado: showInstallments ? parcelado : false,
        totalParcelas: showInstallments && parcelado ? quantidadeParcelas : undefined,
        valorParcela: showInstallments && parcelado ? valorParcela : undefined,
        valorTotalParcelado: showInstallments && parcelado ? valorTotalParcelado : undefined,
        parcelamentoAtivo: showInstallments && parcelado ? true : undefined,
        parcelamentoQuitado: showInstallments && parcelado ? false : undefined,
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

  const categoriasFixas = [
    "Aluguel",
    "Internet",
    "Energia",
    "Água",
    "Sistema",
    "Funcionário",
    "Contabilidade",
    "Anúncios",
    "Outros",
  ];

  const categoriasVariaveis = [
    "Combustível",
    "Alimentação",
    "Manutenção",
    "Compra avulsa",
    "Taxas",
    "Outros",
  ];

  const formasPagamento = [
    "Pix",
    "Dinheiro",
    "Cartão de crédito",
    "Cartão de débito",
    "Transferência",
    "Boleto",
    "Outros",
  ];

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
                  {editingExpense ? "Editar Despesa" : "Nova Despesa Corporativa"}
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
                    onClick={() => setTipo("fixa")}
                    className={`py-2 px-4 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                      tipo === "fixa"
                        ? "bg-amber-500 text-black shadow-lg shadow-amber-500/10"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Despesa Fixa
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo("variavel")}
                    className={`py-2 px-4 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                      tipo === "variavel"
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/10"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Despesa Variável
                  </button>
                </div>

                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Nome / Credor <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Aluguel do Escritório, Licença AWS, Combustível..."
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:ring-1 focus:ring-emerald-500/10"
                  />
                </div>

                {/* Valor & Date Row */}
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

                  {/* Date (depends on fixed vs variable) */}
                  {tipo === "fixa" ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">
                        Vencimento <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={dataVencimento}
                        onChange={(e) => handleDataVencimentoChange(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 font-mono"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">
                        Data do Gasto <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={data}
                        onChange={(e) => setData(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Parcelamento no cartão */}
                {showInstallments && (
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-purple-500/20 shadow-lg shadow-purple-500/5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                        Parcelamento no Cartão
                      </h4>
                    </div>

                    {editingExpense ? (
                      <div className="text-xs text-zinc-400 leading-relaxed py-1">
                        Esta despesa faz parte de um parcelamento (Parcela {editingExpense.parcelaAtual || 1}/{editingExpense.totalParcelas || 12}). Alterações de valores nesta tela afetarão apenas esta parcela.
                      </div>
                    ) : (
                      <>
                        {/* Tipo de pagamento selection */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-300">Tipo de Pagamento</label>
                          <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-zinc-950 border border-white/5">
                            <button
                              type="button"
                              onClick={() => {
                                setParcelado(false);
                              }}
                              className={`py-1.5 px-3 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                                !parcelado
                                  ? "bg-zinc-800 text-white"
                                  : "text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              À vista
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setParcelado(true);
                                setRecorrente(false); // Force recurrente to false
                              }}
                              className={`py-1.5 px-3 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                                parcelado
                                  ? "bg-purple-500 text-white"
                                  : "text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              Parcelado
                            </button>
                          </div>
                        </div>

                        {parcelado && (
                          <div className="space-y-4">
                            {/* Quantidade de parcelas input */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-zinc-300">
                                Quantidade de parcelas <span className="text-emerald-400">*</span>
                              </label>
                              <input
                                type="number"
                                min="2"
                                max="48"
                                required={parcelado}
                                value={quantidadeParcelas}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setQuantidadeParcelas(val < 2 ? 2 : val);
                                }}
                                className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all font-mono"
                              />
                            </div>

                            {/* Calculations review */}
                            {(() => {
                              const valTotal = Number(valor) || 0;
                              const valParcela = quantidadeParcelas > 0 ? valTotal / quantidadeParcelas : 0;
                              const dates = generateInstallmentDates(dataPrimeiraParcela || dataVencimento, quantidadeParcelas);
                              const ultimaData = dates.length > 0 ? dates[dates.length - 1] : "";
                              
                              const formatBRDate = (dStr: string) => {
                                if (!dStr) return "";
                                const parts = dStr.split("-");
                                return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr;
                              };

                              return (
                                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/5 space-y-2">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-400">Quantidade de parcelas:</span>
                                    <span className="font-bold text-white font-mono">{quantidadeParcelas}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-400">Valor total:</span>
                                    <span className="font-bold text-white font-mono">
                                      R$ {valorTotalParcelado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-400">Valor da parcela:</span>
                                    <span className="font-bold text-purple-400 font-mono">
                                      R$ {valorParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-400">Data da primeira parcela (Vencimento):</span>
                                    <span className="text-zinc-300 font-mono">
                                      {formatBRDate(dataPrimeiraParcela || dataVencimento)}
                                    </span>
                                  </div>
                                  {ultimaData && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-zinc-400">Última parcela:</span>
                                      <span className="text-purple-300 font-mono">
                                        {formatBRDate(ultimaData)}
                                      </span>
                                    </div>
                                  )}

                                  {/* Preview list */}
                                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Prévia das parcelas</p>
                                    {dates.map((date, idx) => {
                                      const vals = calculateInstallmentValues(valTotal, quantidadeParcelas);
                                      return (
                                        <div key={idx} className="flex justify-between text-[11px] text-zinc-400 font-mono bg-zinc-900/40 px-2 py-1 rounded">
                                          <span>{idx + 1}/{quantidadeParcelas} - R$ {vals[idx]?.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - {formatBRDate(date)}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Recorrência Inteligente para Despesas Fixas */}
                {tipo === "fixa" && (
                  showInstallments && parcelado ? (
                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 leading-relaxed">
                      Despesas parceladas no cartão já serão distribuídas conforme o número de parcelas. A recorrência mensal será desativada.
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="recorrente"
                          checked={recorrente}
                          onChange={(e) => setRecorrente(e.target.checked)}
                          className="w-4 h-4 rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <label htmlFor="recorrente" className="text-xs font-semibold text-zinc-200 cursor-pointer select-none">
                          Repetir todos os meses (Recorrência Inteligente)
                        </label>
                      </div>

                      {recorrente && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-300">
                            Dia de vencimento <span className="text-emerald-400">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            required={recorrente}
                            value={diaVencimento}
                            onChange={(e) => setDiaVencimento(e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder="Ex: 10"
                            className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 font-mono"
                          />
                          <p className="text-[10px] text-zinc-500">
                            Uma nova despesa pendente para o mês seguinte será criada automaticamente ao liquidar este pagamento.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Categoria & Forma de Pagamento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Categoria */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Categoria <span className="text-emerald-400">*</span>
                    </label>
                    <select
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      disabled={(tipo === "fixa" ? dbCategoriasFixas : dbCategoriasVariaveis).length === 0}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 cursor-pointer disabled:opacity-60"
                    >
                      {(tipo === "fixa" ? dbCategoriasFixas : dbCategoriasVariaveis).length === 0 ? (
                        <option value="">Nenhuma categoria cadastrada</option>
                      ) : (
                        (tipo === "fixa" ? dbCategoriasFixas : dbCategoriasVariaveis).map((cat) => (
                          <option key={cat.id} value={cat.nome}>
                            {cat.nome}
                          </option>
                        ))
                      )}
                    </select>
                    {(tipo === "fixa" ? dbCategoriasFixas : dbCategoriasVariaveis).length === 0 && (
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

                {/* Status Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Status de Pagamento</label>
                  <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-zinc-900 border border-white/5">
                    <button
                      type="button"
                      onClick={() => setStatus("pendente")}
                      className={`py-2 px-4 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                        status === "pendente"
                          ? "bg-zinc-850 border border-zinc-700 text-amber-400"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Pendente / Em Aberto
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus("pago")}
                      className={`py-2 px-4 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                        status === "pago"
                          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Pago / Liquidado
                    </button>
                  </div>
                </div>

                {/* Imóvel / Centro de Custo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Imóvel / Centro de Custo (Opcional)
                  </label>
                  <select
                    value={selectedImovelId}
                    onChange={(e) => setSelectedImovelId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 cursor-pointer"
                  >
                    <option value="">Nenhum / Não associado</option>
                    {dbImoveis.map((imovel) => (
                      <option key={imovel.id} value={imovel.id}>
                        {imovel.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Descricao */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Descrição (Opcional)</label>
                  <textarea
                    rows={2}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Adicione notas adicionais sobre a despesa..."
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
                        <span>Salvar Despesa</span>
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
