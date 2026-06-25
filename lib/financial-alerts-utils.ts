import { Expense, BankAccount, CardInvoice, Transaction } from "@/types/finance";
import { getCompetenceFromDateStr } from "./cycle-utils";

/**
 * Calculates differences in days between two date strings (YYYY-MM-DD).
 */
export function getDaysDiff(dateStr: string, todayStr: string): number {
  if (!dateStr || !todayStr) return 0;
  try {
    const itemDate = new Date(dateStr + "T00:00:00");
    const todayDate = new Date(todayStr + "T00:00:00");
    const diffTime = itemDate.getTime() - todayDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (e) {
    return 0;
  }
}

/**
 * Filters the expenses list by cycle/competency.
 */
export function filterExpensesByCycle(expenses: Expense[], selectedCycle?: string): Expense[] {
  if (!selectedCycle || selectedCycle === "all") {
    return expenses;
  }
  return expenses.filter((e) => {
    let comp = e.competencia;
    if (!comp && e.dataVencimento) {
      comp = getCompetenceFromDateStr(e.dataVencimento);
    }
    if (!comp && e.data) {
      comp = getCompetenceFromDateStr(e.data);
    }
    return comp === selectedCycle;
  });
}

/**
 * Filters card invoices by cycle/competency.
 */
export function filterCardInvoicesByCycle(cardInvoices: CardInvoice[], selectedCycle?: string): CardInvoice[] {
  if (!selectedCycle || selectedCycle === "all") {
    return cardInvoices;
  }
  return cardInvoices.filter((ci) => ci.competencia === selectedCycle);
}

/**
 * Filters transactions by cycle/competency.
 */
export function filterTransactionsByCycle(transactions: Transaction[], selectedCycle?: string): Transaction[] {
  if (!selectedCycle || selectedCycle === "all") {
    return transactions;
  }
  return transactions.filter((t) => {
    const comp = getCompetenceFromDateStr(t.data);
    return comp === selectedCycle;
  });
}

/**
 * 1. Despesas vencidas:
 * status !== "pago" and dataVencimento < hoje
 */
export function getOverdueExpenses(expenses: Expense[], todayStr: string): Expense[] {
  return expenses.filter(
    (e) =>
      e.status !== "pago" &&
      e.baixadaCompletamente !== true &&
      e.dataVencimento &&
      e.dataVencimento < todayStr
  );
}

/**
 * 2. Despesas que vencem hoje:
 * status !== "pago" and dataVencimento is equal to hoje
 */
export function getDueTodayExpenses(expenses: Expense[], todayStr: string): Expense[] {
  return expenses.filter(
    (e) =>
      e.status !== "pago" &&
      e.baixadaCompletamente !== true &&
      e.dataVencimento &&
      e.dataVencimento === todayStr
  );
}

/**
 * 3. Despesas próximas do vencimento:
 * status !== "pago" and dataVencimento between hoje + 1 and hoje + days
 */
export function getUpcomingExpenses(expenses: Expense[], todayStr: string, days = 3): Expense[] {
  return expenses.filter((e) => {
    if (e.status === "pago" || e.baixadaCompletamente === true || !e.dataVencimento) return false;
    const diff = getDaysDiff(e.dataVencimento, todayStr);
    return diff > 0 && diff <= days;
  });
}

/**
 * 4. Total pendente a pagar:
 * sum of unpaid and non-dismissed expenses, using Math.abs(valor)
 */
export function calculatePendingTotal(expenses: Expense[]): number {
  return expenses
    .filter((e) => e.status !== "pago" && e.baixadaCompletamente !== true)
    .reduce((sum, e) => sum + Math.abs(e.valor || 0), 0);
}

/**
 * 5. Recorrências ativas:
 * count unique active recurrence groups (grupoRecorrenciaId)
 */
export function getUniqueActiveRecurringExpenses(expenses: Expense[]): Expense[] {
  const seenGroups = new Set<string>();
  const uniqueExpenses: Expense[] = [];

  for (const e of expenses) {
    if (
      e.recorrente === true &&
      e.recorrenciaAtiva === true &&
      e.baixadaCompletamente !== true &&
      e.grupoRecorrenciaId
    ) {
      if (!seenGroups.has(e.grupoRecorrenciaId)) {
        seenGroups.add(e.grupoRecorrenciaId);
        uniqueExpenses.push(e);
      }
    }
  }
  return uniqueExpenses;
}

/**
 * 6. Parcelamentos ativos:
 * count unique active installment groups (grupoParcelamentoId)
 */
export function getUniqueActiveInstallments(expenses: Expense[]): Expense[] {
  const seenGroups = new Set<string>();
  const uniqueExpenses: Expense[] = [];

  for (const e of expenses) {
    if (
      e.parcelado === true &&
      e.parcelamentoAtivo === true &&
      e.parcelamentoQuitado !== true &&
      e.baixadaCompletamente !== true &&
      e.grupoParcelamentoId
    ) {
      if (!seenGroups.has(e.grupoParcelamentoId)) {
        seenGroups.add(e.grupoParcelamentoId);
        uniqueExpenses.push(e);
      }
    }
  }
  return uniqueExpenses;
}

/**
 * 7. Faturas de cartão próximas:
 * faturasCartao where status !== "paga" and dataVencimento is close (or overdue)
 */
export function getUpcomingCardInvoices(cardInvoices: CardInvoice[], todayStr: string, days = 7): CardInvoice[] {
  return cardInvoices.filter((ci) => {
    if (ci.status === "paga" || !ci.dataVencimento) return false;
    const diff = getDaysDiff(ci.dataVencimento, todayStr);
    return diff <= days; // includes overdue (diff < 0) and upcoming (diff <= days)
  });
}

/**
 * 8. Saldo disponível:
 * sum of active bank balances
 */
export function calculateAvailableBankBalance(banks: BankAccount[]): number {
  return banks
    .filter((b) => b.ativo !== false)
    .reduce((sum, b) => sum + (b.saldoAtual || 0), 0);
}

export interface CalculateFinancialAlertsParams {
  expenses: Expense[];
  transactions: Transaction[];
  cardInvoices: CardInvoice[];
  banks: BankAccount[];
  selectedCycle?: string;
  todayStr: string;
}

export function calculateFinancialAlerts({
  expenses,
  transactions,
  cardInvoices,
  banks,
  selectedCycle,
  todayStr
}: CalculateFinancialAlertsParams) {
  // First, apply cycle filters if requested
  const filteredExps = filterExpensesByCycle(expenses, selectedCycle);
  const filteredInvs = filterCardInvoicesByCycle(cardInvoices, selectedCycle);
  const filteredTxs = filterTransactionsByCycle(transactions, selectedCycle);

  // 1. Despesas vencidas
  const overdueExpenses = getOverdueExpenses(filteredExps, todayStr);

  // 2. Despesas que vencem hoje
  const dueTodayExpenses = getDueTodayExpenses(filteredExps, todayStr);

  // 3. Despesas próximas do vencimento
  const upcomingExpenses = getUpcomingExpenses(filteredExps, todayStr, 3);

  // 4. Total pendente a pagar
  const pendingTotal = calculatePendingTotal(filteredExps);

  // 5. Recorrências ativas (calculated over the filtered list or entire list? 
  // Let's use filtered list so it respects the selected cycle if any, but default to all if selectedCycle is empty/all)
  const activeRecurring = getUniqueActiveRecurringExpenses(filteredExps);

  // 6. Parcelamentos ativos
  const activeInstallments = getUniqueActiveInstallments(filteredExps);

  // 7. Faturas de cartão próximas
  const upcomingInvoices = getUpcomingCardInvoices(filteredInvs, todayStr, 7);

  // 8. Saldo disponível (banks are global, so we sum globally)
  const availableBalance = calculateAvailableBankBalance(banks);

  return {
    overdueExpenses,
    dueTodayExpenses,
    upcomingExpenses,
    pendingTotal,
    activeRecurring,
    activeInstallments,
    upcomingInvoices,
    availableBalance,
    filteredExpenses: filteredExps,
    filteredTransactions: filteredTxs,
    filteredInvoices: filteredInvs
  };
}
