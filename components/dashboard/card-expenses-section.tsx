"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
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
  AlertCircle,
  RefreshCw
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
  writeBatch,
  increment
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { calculateCardTotals } from "@/lib/card-totals-utils";
import { confirmCardInvoicePaymentAndUpdateBank } from "@/lib/bank-balance-utils";
import { ConfirmDialog } from "./confirm-dialog";
import { 
  CreditCard as ICreditCard, 
  CardInvoice, 
  CardItem, 
  ImportInvoiceResult, 
  FinanceCategory 
} from "@/types/finance";
import { CreditCardForm } from "./credit-card-form";
const CardInvoiceImport = React.lazy(() => import("./card-invoice-import"));
import CardInvoicePreview from "./card-invoice-preview";
import { CardManualEntryForm } from "./card-manual-entry-form";

interface CardExpensesSectionProps {
  userEmail: string;
}

export default function CardExpensesSection({ userEmail }: CardExpensesSectionProps) {
  // DB States
  const [cards, setCards] = useState<ICreditCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [categories, setCategories] = useState<string[]>(["Alimentação", "Sistemas", "Anúncios", "Transporte", "Saúde", "Outros"]);
  const [banks, setBanks] = useState<{ id: string; nome: string; saldoAtual: number }[]>([]);
  const [invoicePaymentModal, setInvoicePaymentModal] = useState<{
    isOpen: boolean;
    selectedBankId: string;
    invoiceToPay: CardInvoice | null;
  }>({
    isOpen: false,
    selectedBankId: "",
    invoiceToPay: null,
  });

  // Navigation state
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("");

  // Invoice & Items States for the selected card
  const [currentInvoice, setCurrentInvoice] = useState<CardInvoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<CardItem[]>([]);
  const [loadingInvoiceData, setLoadingInvoiceData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // Reusable Confirm Dialog State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void | Promise<void>) | null>(null);
  const [confirmVariant, setConfirmVariant] = useState<"default" | "danger" | "success">("default");
  const [confirmLoading, setConfirmLoading] = useState(false);

  const showConfirm = (
    title: string,
    desc: string,
    onConfirm: () => void | Promise<void>,
    variant: "default" | "danger" | "success" = "default"
  ) => {
    setConfirmTitle(title);
    setConfirmDesc(desc);
    setConfirmAction(() => onConfirm);
    setConfirmVariant(variant);
    setConfirmOpen(true);
  };

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

  // Load active banks
  useEffect(() => {
    const qBanks = query(collection(db, "financeiro", "geral", "bancos"));
    const unsubBanks = onSnapshot(qBanks, (snap) => {
      const list: { id: string; nome: string; saldoAtual: number }[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.ativo ?? true) {
          list.push({ id: docSnap.id, nome: d.nome, saldoAtual: d.saldoAtual || 0 });
        }
      });
      setBanks(list);
    });
    return () => unsubBanks();
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
    setLoadError(null);

    // 1. Listen to items (itensCartao)
    const qItems = query(
      collection(db, "financeiro", "geral", "itensCartao"),
      where("cartaoId", "==", selectedCardId)
    );

    const unsubItems = onSnapshot(qItems, (snap) => {
      const allItems: CardItem[] = [];
      snap.forEach(docSnap => {
        allItems.push({
          id: docSnap.id,
          ...docSnap.data()
        } as CardItem);
      });

      const itemsList = allItems.filter(item => item.competencia === selectedCompetencia);

      // Sort by purchase date ascending
      itemsList.sort((a, b) => {
        const dateA = a.dataCompra?.toDate ? a.dataCompra.toDate() : new Date(a.dataCompra);
        const dateB = b.dataCompra?.toDate ? b.dataCompra.toDate() : new Date(b.dataCompra);
        return dateA.getTime() - dateB.getTime();
      });

      setInvoiceItems(itemsList);
    }, (error) => {
      console.error("Erro ao carregar itens do cartão:", error);
      setLoadError("Erro ao carregar lançamentos do cartão.");
      setLoadingInvoiceData(false);
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
    }, (error) => {
      console.error("Erro ao carregar fatura do cartão:", error);
      setLoadError("Erro ao carregar lançamentos do cartão.");
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
    showConfirm(
      "Excluir cartão de crédito?",
      `Tem certeza que deseja excluir o cartão "${card.nome}" (${card.banco})? Faturas e itens importados dele continuarão salvos, mas você não poderá mais cadastrar compras neste cartão.`,
      async () => {
        setConfirmLoading(true);
        try {
          await deleteDoc(doc(db, "financeiro", "geral", "cartoes", card.id));
          if (selectedCardId === card.id) setSelectedCardId(null);
          alert("Cartão excluído com sucesso.");
        } catch (err) {
          console.error("Erro ao excluir cartão:", err);
          alert("Erro ao excluir cartão.");
        } finally {
          setConfirmLoading(false);
          setConfirmOpen(false);
        }
      },
      "danger"
    );
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

    if (banks.length === 0) {
      alert("Aviso: Cadastre e ative pelo menos uma conta/banco para confirmar pagamentos de fatura.");
      return;
    }

    let invoiceToPay = currentInvoice;
    if (!invoiceToPay) {
      if (invoiceItems.length === 0) {
        alert("Não é possível pagar uma fatura sem lançamentos.");
        return;
      }
    } else if (invoiceToPay.status === "paga") {
      alert("Essa fatura já foi paga.");
      return;
    }

    setInvoicePaymentModal({
      isOpen: true,
      selectedBankId: banks[0].id,
      invoiceToPay: invoiceToPay
    });
  };

  // Process credit card invoice payment with bank balance deduction
  const handleExecuteCardInvoicePaymentWithBank = async () => {
    const { selectedBankId, invoiceToPay } = invoicePaymentModal;
    if (!selectedBankId) {
      alert("Selecione uma conta para pagamento.");
      return;
    }

    setConfirmLoading(true);
    try {
      let finalInvoice = invoiceToPay;
      
      if (!finalInvoice) {
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

        await addDoc(collection(db, "financeiro", "geral", "faturasCartao"), {
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

        const snap = await getDocs(query(collection(db, "financeiro", "geral", "faturasCartao"), where("cartaoId", "==", selectedCardId), where("competencia", "==", selectedCompetencia)));
        if (!snap.empty) {
          finalInvoice = { id: snap.docs[0].id, ...snap.docs[0].data() } as CardInvoice;
        }
      }

      if (finalInvoice) {
        await confirmCardInvoicePaymentAndUpdateBank(finalInvoice, selectedBankId, invoiceItems, userEmail);
        alert("Fatura liquidada com sucesso! Saída gerada em Entradas e Saídas.");
      } else {
        throw new Error("Erro ao gerar fatura para pagamento.");
      }
    } catch (error: any) {
      console.error("Erro ao consolidar/pagar fatura:", error);
      alert("Erro ao pagar fatura: " + error.message);
    } finally {
      setConfirmLoading(false);
      setInvoicePaymentModal({ isOpen: false, selectedBankId: "", invoiceToPay: null });
    }
  };

  // Reopen paid invoice, delete generated transaction and restore bank balance
  const handleReopenInvoice = async () => {
    if (!currentInvoice || !selectedCard) return;

    showConfirm(
      "Reabrir fatura?",
      "Deseja reabrir esta fatura? O status voltará para 'aberta', a transação de saída gerada anteriormente será EXCLUÍDA e o valor será estornado na sua conta bancária!",
      async () => {
        setConfirmLoading(true);
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
            bancoPagamentoId: null,
            bancoPagamentoNome: null,
            atualizadoEm: Timestamp.now()
          });

          // 2b. Revert/estornar bank balance if bancoPagamentoId exists
          if (currentInvoice.bancoPagamentoId) {
            const bankRef = doc(db, "financeiro", "geral", "bancos", currentInvoice.bancoPagamentoId);
            batch.update(bankRef, {
              saldoAtual: increment(currentInvoice.valorTotal),
              atualizadoEm: new Date().toISOString()
            });
          }

          // 3. Reopen items inside fatura to pendente (except ignored ones)
          for (const item of invoiceItems) {
            const itemRef = doc(db, "financeiro", "geral", "itensCartao", item.id);
            batch.update(itemRef, { 
              status: item.classificacaoCartao === "ignorar" ? "ignorado" : "pendente" 
            });
          }

          await batch.commit();
          alert("Fatura reaberta com sucesso, transação de saída removida e saldo estornado.");
        } catch (err) {
          console.error("Erro ao reabrir fatura:", err);
          alert("Erro ao reabrir fatura.");
        } finally {
          setConfirmLoading(false);
          setConfirmOpen(false);
        }
      },
      "default"
    );
  };

  // Item deletion
  const handleDeleteItem = async (item: CardItem) => {
    showConfirm(
      "Excluir lançamento do cartão?",
      "Essa ação removerá este lançamento da fatura. Essa ação não pode ser desfeita.",
      async () => {
        setConfirmLoading(true);
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
        } finally {
          setConfirmLoading(false);
          setConfirmOpen(false);
        }
      },
      "danger"
    );
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
  const totals = calculateCardTotals(invoiceItems);

  console.log("Cartão selecionado:", selectedCard);
  console.log("Competência selecionada:", selectedCompetencia);
  console.log("Itens carregados do Firestore:", invoiceItems);
  console.log("Itens filtrados:", filteredItems);
  console.log("Totais calculados:", totals);

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

  const handleImportCompleted = (newComp?: string) => {
    setImportState("none");
    setImportResult(null);
    setImportFileName("");
    if (newComp) {
      setSelectedCompetencia(newComp);
    }
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

      {loadError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-center">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Main Import Interface overrides the dashboard */}
      {importState === "upload" && (
        <React.Suspense fallback={
          <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-emerald-500/10 bg-[#0A0D0A]/40 text-emerald-500 font-mono text-sm gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
            <span>Carregando importador de faturas...</span>
          </div>
        }>
          <CardInvoiceImport
            onParsed={handleInvoiceParsed}
            onCancel={() => setImportState("none")}
          />
        </React.Suspense>
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
                    {(() => {
                      const totals = calculateCardTotals(invoiceItems);
                      return (
                        <>
                          <div className="p-4 rounded-2xl bg-zinc-900/10 border border-white/5 space-y-1">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Fixas do Cartão</span>
                            <h5 className="text-base font-bold font-mono text-amber-400">
                              R$ {(currentInvoice?.totalFixasCartao || totals.totalFixasCartao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </h5>
                          </div>

                          <div className="p-4 rounded-2xl bg-zinc-900/10 border border-white/5 space-y-1">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Variáveis do Cartão</span>
                            <h5 className="text-base font-bold font-mono text-blue-400">
                              R$ {(currentInvoice?.totalVariaveisCartao || totals.totalVariaveisCartao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </h5>
                          </div>

                          <div className="p-4 rounded-2xl bg-zinc-900/10 border border-white/5 space-y-1">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Créditos/Estornos</span>
                            <h5 className="text-base font-bold font-mono text-emerald-400">
                              R$ {(currentInvoice?.totalCreditosEstornos || totals.totalCreditosEstornos).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </h5>
                          </div>

                          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-1">
                            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider font-mono">Total Consolidado</span>
                            <h5 className="text-lg font-bold font-mono text-white">
                              R$ {(currentInvoice?.valorTotal || totals.totalConsolidado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </h5>
                          </div>
                        </>
                      );
                    })()}
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
                      (async () => {
                        const { exportCardInvoicePDF } = await import("@/lib/pdf-utils");
                        exportCardInvoicePDF(invoiceObj, invoiceItems, selectedCard, userEmail);
                      })();
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
          onSave={(newComp) => {
            setIsManualFormOpen(false);
            if (newComp) {
              setSelectedCompetencia(newComp);
            }
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

      {confirmOpen && (
        <ConfirmDialog
          open={confirmOpen}
          title={confirmTitle}
          description={confirmDesc}
          onConfirm={confirmAction || (() => {})}
          onCancel={() => {
            if (!confirmLoading) {
              setConfirmOpen(false);
              setConfirmAction(null);
            }
          }}
          loading={confirmLoading}
          variant={confirmVariant}
        />
      )}

      {invoicePaymentModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !confirmLoading && setInvoicePaymentModal(prev => ({ ...prev, isOpen: false }))}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl p-[1px] bg-gradient-to-tr from-emerald-500/30 via-zinc-800 to-zinc-800 shadow-2xl z-10"
          >
            <div className="bg-zinc-950 rounded-[23px] px-6 py-7 border border-white/5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white tracking-wide">
                      Pagar Fatura do Cartão
                    </h4>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      SELECIONE A CONTA DE SAÍDA
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={() => setInvoicePaymentModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all hover:scale-105 cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed mb-5">
                Selecione a conta bancária pela qual esta fatura será paga. O valor total de <span className="font-bold text-white">R$ {(invoicePaymentModal.invoiceToPay?.valorTotal ?? invoiceItems.reduce((sum, item) => sum + (item.classificacaoCartao === "fixa_cartao" || item.classificacaoCartao === "variavel_cartao" ? item.valor : -Math.abs(item.valor)), 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> será deduzido do saldo atual da conta e uma transação de saída automática de cartão será gerada.
              </p>

              <div className="space-y-4 mb-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Conta/Banco de Saída</label>
                  <select
                    disabled={confirmLoading}
                    value={invoicePaymentModal.selectedBankId}
                    onChange={(e) => setInvoicePaymentModal(prev => ({ ...prev, selectedBankId: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all cursor-pointer disabled:opacity-50"
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome} (Saldo: R$ {b.saldoAtual?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={() => setInvoicePaymentModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-xs text-zinc-300 hover:text-white border border-white/5 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={handleExecuteCardInvoicePaymentWithBank}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-50"
                >
                  {confirmLoading ? "Processando..." : "Confirmar Pagamento"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
