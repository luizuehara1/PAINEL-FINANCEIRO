"use client";

import React, { useState, useEffect } from "react";
import { 
  CreditCard as CardIcon, 
  Plus, 
  Upload, 
  DollarSign, 
  Calendar, 
  Trash2, 
  Edit2, 
  Clock, 
  ChevronRight, 
  Search, 
  Download, 
  Check, 
  X, 
  ArrowLeft,
  Filter,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  Timestamp, 
  where, 
  getDocs, 
  writeBatch 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  CreditCard as ICreditCard, 
  CardInvoice, 
  CardItem, 
  ImportInvoiceResult, 
  FinanceCategory 
} from "@/types/finance";
import { CreditCardForm } from "./credit-card-form";
import CardInvoiceImport from "./card-invoice-import";
import CardInvoicePreview from "./card-invoice-preview";
import { CardManualEntryForm } from "./card-manual-entry-form";
import { exportCardInvoicePDF } from "@/lib/pdf-utils";

interface CardExpensesSectionProps {
  userEmail: string;
}

export default function CardExpensesSection({ userEmail }: CardExpensesSectionProps) {
  // DB States
  const [cards, setCards] = useState<ICreditCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [categories, setCategories] = useState<string[]>(["Alimentação", "Sistemas", "Anúncios", "Transporte", "Saúde", "Outros"]);

  // Navigation state
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("");

  // Invoice & Items States for the selected card
  const [currentInvoice, setCurrentInvoice] = useState<CardInvoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<CardItem[]>([]);
  const [loadingInvoiceData, setLoadingInvoiceData] = useState(false);
  const [allCompetencias, setAllCompetencias] = useState<string[]>([]);

  // Filtering states
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterClassification, setFilterClassification] = useState("");

  // Modals & UI States
  const [isCardFormOpen, setIsCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<ICreditCard | null>(null);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CardItem | null>(null);
  const [importState, setImportState] = useState<"none" | "upload" | "preview">("none");
  const [importResult, setImportResult] = useState<ImportInvoiceResult | null>(null);
  const [importFileName, setImportFileName] = useState("");

  // Edit Item Form Fields
  const [editDesc, setEditDesc] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editClassification, setEditClassification] = useState<any>("variavel_cartao");

  const selectedCard = cards.find(c => c.id === selectedCardId);

  // Load registered cards
  useEffect(() => {
    const q = query(
      collection(db, "financeiro", "geral", "cartoes"),
      orderBy("nome", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: ICreditCard[] = [];
      snap.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data()
        } as ICreditCard);
      });
      setCards(list);
      setLoadingCards(false);

      // Pre-select first card if only one exists
      if (list.length === 1 && !selectedCardId) {
        setSelectedCardId(list[0].id);
      }
    }, (error) => {
      console.error("Erro ao carregar cartões:", error);
      setLoadingCards(false);
    });

    return () => unsub();
  }, []);

  // Load distinct categories from database despesas
  useEffect(() => {
    const qFixas = query(collection(db, "financeiro", "geral", "categoriasDespesasFixas"), orderBy("nome", "asc"));
    const qVariaveis = query(collection(db, "financeiro", "geral", "categoriasDespesasVariaveis"), orderBy("nome", "asc"));

    const unsub1 = onSnapshot(qFixas, (snap) => {
      const list: string[] = [];
      snap.forEach(d => {
        if (d.data().nome) list.push(d.data().nome);
      });
      setCategories(prev => Array.from(new Set([...prev, ...list])));
    });

    const unsub2 = onSnapshot(qVariaveis, (snap) => {
      const list: string[] = [];
      snap.forEach(d => {
        if (d.data().nome) list.push(d.data().nome);
      });
      setCategories(prev => Array.from(new Set([...prev, ...list])));
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // Fetch all competencies (distinct list) for the selected card
  useEffect(() => {
    if (!selectedCardId) return;

    // First load faturas to see what we have
    const qFaturas = query(
      collection(db, "financeiro", "geral", "faturasCartao"),
      where("cartaoId", "==", selectedCardId)
    );

    const unsub = onSnapshot(qFaturas, (snap) => {
      const competencies: string[] = [];
      snap.forEach(d => {
        const comp = d.data().competencia;
        if (comp && !competencies.includes(comp)) {
          competencies.push(comp);
        }
      });

      // Also list some future / recent months by default if none exist
      const today = new Date();
      for (let i = -3; i <= 3; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const compStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!competencies.includes(compStr)) {
          competencies.push(compStr);
        }
      }

      // Sort chronological descending
      competencies.sort((a, b) => b.localeCompare(a));
      setAllCompetencias(competencies);

      // Pre-select current competence if not selected
      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      if (!selectedCompetencia || !competencies.includes(selectedCompetencia)) {
        if (competencies.includes(currentMonthStr)) {
          setSelectedCompetencia(currentMonthStr);
        } else {
          setSelectedCompetencia(competencies[0] || currentMonthStr);
        }
      }
    });

    return () => unsub();
  }, [selectedCardId]);

  // Load items and the specific invoice for selected card + competency
  useEffect(() => {
    if (!selectedCardId || !selectedCompetencia) {
      setCurrentInvoice(null);
      setInvoiceItems([]);
      return;
    }

    setLoadingInvoiceData(true);

    // 1. Listen to items (itensCartao)
    const qItems = query(
      collection(db, "financeiro", "geral", "itensCartao"),
      where("cartaoId", "==", selectedCardId),
      where("competencia", "==", selectedCompetencia)
    );

    const unsubItems = onSnapshot(qItems, (snap) => {
      const itemsList: CardItem[] = [];
      snap.forEach(docSnap => {
        itemsList.push({
          id: docSnap.id,
          ...docSnap.data()
        } as CardItem);
      });

      // Sort by purchase date ascending
      itemsList.sort((a, b) => {
        const dateA = a.dataCompra?.toDate ? a.dataCompra.toDate() : new Date(a.dataCompra);
        const dateB = b.dataCompra?.toDate ? b.dataCompra.toDate() : new Date(b.dataCompra);
        return dateA.getTime() - dateB.getTime();
      });

      setInvoiceItems(itemsList);
    });

    // 2. Listen to invoice (faturasCartao)
    const qInvoice = query(
      collection(db, "financeiro", "geral", "faturasCartao"),
      where("cartaoId", "==", selectedCardId),
      where("competencia", "==", selectedCompetencia)
    );

    const unsubInvoice = onSnapshot(qInvoice, (snap) => {
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        setCurrentInvoice({
          id: docSnap.id,
          ...docSnap.data()
        } as CardInvoice);
      } else {
        setCurrentInvoice(null);
      }
      setLoadingInvoiceData(false);
    });

    return () => {
      unsubItems();
      unsubInvoice();
    };
  }, [selectedCardId, selectedCompetencia]);

  // Save or edit a credit card definition
  const handleCardFormSubmit = async (cardData: Omit<ICreditCard, "id" | "criadoEm"> & { id?: string }) => {
    try {
      if (cardData.id) {
        const cardRef = doc(db, "financeiro", "geral", "cartoes", cardData.id);
        await updateDoc(cardRef, {
          ...cardData,
          atualizadoEm: Timestamp.now()
        });
      } else {
        const { id, ...cleanData } = cardData;
        await addDoc(collection(db, "financeiro", "geral", "cartoes"), {
          ...cleanData,
          criadoEm: Timestamp.now(),
          atualizadoEm: Timestamp.now(),
          criadoPorEmail: userEmail,
        });
      }
      setIsCardFormOpen(false);
    } catch (err) {
      console.error("Erro ao salvar cartão:", err);
      alert("Erro ao salvar cartão corporativo.");
    }
  };

  // Delete credit card
  const handleDeleteCard = async (card: ICreditCard) => {
    if (!confirm(`Tem certeza que deseja excluir o cartão "${card.nome}" (${card.banco})? Faturas e itens importados dele continuarão salvos, mas você não poderá mais cadastrar compras neste cartão.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "financeiro", "geral", "cartoes", card.id));
      if (selectedCardId === card.id) setSelectedCardId(null);
    } catch (err) {
      console.error("Erro ao excluir cartão:", err);
      alert("Erro ao excluir cartão.");
    }
  };

  // Recalculates metrics for invoice document in case of manual edits or deletions
  const syncInvoiceMetrics = async (invoiceId: string, itemsList: CardItem[]) => {
    const totalFixasCartao = itemsList
      .filter(item => item.classificacaoCartao === "fixa_cartao")
      .reduce((sum, item) => sum + item.valor, 0);

    const totalVariaveisCartao = itemsList
      .filter(item => item.classificacaoCartao === "variavel_cartao")
      .reduce((sum, item) => sum + item.valor, 0);

    const totalPagamentos = itemsList
      .filter(item => item.classificacaoCartao === "pagamento_fatura")
      .reduce((sum, item) => sum + Math.abs(item.valor), 0);

    const totalCreditosEstornos = itemsList
      .filter(item => item.classificacaoCartao === "credito_estorno")
      .reduce((sum, item) => sum + Math.abs(item.valor), 0);

    const valorTotal = totalFixasCartao + totalVariaveisCartao - totalPagamentos - totalCreditosEstornos;

    await updateDoc(doc(db, "financeiro", "geral", "faturasCartao", invoiceId), {
      totalFixasCartao,
      totalVariaveisCartao,
      totalPagamentos,
      totalCreditosEstornos,
      valorTotal,
      atualizadoEm: Timestamp.now()
    });
  };

  // Mark selected invoice as paid & generate transaction
  const handleMarkAsPaid = async () => {
    if (!selectedCard || !selectedCompetencia) return;

    // Check if we have items or invoice document
    let invoiceToPay = currentInvoice;
    if (!invoiceToPay) {
      // Create a skeleton CardInvoice document if none exists yet
      if (invoiceItems.length === 0) {
        alert("Não é possível pagar uma fatura sem lançamentos.");
        return;
      }
      if (!confirm("Não existe uma fatura criada para este período. Deseja consolidar os lançamentos e registrar o pagamento?")) {
        return;
      }

      const totalFixasCartao = invoiceItems
        .filter(item => item.classificacaoCartao === "fixa_cartao")
        .reduce((sum, item) => sum + item.valor, 0);

      const totalVariaveisCartao = invoiceItems
        .filter(item => item.classificacaoCartao === "variavel_cartao")
        .reduce((sum, item) => sum + item.valor, 0);

      const totalPagamentos = invoiceItems
        .filter(item => item.classificacaoCartao === "pagamento_fatura")
        .reduce((sum, item) => sum + Math.abs(item.valor), 0);

      const totalCreditosEstornos = invoiceItems
        .filter(item => item.classificacaoCartao === "credito_estorno")
        .reduce((sum, item) => sum + Math.abs(item.valor), 0);

      const valorTotal = totalFixasCartao + totalVariaveisCartao - totalPagamentos - totalCreditosEstornos;

      const newInvoiceRef = await addDoc(collection(db, "financeiro", "geral", "faturasCartao"), {
        cartaoId: selectedCardId,
        cartaoNome: selectedCard.nome,
        banco: selectedCard.banco,
        finalCartao: selectedCard.finalCartao,
        competencia: selectedCompetencia,
        dataInicioCiclo: invoiceItems[0]?.dataInicioCiclo || Timestamp.now(),
        dataFimCiclo: invoiceItems[0]?.dataFimCiclo || Timestamp.now(),
        dataVencimento: invoiceItems[0]?.dataVencimentoFatura || Timestamp.now(),
        valorTotal,
        totalFixasCartao,
        totalVariaveisCartao,
        totalPagamentos,
        totalCreditosEstornos,
        status: "aberta",
        criadoEm: Timestamp.now(),
        criadoPorEmail: userEmail
      });

      // Fetch immediately to have reference
      const invoiceSnap = await getDocs(query(collection(db, "financeiro", "geral", "faturasCartao"), where("cartaoId", "==", selectedCardId), where("competencia", "==", selectedCompetencia)));
      if (!invoiceSnap.empty) {
        invoiceToPay = { id: invoiceSnap.docs[0].id, ...invoiceSnap.docs[0].data() } as CardInvoice;
      }
    }

    if (!invoiceToPay) return;

    if (!confirm(`Deseja confirmar o pagamento total da fatura de ${selectedCompetencia} no valor de R$ ${invoiceToPay.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}? Isso gerará uma saída na seção Entradas e Saídas.`)) {
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. Create automatic transaction (saída)
      const transRef = doc(collection(db, "financeiro", "geral", "transacoes"));
      const transId = transRef.id;

      const transPayload = {
        tipo: "saida" as const,
        nome: `Pagamento Fatura - ${selectedCard.nome} - ${selectedCompetencia}`,
        descricao: `Liquidação de fatura consolidada de cartão de crédito. Competência: ${selectedCompetencia}.`,
        categoria: "Pagamento Fatura",
        valor: Number(invoiceToPay.valorTotal),
        formaPagamento: "PIX", // Default payment form for credit card invoice
        data: new Date().toISOString().split("T")[0],
        origem: "manual", // Standard source
        despesaId: null,
        criadoEm: new Date().toISOString(),
        criadoPorEmail: userEmail,
      };

      batch.set(transRef, transPayload);

      // 2. Update invoice status
      const invoiceRef = doc(db, "financeiro", "geral", "faturasCartao", invoiceToPay.id);
      batch.update(invoiceRef, { 
        status: "paga", 
        pagoEm: Timestamp.now(),
        transacaoGeradaId: transId,
        atualizadoEm: Timestamp.now()
      });

      // 3. Update all items inside fatura to pago
      for (const item of invoiceItems) {
        const itemRef = doc(db, "financeiro", "geral", "itensCartao", item.id);
        batch.update(itemRef, { status: "pago" });
      }

      await batch.commit();
      alert("Fatura liquidada com sucesso! Saída gerada em Entradas e Saídas.");
    } catch (err) {
      console.error("Erro ao pagar fatura:", err);
      alert("Erro ao liquidar fatura. Tente novamente.");
    }
  };

  // Reopen paid invoice & delete generated transaction
  const handleReopenInvoice = async () => {
    if (!currentInvoice || !selectedCard) return;

    if (!confirm("Deseja reabrir esta fatura? O status voltará para 'aberta' e a transação de saída gerada anteriormente será EXCLUÍDA de sua seção Entradas e Saídas!")) {
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. Delete generated transaction if present
      if (currentInvoice.transacaoGeradaId) {
        const transRef = doc(db, "financeiro", "geral", "transacoes", currentInvoice.transacaoGeradaId);
        batch.delete(transRef);
      }

      // 2. Reopen invoice
      const invoiceRef = doc(db, "financeiro", "geral", "faturasCartao", currentInvoice.id);
      batch.update(invoiceRef, {
        status: "aberta",
        pagoEm: null,
        transacaoGeradaId: null,
        atualizadoEm: Timestamp.now()
      });

      // 3. Reopen items inside fatura to pendente (except ignored ones)
      for (const item of invoiceItems) {
        const itemRef = doc(db, "financeiro", "geral", "itensCartao", item.id);
        batch.update(itemRef, { 
          status: item.classificacaoCartao === "ignorar" ? "ignorado" : "pendente" 
        });
      }

      await batch.commit();
      alert("Fatura reaberta com sucesso e transação de saída removida.");
    } catch (err) {
      console.error("Erro ao reabrir fatura:", err);
      alert("Erro ao reabrir fatura.");
    }
  };

  // Item deletion
  const handleDeleteItem = async (item: CardItem) => {
    if (!confirm(`Deseja realmente excluir o lançamento "${item.descricao}"? Esta ação é irreversível.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "financeiro", "geral", "itensCartao", item.id));

      // If there is an active invoice, sync its metrics
      if (currentInvoice) {
        const updatedItems = invoiceItems.filter(i => i.id !== item.id);
        await syncInvoiceMetrics(currentInvoice.id, updatedItems);
      }

      alert("Lançamento excluído com sucesso.");
    } catch (err) {
      console.error("Erro ao deletar lançamento:", err);
      alert("Erro ao excluir lançamento.");
    }
  };

  // Edit item trigger
  const handleEditItemTrigger = (item: CardItem) => {
    setEditingItem(item);
    setEditDesc(item.descricao);
    setEditValor(String(item.valor));
    setEditCategory(item.categoria);
    setEditClassification(item.classificacaoCartao);
  };

  // Submit edited item
  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const parsedVal = parseFloat(editValor.replace(",", "."));
    if (isNaN(parsedVal) || parsedVal <= 0) {
      alert("Por favor, digite um valor maior que zero.");
      return;
    }

    try {
      const itemRef = doc(db, "financeiro", "geral", "itensCartao", editingItem.id);
      await updateDoc(itemRef, {
        descricao: editDesc,
        valor: parsedVal,
        categoria: editCategory,
        classificacaoCartao: editClassification,
        status: editClassification === "ignorar" ? "ignorado" : editingItem.status === "ignorado" ? "pendente" : editingItem.status,
        atualizadoEm: Timestamp.now()
      });

      // Refresh items list and recalculate
      if (currentInvoice) {
        const updatedItems = invoiceItems.map(i => {
          if (i.id === editingItem.id) {
            return {
              ...i,
              descricao: editDesc,
              valor: parsedVal,
              categoria: editCategory,
              classificacaoCartao: editClassification
            };
          }
          return i;
        });
        await syncInvoiceMetrics(currentInvoice.id, updatedItems);
      }

      setEditingItem(null);
      alert("Lançamento editado com sucesso!");
    } catch (err) {
      console.error("Erro ao editar lançamento:", err);
      alert("Erro ao editar o lançamento.");
    }
  };

  // Filtering calculation
  const filteredItems = invoiceItems.filter(item => {
    const matchesSearch = item.descricao.toLowerCase().includes(searchText.toLowerCase()) || 
                          item.categoria.toLowerCase().includes(searchText.toLowerCase());
    const matchesCategory = filterCategory ? item.categoria === filterCategory : true;
    const matchesClassification = filterClassification ? item.classificacaoCartao === filterClassification : true;

    return matchesSearch && matchesCategory && matchesClassification;
  });

  // Consolidated Card Metrics
  const totalCardsLimit = cards
    .filter(c => c.ativo)
    .reduce((acc, c) => acc + (c.limite || 0), 0);

  // Return to lists if importing faturas
  const handleInvoiceParsed = (result: ImportInvoiceResult, fileName: string) => {
    setImportResult(result);
    setImportFileName(fileName);
    setImportState("preview");
  };

  const handleImportCompleted = () => {
    setImportState("none");
    setImportResult(null);
    setImportFileName("");
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-1">
      {/* Title & Import Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">
            {selectedCardId ? (
              <button 
                type="button"
                onClick={() => setSelectedCardId(null)}
                className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Despesas Cartão de Crédito
              </button>
            ) : "Despesas Cartão de Crédito"}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {selectedCardId 
              ? `Visualizando faturas e lançamentos em tempo real de ${selectedCard?.nome}`
              : "Gerencie cartões corporativos, faturas mensais isoladas e importações automáticas."}
          </p>
        </div>

        {importState === "none" && (
          <div className="flex items-center gap-3">
            {selectedCardId && (
              <button
                type="button"
                onClick={() => setIsManualFormOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Lançamento Manual
              </button>
            )}
            <button
              type="button"
              onClick={() => setImportState("upload")}
              disabled={cards.length === 0}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              Importar Fatura
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingCard(null);
                setIsCardFormOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-xs text-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Cartão
            </button>
          </div>
        )}
      </div>

      {/* Main Import Interface overrides the dashboard */}
      {importState === "upload" && (
        <CardInvoiceImport
          onParsed={handleInvoiceParsed}
          onCancel={() => setImportState("none")}
        />
      )}

      {importState === "preview" && importResult && (
        <CardInvoicePreview
          initialResult={importResult}
          availableCards={cards}
          userEmail={userEmail}
          onImportCompleted={handleImportCompleted}
          onCancel={() => setImportState("upload")}
          fileName={importFileName}
        />
      )}

      {importState === "none" && (
        <>
          {/* SCREEN 1: Overview and List of Cards (if selectedCardId is null) */}
          {!selectedCardId ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Metrics Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="p-5 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Limite Consolidado</span>
                    <h4 className="text-xl font-bold text-white font-mono mt-0.5">
                      R$ {totalCardsLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </h4>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <CardIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Cartões Cadastrados</span>
                    <h4 className="text-xl font-bold text-white font-mono mt-0.5">
                      {cards.length} {cards.length === 1 ? "Cartão" : "Cartões"}
                    </h4>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900/40 border border-white/5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Controle de Ciclo</span>
                    <h4 className="text-xs font-semibold text-zinc-300 mt-1 leading-relaxed">
                      Compras separadas das telas normais e fechamentos baseados em ciclos.
                    </h4>
                  </div>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <CardIcon className="w-4 h-4 text-emerald-400" />
                  Selecione um Cartão Corporativo para Gerenciar
                </h4>

                {loadingCards ? (
                  <div className="py-12 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 animate-spin text-emerald-400" />
                    Carregando cartões de crédito...
                  </div>
                ) : cards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 px-4 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10 space-y-4">
                    <div className="p-4 rounded-full bg-zinc-900 border border-white/5 text-zinc-600">
                      <CardIcon className="w-8 h-8" />
                    </div>
                    <div className="text-center space-y-1 max-w-xs">
                      <h4 className="text-sm font-bold text-white">Nenhum cartão cadastrado</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Cadastre um cartão corporativo configurando o início/fim de ciclo e vencimento.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCardFormOpen(true)}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-black transition-all cursor-pointer"
                    >
                      Cadastrar Primeiro Cartão
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card) => (
                      <div 
                        key={card.id} 
                        onClick={() => setSelectedCardId(card.id)}
                        className={`relative overflow-hidden rounded-3xl border p-5 flex flex-col justify-between h-48 transition-all duration-300 group cursor-pointer ${
                          card.ativo 
                            ? "border-white/5 bg-zinc-900/10 hover:border-emerald-500/30 hover:bg-zinc-900/30 hover:shadow-lg hover:shadow-emerald-950/10" 
                            : "border-white/5 bg-zinc-900/50 opacity-60"
                        }`}
                      >
                        {/* Visual Card Accents */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
                        
                        {/* Top row */}
                        <div className="flex justify-between items-start z-10">
                          <div>
                            <span className="text-[10px] font-bold text-emerald-400 tracking-wider font-mono uppercase bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                              {card.banco}
                            </span>
                            <h4 className="text-sm font-bold text-white mt-1.5 group-hover:text-emerald-300 transition-colors">{card.nome}</h4>
                          </div>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCard(card);
                                setIsCardFormOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white cursor-pointer transition-all"
                              title="Editar cartão"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCard(card)}
                              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/40 border border-white/5 text-zinc-400 hover:text-red-400 cursor-pointer transition-all"
                              title="Excluir cartão"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Middle row: Card Number Ending */}
                        <div className="z-10 py-1">
                          <span className="text-sm font-mono tracking-widest text-zinc-400">
                            •••• •••• •••• <span className="text-white font-bold">{card.finalCartao}</span>
                          </span>
                        </div>

                        {/* Bottom row: Closing and Due Days */}
                        <div className="flex justify-between items-end border-t border-white/5 pt-3 mt-1 z-10 font-mono text-xs text-zinc-500">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 block">Ciclo</span>
                            <span className="text-zinc-300 font-bold">{card.diaInicioCiclo} a {card.diaFimCiclo}</span>
                          </div>
                          <div className="space-y-0.5 text-right">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 block">Vencimento</span>
                            <span className="text-zinc-300 font-bold">Dia {card.diaVencimento}</span>
                          </div>
                          <div className="space-y-0.5 text-right pl-4">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 block">Limite</span>
                            <span className="text-emerald-400 font-bold">
                              {card.limite ? `R$ ${card.limite.toLocaleString("pt-BR")}` : "Sem limite"}
                            </span>
                          </div>
                          <div className="pl-2">
                            <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SCREEN 2: Card Invoice Detailed Drilling Down Section */
            <div className="space-y-6 animate-fadeIn">
              
              {/* Card Meta & Competency Select */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl bg-zinc-900/20 border border-white/5 gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <CardIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {selectedCard?.nome} 
                      <span className="text-xs font-mono font-bold text-zinc-400">({selectedCard?.banco} • {selectedCard?.finalCartao})</span>
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5 uppercase tracking-wide">
                      Ciclo: Todo dia {selectedCard?.diaInicioCiclo} ao {selectedCard?.diaFimCiclo} • Vence dia {selectedCard?.diaVencimento}
                    </p>
                  </div>
                </div>

                {/* Competency Period select */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <span className="text-xs font-semibold text-zinc-400 shrink-0 font-mono">COMPETÊNCIA:</span>
                  <select
                    value={selectedCompetencia}
                    onChange={(e) => setSelectedCompetencia(e.target.value)}
                    className="flex-1 sm:flex-initial bg-zinc-950 border border-white/5 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-bold font-mono"
                  >
                    {allCompetencias.map(c => {
                      const [y, m] = c.split("-");
                      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                      const label = `${monthNames[parseInt(m) - 1]}/${y}`;
                      return <option key={c} value={c}>{label}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* Invoice Summary Row */}
              {loadingInvoiceData ? (
                <div className="py-8 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 animate-spin text-emerald-400" />
                  Analisando faturas...
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Values bento block */}
                  <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-zinc-900/10 border border-white/5 space-y-1">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Fixas do Cartão</span>
                      <h5 className="text-base font-bold font-mono text-amber-400">
                        R$ {(currentInvoice?.totalFixasCartao || invoiceItems.filter(i => i.classificacaoCartao === "fixa_cartao").reduce((acc, i) => acc + i.valor, 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </h5>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-900/10 border border-white/5 space-y-1">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Variáveis do Cartão</span>
                      <h5 className="text-base font-bold font-mono text-blue-400">
                        R$ {(currentInvoice?.totalVariaveisCartao || invoiceItems.filter(i => i.classificacaoCartao === "variavel_cartao").reduce((acc, i) => acc + i.valor, 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </h5>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-900/10 border border-white/5 space-y-1">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Créditos/Estornos</span>
                      <h5 className="text-base font-bold font-mono text-emerald-400">
                        R$ {(currentInvoice?.totalCreditosEstornos || invoiceItems.filter(i => i.classificacaoCartao === "credito_estorno").reduce((acc, i) => acc + Math.abs(i.valor), 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </h5>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-1">
                      <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider font-mono">Total Consolidado</span>
                      <h5 className="text-lg font-bold font-mono text-white">
                        R$ {(currentInvoice?.valorTotal || invoiceItems.filter(i => ["fixa_cartao", "variavel_cartao"].includes(i.classificacaoCartao)).reduce((acc, i) => acc + i.valor, 0) - invoiceItems.filter(i => ["credito_estorno", "pagamento_fatura"].includes(i.classificacaoCartao)).reduce((acc, i) => acc + Math.abs(i.valor), 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </h5>
                    </div>
                  </div>

                  {/* Status & Liquidate box */}
                  <div className="p-5 rounded-2xl bg-zinc-900/30 border border-white/5 flex flex-col justify-between gap-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-400 font-mono">STATUS FATURA:</span>
                      {currentInvoice?.status === "paga" ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1 font-mono uppercase">
                          <CheckCircle2 className="w-3.5 h-3.5" /> PAGA
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center gap-1 font-mono uppercase animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" /> EM ABERTO
                        </span>
                      )}
                    </div>

                    <div>
                      {currentInvoice?.status === "paga" ? (
                        <button
                          type="button"
                          onClick={handleReopenInvoice}
                          className="w-full py-2 px-3 text-center bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 text-red-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          Cancelar Liquidação
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleMarkAsPaid}
                          className="w-full py-2.5 px-3 text-center bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          Confirmar Pagamento
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Filtering & Actions bar */}
              <div className="flex flex-col md:flex-row gap-3.5 items-center justify-between bg-zinc-900/10 p-4 rounded-2xl border border-white/5">
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Filtrar lançamentos..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/40"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                  {/* Category Filter */}
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/40 font-semibold"
                  >
                    <option value="">Todas Categorias</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>

                  {/* Classification Filter */}
                  <select
                    value={filterClassification}
                    onChange={(e) => setFilterClassification(e.target.value)}
                    className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/40 font-semibold"
                  >
                    <option value="">Todas Classificações</option>
                    <option value="fixa_cartao">Despesas Fixas</option>
                    <option value="variavel_cartao">Despesas Variáveis</option>
                    <option value="pagamento_fatura">Pagamento Fatura</option>
                    <option value="credito_estorno">Estorno/Crédito</option>
                    <option value="ignorar">Ignoradas</option>
                  </select>

                  {/* PDF report trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedCard) return;
                      // Skeleton or real invoice object
                      const invoiceObj = currentInvoice || {
                        id: `temp_${Date.now()}`,
                        cartaoId: selectedCard.id,
                        cartaoNome: selectedCard.nome,
                        banco: selectedCard.banco,
                        finalCartao: selectedCard.finalCartao,
                        competencia: selectedCompetencia,
                        dataInicioCiclo: invoiceItems[0]?.dataInicioCiclo || null,
                        dataFimCiclo: invoiceItems[0]?.dataFimCiclo || null,
                        dataVencimento: invoiceItems[0]?.dataVencimentoFatura || null,
                        valorTotal: invoiceItems.filter(i => ["fixa_cartao", "variavel_cartao"].includes(i.classificacaoCartao)).reduce((acc, i) => acc + i.valor, 0),
                        totalFixasCartao: invoiceItems.filter(i => i.classificacaoCartao === "fixa_cartao").reduce((acc, i) => acc + i.valor, 0),
                        totalVariaveisCartao: invoiceItems.filter(i => i.classificacaoCartao === "variavel_cartao").reduce((acc, i) => acc + i.valor, 0),
                        totalPagamentos: invoiceItems.filter(i => i.classificacaoCartao === "pagamento_fatura").reduce((acc, i) => acc + i.valor, 0),
                        totalCreditosEstornos: invoiceItems.filter(i => i.classificacaoCartao === "credito_estorno").reduce((acc, i) => acc + i.valor, 0),
                        status: "aberta" as const
                      };
                      exportCardInvoicePDF(invoiceObj, invoiceItems, selectedCard, userEmail);
                    }}
                    className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                    title="Exportar Fatura em PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List Table */}
              <div className="overflow-x-auto rounded-3xl border border-white/5 bg-zinc-950/20">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-zinc-900/30">
                      <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Data Compra</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Estabelecimento</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Categoria</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono text-center">Classificação</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono text-right">Valor</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {loadingInvoiceData ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-500 text-xs">
                          Analisando lançamentos...
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-500 text-xs leading-relaxed">
                          Nenhum lançamento encontrado para este período com os filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {
                        const dateStr = item.dataCompra?.toDate 
                          ? item.dataCompra.toDate().toLocaleDateString("pt-BR") 
                          : new Date(item.dataCompra).toLocaleDateString("pt-BR");

                        return (
                          <tr key={item.id} className="hover:bg-zinc-900/10 transition-colors">
                            <td className="py-3 px-4 text-zinc-400 font-mono">{dateStr}</td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{item.descricao}</div>
                              {item.parcelado && item.parcelaAtual && (
                                <span className="text-[8px] font-bold text-zinc-500 font-mono uppercase bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5 mt-1 inline-block">
                                  Parcela {item.parcelaAtual}/{item.totalParcelas}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-400">{item.categoria}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                item.classificacaoCartao === "fixa_cartao" 
                                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                  : item.classificacaoCartao === "variavel_cartao"
                                  ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                                  : item.classificacaoCartao === "pagamento_fatura"
                                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                  : item.classificacaoCartao === "credito_estorno"
                                  ? "bg-purple-500/10 border border-purple-500/20 text-purple-400"
                                  : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                              }`}>
                                {item.classificacaoCartao === "fixa_cartao" 
                                  ? "Fixa Cartão" 
                                  : item.classificacaoCartao === "variavel_cartao" 
                                  ? "Variável Cartão" 
                                  : item.classificacaoCartao === "pagamento_fatura"
                                  ? "Pagamento"
                                  : item.classificacaoCartao === "credito_estorno"
                                  ? "Estorno"
                                  : "Ignorado"}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold font-mono text-white text-right">
                              R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditItemTrigger(item)}
                                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                                  title="Editar lançamento"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item)}
                                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/40 border border-white/5 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                                  title="Excluir lançamento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Credit Card CRUD modal */}
      {isCardFormOpen && (
        <CreditCardForm
          card={editingCard}
          userEmail={userEmail}
          onClose={() => setIsCardFormOpen(false)}
          onSave={() => {
            setIsCardFormOpen(false);
            alert("Cartão corporativo salvo com sucesso!");
          }}
        />
      )}

      {/* Manual Purchase modal */}
      {isManualFormOpen && selectedCard && (
        <CardManualEntryForm
          card={selectedCard}
          userEmail={userEmail}
          categories={categories}
          onClose={() => setIsManualFormOpen(false)}
          onSave={() => {
            setIsManualFormOpen(false);
            alert("Lançamento manual adicionado com sucesso!");
          }}
        />
      )}

      {/* Edit Purchase Item modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setEditingItem(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl p-[1px] bg-gradient-to-tr from-emerald-500/30 via-zinc-800 to-zinc-800 shadow-2xl z-10">
            <div className="bg-zinc-950 rounded-[23px] p-6 border border-white/5 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Editar Lançamento</h4>
                <button type="button" onClick={() => setEditingItem(null)} className="text-zinc-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditItemSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">Descrição</label>
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">Valor (R$)</label>
                    <input
                      type="text"
                      value={editValor}
                      onChange={(e) => setEditValor(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">Categoria</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2 text-xs text-white"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">Classificação Fatura</label>
                  <select
                    value={editClassification}
                    onChange={(e) => setEditClassification(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2 text-xs text-white"
                  >
                    <option value="variavel_cartao">Despesa Variável</option>
                    <option value="fixa_cartao">Despesa Fixa</option>
                    <option value="pagamento_fatura">Pagamento Fatura</option>
                    <option value="credito_estorno">Estorno/Crédito</option>
                    <option value="ignorar">Ignorar Lançamento</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" /> Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
