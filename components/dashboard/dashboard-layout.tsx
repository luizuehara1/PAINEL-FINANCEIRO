"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  LayoutDashboard, 
  ArrowLeftRight, 
  Calendar, 
  Layers, 
  BarChart3, 
  LogOut, 
  Plus, 
  Menu, 
  X, 
  User,
  Sparkles,
  Search,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Filter,
  Check,
  Settings,
  FileText,
  Trash2,
  CreditCard,
  Wallet
} from "lucide-react";
import {
  exportTransactionsPDF,
  exportFixedExpensesPDF,
  exportVariableExpensesPDF,
  exportOverviewPDF,
  exportReportsPDF
} from "@/lib/pdf-utils";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  Timestamp,
  increment,
  writeBatch,
  where
} from "firebase/firestore";

import { Transaction, Expense, PropertyCostCenter, BankAccount, Investment, Asset } from "@/types/finance";
import { auth, db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { isAllowedEmail } from "@/lib/auth";
import { 
  createFixedExpense, 
  confirmFixedExpensePayment, 
  closeRecurringExpense, 
  getExpenseCompetence, 
  getNextMonthDueDate 
} from "@/lib/finance-utils";
import { 
  confirmExpensePaymentAndCreateTransaction, 
  createExpensePaymentTransaction,
  deleteLinkedExpenseTransaction,
  updateLinkedExpenseTransaction
} from "@/lib/finance-actions";
import { 
  generateInstallmentExpenses, 
  deleteInstallmentGroup,
  isCreditCardPayment,
  normalizeText
} from "@/lib/installment-utils";
import {
  applyTransactionToBank,
  reverseTransactionFromBank,
  updateBankBalanceOnTransactionEdit,
  confirmExpensePaymentAndUpdateBank,
} from "@/lib/bank-balance-utils";
import PaymentAlerts from "./payment-alerts";
import TransactionForm from "./transaction-form";
import TransactionTable from "./transaction-table";
import ExpenseForm from "./expense-form";
import ExpenseTable from "./expense-table";
import ReportsSection from "./reports-section";
import SettingsSection from "./settings-section";
import CardExpensesSection from "./card-expenses-section";
import { ApplicationsSection } from "./applications-section";
import { ConfirmDialog } from "./confirm-dialog";
import { generateFutureRecurringExpenses } from "@/lib/recurring-expense-utils";
import { 
  filterFixedExpensesByPeriod, 
  calculateFixedExpenseTotals,
  getDateRangeFromPeriodFilter
} from "@/lib/finance-calculations";
import {
  getAvailableCyclesFromExpenses,
  getCompetenceFromDateStr,
  formatCompetenceLabel
} from "@/lib/cycle-utils";

// Helper functions for date & timestamp conversion
function stringToTimestamp(dateStr: string): Timestamp {
  if (!dateStr) return Timestamp.now();
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return Timestamp.fromDate(date);
}

function parseTimestampToString(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val.toDate === "function") {
    const date = val.toDate();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return "";
}

type ActiveSection = "overview" | "transactions" | "fixed-expenses" | "variable-expenses" | "reports" | "registrations" | "card-expenses" | "applications";

export default function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<ActiveSection>("overview");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Transactions and Expenses state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Banks, Investments and Assets state
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Performance-optimizing session refs
  const hasGeneratedFutureRecurrences = useRef(false);

  // Expense/Card Invoice bank payment confirmation modal
  const [paymentBankModalConfig, setPaymentBankModalConfig] = useState<{
    isOpen: boolean;
    expenseId: string | null;
    selectedBankId: string;
  }>({
    isOpen: false,
    expenseId: null,
    selectedBankId: "",
  });

  // Modals state
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [preselectedExpenseType, setPreselectedExpenseType] = useState<"fixa" | "variavel">("fixa");

  // Editing state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Delete confirm modal state
  const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<{
    isOpen: boolean;
    type: "transaction" | "expense";
    id: string;
    loading: boolean;
    error: string | null;
    isParcelado?: boolean;
    grupoParcelamentoId?: string | null;
    deleteOption?: "only" | "all";
  }>({
    isOpen: false,
    type: "transaction",
    id: "",
    loading: false,
    error: null,
    isParcelado: false,
    grupoParcelamentoId: null,
    deleteOption: "only",
  });

  // Custom multi-option confirmation state
  const [expenseActionConfirm, setExpenseActionConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    extraLabel?: string;
    onConfirm: () => void;
    onExtraConfirm?: () => void;
    onCancel: () => void;
  } | null>(null);

  // Dashboard general ConfirmDialog state
  const [dashboardConfirmOpen, setDashboardConfirmOpen] = useState(false);
  const [dashboardConfirmTitle, setDashboardConfirmTitle] = useState("");
  const [dashboardConfirmDesc, setDashboardConfirmDesc] = useState("");
  const [dashboardConfirmAction, setDashboardConfirmAction] = useState<(() => void | Promise<void>) | null>(null);
  const [dashboardConfirmVariant, setDashboardConfirmVariant] = useState<"default" | "danger" | "success">("default");
  const [dashboardConfirmLoading, setDashboardConfirmLoading] = useState(false);

  const showDashboardConfirm = (
    title: string,
    desc: string,
    onConfirm: () => void | Promise<void>,
    variant: "default" | "danger" | "success" = "default"
  ) => {
    setDashboardConfirmTitle(title);
    setDashboardConfirmDesc(desc);
    setDashboardConfirmAction(() => onConfirm);
    setDashboardConfirmVariant(variant);
    setDashboardConfirmOpen(true);
  };

  // Today dates
  const [todayStr, setTodayStr] = useState("");
  const [currentDateFormatted, setCurrentDateFormatted] = useState("");

  // Filters state
  const [selectedMonth, setSelectedMonth] = useState(""); // YYYY-MM
  
  // 1. Transactions Filters
  const [txDateStart, setTxDateStart] = useState("");
  const [txDateEnd, setTxDateEnd] = useState("");
  const [txType, setTxType] = useState<"todos" | "entrada" | "saida">("todos");
  const [txCategory, setTxCategory] = useState("todas");
  const [txPaymentMethod, setTxPaymentMethod] = useState("todos");

  // 2. Fixed Expenses Filters
  const [fixedVencimentoStart, setFixedVencimentoStart] = useState("");
  const [fixedVencimentoEnd, setFixedVencimentoEnd] = useState("");
  const [fixedStatus, setFixedStatus] = useState<"todos" | "pendente" | "pago" | "vencida">("todos");
  const [fixedCategory, setFixedCategory] = useState("todas");
  const [fixedPaymentMethod, setFixedPaymentMethod] = useState("todos");
  const [fixedRecurrenceFilter, setFixedRecurrenceFilter] = useState<"todos" | "ativas" | "baixadas" | "nao-recorrentes">("todos");
  const [fixedPeriodFilter, setFixedPeriodFilter] = useState<"este_mes" | "proximo_mes" | "proximos_3_meses" | "proximos_6_meses" | "este_ano" | "todas_futuras" | "personalizado">("este_mes");
  const [fixedParcelamentoFilter, setFixedParcelamentoFilter] = useState<"todos" | "a_vista" | "parcelado" | "em_andamento" | "quitado">("todos");

  // 3. Variable Expenses Filters
  const [variableDateStart, setVariableDateStart] = useState("");
  const [variableDateEnd, setVariableDateEnd] = useState("");
  const [variableStatus, setVariableStatus] = useState<"todos" | "pendente" | "pago">("todos");
  const [variableCategory, setVariableCategory] = useState("todas");
  const [variablePaymentMethod, setVariablePaymentMethod] = useState("todos");

  // Property Filters & Data
  const [layoutImoveis, setLayoutImoveis] = useState<PropertyCostCenter[]>([]);
  const [fixedImovelFilter, setFixedImovelFilter] = useState("todos");
  const [variableImovelFilter, setVariableImovelFilter] = useState("todos");

  // Format currency helper
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  useEffect(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    
    setTodayStr(`${year}-${month}-${day}`);
    setSelectedMonth(`${year}-${month}`);

    // Beautiful date header in Portuguese
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    setCurrentDateFormatted(d.toLocaleDateString('pt-BR', options));
  }, []);

  // 1. Authenticate user and protect dashboard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.history.pushState({}, "", "/login");
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else if (!isAllowedEmail(user.email)) {
        await signOut(auth);
        window.history.pushState({}, "", "/login");
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else {
        setCurrentUser(user);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load Real-Time data from Firestore (NO SEEDING, ONLY REAL DATA)
  // A. Transactions (only when needed)
  useEffect(() => {
    if (!currentUser) return;

    const neededTabs = ["overview", "transactions", "reports"];
    if (!neededTabs.includes(activeTab)) {
      setTransactions([]); // Clear state when closing tab to free memory
      return;
    }

    const qTx = query(
      collection(db, "financeiro", "geral", "transacoes"),
      orderBy("data", "desc")
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const txList: Transaction[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        txList.push({
          id: doc.id,
          tipo: d.tipo,
          nome: d.nome,
          descricao: d.descricao || "",
          categoria: d.categoria,
          valor: d.valor,
          formaPagamento: d.formaPagamento,
          data: parseTimestampToString(d.data),
          criadoEm: parseTimestampToString(d.criadoEm || d.data),
          criadoPorEmail: d.criadoPorEmail || "",
          notaUrl: d.notaUrl || null,
          notaPublicId: d.notaPublicId || null,
          notaTipo: d.notaTipo || null,
          notaNome: d.notaNome || null,
          origem: d.origem || "manual",
          despesaId: d.despesaId || null,
          despesaTipo: d.despesaTipo || null,
          imovelId: d.imovelId || null,
          imovelNome: d.imovelNome || null,
          centroCustoTipo: d.centroCustoTipo || null,
        });
      });
      setTransactions(txList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "financeiro/geral/transacoes");
    });

    return () => unsubscribeTx();
  }, [currentUser, activeTab]);

  // B. Expenses (filtered specifically by tab to optimize querying and network reads)
  useEffect(() => {
    if (!currentUser) return;

    const neededTabs = ["overview", "fixed-expenses", "variable-expenses", "reports"];
    if (!neededTabs.includes(activeTab)) {
      setExpenses([]); // Clear state when closing tab
      return;
    }

    let qExp;
    if (activeTab === "fixed-expenses") {
      qExp = query(
        collection(db, "financeiro", "geral", "despesas"),
        where("tipo", "==", "fixa"),
        orderBy("dataVencimento", "asc")
      );
    } else if (activeTab === "variable-expenses") {
      qExp = query(
        collection(db, "financeiro", "geral", "despesas"),
        where("tipo", "==", "variavel"),
        orderBy("dataVencimento", "asc")
      );
    } else {
      qExp = query(
        collection(db, "financeiro", "geral", "despesas"),
        orderBy("dataVencimento", "asc")
      );
    }

    const unsubscribeExp = onSnapshot(qExp, (snapshot) => {
      const expList: Expense[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        expList.push({
          id: doc.id,
          tipo: d.tipo,
          nome: d.nome,
          descricao: d.descricao || "",
          categoria: d.categoria,
          valor: d.valor,
          formaPagamento: d.formaPagamento,
          data: parseTimestampToString(d.data),
          dataVencimento: parseTimestampToString(d.dataVencimento),
          status: d.status,
          pagoEm: d.pagoEm ? parseTimestampToString(d.pagoEm) : undefined,
          criadoEm: parseTimestampToString(d.criadoEm || d.dataVencimento),
          criadoPorEmail: d.criadoPorEmail || "",
          diaVencimento: d.diaVencimento || undefined,
          competencia: d.competencia || "",
          recorrente: d.recorrente ?? false,
          recorrenciaAtiva: d.recorrenciaAtiva ?? false,
          despesaOrigemId: d.despesaOrigemId || null,
          grupoRecorrenciaId: d.grupoRecorrenciaId || "",
          baixadaCompletamente: d.baixadaCompletamente ?? false,
          baixadaEm: d.baixadaEm ? parseTimestampToString(d.baixadaEm) : null,
          motivoBaixa: d.motivoBaixa || null,
          imovelId: d.imovelId || null,
          imovelNome: d.imovelNome || null,
          centroCustoTipo: d.centroCustoTipo || null,
          notaUrl: d.notaUrl || null,
          notaPublicId: d.notaPublicId || null,
          notaTipo: d.notaTipo || null,
          notaNome: d.notaNome || null,
          origem: d.origem || undefined,
          cartaoId: d.cartaoId || null,
          faturaId: d.faturaId || null,
          itemCartaoId: d.itemCartaoId || null,
          parcelado: d.parcelado ?? false,
          parcelaAtual: d.parcelaAtual || undefined,
          totalParcelas: d.totalParcelas || undefined,
          valorParcela: d.valorParcela || undefined,
          valorTotalParcelado: d.valorTotalParcelado || undefined,
          grupoParcelamentoId: d.grupoParcelamentoId || null,
          parcelamentoAtivo: d.parcelamentoAtivo ?? false,
          parcelamentoQuitado: d.parcelamentoQuitado ?? false,
          quitadoEm: d.quitadoEm || null,
          transacaoGeradaId: d.transacaoGeradaId || null,
          saidaGerada: d.saidaGerada ?? false,
        });
      });
      setExpenses(expList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "financeiro/geral/despesas");
    });

    return () => unsubscribeExp();
  }, [currentUser, activeTab]);

  // C. Properties / Cost Centers
  useEffect(() => {
    if (!currentUser) return;

    const neededTabs = ["overview", "transactions", "fixed-expenses", "variable-expenses", "registrations"];
    if (!neededTabs.includes(activeTab)) {
      setLayoutImoveis([]);
      return;
    }

    const qLayoutImoveis = query(
      collection(db, "financeiro", "geral", "imoveis"),
      orderBy("nome", "asc")
    );
    const unsubscribeImoveis = onSnapshot(qLayoutImoveis, (snapshot) => {
      const imList: PropertyCostCenter[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        imList.push({
          id: doc.id,
          nome: d.nome,
          tipo: d.tipo || "casa",
          endereco: d.endereco || "",
          descricao: d.descricao || "",
          ativo: d.ativo ?? true,
          criadoEm: parseTimestampToString(d.criadoEm),
          atualizadoEm: parseTimestampToString(d.atualizadoEm),
          criadoPorEmail: d.criadoPorEmail || "",
        });
      });
      setLayoutImoveis(imList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "financeiro/geral/imoveis");
    });

    return () => unsubscribeImoveis();
  }, [currentUser, activeTab]);

  // D. Banks, Investments & Assets
  useEffect(() => {
    if (!currentUser) return;

    const neededTabs = ["overview", "applications"];
    if (!neededTabs.includes(activeTab)) {
      setBanks([]);
      setInvestments([]);
      setAssets([]);
      return;
    }

    const qBanks = query(collection(db, "financeiro", "geral", "bancos"));
    const unsubscribeBanks = onSnapshot(qBanks, (snapshot) => {
      const list: BankAccount[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as BankAccount);
      });
      setBanks(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "financeiro/geral/bancos");
    });

    const qInvs = query(collection(db, "financeiro", "geral", "investimentos"));
    const unsubscribeInvs = onSnapshot(qInvs, (snapshot) => {
      const list: Investment[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Investment);
      });
      setInvestments(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "financeiro/geral/investimentos");
    });

    const qAssets = query(collection(db, "financeiro", "geral", "patrimonios"));
    const unsubscribeAssets = onSnapshot(qAssets, (snapshot) => {
      const list: Asset[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Asset);
      });
      setAssets(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "financeiro/geral/patrimonios");
    });

    return () => {
      unsubscribeBanks();
      unsubscribeInvs();
      unsubscribeAssets();
    };
  }, [currentUser, activeTab]);

  // Auto-generate future recurring expenses up to 12 months ahead to support future views
  useEffect(() => {
    if (activeTab === "fixed-expenses" && expenses.length > 0 && currentUser?.email && !hasGeneratedFutureRecurrences.current) {
      hasGeneratedFutureRecurrences.current = true;
      generateFutureRecurringExpenses(expenses, currentUser.email);
    }
  }, [activeTab, expenses, currentUser]);

  // Filters calculation
  // 1. Transactions filtered
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter((t) => {
      if (selectedMonth && !t.data.startsWith(selectedMonth)) return false;
      if (txDateStart && t.data < txDateStart) return false;
      if (txDateEnd && t.data > txDateEnd) return false;
      if (txType !== "todos" && t.tipo !== txType) return false;
      if (txCategory !== "todas" && t.categoria !== txCategory) return false;
      if (txPaymentMethod !== "todos" && t.formaPagamento !== txPaymentMethod) return false;
      return true;
    });
  }, [transactions, selectedMonth, txDateStart, txDateEnd, txType, txCategory, txPaymentMethod]);

  // 2. Fixed Expenses filtered
  const availableCycles = React.useMemo(() => {
    return getAvailableCyclesFromExpenses(expenses);
  }, [expenses]);

  const filteredFixedExpenses = React.useMemo(() => {
    return expenses.filter((e) => {
      if (e.tipo !== "fixa") return false;

      // Apply global cycle filter (selectedMonth)
      if (selectedMonth) {
        let comp = e.competencia;
        if (!comp && e.dataVencimento) {
          comp = getCompetenceFromDateStr(e.dataVencimento);
        }
        if (!comp && e.data) {
          comp = getCompetenceFromDateStr(e.data);
        }
        if (comp !== selectedMonth) return false;

        // When a specific cycle is selected, we only apply the period filter if it is personalized
        if (fixedPeriodFilter === "personalizado") {
          if (fixedVencimentoStart && e.dataVencimento < fixedVencimentoStart) return false;
          if (fixedVencimentoEnd && e.dataVencimento > fixedVencimentoEnd) return false;
        }
      } else {
        // Apply standard period filter
        if (fixedPeriodFilter === "personalizado") {
          if (fixedVencimentoStart && e.dataVencimento < fixedVencimentoStart) return false;
          if (fixedVencimentoEnd && e.dataVencimento > fixedVencimentoEnd) return false;
        } else {
          const { start, end } = getDateRangeFromPeriodFilter(fixedPeriodFilter, todayStr);
          if (start && e.dataVencimento < start) return false;
          if (end && e.dataVencimento > end) return false;
        }
      }

      if (fixedStatus !== "todos") {
        if (fixedStatus === "pago") {
          if (e.status !== "pago") return false;
        } else if (fixedStatus === "pendente") {
          if (e.status !== "pendente" || (e.dataVencimento && e.dataVencimento < todayStr)) return false;
        } else if (fixedStatus === "vencida") {
          if (e.status !== "pendente" || (e.dataVencimento && e.dataVencimento >= todayStr)) return false;
        }
      }
      if (fixedCategory !== "todas" && e.categoria !== fixedCategory) return false;
      if (fixedPaymentMethod !== "todos" && e.formaPagamento !== fixedPaymentMethod) return false;
      
      // Property Filter
      if (fixedImovelFilter !== "todos") {
        if (fixedImovelFilter === "sem_imovel") {
          if (e.imovelId) return false;
        } else {
          if (e.imovelId !== fixedImovelFilter) return false;
        }
      }

      // Recurrence filter
      if (fixedRecurrenceFilter !== "todos") {
        if (fixedRecurrenceFilter === "ativas") {
          if (!e.recorrente || !e.recorrenciaAtiva || e.baixadaCompletamente) return false;
        } else if (fixedRecurrenceFilter === "baixadas") {
          if (!e.baixadaCompletamente) return false;
        } else if (fixedRecurrenceFilter === "nao-recorrentes") {
          if (e.recorrente) return false;
        }
      }

      // Parcelamento filter
      if (fixedParcelamentoFilter !== "todos") {
        if (fixedParcelamentoFilter === "a_vista") {
          if (e.parcelado) return false;
        } else if (fixedParcelamentoFilter === "parcelado") {
          if (!e.parcelado) return false;
        } else if (fixedParcelamentoFilter === "em_andamento") {
          if (!e.parcelado || e.parcelamentoAtivo !== true) return false;
        } else if (fixedParcelamentoFilter === "quitado") {
          if (!e.parcelado || e.parcelamentoQuitado !== true) return false;
        }
      }
      return true;
    });
  }, [
    expenses,
    selectedMonth,
    fixedPeriodFilter,
    fixedVencimentoStart,
    fixedVencimentoEnd,
    todayStr,
    fixedStatus,
    fixedCategory,
    fixedPaymentMethod,
    fixedImovelFilter,
    fixedRecurrenceFilter,
    fixedParcelamentoFilter
  ]);

  // 3. Variable Expenses filtered
  const filteredVariableExpenses = React.useMemo(() => {
    return expenses.filter((e) => {
      if (e.tipo !== "variavel") return false;
      if (selectedMonth && !e.data.startsWith(selectedMonth)) return false;
      if (variableDateStart && e.data < variableDateStart) return false;
      if (variableDateEnd && e.data > variableDateEnd) return false;
      if (variableStatus !== "todos" && e.status !== variableStatus) return false;
      if (variableCategory !== "todas" && e.categoria !== variableCategory) return false;
      if (variablePaymentMethod !== "todos" && e.formaPagamento !== variablePaymentMethod) return false;

      // Property Filter
      if (variableImovelFilter !== "todos") {
        if (variableImovelFilter === "sem_imovel") {
          if (e.imovelId) return false;
        } else {
          if (e.imovelId !== variableImovelFilter) return false;
        }
      }

      return true;
    });
  }, [
    expenses,
    selectedMonth,
    variableDateStart,
    variableDateEnd,
    variableStatus,
    variableCategory,
    variablePaymentMethod,
    variableImovelFilter
  ]);

  // Clear filters helper
  const handleClearFilters = () => {
    setTxDateStart("");
    setTxDateEnd("");
    setTxType("todos");
    setTxCategory("todas");
    setTxPaymentMethod("todos");

    setFixedVencimentoStart("");
    setFixedVencimentoEnd("");
    setFixedStatus("todos");
    setFixedCategory("todas");
    setFixedPaymentMethod("todos");
    setFixedRecurrenceFilter("todos");
    setFixedImovelFilter("todos");
    setFixedPeriodFilter("este_mes");
    setFixedParcelamentoFilter("todos");

    setVariableDateStart("");
    setVariableDateEnd("");
    setVariableStatus("todos");
    setVariableCategory("todas");
    setVariablePaymentMethod("todos");
    setVariableImovelFilter("todos");
  };

  // Format Date to BR Helper
  const formatDateDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handleExportPDF = () => {
    const userEmail = currentUser?.email || "";
    
    if (activeTab === "transactions") {
      const parts = [];
      if (selectedMonth) parts.push(`Ciclo: ${selectedMonth}`);
      if (txDateStart) parts.push(`Início: ${formatDateDate(txDateStart)}`);
      if (txDateEnd) parts.push(`Fim: ${formatDateDate(txDateEnd)}`);
      if (txType !== "todos") parts.push(`Tipo: ${txType === "entrada" ? "Entrada" : "Saída"}`);
      if (txCategory !== "todas") parts.push(`Categoria: ${txCategory}`);
      if (txPaymentMethod !== "todos") parts.push(`Meio: ${txPaymentMethod}`);
      const filtersInfo = parts.join(" | ") || "Sem filtros ativos";
      
      exportTransactionsPDF(filteredTransactions, filtersInfo, userEmail);
    } 
    else if (activeTab === "fixed-expenses") {
      const parts = [];
      parts.push(`Período: ${
        fixedPeriodFilter === "este_mes" ? "Este mês" :
        fixedPeriodFilter === "proximo_mes" ? "Próximo mês" :
        fixedPeriodFilter === "proximos_3_meses" ? "Próximos 3 meses" :
        fixedPeriodFilter === "proximos_6_meses" ? "Próximos 6 meses" :
        fixedPeriodFilter === "este_ano" ? "Este ano" :
        fixedPeriodFilter === "todas_futuras" ? "Todas futuras" :
        "Personalizado"
      }`);
      if (fixedVencimentoStart) parts.push(`Venc. Início: ${formatDateDate(fixedVencimentoStart)}`);
      if (fixedVencimentoEnd) parts.push(`Venc. Fim: ${formatDateDate(fixedVencimentoEnd)}`);
      if (fixedStatus !== "todos") parts.push(`Status: ${fixedStatus}`);
      if (fixedCategory !== "todas") parts.push(`Categoria: ${fixedCategory}`);
      if (fixedPaymentMethod !== "todos") parts.push(`Meio: ${fixedPaymentMethod}`);
      if (fixedRecurrenceFilter !== "todos") parts.push(`Recorrência: ${fixedRecurrenceFilter}`);
      if (fixedParcelamentoFilter !== "todos") parts.push(`Parcelamento: ${fixedParcelamentoFilter}`);
      const filtersInfo = parts.join(" | ") || "Sem filtros ativos";
      
      exportFixedExpensesPDF(filteredFixedExpenses, filtersInfo, userEmail, todayStr);
    }
    else if (activeTab === "variable-expenses") {
      const parts = [];
      if (selectedMonth) parts.push(`Ciclo: ${selectedMonth}`);
      if (variableDateStart) parts.push(`Início: ${formatDateDate(variableDateStart)}`);
      if (variableDateEnd) parts.push(`Fim: ${formatDateDate(variableDateEnd)}`);
      if (variableStatus !== "todos") parts.push(`Status: ${variableStatus}`);
      if (variableCategory !== "todas") parts.push(`Categoria: ${variableCategory}`);
      if (variablePaymentMethod !== "todos") parts.push(`Meio: ${variablePaymentMethod}`);
      const filtersInfo = parts.join(" | ") || "Sem filtros ativos";
      
      exportVariableExpensesPDF(filteredVariableExpenses, filtersInfo, userEmail);
    }
    else if (activeTab === "overview") {
      exportOverviewPDF(transactions, expenses, selectedMonth, userEmail);
    }
    else if (activeTab === "reports") {
      // Filter data for reports
      const reportTxs = transactions.filter((t) => !selectedMonth || t.data.startsWith(selectedMonth));
      const reportExps = expenses.filter((e) => {
        const dateStr = e.tipo === "fixa" ? e.dataVencimento : e.data;
        return !selectedMonth || dateStr.startsWith(selectedMonth);
      });

      const totalReceita = reportTxs.filter(t => t.tipo === "entrada").reduce((sum, t) => sum + t.valor, 0);
      const totalSaidasTx = reportTxs.filter(t => t.tipo === "saida").reduce((sum, t) => sum + t.valor, 0);
      const totalFixed = reportExps.filter(e => e.tipo === "fixa").reduce((sum, e) => sum + e.valor, 0);
      const totalVariable = reportExps.filter(e => e.tipo === "variavel").reduce((sum, e) => sum + e.valor, 0);
      const totalCustos = totalSaidasTx + totalFixed + totalVariable;
      const lucroPrejuizo = totalReceita - totalCustos;
      const margemLucro = totalReceita > 0 ? (lucroPrejuizo / totalReceita) * 100 : 0;

      const catGroups: Record<string, number> = {};
      reportTxs.filter(t => t.tipo === "saida").forEach(t => {
        catGroups[t.categoria] = (catGroups[t.categoria] || 0) + t.valor;
      });
      reportExps.forEach(e => {
        catGroups[e.categoria] = (catGroups[e.categoria] || 0) + e.valor;
      });
      const categoryData = Object.entries(catGroups)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const list: string[] = [];
      if (totalReceita > totalCustos) {
        list.push(`Suas entradas foram maiores que suas saídas e despesas neste período, resultando em superávit de ${formatCurrency(lucroPrejuizo)}.`);
      } else if (totalReceita < totalCustos) {
        list.push(`As saídas e despesas superaram suas entradas neste período. Recomendamos identificar gargalos ou reduzir custos de marketing e infraestrutura.`);
      } else {
        list.push(`Seu fluxo de caixa atingiu o ponto de equilíbrio perfeito neste período (R$ 0,00 de saldo líquido).`);
      }

      if (totalCustos > 0) {
        const fixedRatio = (totalFixed / totalCustos) * 100;
        list.push(`As despesas fixas representam ${fixedRatio.toFixed(1)}% de todos os seus custos totais do período analisado.`);
      }

      if (categoryData.length > 0) {
        const topCat = categoryData[0];
        list.push(`A categoria com maior consumo de capital foi "${topCat.name}" acumulando ${formatCurrency(topCat.value)}.`);
      }

      const overdueCount = reportExps.filter(e => e.status !== "pago" && e.tipo === "fixa" && e.dataVencimento < todayStr).length;
      if (overdueCount > 0) {
        list.push(`Atenção crítica: Existem ${overdueCount} despesas fixas vencidas no período analisado.`);
      } else {
        list.push(`Excelente! Nenhuma despesa fixa está vencida no período selecionado.`);
      }

      if (lucroPrejuizo >= 0) {
        list.push(`Seu resultado final consolidado para o filtro atual foi positivo em ${formatCurrency(lucroPrejuizo)} (Margem de ${margemLucro.toFixed(1)}%).`);
      } else {
        list.push(`Seu resultado final consolidado para o filtro atual foi negativo em ${formatCurrency(Math.abs(lucroPrejuizo))}.`);
      }

      exportReportsPDF(reportTxs, reportExps, selectedMonth || "Consolidado Geral", list, userEmail);
    }
  };

  // ----------------------------------------
  // Section calculations (Dynamic calculations based on user instructions)
  // 1. All-time general metrics
  const totalBancosAtivos = banks.filter(b => b.ativo).reduce((sum, b) => sum + (b.saldoAtual || 0), 0);
  const totalInvestidoAtivos = investments.filter(i => i.ativo).reduce((sum, i) => sum + (i.valorAtual || 0), 0);
  const totalBensAtivos = assets.filter(a => a.ativo).reduce((sum, a) => sum + (a.valorEstimado || 0), 0);
  const patrimonioConsolidado = totalBancosAtivos + totalInvestidoAtivos + totalBensAtivos;

  const totalEntradasAll = transactions.filter(t => t.tipo === "entrada").reduce((sum, t) => sum + Math.abs(t.valor || 0), 0);
  const totalSaidasAll = transactions.filter(t => t.tipo === "saida").reduce((sum, t) => sum + Math.abs(t.valor || 0), 0);
  const totalDespesasPagasAll = expenses.filter(e => e.status === "pago" && !e.saidaGerada).reduce((sum, e) => sum + e.valor, 0);
  const saldoAtualAllTime = totalBancosAtivos;

  // 2. Month-specific general metrics (Dynamic filter on selected month)
  const entriesInSelectedMonth = transactions.filter(t => t.tipo === "entrada" && (!selectedMonth || t.data.startsWith(selectedMonth)));
  const exitsInSelectedMonth = transactions.filter(t => t.tipo === "saida" && (!selectedMonth || t.data.startsWith(selectedMonth)));
  const fixedInSelectedMonth = expenses.filter(e => e.tipo === "fixa" && (!selectedMonth || e.dataVencimento.startsWith(selectedMonth)));
  const variableInSelectedMonth = expenses.filter(e => e.tipo === "variavel" && (!selectedMonth || e.data.startsWith(selectedMonth)));

  const totalEntradasMonth = entriesInSelectedMonth.reduce((sum, t) => sum + Math.abs(t.valor || 0), 0);
  const totalSaidasMonth = exitsInSelectedMonth.reduce((sum, t) => sum + Math.abs(t.valor || 0), 0);
  const totalDespesasFixasMonth = fixedInSelectedMonth.reduce((sum, e) => sum + e.valor, 0);
  const totalDespesasVariaveisMonth = variableInSelectedMonth.reduce((sum, e) => sum + e.valor, 0);

  const fixedPaidMonth = fixedInSelectedMonth.filter(e => e.status === "pago" && !e.saidaGerada).reduce((sum, e) => sum + e.valor, 0);
  const variablePaidMonth = variableInSelectedMonth.filter(e => e.status === "pago" && !e.saidaGerada).reduce((sum, e) => sum + e.valor, 0);
  const totalDespesasPagasMonth = fixedPaidMonth + variablePaidMonth;
  const resultadoDoMes = totalEntradasMonth - totalSaidasMonth;

  // Overdue, today, upcoming calculations
  const overdueExpensesCount = expenses.filter(e => e.tipo === "fixa" && e.status !== "pago" && e.dataVencimento < todayStr).reduce((sum, e) => sum + e.valor, 0);
  const todayExpensesCount = expenses.filter(e => e.tipo === "fixa" && e.status !== "pago" && e.dataVencimento === todayStr).reduce((sum, e) => sum + e.valor, 0);
  
  const getDaysDiff = (dateStr: string) => {
    if (!dateStr || !todayStr) return 999;
    const itemDate = new Date(dateStr + "T00:00:00");
    const todayDate = new Date(todayStr + "T00:00:00");
    const diffTime = itemDate.getTime() - todayDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  const upcomingExpensesCount = expenses.filter(e => {
    if (e.status === "pago" || e.tipo !== "fixa") return false;
    const diff = getDaysDiff(e.dataVencimento);
    return diff > 0 && diff <= 3;
  }).reduce((sum, e) => sum + e.valor, 0);

  // ----------------------------------------
  // Transaction CRUD Actions
  const handleTransactionSubmit = async (data: Omit<Transaction, "id" | "criadoEm"> & { id?: string }) => {
    const userEmail = currentUser?.email || "";
    const safeValor = Math.abs(data.valor || 0);
    try {
      if (data.id) {
        const originalTx = transactions.find(t => t.id === data.id);
        const updatedTxPayload: Transaction = {
          id: data.id,
          tipo: data.tipo,
          nome: data.nome,
          descricao: data.descricao || "",
          categoria: data.categoria,
          valor: safeValor,
          formaPagamento: data.formaPagamento,
          data: data.data,
          bancoId: data.bancoId || null,
          bancoNome: data.bancoNome || null,
          origem: data.origem || "manual",
          criadoEm: originalTx?.criadoEm || "",
          imovelId: data.imovelId || originalTx?.imovelId || null,
          imovelNome: data.imovelNome || originalTx?.imovelNome || null,
          centroCustoTipo: data.centroCustoTipo || originalTx?.centroCustoTipo || null,
        };

        if (originalTx) {
          await updateBankBalanceOnTransactionEdit(originalTx, updatedTxPayload);
        }

        const docRef = doc(db, "financeiro", "geral", "transacoes", data.id);
        await updateDoc(docRef, {
          tipo: data.tipo,
          nome: data.nome,
          descricao: data.descricao,
          categoria: data.categoria,
          valor: safeValor,
          formaPagamento: data.formaPagamento,
          data: stringToTimestamp(data.data),
          bancoId: data.bancoId || null,
          bancoNome: data.bancoNome || null,
          origem: data.origem || "manual",
          atualizadoEm: serverTimestamp(),
          notaUrl: data.notaUrl || null,
          notaPublicId: data.notaPublicId || null,
          notaTipo: data.notaTipo || null,
          notaNome: data.notaNome || null,
        });
      } else {
        const newTxPayload: Transaction = {
          id: "",
          tipo: data.tipo,
          nome: data.nome,
          descricao: data.descricao || "",
          categoria: data.categoria,
          valor: safeValor,
          formaPagamento: data.formaPagamento,
          data: data.data,
          bancoId: data.bancoId || null,
          bancoNome: data.bancoNome || null,
          origem: "manual",
          criadoEm: "",
        };

        await applyTransactionToBank(newTxPayload);

        const colRef = collection(db, "financeiro", "geral", "transacoes");
        await addDoc(colRef, {
          tipo: data.tipo,
          nome: data.nome,
          descricao: data.descricao,
          categoria: data.categoria,
          valor: safeValor,
          formaPagamento: data.formaPagamento,
          data: stringToTimestamp(data.data),
          bancoId: data.bancoId || null,
          bancoNome: data.bancoNome || null,
          origem: "manual",
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
          criadoPorEmail: userEmail,
          notaUrl: data.notaUrl || null,
          notaPublicId: data.notaPublicId || null,
          notaTipo: data.notaTipo || null,
          notaNome: data.notaNome || null,
        });
      }
      setEditingTransaction(null);
    } catch (err) {
      handleFirestoreError(err, data.id ? OperationType.UPDATE : OperationType.CREATE, `financeiro/geral/transacoes/${data.id || ""}`);
    }
  };

  const handleTransactionEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsTransactionModalOpen(true);
  };

  const handleTransactionDelete = (id: string) => {
    setDeleteConfirmConfig({
      isOpen: true,
      type: "transaction",
      id,
      loading: false,
      error: null,
    });
  };

  // Expense CRUD Actions
  const handleExpenseSubmit = async (data: Omit<Expense, "id" | "criadoEm"> & { id?: string }) => {
    const userEmail = currentUser?.email || "";
    try {
      const finalData = data.tipo === "variavel" ? data.data : "";
      const finalVencimento = data.tipo === "fixa" ? data.dataVencimento : "";

      if (data.id) {
        // Mode: EDIT
        const originalExpense = expenses.find(e => e.id === data.id);
        const hasLinkedTransaction = originalExpense?.saidaGerada === true || !!originalExpense?.transacaoGeradaId;

        const performUpdate = async (shouldUpdateTx: boolean) => {
          const docRef = doc(db, "financeiro", "geral", "despesas", data.id!);
          const updateData: any = {
            tipo: data.tipo,
            nome: data.nome,
            descricao: data.descricao,
            categoria: data.categoria,
            valor: data.valor,
            formaPagamento: data.formaPagamento,
            data: finalData ? stringToTimestamp(finalData) : Timestamp.now(),
            dataVencimento: finalVencimento ? stringToTimestamp(finalVencimento) : Timestamp.now(),
            status: data.status,
            pagoEm: data.status === "pago" ? (data.pagoEm ? stringToTimestamp(data.pagoEm) : Timestamp.now()) : null,
            atualizadoEm: serverTimestamp(),
            notaUrl: data.notaUrl || null,
            notaPublicId: data.notaPublicId || null,
            notaTipo: data.notaTipo || null,
            notaNome: data.notaNome || null,
            transacaoGeradaId: data.transacaoGeradaId || null,
            saidaGerada: data.saidaGerada ?? false,
            imovelId: data.imovelId || null,
            imovelNome: data.imovelNome || null,
            centroCustoTipo: data.centroCustoTipo || null,
          };

          if (data.tipo === "fixa") {
            updateData.recorrente = data.recorrente ?? false;
            updateData.recorrenciaAtiva = data.recorrenciaAtiva ?? false;
            updateData.diaVencimento = data.diaVencimento || Number(finalVencimento.split("-")[2]) || 10;
            updateData.competencia = data.competencia || getExpenseCompetence(finalVencimento);
            if (data.baixadaCompletamente !== undefined) {
              updateData.baixadaCompletamente = data.baixadaCompletamente;
            }
            if (data.baixadaEm) {
              updateData.baixadaEm = stringToTimestamp(data.baixadaEm);
            }
            if (data.motivoBaixa !== undefined) {
              updateData.motivoBaixa = data.motivoBaixa;
            }
          }

          await updateDoc(docRef, updateData);

          if (shouldUpdateTx && hasLinkedTransaction && originalExpense) {
            const updatedExpenseForTx: Expense = {
              ...originalExpense,
              ...data,
            } as Expense;
            await updateLinkedExpenseTransaction(updatedExpenseForTx);
          }
        };

        if (hasLinkedTransaction) {
          setExpenseActionConfirm({
            isOpen: true,
            title: "Atualizar saída vinculada?",
            message: "Esta despesa já gerou uma saída automática. Deseja atualizar também a saída vinculada?",
            confirmLabel: "Atualizar despesa e saída",
            cancelLabel: "Cancelar",
            extraLabel: "Atualizar somente despesa",
            onConfirm: async () => {
              await performUpdate(true);
              setExpenseActionConfirm(null);
              setIsExpenseModalOpen(false);
              setEditingExpense(null);
            },
            onExtraConfirm: async () => {
              await performUpdate(false);
              setExpenseActionConfirm(null);
              setIsExpenseModalOpen(false);
              setEditingExpense(null);
            },
            onCancel: () => {
              setExpenseActionConfirm(null);
            }
          });
          return;
        } else {
          // If edited to paid status, and didn't have a transaction, auto-create one
          if (data.status === "pago" && originalExpense?.status !== "pago") {
            const tempExpense: Expense = {
              id: data.id,
              ...data,
              pagoEm: new Date().toISOString(),
            } as any;
            const genTxId = await createExpensePaymentTransaction(tempExpense, userEmail);
            if (genTxId) {
              data.saidaGerada = true;
              data.transacaoGeradaId = genTxId;
            }
          }
          await performUpdate(false);
        }
      } else {
        // Mode: CREATE
        const colRef = collection(db, "financeiro", "geral", "despesas");
        
        if (data.tipo === "fixa" && isCreditCardPayment(data.formaPagamento) && data.parcelado) {
          await generateInstallmentExpenses({
            nome: data.nome,
            valorTotal: data.valor,
            totalParcelas: data.totalParcelas || 12,
            primeiraDataVencimento: finalVencimento,
            categoria: data.categoria,
            formaPagamento: data.formaPagamento,
            descricao: data.descricao || "",
            criadoPorEmail: userEmail,
            notaUrl: data.notaUrl || null,
            notaPublicId: data.notaPublicId || null,
            notaTipo: data.notaTipo || null,
            notaNome: data.notaNome || null,
            imovelId: data.imovelId || null,
            imovelNome: data.imovelNome || null,
            centroCustoTipo: data.centroCustoTipo || null,
          });
        } else if (data.tipo === "fixa") {
          const competence = getExpenseCompetence(finalVencimento);
          const diaVenc = data.diaVencimento || Number(finalVencimento.split("-")[2]) || 10;
          const grupoId = data.grupoRecorrenciaId || `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          const newDoc = await addDoc(colRef, {
            tipo: "fixa",
            nome: data.nome,
            descricao: data.descricao || "",
            categoria: data.categoria,
            valor: data.valor,
            formaPagamento: data.formaPagamento,
            data: "",
            dataVencimento: finalVencimento ? stringToTimestamp(finalVencimento) : Timestamp.now(),
            status: data.status,
            pagoEm: data.status === "pago" ? Timestamp.now() : null,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
            criadoPorEmail: userEmail,
            
            // Recurrence fields
            recorrente: data.recorrente ?? false,
            recorrenciaAtiva: data.recorrente ?? false,
            grupoRecorrenciaId: grupoId,
            despesaOrigemId: null,
            competencia: competence,
            diaVencimento: diaVenc,
            baixadaCompletamente: false,
            baixadaEm: null,
            motivoBaixa: null,

            notaUrl: data.notaUrl || null,
            notaPublicId: data.notaPublicId || null,
            notaTipo: data.notaTipo || null,
            notaNome: data.notaNome || null,

            // Property cost center fields
            imovelId: data.imovelId || null,
            imovelNome: data.imovelNome || null,
            centroCustoTipo: data.centroCustoTipo || null,
          });

          // If created as "pago", auto-create a transaction
          if (data.status === "pago") {
            const tempExpense: Expense = {
              id: newDoc.id,
              ...data,
              pagoEm: new Date().toISOString(),
            } as any;
            const genTxId = await createExpensePaymentTransaction(tempExpense, userEmail);
            if (genTxId) {
              await updateDoc(doc(db, "financeiro", "geral", "despesas", newDoc.id), {
                saidaGerada: true,
                transacaoGeradaId: genTxId,
              });
            }
          }

          // If it's saved as "pago" and marked as recurring, auto-create the next month's pending installment
          if (data.status === "pago" && data.recorrente) {
            const nextDueDate = getNextMonthDueDate(finalVencimento, diaVenc);
            const nextCompetence = getExpenseCompetence(nextDueDate);
            const alreadyExists = expenses.some(
              (e) => e.grupoRecorrenciaId === grupoId && e.competencia === nextCompetence
            );

            if (!alreadyExists) {
              await addDoc(colRef, {
                tipo: "fixa",
                nome: data.nome,
                descricao: data.descricao || "",
                categoria: data.categoria,
                valor: data.valor,
                formaPagamento: data.formaPagamento,
                data: "",
                dataVencimento: stringToTimestamp(nextDueDate),
                diaVencimento: diaVenc,
                competencia: nextCompetence,
                status: "pendente",
                pagoEm: null,
                criadoEm: serverTimestamp(),
                atualizadoEm: serverTimestamp(),
                criadoPorEmail: userEmail,
                recorrente: true,
                recorrenciaAtiva: true,
                despesaOrigemId: newDoc.id,
                grupoRecorrenciaId: grupoId,
                baixadaCompletamente: false,
                baixadaEm: null,
                motivoBaixa: null,

                // Property fields for next-month automatic pending expense
                imovelId: data.imovelId || null,
                imovelNome: data.imovelNome || null,
                centroCustoTipo: data.centroCustoTipo || null,
              });
            }
          }
        } else {
          // Variable Expense (non-recurring)
          const newDoc = await addDoc(colRef, {
            tipo: "variavel",
            nome: data.nome,
            descricao: data.descricao || "",
            categoria: data.categoria,
            valor: data.valor,
            formaPagamento: data.formaPagamento,
            data: finalData ? stringToTimestamp(finalData) : Timestamp.now(),
            dataVencimento: Timestamp.now(),
            status: data.status,
            pagoEm: data.status === "pago" ? Timestamp.now() : null,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
            criadoPorEmail: userEmail,
            notaUrl: data.notaUrl || null,
            notaPublicId: data.notaPublicId || null,
            notaTipo: data.notaTipo || null,
            notaNome: data.notaNome || null,

            // Property fields for variable expense
            imovelId: data.imovelId || null,
            imovelNome: data.imovelNome || null,
            centroCustoTipo: data.centroCustoTipo || null,
          });

          // If created as "pago", auto-create a transaction
          if (data.status === "pago") {
            const tempExpense: Expense = {
              id: newDoc.id,
              ...data,
              pagoEm: new Date().toISOString(),
            } as any;
            const genTxId = await createExpensePaymentTransaction(tempExpense, userEmail);
            if (genTxId) {
              await updateDoc(doc(db, "financeiro", "geral", "despesas", newDoc.id), {
                saidaGerada: true,
                transacaoGeradaId: genTxId,
              });
            }
          }
        }
      }
      setEditingExpense(null);
    } catch (err) {
      handleFirestoreError(err, data.id ? OperationType.UPDATE : OperationType.CREATE, `financeiro/geral/despesas/${data.id || ""}`);
    }
  };

  const handleExpenseEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setIsExpenseModalOpen(true);
  };

  const handleExpenseDelete = (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    const isParcelado = expense.parcelado ?? false;
    const grupoParcelamentoId = expense.grupoParcelamentoId || null;
    const hasLinkedTransaction = expense.saidaGerada === true || !!expense.transacaoGeradaId;

    if (hasLinkedTransaction) {
      setExpenseActionConfirm({
        isOpen: true,
        title: "Excluir despesa paga?",
        message: "Esta despesa já gerou uma saída automática. Deseja excluir também a saída vinculada e estornar o valor no banco?",
        confirmLabel: "Excluir despesa e saída vinculada",
        cancelLabel: "Cancelar",
        extraLabel: "Excluir somente despesa",
        onConfirm: async () => {
          try {
            const batch = writeBatch(db);
            if (isParcelado && grupoParcelamentoId) {
              await deleteInstallmentGroup(grupoParcelamentoId);
            } else {
              batch.delete(doc(db, "financeiro", "geral", "despesas", id));
            }
            if (expense.transacaoGeradaId) {
              batch.delete(doc(db, "financeiro", "geral", "transacoes", expense.transacaoGeradaId));
            }
            if (expense.bancoPagamentoId) {
              const bankRef = doc(db, "financeiro", "geral", "bancos", expense.bancoPagamentoId);
              batch.update(bankRef, {
                saldoAtual: increment(expense.valor),
                atualizadoEm: new Date().toISOString()
              });
            }
            await batch.commit();
            console.log("Despesa e transação excluídas e saldo estornado.");
          } catch (err) {
            console.error(err);
          }
          setExpenseActionConfirm(null);
        },
        onExtraConfirm: async () => {
          try {
            await deleteDoc(doc(db, "financeiro", "geral", "despesas", id));
            console.log("Despesa excluída");
          } catch (err) {
            console.error(err);
          }
          setExpenseActionConfirm(null);
        },
        onCancel: () => {
          setExpenseActionConfirm(null);
        }
      });
      return;
    }

    setDeleteConfirmConfig({
      isOpen: true,
      type: "expense",
      id,
      loading: false,
      error: null,
      isParcelado,
      grupoParcelamentoId,
      deleteOption: "only",
    });
  };

  const handleExecuteDelete = async () => {
    const { id, type, isParcelado, grupoParcelamentoId, deleteOption } = deleteConfirmConfig;
    if (!id) return;

    setDeleteConfirmConfig(prev => ({ ...prev, loading: true, error: null }));

    try {
      if (type === "transaction") {
        const tx = transactions.find(t => t.id === id);
        if (tx) {
          await reverseTransactionFromBank(tx);
        }
        const docRef = doc(db, "financeiro", "geral", "transacoes", id);
        await deleteDoc(docRef);
        console.log("Transação excluída com sucesso:", id);
      } else {
        const expense = expenses.find(e => e.id === id);
        if (isParcelado && grupoParcelamentoId && deleteOption === "all") {
          if (expense && expense.status === "pago" && expense.bancoPagamentoId) {
            const bankRef = doc(db, "financeiro", "geral", "bancos", expense.bancoPagamentoId);
            await updateDoc(bankRef, {
              saldoAtual: increment(expense.valor),
              atualizadoEm: new Date().toISOString()
            });
          }
          await deleteInstallmentGroup(grupoParcelamentoId);
          console.log("Grupo de parcelamento excluído com sucesso:", grupoParcelamentoId);
        } else {
          if (expense && expense.status === "pago" && expense.bancoPagamentoId) {
            const bankRef = doc(db, "financeiro", "geral", "bancos", expense.bancoPagamentoId);
            await updateDoc(bankRef, {
              saldoAtual: increment(expense.valor),
              atualizadoEm: new Date().toISOString()
            });
          }
          const docRef = doc(db, "financeiro", "geral", "despesas", id);
          await deleteDoc(docRef);
          console.log("Despesa excluída com sucesso:", id);
        }
      }
      setDeleteConfirmConfig({
        isOpen: false,
        type: "transaction",
        id: "",
        loading: false,
        error: null,
        isParcelado: false,
        grupoParcelamentoId: null,
        deleteOption: "only",
      });
    } catch (err: any) {
      console.error(`Erro ao excluir ${type}:`, err);
      // Give a precise error message based on common Firebase permission errors
      const errorMsg = err.code === "permission-denied" 
        ? "Permissão negada. Apenas usuários autorizados nas regras do Firestore podem excluir registros."
        : "Erro ao excluir registro do Firestore. Verifique o console.";
      setDeleteConfirmConfig(prev => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
    }
  };

  const handleConfirmPaid = (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    const activeBanks = banks.filter(b => b.ativo);
    if (activeBanks.length === 0) {
      alert("Aviso: Cadastre e ative pelo menos uma conta/banco para confirmar pagamentos.");
      return;
    }

    setPaymentBankModalConfig({
      isOpen: true,
      expenseId: id,
      selectedBankId: activeBanks[0].id,
    });
  };

  const handleExecuteExpensePaymentWithBank = async () => {
    const { expenseId, selectedBankId } = paymentBankModalConfig;
    if (!expenseId || !selectedBankId) return;

    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const selectedBank = banks.find(b => b.id === selectedBankId);
    if (!selectedBank) return;

    try {
      const userEmail = currentUser?.email || "";
      const result = await confirmExpensePaymentAndUpdateBank(expense, selectedBankId, userEmail);
      if (result && result.groupFullyPaid) {
        alert("Parcelamento quitado com sucesso.");
      }
      if (expense.recorrente) {
        hasGeneratedFutureRecurrences.current = false;
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao confirmar pagamento: " + (err as any).message);
    } finally {
      setPaymentBankModalConfig({ isOpen: false, expenseId: null, selectedBankId: "" });
    }
  };

  const handleCancelPayment = async (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;

    const hasLinkedTransaction = expense.saidaGerada === true || !!expense.transacaoGeradaId;

    if (hasLinkedTransaction) {
      setExpenseActionConfirm({
        isOpen: true,
        title: "Cancelar pagamento?",
        message: "Esta despesa já gerou uma saída automática. Deseja excluir também a saída vinculada e estornar o valor para o banco?",
        confirmLabel: "Sim, excluir saída e estornar",
        cancelLabel: "Cancelar",
        extraLabel: "Não, manter saída vinculada",
        onConfirm: async () => {
          try {
            const batch = writeBatch(db);
            batch.update(doc(db, "financeiro", "geral", "despesas", id), {
              status: "pendente",
              pagoEm: null,
              saidaGerada: false,
              transacaoGeradaId: null,
              bancoPagamentoId: null,
              bancoPagamentoNome: null,
              atualizadoEm: serverTimestamp()
            });
            if (expense.transacaoGeradaId) {
              batch.delete(doc(db, "financeiro", "geral", "transacoes", expense.transacaoGeradaId));
            }
            if (expense.bancoPagamentoId) {
              const bankRef = doc(db, "financeiro", "geral", "bancos", expense.bancoPagamentoId);
              batch.update(bankRef, {
                saldoAtual: increment(expense.valor),
                atualizadoEm: new Date().toISOString()
              });
            }
            await batch.commit();
            console.log("Pagamento cancelado, transação excluída e saldo estornado.");
          } catch (err) {
            console.error(err);
          }
          setExpenseActionConfirm(null);
        },
        onExtraConfirm: async () => {
          try {
            const docRef = doc(db, "financeiro", "geral", "despesas", id);
            await updateDoc(docRef, {
              status: "pendente",
              pagoEm: null,
              saidaGerada: false,
              transacaoGeradaId: null,
              bancoPagamentoId: null,
              bancoPagamentoNome: null,
              atualizadoEm: serverTimestamp()
            });
          } catch (err) {
            console.error(err);
          }
          setExpenseActionConfirm(null);
        },
        onCancel: () => {
          setExpenseActionConfirm(null);
        }
      });
    } else {
      // Just mark back as pending
      try {
        const docRef = doc(db, "financeiro", "geral", "despesas", id);
        await updateDoc(docRef, {
          status: "pendente",
          pagoEm: null,
          bancoPagamentoId: null,
          bancoPagamentoNome: null,
          atualizadoEm: serverTimestamp()
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCloseRecurring = async (id: string, motivo: string) => {
    try {
      await closeRecurringExpense(id, expenses, motivo);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `financeiro/geral/despesas/${id}`);
    }
  };

  // Logout - signs out of Firebase Auth
  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.history.pushState({}, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }
  };

  const menuItems = [
    { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
    { id: "transactions", label: "Entradas e Saídas", icon: ArrowLeftRight },
    { id: "fixed-expenses", label: "Despesas Fixas", icon: Calendar },
    { id: "variable-expenses", label: "Despesas Variáveis", icon: Layers },
    { id: "reports", label: "Relatórios de BI", icon: BarChart3 },
    { id: "registrations", label: "Cadastros", icon: Settings },
    { id: "card-expenses", label: "Despesas Cartão", icon: CreditCard },
    { id: "applications", label: "Aplicações", icon: Wallet },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans relative overflow-hidden">
        <div className="absolute top-[30%] left-[20%] w-[300px] h-[300px] rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none" />
        <div className="relative flex flex-col items-center gap-4 z-10">
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-lime-400 p-[1px] flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[15px] flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-emerald-600 to-lime-400 opacity-20 blur-md animate-pulse" />
          </div>
          <p className="text-sm font-semibold tracking-wider text-emerald-400/90 uppercase font-mono animate-pulse">
            Carregando Painel Real...
          </p>
        </div>
      </div>
    );
  }

  // Categories list for selection options
  const transactionCategories = ["Comissão", "Venda", "Serviço", "Aluguel", "Investimento", "Reembolso", "Anúncios", "Software/SaaS", "Infraestrutura", "Consultoria", "Impostos", "Outros"];
  const fixedCategories = ["Aluguel", "Internet", "Energia", "Água", "Sistema", "Funcionário", "Contabilidade", "Anúncios", "Seguros", "Outros"];
  const variableCategories = ["Combustível", "Alimentação", "Manutenção", "Compra avulsa", "Taxas", "Viagem", "Eventos", "Outros"];
  const paymentMethodsList = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Transferência", "Boleto", "Outros"];

  // Category distributions calculation for Reports
  const txFilteredEntries = filteredTransactions.filter(t => t.tipo === "entrada");
  const txFilteredExits = filteredTransactions.filter(t => t.tipo === "saida");
  
  const entriesByCategory = txFilteredEntries.reduce((acc, t) => {
    acc[t.categoria] = (acc[t.categoria] || 0) + t.valor;
    return acc;
  }, {} as Record<string, number>);

  const exitsByCategory = txFilteredExits.reduce((acc, t) => {
    acc[t.categoria] = (acc[t.categoria] || 0) + t.valor;
    return acc;
  }, {} as Record<string, number>);

  const fixedByCategory = filteredFixedExpenses.reduce((acc, e) => {
    acc[e.categoria] = (acc[e.categoria] || 0) + e.valor;
    return acc;
  }, {} as Record<string, number>);

  const variableByCategory = filteredVariableExpenses.reduce((acc, e) => {
    acc[e.categoria] = (acc[e.categoria] || 0) + e.valor;
    return acc;
  }, {} as Record<string, number>);

  const getPercentageWidth = (value: number, total: number) => {
    if (total <= 0) return "0%";
    return `${Math.min(100, Math.round((value / total) * 100))}%`;
  };

  return (
    <div className="min-h-screen bg-black text-white flex overflow-x-hidden font-sans relative w-full max-w-full">
      
      {/* Background radial effects */}
      <div className="absolute top-[-30%] left-[-20%] w-[600px] h-[600px] rounded-full bg-emerald-950/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-35%] right-[-10%] w-[600px] h-[600px] rounded-full bg-lime-950/15 blur-[150px] pointer-events-none" />
      <div className="absolute top-[20%] right-[30%] w-[400px] h-[400px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] pointer-events-none opacity-50" />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-zinc-950/80 backdrop-blur-xl border-r border-white/5 z-20 h-screen shrink-0">
        
        {/* Sidebar Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-lime-400 shadow-md shadow-emerald-500/10">
            <TrendingUp className="w-5 h-5 text-black stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white leading-tight">
              Painel Financeiro
            </h2>
            <span className="text-[10px] text-emerald-400/90 font-medium tracking-wide uppercase">
              Corporate SaaS
            </span>
          </div>
        </div>

        {/* Sidebar User Area */}
        <div className="px-4 py-5 border-b border-white/5">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-900/30 border border-white/5">
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-emerald-400 border border-emerald-500/10 shrink-0 font-bold uppercase">
              {currentUser?.email ? currentUser.email.slice(0, 2) : "AD"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser?.displayName || currentUser?.email?.split("@")[0] || "Administrador"}
              </p>
              <p className="text-[10px] text-zinc-500 truncate">
                {currentUser?.email || "admin@painelfinanceiro.com"}
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as ActiveSection);
                  handleClearFilters();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-400 border-l-[3px] border-emerald-500 font-bold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-zinc-400"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-900/50 hover:bg-red-950/20 text-zinc-400 hover:text-red-400 border border-white/5 hover:border-red-500/15 text-xs font-semibold tracking-wide transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do sistema</span>
          </button>
        </div>

      </aside>

      {/* Mobile Sidebar overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/90 z-30 lg:hidden"
            />

            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-zinc-950 border-r border-white/5 z-40 lg:hidden flex flex-col"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-lime-400">
                    <TrendingUp className="w-5 h-5 text-black stroke-[2.5]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight text-white leading-tight">
                      Painel Financeiro
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 py-4 border-b border-white/5 bg-zinc-900/10">
                <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-900/50">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/10">
                    {currentUser?.email ? currentUser.email.slice(0, 2).toUpperCase() : "AD"}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white truncate">
                      {currentUser?.displayName || currentUser?.email?.split("@")[0] || "Administrador"}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {currentUser?.email || "admin@painelfinanceiro.com"}
                    </p>
                  </div>
                </div>
              </div>

              <nav className="flex-1 px-3 py-6 space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as ActiveSection);
                        handleClearFilters();
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        isActive
                          ? "bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-400 border-l-[3px] border-emerald-500 font-bold"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-zinc-400"}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-white/5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-900 hover:bg-red-950/20 text-zinc-400 hover:text-red-400 border border-white/5 text-xs font-semibold transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair do sistema</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden relative z-10 min-w-0 max-w-full">
        
        {/* Header */}
        <header className="sticky top-0 bg-black/40 backdrop-blur-md border-b border-white/5 p-4 lg:p-6 flex items-center justify-between shrink-0">
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-white bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent uppercase font-mono">
                {activeTab === "overview" && "Visão Geral"}
                {activeTab === "transactions" && "Entradas & Saídas"}
                {activeTab === "fixed-expenses" && "Despesas Fixas"}
                {activeTab === "variable-expenses" && "Despesas Variáveis"}
                {activeTab === "reports" && "Relatórios de BI"}
                {activeTab === "registrations" && "Cadastros do Sistema"}
                {activeTab === "card-expenses" && "Despesas Cartão"}
                {activeTab === "applications" && "Aplicações"}
              </h1>
              <p className="hidden sm:block text-xs text-zinc-500 mt-0.5">
                Dados reais carregados do Firebase Firestore de forma segura.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Current Date display */}
            <span className="hidden xl:inline-block text-[11px] font-semibold text-zinc-400 bg-zinc-900/60 border border-white/5 px-3 py-1.5 rounded-xl font-mono">
              {currentDateFormatted}
            </span>

            {/* Quick Action buttons */}
            <div className="flex gap-2">
              {activeTab !== "registrations" && activeTab !== "card-expenses" && activeTab !== "applications" && (
                <button
                  id="btn-exportar-pdf"
                  onClick={handleExportPDF}
                  className="bg-zinc-950 hover:bg-emerald-500/10 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 border border-emerald-500/30 hover:border-emerald-500 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden md:inline">Exportar PDF</span>
                  <span className="md:hidden">PDF</span>
                </button>
              )}

              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setIsTransactionModalOpen(true);
                }}
                className="bg-gradient-to-r from-emerald-500 to-lime-400 hover:from-emerald-400 hover:to-lime-300 text-black font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-emerald-500/5"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span className="hidden md:inline">Nova Transação</span>
                <span className="md:hidden">Transação</span>
              </button>

              <button
                onClick={() => {
                  setEditingExpense(null);
                  setPreselectedExpenseType("fixa");
                  setIsExpenseModalOpen(true);
                }}
                className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 border border-white/5 hover:border-white/10 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                <span className="hidden md:inline">Nova Despesa</span>
                <span className="md:hidden">Despesa</span>
              </button>
            </div>
          </div>

        </header>

        {/* Inner Scrolling Area */}
        <div className="flex-1 p-4 lg:p-6 space-y-6 max-w-7xl w-full mx-auto pb-16">
          
          {/* Universal Month Filter at the top of the workspace */}
          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                Ciclo de Análise Financeira:
              </span>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-2 text-xs text-white outline-none transition-all cursor-pointer w-full sm:w-44 font-mono font-bold"
              >
                {availableCycles.map((cycle) => (
                  <option key={cycle.value} value={cycle.value}>
                    {cycle.label}
                  </option>
                ))}
              </select>
              
              {selectedMonth && (
                <button
                  onClick={() => setSelectedMonth("")}
                  className="px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-white/5 rounded-xl transition-all"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* 1. Dynamic Render according to selected tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              
              {/* Overview cards - dynamic, beautiful */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                
                {/* Saldo Atual (All-time consolidado) */}
                <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6 group hover:border-emerald-500/20 transition-all duration-300">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-50 from-emerald-500/20 via-lime-400/10 to-transparent" />
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Saldo Atual</span>
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 text-emerald-400">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-white font-mono">
                      {formatCurrency(saldoAtualAllTime)}
                    </h2>
                    <p className="text-zinc-500 text-[10px]">Total geral líquido acumulado</p>
                  </div>
                </div>

                {/* Total de Entradas (Month filter) */}
                <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6 group hover:border-emerald-500/20 transition-all duration-300">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-50 from-emerald-500/20 via-lime-400/10 to-transparent" />
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Entradas</span>
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 text-emerald-400">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-white font-mono">
                      {formatCurrency(totalEntradasMonth)}
                    </h2>
                    <p className="text-zinc-500 text-[10px]">Faturamento bruto do ciclo</p>
                  </div>
                </div>

                {/* Total de Saídas (Month filter) */}
                <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6 group hover:border-red-500/20 transition-all duration-300">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-50 from-red-500/20 to-transparent" />
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Saídas</span>
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 text-red-400">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-white font-mono">
                      {formatCurrency(totalSaidasMonth)}
                    </h2>
                    <p className="text-zinc-500 text-[10px]">Fluxos de saída operacional</p>
                  </div>
                </div>

                {/* Resultado do mês (Entries month - exits month - paid expenses month) */}
                <div className={`relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6 group transition-all duration-300 ${resultadoDoMes >= 0 ? "hover:border-emerald-500/20" : "hover:border-red-500/20"}`}>
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-50 from-emerald-500/10 to-transparent" />
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Resultado do Ciclo</span>
                    <div className={`p-2.5 rounded-xl bg-zinc-950 border border-white/5 ${resultadoDoMes >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      <Sparkles className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h2 className={`text-2xl md:text-3xl font-extrabold font-mono ${resultadoDoMes >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatCurrency(resultadoDoMes)}
                    </h2>
                    <p className="text-zinc-500 text-[10px]">Lucro/prejuízo líquido do período</p>
                  </div>
                </div>

                {/* Despesas Fixas */}
                <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6 group hover:border-amber-500/20 transition-all duration-300">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-50 from-amber-500/20 to-transparent" />
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Despesas Fixas</span>
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 text-amber-400">
                      <Calendar className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-white font-mono">
                      {formatCurrency(totalDespesasFixasMonth)}
                    </h2>
                    <p className="text-zinc-500 text-[10px]">Total de obrigações fixas</p>
                  </div>
                </div>

                {/* Despesas Variáveis */}
                <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6 group hover:border-blue-500/20 transition-all duration-300">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-50 from-blue-500/20 to-transparent" />
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Despesas Variáveis</span>
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 text-blue-400">
                      <Layers className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-white font-mono">
                      {formatCurrency(totalDespesasVariaveisMonth)}
                    </h2>
                    <p className="text-zinc-500 text-[10px]">Custos flutuantes adicionais</p>
                  </div>
                </div>

                {/* Despesas Vencidas */}
                <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6 group hover:border-red-500/20 transition-all duration-300">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-50 from-red-500/20 to-transparent" />
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Despesas Vencidas</span>
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 text-red-500">
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-red-500 font-mono">
                      {formatCurrency(overdueExpensesCount)}
                    </h2>
                    <p className="text-zinc-500 text-[10px]">Contas em atraso pendentes</p>
                  </div>
                </div>

                {/* Vencem Hoje */}
                <div className="relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-md p-6 group hover:border-amber-500/20 transition-all duration-300">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-50 from-amber-500/20 to-transparent" />
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Vencem Hoje</span>
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 text-amber-500">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-amber-500 font-mono">
                      {formatCurrency(todayExpensesCount)}
                    </h2>
                    <p className="text-zinc-500 text-[10px]">Obrigações com prazo de vencimento hoje</p>
                  </div>
                </div>

              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className="xl:col-span-2 space-y-6">
                  {/* Recent Transactions Table */}
                  <TransactionTable
                    transactions={transactions.filter(t => !selectedMonth || t.data.startsWith(selectedMonth)).slice(0, 5)}
                    onEdit={handleTransactionEdit}
                    onDelete={handleTransactionDelete}
                  />

                  {/* Recent Expenses Table */}
                  <ExpenseTable
                    expenses={expenses.filter(e => !selectedMonth || (e.tipo === "fixa" ? e.dataVencimento.startsWith(selectedMonth) : e.data.startsWith(selectedMonth))).slice(0, 5)}
                    onEdit={handleExpenseEdit}
                    onDelete={handleExpenseDelete}
                    onConfirmPaid={handleConfirmPaid}
                    onCloseRecurring={handleCloseRecurring}
                    onCancelPayment={handleCancelPayment}
                  />
                </div>

                <div className="space-y-6">
                  {/* Intelligent alerts panel */}
                  <PaymentAlerts expenses={expenses} />
                  
                  {/* Session User information */}
                  <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 backdrop-blur-md space-y-4">
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-4 h-4 text-emerald-400" />
                      Sessão Ativa
                    </h4>
                    <div className="space-y-2 text-xs text-zinc-400">
                      <p>E-mail corporativo autenticado:</p>
                      <div className="bg-black/40 border border-zinc-800 rounded-xl p-3 text-zinc-300 leading-relaxed font-mono text-[11px] break-all">
                        {currentUser?.email}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 2. TRANSACTIONS SECTION */}
          {activeTab === "transactions" && (
            <div className="space-y-6">
              
              {/* Filter panel */}
              <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Filter className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Filtros Avançados: Entradas e Saídas</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Data Inicial</label>
                    <input
                      type="date"
                      value={txDateStart}
                      onChange={(e) => setTxDateStart(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Data Final</label>
                    <input
                      type="date"
                      value={txDateEnd}
                      onChange={(e) => setTxDateEnd(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Tipo de Registro</label>
                    <select
                      value={txType}
                      onChange={(e) => setTxType(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todos">Todos os Tipos</option>
                      <option value="entrada">Entradas</option>
                      <option value="saida">Saídas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Categoria</label>
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todas">Todas as Categorias</option>
                      {transactionCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Forma de Pagamento</label>
                    <select
                      value={txPaymentMethod}
                      onChange={(e) => setTxPaymentMethod(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todos">Todas as Formas</option>
                      {paymentMethodsList.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl border border-white/5 transition-all"
                  >
                    Resetar Filtros
                  </button>
                </div>
              </div>

              {/* Specific Cards for Transactions Section */}
              {(() => {
                const totalEntradasTxFiltered = txFilteredEntries.reduce((sum, t) => sum + t.valor, 0);
                const totalSaidasTxFiltered = txFilteredExits.reduce((sum, t) => sum + t.valor, 0);
                const resultadoTxFiltered = totalEntradasTxFiltered - totalSaidasTxFiltered;

                const maiorEntradaTxFiltered = txFilteredEntries.length > 0 
                  ? Math.max(...txFilteredEntries.map(t => t.valor)) 
                  : 0;

                const maiorSaidaTxFiltered = txFilteredExits.length > 0 
                  ? Math.max(...txFilteredExits.map(t => t.valor)) 
                  : 0;

                const totalTransacoesFiltered = filteredTransactions.length;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Entradas do Mês</span>
                        <h2 className="text-xl font-black text-emerald-400 font-mono leading-none">
                          {formatCurrency(totalEntradasTxFiltered)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Faturamento operacional</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Saídas do Mês</span>
                        <h2 className="text-xl font-black text-red-400 font-mono leading-none">
                          {formatCurrency(totalSaidasTxFiltered)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Gastos operacionais</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Resultado do Mês</span>
                        <h2 className={`text-xl font-black font-mono leading-none ${resultadoTxFiltered >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {formatCurrency(resultadoTxFiltered)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Líquido do período</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Maior Entrada</span>
                        <h2 className="text-xl font-black text-emerald-400 font-mono leading-none">
                          {formatCurrency(maiorEntradaTxFiltered)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Pico de faturamento</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Maior Saída</span>
                        <h2 className="text-xl font-black text-red-400 font-mono leading-none">
                          {formatCurrency(maiorSaidaTxFiltered)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Maior retirada única</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Total Transações</span>
                        <h2 className="text-xl font-black text-white font-mono leading-none">
                          {totalTransacoesFiltered}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Volume do período</p>
                    </div>
                  </div>
                );
              })()}

              {/* Transactions Table Only */}
              <TransactionTable
                transactions={filteredTransactions}
                onEdit={handleTransactionEdit}
                onDelete={handleTransactionDelete}
              />

            </div>
          )}

          {/* 3. FIXED EXPENSES SECTION */}
          {activeTab === "fixed-expenses" && (
            <div className="space-y-6">
              
              {/* Filter panel */}
              <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Filter className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Filtros Avançados: Despesas Fixas</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Período</label>
                    <select
                      value={fixedPeriodFilter}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setFixedPeriodFilter(val);
                        if (val !== "personalizado") {
                          setFixedVencimentoStart("");
                          setFixedVencimentoEnd("");
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="este_mes">Este mês</option>
                      <option value="proximo_mes">Próximo mês</option>
                      <option value="proximos_3_meses">Próximos 3 meses</option>
                      <option value="proximos_6_meses">Próximos 6 meses</option>
                      <option value="este_ano">Este ano</option>
                      <option value="todas_futuras">Todas futuras</option>
                      <option value="personalizado">Personalizado (Manual)</option>
                    </select>
                  </div>

                  {fixedPeriodFilter === "personalizado" && (
                    <>
                      <div>
                        <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Vencimento Inicial</label>
                        <input
                          type="date"
                          value={fixedVencimentoStart}
                          onChange={(e) => setFixedVencimentoStart(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Vencimento Final</label>
                        <input
                          type="date"
                          value={fixedVencimentoEnd}
                          onChange={(e) => setFixedVencimentoEnd(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Status de Liquidação</label>
                    <select
                      value={fixedStatus}
                      onChange={(e) => setFixedStatus(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todos">Todos os Status</option>
                      <option value="pendente">Pendentes em Dia</option>
                      <option value="pago">Pagas</option>
                      <option value="vencida">Atrasadas / Vencidas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Recorrência</label>
                    <select
                      value={fixedRecurrenceFilter}
                      onChange={(e) => setFixedRecurrenceFilter(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todos">Todas</option>
                      <option value="ativas">Ativas</option>
                      <option value="baixadas">Baixadas</option>
                      <option value="nao-recorrentes">Não recorrentes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Parcelamento</label>
                    <select
                      value={fixedParcelamentoFilter}
                      onChange={(e) => setFixedParcelamentoFilter(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todos">Todos</option>
                      <option value="a_vista">À vista</option>
                      <option value="parcelado">Parcelado</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="quitado">Quitado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Imóvel / Centro</label>
                    <select
                      value={fixedImovelFilter}
                      onChange={(e) => setFixedImovelFilter(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todos">Todos os imóveis</option>
                      <option value="sem_imovel">Sem imóvel vinculado</option>
                      {layoutImoveis.map((im) => (
                        <option key={im.id} value={im.id}>{im.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Categoria</label>
                    <select
                      value={fixedCategory}
                      onChange={(e) => setFixedCategory(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todas">Todas as Categorias</option>
                      {fixedCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Forma de Pagamento</label>
                    <select
                      value={fixedPaymentMethod}
                      onChange={(e) => setFixedPaymentMethod(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todos">Todas as Formas</option>
                      {paymentMethodsList.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl border border-white/5 transition-all"
                  >
                    Resetar Filtros
                  </button>
                </div>
              </div>

              {/* Cards row */}
              {(() => {
                const isMonthOnly = fixedPeriodFilter === "este_mes";
                const labelSuffix = isMonthOnly ? "do Mês" : "do Período";

                const totalFixasPeriod = filteredFixedExpenses.reduce((sum, e) => sum + e.valor, 0);
                const totalPendentesPeriod = filteredFixedExpenses.filter(e => e.status === "pendente" && !e.baixadaCompletamente).reduce((sum, e) => sum + e.valor, 0);
                const totalPagasPeriod = filteredFixedExpenses.filter(e => e.status === "pago" && !e.baixadaCompletamente).reduce((sum, e) => sum + e.valor, 0);
                const totalVencidasFixas = filteredFixedExpenses.filter(e => e.status === "pendente" && !e.baixadaCompletamente && e.dataVencimento < todayStr).reduce((sum, e) => sum + e.valor, 0);
                const activeRecurrences = filteredFixedExpenses.filter(e => e.recorrente && e.recorrenciaAtiva && !e.baixadaCompletamente).length;
                const closedRecurrences = filteredFixedExpenses.filter(e => e.baixadaCompletamente).length;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Despesas {labelSuffix}</span>
                        <h2 className="text-xl font-black text-white font-mono leading-none">
                          {formatCurrency(totalFixasPeriod)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">{filteredFixedExpenses.length} registradas</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Pendentes {labelSuffix}</span>
                        <h2 className="text-xl font-black text-amber-500 font-mono leading-none">
                          {formatCurrency(totalPendentesPeriod)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2 font-semibold text-amber-500/80">Aguardando liquidação</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Pagas {labelSuffix}</span>
                        <h2 className="text-xl font-black text-emerald-400 font-mono leading-none">
                          {formatCurrency(totalPagasPeriod)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2 font-semibold text-emerald-400/80">Obrigações quitadas</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Total Vencidas</span>
                        <h2 className="text-xl font-black text-red-400 font-mono leading-none">
                          {formatCurrency(totalVencidasFixas)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2 text-red-500/80 font-semibold">Necessita atenção</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Recorrências Ativas</span>
                        <h2 className="text-xl font-black text-lime-400 font-mono leading-none">
                          {activeRecurrences}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Smart recém-geradas</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Recorrências Baixadas</span>
                        <h2 className="text-xl font-black text-zinc-400 font-mono leading-none">
                          {closedRecurrences}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Fluxos encerrados</p>
                    </div>
                  </div>
                );
              })()}

              {/* Table Fixed Expenses */}
              <ExpenseTable
                expenses={filteredFixedExpenses}
                onEdit={handleExpenseEdit}
                onDelete={handleExpenseDelete}
                onConfirmPaid={handleConfirmPaid}
                onCloseRecurring={handleCloseRecurring}
                onCancelPayment={handleCancelPayment}
              />

            </div>
          )}

          {/* 4. VARIABLE EXPENSES SECTION */}
          {activeTab === "variable-expenses" && (
            <div className="space-y-6">
              
              {/* Filter panel */}
              <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Filter className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Filtros Avançados: Despesas Variáveis</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Data Inicial</label>
                    <input
                      type="date"
                      value={variableDateStart}
                      onChange={(e) => setVariableDateStart(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Data Final</label>
                    <input
                      type="date"
                      value={variableDateEnd}
                      onChange={(e) => setVariableDateEnd(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Status</label>
                    <select
                      value={variableStatus}
                      onChange={(e) => setVariableStatus(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todos">Todos os Status</option>
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Imóvel / Centro</label>
                    <select
                      value={variableImovelFilter}
                      onChange={(e) => setVariableImovelFilter(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todos">Todos os imóveis</option>
                      <option value="sem_imovel">Sem imóvel vinculado</option>
                      {layoutImoveis.map((im) => (
                        <option key={im.id} value={im.id}>{im.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Categoria</label>
                    <select
                      value={variableCategory}
                      onChange={(e) => setVariableCategory(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todas">Todas as Categorias</option>
                      {variableCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Forma de Pagamento</label>
                    <select
                      value={variablePaymentMethod}
                      onChange={(e) => setVariablePaymentMethod(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="todos">Todas as Formas</option>
                      {paymentMethodsList.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl border border-white/5 transition-all"
                  >
                    Resetar Filtros
                  </button>
                </div>
              </div>

              {/* Cards Row */}
              {(() => {
                const totalVariaveisFiltered = filteredVariableExpenses.reduce((sum, e) => sum + e.valor, 0);
                const pagasVariaveisFiltered = filteredVariableExpenses.filter(e => e.status === "pago").reduce((sum, e) => sum + e.valor, 0);
                const pendentesVariaveisFiltered = filteredVariableExpenses.filter(e => e.status === "pendente").reduce((sum, e) => sum + e.valor, 0);
                const maiorVariavelFiltered = filteredVariableExpenses.length > 0 
                  ? Math.max(...filteredVariableExpenses.map(e => e.valor)) 
                  : 0;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Total Despesas Variáveis</span>
                        <h2 className="text-xl font-black text-white font-mono leading-none font-mono">
                          {formatCurrency(totalDespesasVariaveisMonth)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Acumulado do mês corrente</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Despesas Pagas</span>
                        <h2 className="text-xl font-black text-emerald-400 font-mono leading-none">
                          {formatCurrency(pagasVariaveisFiltered)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Lançamentos avulsos quitados</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Despesas Pendentes</span>
                        <h2 className="text-xl font-black text-amber-500 font-mono leading-none font-mono">
                          {formatCurrency(pendentesVariaveisFiltered)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Gastos em aberto</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Maior Despesa Variável</span>
                        <h2 className="text-xl font-black text-red-400 font-mono leading-none">
                          {formatCurrency(maiorVariavelFiltered)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Maior pico avulso no filtro</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                      <div>
                        <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Total do Período</span>
                        <h2 className="text-xl font-black text-white font-mono leading-none">
                          {formatCurrency(totalVariaveisFiltered)}
                        </h2>
                      </div>
                      <p className="text-zinc-600 text-[9px] mt-2">Consolidado do filtro ativo</p>
                    </div>
                  </div>
                );
              })()}

              {/* Table Variable Expenses */}
              <ExpenseTable
                expenses={filteredVariableExpenses}
                onEdit={handleExpenseEdit}
                onDelete={handleExpenseDelete}
                onConfirmPaid={handleConfirmPaid}
                onCloseRecurring={handleCloseRecurring}
                onCancelPayment={handleCancelPayment}
              />

            </div>
          )}

          {/* 5. REPORTS SECTION */}
          {activeTab === "reports" && (
            <ReportsSection 
              transactions={transactions} 
              expenses={expenses} 
              currentDateFormatted={todayStr}
              userEmail={currentUser?.email || ""}
            />
          )}

          {/* 6. REGISTRATIONS SECTION */}
          {activeTab === "registrations" && (
            <SettingsSection 
              userEmail={currentUser?.email || ""}
            />
          )}

          {/* 7. CARD EXPENSES SECTION */}
          {activeTab === "card-expenses" && (
            <CardExpensesSection 
              userEmail={currentUser?.email || ""}
            />
          )}

          {/* 8. APPLICATIONS SECTION */}
          {activeTab === "applications" && (
            <ApplicationsSection 
              userEmail={currentUser?.email || ""}
            />
          )}

        </div>

      </main>

      {/* Transaction Entry Form Modal */}
      <TransactionForm
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setEditingTransaction(null);
        }}
        onSubmit={handleTransactionSubmit}
        editingTransaction={editingTransaction}
      />

      {/* Expense Entry Form Modal */}
      <ExpenseForm
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleExpenseSubmit}
        editingExpense={editingExpense}
        preselectedType={preselectedExpenseType}
      />

      {/* Delete Confirmation Modal (Modal Bonito) */}
      <AnimatePresence>
        {deleteConfirmConfig.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!deleteConfirmConfig.loading) {
                  setDeleteConfirmConfig(prev => ({ ...prev, isOpen: false }));
                }
              }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl p-[1px] bg-gradient-to-tr from-red-500/30 via-zinc-800 to-zinc-800 shadow-2xl z-10"
            >
              <div className="bg-zinc-950 rounded-[23px] px-6 py-7 border border-white/5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white tracking-wide">
                        Excluir registro?
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {deleteConfirmConfig.type === "transaction" ? "CONTA: TRANSAÇÃO" : "CONTA: DESPESA"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deleteConfirmConfig.loading}
                    onClick={() => setDeleteConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-xs text-zinc-300 leading-relaxed mb-5">
                  Essa ação não pode ser desfeita. O registro será removido permanentemente do Firestore.
                </p>

                {deleteConfirmConfig.type === "expense" && deleteConfirmConfig.isParcelado && (
                  <div className="mb-5 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-3">
                    <p className="text-xs font-bold text-purple-400">
                      Essa despesa faz parte de um parcelamento.
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteOption"
                          value="only"
                          checked={deleteConfirmConfig.deleteOption === "only"}
                          onChange={() => setDeleteConfirmConfig(prev => ({ ...prev, deleteOption: "only" }))}
                          className="w-4 h-4 rounded-full bg-zinc-950 border-zinc-800 text-purple-500 focus:ring-0 cursor-pointer"
                        />
                        <span>Excluir somente esta parcela</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteOption"
                          value="all"
                          checked={deleteConfirmConfig.deleteOption === "all"}
                          onChange={() => setDeleteConfirmConfig(prev => ({ ...prev, deleteOption: "all" }))}
                          className="w-4 h-4 rounded-full bg-zinc-950 border-zinc-800 text-purple-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="font-semibold text-red-400">Excluir todas as parcelas deste parcelamento</span>
                      </label>
                    </div>
                  </div>
                )}

                {deleteConfirmConfig.error && (
                  <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-start">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{deleteConfirmConfig.error}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={deleteConfirmConfig.loading}
                    onClick={() => setDeleteConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-xs text-zinc-300 hover:text-white border border-white/5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={deleteConfirmConfig.loading}
                    onClick={handleExecuteDelete}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-xs text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-950/40 active:scale-95 disabled:opacity-50"
                  >
                    {deleteConfirmConfig.loading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Action Confirmation Modal */}
      <AnimatePresence>
        {expenseActionConfirm?.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={expenseActionConfirm.onCancel}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl p-[1px] bg-gradient-to-tr from-emerald-500/30 via-zinc-800 to-zinc-800 shadow-2xl z-10"
            >
              <div className="bg-zinc-950 rounded-[23px] px-6 py-7 border border-white/5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <HelpCircle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white tracking-wide">
                        {expenseActionConfirm.title}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        AÇÃO AUTOMÁTICA DETECTADA
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={expenseActionConfirm.onCancel}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all hover:scale-105 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-xs text-zinc-300 leading-relaxed mb-6">
                  {expenseActionConfirm.message}
                </p>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={expenseActionConfirm.onConfirm}
                    className="w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {expenseActionConfirm.confirmLabel}
                  </button>
                  
                  {expenseActionConfirm.extraLabel && (
                    <button
                      type="button"
                      onClick={expenseActionConfirm.onExtraConfirm}
                      className="w-full px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-xs text-zinc-300 hover:text-white border border-white/5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {expenseActionConfirm.extraLabel}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={expenseActionConfirm.onCancel}
                    className="w-full px-5 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-900 font-medium text-xs text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
                  >
                    {expenseActionConfirm.cancelLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {dashboardConfirmOpen && (
          <ConfirmDialog
            open={dashboardConfirmOpen}
            title={dashboardConfirmTitle}
            description={dashboardConfirmDesc}
            onConfirm={dashboardConfirmAction || (() => {})}
            onCancel={() => {
              if (!dashboardConfirmLoading) {
                setDashboardConfirmOpen(false);
                setDashboardConfirmAction(null);
              }
            }}
            loading={dashboardConfirmLoading}
            variant={dashboardConfirmVariant}
          />
        )}
        {paymentBankModalConfig.isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPaymentBankModalConfig(prev => ({ ...prev, isOpen: false }))}
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
                        Confirmar Pagamento
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        SELECIONE A CONTA DE SAÍDA
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaymentBankModalConfig(prev => ({ ...prev, isOpen: false }))}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all hover:scale-105 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed mb-5">
                  Selecione a conta bancária pela qual esta despesa foi ou será paga. O valor será deduzido do saldo atual da conta correspondente e uma transação de saída automática será gerada.
                </p>

                <div className="space-y-4 mb-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 font-medium">Conta/Banco de Saída</label>
                    <select
                      value={paymentBankModalConfig.selectedBankId}
                      onChange={(e) => setPaymentBankModalConfig(prev => ({ ...prev, selectedBankId: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      {banks.filter(b => b.ativo).map((b) => (
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
                    onClick={() => setPaymentBankModalConfig(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-xs text-zinc-300 hover:text-white border border-white/5 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteExpensePaymentWithBank}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Confirmar Pagamento
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
