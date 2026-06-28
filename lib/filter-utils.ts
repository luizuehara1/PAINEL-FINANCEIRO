import { Transaction, Expense } from "@/types/finance";
import { getCompetenceFromDateStr } from "./cycle-utils";
import { COMPANY_ID } from "./app-config";
import { normalizeDateToISO } from "./date-utils";

/**
 * Checks if the filter value represents an accumulated / all-time view.
 */
export function isAccumulatedFilter(value: string | null | undefined): boolean {
  return (
    !value ||
    value === "all" ||
    value === "acumulado" ||
    value === "accumulated" ||
    value === "todos" ||
    value === "todos_os_ciclos" ||
    value === ""
  );
}

/**
 * Safely converts any value (Firestore Timestamp, Date, string) to a Date object.
 */
export function toDateSafe(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    if (value.includes("/")) {
      const [day, month, year] = value.split("/");
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(value);
  }

  return null;
}

/**
 * Normalizes a Date object to a YYYY-MM competence string.
 */
export function getCompetenceFromDate(date: Date): string {
  if (!date || isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Extracts YYYY-MM competence string from any financial item safely.
 */
export function getCompetenceFromItem(item: any): string {
  if (!item) return "";
  if (item.competencia) return item.competencia;
  
  // Try dataVencimento (often used for Expenses)
  if (item.dataVencimento) {
    const isoStr = normalizeDateToISO(item.dataVencimento);
    if (isoStr && isoStr.length >= 7) {
      return isoStr.substring(0, 7);
    }
  }
  
  // Try data (used for Transactions and Expenses)
  if (item.data) {
    const isoStr = normalizeDateToISO(item.data);
    if (isoStr && isoStr.length >= 7) {
      return isoStr.substring(0, 7);
    }
  }
  
  return "";
}

/**
 * Filters items by cycle using getCompetenceFromItem.
 */
export function filterItemsByCycle<T>(items: T[], selectedCycle: string | null | undefined): T[] {
  if (isAccumulatedFilter(selectedCycle)) {
    return items;
  }
  const targetCycle = selectedCycle || "";
  return items.filter((item) => {
    const itemComp = getCompetenceFromItem(item);
    return itemComp === targetCycle;
  });
}

/**
 * Strips accents, trims, and lowercases a string helper.
 */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove accents
}

/**
 * Normalizes any variation of fixed/variable expense type into "fixa" or "variavel".
 */
export function normalizeExpenseType(value: string | null | undefined): "fixa" | "variavel" | "" {
  const norm = normalizeText(value);
  if (norm.includes("fixa") || norm.includes("despesa_fixa") || norm === "fixas") {
    return "fixa";
  }
  if (norm.includes("variave") || norm.includes("despesas_variaveis") || norm === "variaveis") {
    return "variavel";
  }
  return "";
}

/**
 * Normalizes any variation of transaction type into "entrada" or "saida".
 */
export function normalizeTransactionType(value: string | null | undefined): "entrada" | "saida" | "" {
  const norm = normalizeText(value);
  if (norm === "entrada" || norm === "receita" || norm === "ganho" || norm === "entradas") {
    return "entrada";
  }
  if (norm === "saida" || norm === "saida" || norm === "despesa" || norm === "gasto" || norm === "saidas") {
    return "saida";
  }
  return "";
}

/**
 * Validates a financial document. Returns true if valid, false if invalid.
 */
export function validateFinanceDocument(item: any, type: "transaction" | "expense"): boolean {
  if (!item || typeof item !== "object") return false;
  if (!item.id) return false;
  
  // Checking companyId
  if (!item.companyId) return false;

  // Checking value
  const val = parseFloat(item.valor);
  if (isNaN(val)) return false;

  if (type === "transaction") {
    const tType = normalizeTransactionType(item.tipo);
    if (!tType) return false;
    if (!item.data) return false;
  } else if (type === "expense") {
    const eType = normalizeExpenseType(item.tipo);
    if (!eType) return false;
    if (eType === "fixa" && !item.dataVencimento) return false;
    if (eType === "variavel" && !item.data) return false;
  }

  return true;
}

/**
 * Extracts a YYYY-MM competence string from any date field in Transaction or Expense.
 */
export function getCompetenceFromAnyDate(item: any): string {
  return getCompetenceFromItem(item);
}

/**
 * Filters list by companyId (with temporary fallback to documents without companyId).
 */
export function filterByCompanyId<T extends { companyId?: string }>(items: T[]): T[] {
  return items.filter((item) => item.companyId === COMPANY_ID || !item.companyId);
}

/**
 * Filters items by selectedCycle/competency.
 */
export function filterByCycle<T extends Transaction | Expense>(
  items: T[],
  selectedCycle: string | null | undefined
): T[] {
  if (isAccumulatedFilter(selectedCycle)) {
    return items;
  }
  const targetCycle = selectedCycle || "";
  return items.filter((item) => {
    const itemComp = getCompetenceFromAnyDate(item);
    return itemComp === targetCycle;
  });
}

/**
 * Filters an array of items (transactions or expenses) by competence/cycle (alias).
 */
export function filterByCompetence<T extends Transaction | Expense>(
  items: T[],
  selectedCycle: string | null | undefined
): T[] {
  return filterByCycle(items, selectedCycle);
}

/**
 * Filter transactions based on several filters including cycle.
 */
export function filterTransactions(
  items: Transaction[],
  filters: {
    selectedCycle?: string | null;
    txDateStart?: string;
    txDateEnd?: string;
    txType?: string;
    txCategory?: string;
    txPaymentMethod?: string;
  }
): Transaction[] {
  return items.filter((t) => {
    // 1. Company ID filter (safety fallback already applied, but to be sure)
    if (t.companyId && t.companyId !== COMPANY_ID) return false;

    // 2. Cycle Filter
    if (!isAccumulatedFilter(filters.selectedCycle)) {
      const itemComp = getCompetenceFromAnyDate(t);
      if (itemComp !== filters.selectedCycle) return false;
    }
    
    // 3. Date Start/End
    if (filters.txDateStart && t.data < filters.txDateStart) return false;
    if (filters.txDateEnd && t.data > filters.txDateEnd) return false;
    
    // 4. Type
    if (filters.txType && filters.txType !== "todos") {
      const tTipoStr = t.tipo as string;
      const normalizedType = normalizeTransactionType(tTipoStr);
      const filterType = normalizeTransactionType(filters.txType);
      if (normalizedType !== filterType) return false;
    }
    
    // 5. Category
    if (filters.txCategory && filters.txCategory !== "todas" && t.categoria !== filters.txCategory) return false;
    
    // 6. Payment Method
    if (filters.txPaymentMethod && filters.txPaymentMethod !== "todos" && t.formaPagamento !== filters.txPaymentMethod) return false;
    
    return true;
  });
}

/**
 * Filter expenses based on several filters including cycle.
 */
export function filterExpenses(
  items: Expense[],
  filters: {
    selectedCycle?: string | null;
    tipo?: "fixa" | "variavel";
    fixedPeriodFilter?: string;
    fixedVencimentoStart?: string;
    fixedVencimentoEnd?: string;
    variableDateStart?: string;
    variableDateEnd?: string;
    status?: string;
    category?: string;
    paymentMethod?: string;
    imovelId?: string;
    recurrenceFilter?: string;
    parcelamentoFilter?: string;
    todayStr?: string;
  }
): Expense[] {
  return items.filter((e) => {
    // 1. Company ID safety filter
    if (e.companyId && e.companyId !== COMPANY_ID) return false;

    // 2. Type filter
    if (filters.tipo) {
      const normalizedEType = normalizeExpenseType(e.tipo);
      const normalizedFilterType = normalizeExpenseType(filters.tipo);
      if (normalizedEType !== normalizedFilterType) return false;
    }

    // 3. Cycle / Period Filter
    if (!isAccumulatedFilter(filters.selectedCycle)) {
      const itemComp = getCompetenceFromAnyDate(e);
      if (itemComp !== filters.selectedCycle) return false;
      
      // When a specific cycle is selected, we only apply the period filter if it is personalized
      if (filters.tipo === "fixa" && filters.fixedPeriodFilter === "personalizado") {
        const isoDueDate = normalizeDateToISO(e.dataVencimento);
        if (filters.fixedVencimentoStart && isoDueDate < filters.fixedVencimentoStart) return false;
        if (filters.fixedVencimentoEnd && isoDueDate > filters.fixedVencimentoEnd) return false;
      }
    } else {
      // For accumulated, we DO NOT filter by selectedCycle
      if (filters.tipo === "fixa" && filters.fixedPeriodFilter === "personalizado") {
        const isoDueDate = normalizeDateToISO(e.dataVencimento);
        if (filters.fixedVencimentoStart && isoDueDate < filters.fixedVencimentoStart) return false;
        if (filters.fixedVencimentoEnd && isoDueDate > filters.fixedVencimentoEnd) return false;
      }
    }

    // 4. Date Start/End for variable expenses
    if (filters.tipo === "variavel") {
      if (filters.variableDateStart && e.data < filters.variableDateStart) return false;
      if (filters.variableDateEnd && e.data > filters.variableDateEnd) return false;
    }

    // 5. Status Filter
    if (filters.status && filters.status !== "todos") {
      if (filters.status === "pago") {
        if (e.status !== "pago") return false;
      } else if (filters.status === "pendente") {
        const today = filters.todayStr || new Date().toISOString().split("T")[0];
        const isoDueDate = normalizeDateToISO(e.dataVencimento);
        if (e.status !== "pendente" || (isoDueDate && isoDueDate < today)) return false;
      } else if (filters.status === "vencida") {
        const today = filters.todayStr || new Date().toISOString().split("T")[0];
        const isoDueDate = normalizeDateToISO(e.dataVencimento);
        if (e.status !== "pendente" || (isoDueDate && isoDueDate >= today)) return false;
      }
    }

    // 6. Category
    if (filters.category && filters.category !== "todas" && e.categoria !== filters.category) return false;

    // 7. Payment Method
    if (filters.paymentMethod && filters.paymentMethod !== "todos") {
      // Check normalized match for credit cards
      const normalizedEPay = normalizeText(e.formaPagamento);
      const normalizedFilterPay = normalizeText(filters.paymentMethod);
      
      const isECard = normalizedEPay.includes("cartao de credito") || normalizedEPay.includes("cartao credito");
      const isFilterCard = normalizedFilterPay.includes("cartao de credito") || normalizedFilterPay.includes("cartao credito");
      
      if (isECard && isFilterCard) {
        // Match! Both are credit cards
      } else if (e.formaPagamento !== filters.paymentMethod) {
        return false;
      }
    }

    // 8. Property Filter
    if (filters.imovelId && filters.imovelId !== "todos") {
      if (filters.imovelId === "sem_imovel") {
        if (e.imovelId) return false;
      } else {
        if (e.imovelId !== filters.imovelId) return false;
      }
    }

    // 9. Recurrence Filter
    if (filters.tipo === "fixa" && filters.recurrenceFilter && filters.recurrenceFilter !== "todos") {
      if (filters.recurrenceFilter === "ativas") {
        if (!e.recorrente || !e.recorrenciaAtiva || e.baixadaCompletamente) return false;
      } else if (filters.recurrenceFilter === "baixadas") {
        if (!e.baixadaCompletamente) return false;
      } else if (filters.recurrenceFilter === "nao-recorrentes") {
        if (e.recorrente) return false;
      }
    }

    // 10. Parcelamento Filter
    if (filters.tipo === "fixa" && filters.parcelamentoFilter && filters.parcelamentoFilter !== "todos") {
      if (filters.parcelamentoFilter === "a_vista") {
        if (e.parcelado) return false;
      } else if (filters.parcelamentoFilter === "parcelado") {
        if (!e.parcelado) return false;
      } else if (filters.parcelamentoFilter === "em_andamento") {
        if (!e.parcelado || e.parcelamentoAtivo !== true) return false;
      } else if (filters.parcelamentoFilter === "quitado") {
        if (!e.parcelado || e.parcelamentoQuitado !== true) return false;
      }
    }

    return true;
  });
}
