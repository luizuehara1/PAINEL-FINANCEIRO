"use client";

import React, { useState, useEffect } from "react";
import { 
  Check, 
  Trash2, 
  AlertTriangle, 
  Plus, 
  ChevronRight, 
  CreditCard as CardIcon, 
  Calendar,
  Save,
  ArrowRightLeft,
  X,
  Edit2,
  FileSpreadsheet,
  Info,
  User,
  Hash,
  Activity,
  CheckCircle2,
  ListFilter
} from "lucide-react";
import { CreditCard, ParsedCardItem, ImportInvoiceResult, FinanceCategory } from "@/types/finance";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, writeBatch, Timestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCycleStartDate, getCycleEndDate, getInvoiceDueDate } from "@/lib/card-cycle-utils";
import { parseCurrencyBR } from "@/lib/card-totals-utils";

interface CardInvoicePreviewProps {
  initialResult: ImportInvoiceResult;
  availableCards: CreditCard[];
  userEmail: string;
  onImportCompleted: (newCompetencia?: string) => void;
  onCancel: () => void;
  fileName: string;
}

export default function CardInvoicePreview({
  initialResult,
  availableCards,
  userEmail,
  onImportCompleted,
  onCancel,
  fileName,
}: CardInvoicePreviewProps) {
  const [metadata, setMetadata] = useState(initialResult.metadata);
  const [items, setItems] = useState<ParsedCardItem[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [competencia, setCompetencia] = useState(""); // "YYYY-MM"
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingHashes, setExistingHashes] = useState<Set<string>>(new Set());
  const [dbCategories, setDbCategories] = useState<FinanceCategory[]>([]);

  // Editing modal/form state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<ParsedCardItem | null>(null);

  // Load custom categories from Firestore
  useEffect(() => {
    const q = query(
      collection(db, "financeiro", "geral", "categorias"),
      where("ativo", "==", true)
    );
    getDocs(q).then((snap) => {
      const list: FinanceCategory[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as FinanceCategory);
      });
      setDbCategories(list);
    }).catch((err) => {
      console.error("Erro ao carregar categorias:", err);
    });
  }, []);

  // Set default initial data
  useEffect(() => {
    if (initialResult?.items) {
      setItems(initialResult.items);
    }
    if (initialResult?.metadata) {
      setMetadata(initialResult.metadata);
    }
    
    // Auto-select card if final numbers match or if it's the first available card
    const activeCards = availableCards.filter(c => c.ativo);
    if (activeCards.length > 0) {
      const detectedFinal = initialResult.metadata?.finalCartao;
      const matched = activeCards.find(c => detectedFinal && c.finalCartao.endsWith(detectedFinal));
      if (matched) {
        setSelectedCardId(matched.id);
      } else {
        setSelectedCardId(activeCards[0].id);
      }
    }

    // Set default competency "YYYY-MM" from detected date or current month
    if (initialResult.metadata?.dataVencimento) {
      const d = new Date(initialResult.metadata.dataVencimento);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      setCompetencia(mStr);
    } else {
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      setCompetencia(currentMonthStr);
    }
  }, [initialResult, availableCards]);

  // Unique hash builder for anti-duplicity verification
  const getHash = (
    banco: string,
    finalCartao: string,
    dataCompraStr: string,
    descricao: string,
    valor: number,
    parcelaAtual: number | null,
    totalParcelas: number | null
  ) => {
    return `${banco}_${finalCartao}_${dataCompraStr}_${descricao.trim().toUpperCase()}_${valor.toFixed(2)}_${parcelaAtual || ""}_${totalParcelas || ""}`;
  };

  const selectedCard = availableCards.find(c => c.id === selectedCardId);

  // Load existing imported items for selected card to identify duplicates
  useEffect(() => {
    if (!selectedCardId || !selectedCard) {
      setExistingHashes(new Set());
      return;
    }

    const q = query(
      collection(db, "financeiro", "geral", "itensCartao"),
      where("cartaoId", "==", selectedCardId)
    );

    getDocs(q).then((snap) => {
      const hashes = new Set<string>();
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        let dateStr = "";
        if (data.dataCompra instanceof Timestamp) {
          dateStr = data.dataCompra.toDate().toISOString().split("T")[0];
        } else if (data.dataCompra && typeof data.dataCompra.toDate === "function") {
          dateStr = data.dataCompra.toDate().toISOString().split("T")[0];
        } else {
          dateStr = String(data.dataCompra || "").split("T")[0];
        }

        const hash = getHash(
          selectedCard.banco,
          selectedCard.finalCartao,
          dateStr,
          data.descricao || data.nome || "",
          Number(data.valor) || 0,
          data.parcelaAtual || null,
          data.totalParcelas || null
        );
        hashes.add(hash);
      });
      setExistingHashes(hashes);
    }).catch((err) => {
      console.error("Erro ao carregar hashes para duplicidades:", err);
    });
  }, [selectedCardId, selectedCard]);

  const categoriesList = dbCategories.length > 0 
    ? dbCategories.map(c => c.nome) 
    : [
        "Alimentação",
        "Transporte",
        "Moradia",
        "Assinaturas & Software",
        "Anúncios",
        "Sistema",
        "Alimentação ou Mercado",
        "Despesa Fixa",
        "Material/Obra",
        "Saúde",
        "Outros"
      ];

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateDestino = (id: string, destino: ParsedCardItem["destino"]) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, destino } : item));
  };

  const handleStartEdit = (item: ParsedCardItem) => {
    setEditingItemId(item.id);
    setEditItem({ ...item });
  };

  const handleSaveEdit = () => {
    if (editingItemId && editItem) {
      setItems(prev => prev.map(item => item.id === editingItemId ? editItem : item));
      setEditingItemId(null);
      setEditItem(null);
    }
  };

  const handleAddItem = () => {
    const today = new Date().toISOString().split("T")[0];
    const newItem: ParsedCardItem = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      dataCompra: new Date(today),
      nome: "Novo Lançamento",
      descricao: "Inserido manualmente",
      categoriaSugerida: "Outros",
      valor: 10.00,
      valorOriginal: "10.00",
      parcelaAtual: null,
      totalParcelas: null,
      parcelado: false,
      destino: "despesa_variavel",
      status: "pendente",
      raw: {}
    };
    setItems(prev => [newItem, ...prev]);
    handleStartEdit(newItem);
  };

  const handleConfirmImport = async () => {
    if (!selectedCardId || !selectedCard) {
      alert("Por favor, selecione um cartão de crédito.");
      return;
    }
    if (!competencia) {
      alert("Por favor, informe a competência da fatura.");
      return;
    }
    if (items.length === 0) {
      alert("Sua lista de lançamentos está vazia.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Calculate due and closing dates based on card configuration and competency
      const startDate = getCycleStartDate(competencia, selectedCard);
      const endDate = getCycleEndDate(competencia, selectedCard);
      const dueDate = getInvoiceDueDate(competencia, selectedCard);

      const dataInicioCiclo = Timestamp.fromDate(startDate);
      const dataFimCiclo = Timestamp.fromDate(endDate);
      const dataVencimento = Timestamp.fromDate(dueDate);

      // 2. Filter out duplicates
      const finalItemsToImport: ParsedCardItem[] = [];
      const duplicateItems: ParsedCardItem[] = [];

      for (const item of items) {
        const itemDateStr = item.dataCompra instanceof Date 
          ? item.dataCompra.toISOString().split("T")[0] 
          : String(item.dataCompra).split("T")[0];

        const itemHash = getHash(
          selectedCard.banco,
          selectedCard.finalCartao,
          itemDateStr,
          item.descricao || item.nome,
          item.valor,
          item.parcelaAtual,
          item.totalParcelas
        );

        if (existingHashes.has(itemHash)) {
          duplicateItems.push(item);
        } else {
          finalItemsToImport.push(item);
        }
      }

      if (duplicateItems.length > 0 && finalItemsToImport.length === 0) {
        setIsSubmitting(false);
        alert("Todos os lançamentos selecionados já foram importados anteriormente para este cartão.");
        return;
      }

      if (duplicateItems.length > 0) {
        const confirmMsg = `${duplicateItems.length} lançamentos duplicados já existem no sistema e serão desconsiderados. Continuar importando as outras ${finalItemsToImport.length} novas transações?`;
        if (!confirm(confirmMsg)) {
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Calculate metrics for invoice
      const totalFixasCartao = items
        .filter(item => item.destino === "despesa_fixa")
        .reduce((sum, item) => sum + item.valor, 0);

      const totalVariaveisCartao = items
        .filter(item => item.destino === "despesa_variavel")
        .reduce((sum, item) => sum + item.valor, 0);

      const totalPagamentos = items
        .filter(item => item.destino === "pagamento_fatura")
        .reduce((sum, item) => sum + Math.abs(item.valor), 0);

      const totalCreditosEstornos = items
        .filter(item => item.destino === "credito_estorno")
        .reduce((sum, item) => sum + Math.abs(item.valor), 0);

      const valorTotalFatura = totalFixasCartao + totalVariaveisCartao - totalPagamentos - totalCreditosEstornos;

      // 4. Create or update the CardInvoice document
      const qInvoice = query(
        collection(db, "financeiro", "geral", "faturasCartao"),
        where("cartaoId", "==", selectedCardId),
        where("competencia", "==", competencia)
      );
      const invoiceSnap = await getDocs(qInvoice);
      let faturaId = "";

      const faturaPayload = {
        cartaoId: selectedCardId,
        cartaoNome: selectedCard.nome,
        banco: selectedCard.banco,
        finalCartao: selectedCard.finalCartao,
        competencia,
        dataInicioCiclo,
        dataFimCiclo,
        dataVencimento,
        valorTotal: valorTotalFatura,
        totalFixasCartao,
        totalVariaveisCartao,
        totalPagamentos,
        totalCreditosEstornos,
        status: "aberta" as const, // Abeto por padrão
        formatoOrigem: metadata.formatoDetectado || "xlsx",
        arquivoNome: fileName,
        atualizadoEm: Timestamp.now(),
        criadoPorEmail: userEmail,
      };

      if (!invoiceSnap.empty) {
        faturaId = invoiceSnap.docs[0].id;
        await updateDoc(doc(db, "financeiro", "geral", "faturasCartao", faturaId), faturaPayload);
      } else {
        const newInvoiceRef = await addDoc(collection(db, "financeiro", "geral", "faturasCartao"), {
          ...faturaPayload,
          criadoEm: Timestamp.now(),
        });
        faturaId = newInvoiceRef.id;
      }

      // 5. Batch write elements only to itensCartao (no normal despesas)
      const batch = writeBatch(db);

      for (const item of finalItemsToImport) {
        const itemRef = doc(collection(db, "financeiro", "geral", "itensCartao"));
        const itemId = itemRef.id;

        const itemDateStr = item.dataCompra instanceof Date 
          ? item.dataCompra.toISOString().split("T")[0] 
          : String(item.dataCompra).split("T")[0];

        const itemHash = getHash(
          selectedCard.banco,
          selectedCard.finalCartao,
          itemDateStr,
          item.descricao || item.nome,
          item.valor,
          item.parcelaAtual,
          item.totalParcelas
        );

        // Map UI destination to database classificacaoCartao
        let classification: "fixa_cartao" | "variavel_cartao" | "pagamento_fatura" | "credito_estorno" | "ignorar" = "variavel_cartao";
        if (item.destino === "despesa_fixa") classification = "fixa_cartao";
        else if (item.destino === "despesa_variavel") classification = "variavel_cartao";
        else if (item.destino === "pagamento_fatura") classification = "pagamento_fatura";
        else if (item.destino === "credito_estorno") classification = "credito_estorno";
        else if (item.destino === "ignorar") classification = "ignorar";

        const itemPayload = {
          faturaId,
          cartaoId: selectedCardId,
          cartaoNome: selectedCard.nome,
          banco: selectedCard.banco,
          finalCartao: selectedCard.finalCartao,
          dataCompra: Timestamp.fromDate(new Date(item.dataCompra)),
          descricao: item.descricao || item.nome,
          categoria: item.categoriaSugerida,
          valor: parseCurrencyBR(item.valor),
          valorOriginal: parseCurrencyBR(item.valorOriginal || item.valor),
          parcelaAtual: item.parcelaAtual || null,
          totalParcelas: item.totalParcelas || null,
          parcelado: !!item.parcelado,
          classificacaoCartao: classification,
          competencia,
          dataInicioCiclo,
          dataFimCiclo,
          dataVencimentoFatura: dataVencimento,
          status: classification === "ignorar" 
            ? ("ignorado" as const) 
            : ("pendente" as const),
          importHash: itemHash,
          origem: metadata.formatoDetectado === "sicredi_csv" 
            ? "importacao_csv" as const 
            : metadata.formatoDetectado === "pdf"
            ? "importacao_pdf" as const
            : metadata.formatoDetectado === "xlsx"
            ? "importacao_xlsx" as const
            : "importacao_ofx" as const,
          criadoEm: Timestamp.now(),
          atualizadoEm: Timestamp.now(),
          criadoPorEmail: userEmail,
        };

        batch.set(itemRef, itemPayload);
      }

      await batch.commit();
      alert("Fatura e lançamentos importados com sucesso!");
      onImportCompleted(competencia);

    } catch (err: any) {
      console.error("Erro ao importar fatura:", err);
      alert("Erro ao salvar faturas e lançamentos. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/5 gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
            Revisão da Fatura Importada
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Mapeie o cartão de crédito e a competência correspondente, revise as categorias e os destinos das transações.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAddItem}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-white/5 text-emerald-400 hover:text-emerald-300 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Transação
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-white/10 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metadata Overview Bento */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Bank & Format info */}
        <div className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 space-y-1.5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Origem
          </span>
          <div className="text-sm font-bold text-white font-mono uppercase">
            {metadata.bancoDetectado || "Banco Não Identificado"}
          </div>
          <div className="text-[10px] text-zinc-400">
            Formato: <span className="font-bold text-emerald-400 font-mono">{metadata.formatoDetectado}</span>
          </div>
        </div>

        {/* Card 2: Holder & Cartao Info */}
        <div className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 space-y-1.5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-emerald-400" /> Associado / Cartão
          </span>
          <div className="text-xs font-semibold text-white truncate" title={metadata.associado}>
            {metadata.associado || "Associado Indefinido"}
          </div>
          <div className="text-[10px] text-zinc-400 truncate">
            {metadata.cartaoNome || "Mastercard Black"} {metadata.finalCartao ? `(• ${metadata.finalCartao})` : ""}
          </div>
        </div>

        {/* Card 3: Amount Info */}
        <div className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 space-y-1.5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1">
            <Hash className="w-3.5 h-3.5 text-emerald-400" /> Valor / Lançamentos
          </span>
          <div className="text-sm font-bold text-white font-mono">
            {metadata.valorTotal ? `R$ ${metadata.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Não identificado"}
          </div>
          <div className="text-[10px] text-zinc-400">
            Total de <span className="font-bold text-white">{items.length}</span> lançamentos.
          </div>
        </div>

        {/* Card 4: Status Indicator */}
        <div className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 space-y-1.5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-emerald-400" /> Situação
          </span>
          <div className="text-xs font-semibold text-zinc-300">
            {metadata.situacao || "Válida"}
          </div>
          <div className="text-[10px] text-zinc-400 truncate">
            Arquivo: <span className="text-zinc-300 font-mono font-bold">{fileName}</span>
          </div>
        </div>
      </div>

      {/* Select Card and Competency Input Fields */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <CardIcon className="w-3.5 h-3.5 text-emerald-400" />
            Selecione o Cartão Destino <span className="text-emerald-400">*</span>
          </label>
          <select
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 cursor-pointer"
          >
            <option value="">Selecione um cartão</option>
            {availableCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.banco} - {card.nome} (•••• {card.finalCartao})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            Competência de Lançamento <span className="text-emerald-400">*</span>
          </label>
          <input
            type="month"
            required
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all focus:ring-1 focus:ring-emerald-500/10 font-mono"
          />
        </div>
      </div>

      {/* Inline Editing Form */}
      {editingItemId && editItem && (
        <div className="p-5 rounded-2xl bg-zinc-900 border border-emerald-500/30 space-y-4 shadow-xl">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Editar Lançamento</h4>
            <button
              type="button"
              onClick={() => { setEditingItemId(null); setEditItem(null); }}
              className="p-1 rounded bg-zinc-850 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Data Compra</label>
              <input
                type="date"
                value={editItem.dataCompra instanceof Date ? editItem.dataCompra.toISOString().split("T")[0] : String(editItem.dataCompra).split("T")[0]}
                onChange={(e) => setEditItem({ ...editItem, dataCompra: new Date(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none font-mono"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Descrição</label>
              <input
                type="text"
                value={editItem.descricao}
                onChange={(e) => setEditItem({ ...editItem, descricao: e.target.value, nome: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={editItem.valor}
                onChange={(e) => setEditItem({ ...editItem, valor: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Categoria</label>
              <select
                value={editItem.categoriaSugerida}
                onChange={(e) => setEditItem({ ...editItem, categoriaSugerida: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
              >
                {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Destino</label>
              <select
                value={editItem.destino}
                onChange={(e) => setEditItem({ ...editItem, destino: e.target.value as any })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
              >
                <option value="despesa_fixa">Despesa Fixa</option>
                <option value="despesa_variavel">Despesa Variável</option>
                <option value="ignorar">Ignorar</option>
                <option value="credito_estorno">Crédito / Estorno</option>
                <option value="pagamento_fatura">Pagamento Fatura</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Portador</label>
              <input
                type="text"
                value={editItem.portadorNome || ""}
                onChange={(e) => setEditItem({ ...editItem, portadorNome: e.target.value || null })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                placeholder="Nome do Portador"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-zinc-900/20 max-h-[420px] overflow-y-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/5 bg-zinc-900/50 sticky top-0 z-10">
              <th className="py-3.5 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Data</th>
              <th className="py-3.5 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Lançamento / Descrição</th>
              <th className="py-3.5 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Portador</th>
              <th className="py-3.5 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono text-right">Valor</th>
              <th className="py-3.5 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Categoria</th>
              <th className="py-3.5 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono text-center">Destino</th>
              <th className="py-3.5 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono text-center">Status</th>
              <th className="py-3.5 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item) => {
              const dateObj = item.dataCompra instanceof Date ? item.dataCompra : new Date(item.dataCompra);
              const dateFormatted = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString("pt-BR", { timeZone: "UTC" })
                : "Data inválida";

              const itemDateStr = dateObj.toISOString().split("T")[0];

              const isDuplicate = selectedCard ? existingHashes.has(getHash(
                selectedCard.banco,
                selectedCard.finalCartao,
                itemDateStr,
                item.descricao || item.nome,
                item.valor,
                item.parcelaAtual,
                item.totalParcelas
              )) : false;

              return (
                <tr key={item.id} className={`hover:bg-zinc-900/30 transition-all ${isDuplicate ? "opacity-60" : ""}`}>
                  <td className="py-3 px-4 text-xs font-mono text-zinc-300">{dateFormatted}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-xs text-white flex items-center gap-1.5 flex-wrap">
                      <span>{item.descricao}</span>
                      {item.parcelado && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-[9px] font-bold text-purple-300 font-mono">
                          PARCELA {item.parcelaAtual}/{item.totalParcelas}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-400 font-mono">
                    {item.portadorNome || <span className="text-zinc-600">-</span>}
                  </td>
                  <td className={`py-3 px-4 text-xs font-mono font-bold text-right ${item.valor < 0 ? "text-emerald-400" : "text-white"}`}>
                    R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-400">
                    <span className="bg-zinc-900 px-2 py-1 rounded border border-white/5">
                      {item.categoriaSugerida}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <select
                      value={item.destino}
                      onChange={(e) => handleUpdateDestino(item.id, e.target.value as any)}
                      className={`px-2 py-1 text-[10px] font-bold uppercase rounded-lg border outline-none bg-zinc-950 cursor-pointer transition-all ${
                        item.destino === "despesa_fixa" 
                          ? "text-amber-400 border-amber-500/20"
                          : item.destino === "despesa_variavel"
                          ? "text-blue-400 border-blue-500/20"
                          : item.destino === "ignorar"
                          ? "text-zinc-500 border-white/5"
                          : item.destino === "credito_estorno"
                          ? "text-emerald-400 border-emerald-500/20"
                          : "text-purple-400 border-purple-500/20"
                      }`}
                    >
                      <option value="despesa_fixa">Despesa Fixa</option>
                      <option value="despesa_variavel">Despesa Var.</option>
                      <option value="ignorar">Ignorar</option>
                      <option value="credito_estorno">Crédito/Estorno</option>
                      <option value="pagamento_fatura">Pagt. Fatura</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {isDuplicate ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-400 font-mono">
                        Já Importado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 font-mono">
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer"
                        title="Editar lançamento"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg bg-zinc-950 hover:bg-red-950/40 border border-white/5 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                        title="Remover da lista"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-white/5 gap-4">
        <div className="text-xs text-zinc-500">
          Total de <span className="text-white font-bold">{items.length}</span> lançamentos prontos para importação.
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-xs text-zinc-300 hover:text-white border border-white/5 transition-all cursor-pointer disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={isSubmitting || !selectedCardId}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:opacity-50 font-bold text-xs text-black transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-95"
          >
            {isSubmitting ? (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Confirmar Importação
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
