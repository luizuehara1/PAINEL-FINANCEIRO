import { Expense, BankAccount, Transaction, CardInvoice, CardItem } from "@/types/finance";
import { normalizeDateToISO } from "./date-utils";
import { isAccumulatedFilter, getCompetenceFromItem, normalizeExpenseType, normalizeTransactionType } from "./filter-utils";
import { COMPANY_ID } from "./app-config";

export function getDateRangeFromPeriodFilter(
  period: string,
  todayStr: string
): { start: string; end: string } {
  if (!todayStr) {
    const today = new Date();
    todayStr = today.toISOString().split("T")[0];
  }

  const parts = todayStr.split("-");
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);

  let start = "";
  let end = "";

  switch (period) {
    case "este_mes": {
      start = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      break;
    }
    case "proximo_mes": {
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      start = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
      const lastDay = new Date(nextYear, nextMonth, 0).getDate();
      end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      break;
    }
    case "proximos_3_meses": {
      start = todayStr;
      const d = new Date(year, month - 1 + 3, day);
      const endY = d.getFullYear();
      const endM = String(d.getMonth() + 1).padStart(2, "0");
      const endD = String(d.getDate()).padStart(2, "0");
      end = `${endY}-${endM}-${endD}`;
      break;
    }
    case "proximos_6_meses": {
      start = todayStr;
      const d = new Date(year, month - 1 + 6, day);
      const endY = d.getFullYear();
      const endM = String(d.getMonth() + 1).padStart(2, "0");
      const endD = String(d.getDate()).padStart(2, "0");
      end = `${endY}-${endM}-${endD}`;
      break;
    }
    case "este_ano": {
      start = `${year}-01-01`;
      end = `${year}-12-31`;
      break;
    }
    case "todas_futuras": {
      start = todayStr;
      end = "9999-12-31"; // virtual infinity
      break;
    }
    default:
      break;
  }

  return { start, end };
}

export function filterFixedExpensesByPeriod(
  expenses: Expense[],
  period: string,
  todayStr: string,
  customStart?: string,
  customEnd?: string
): Expense[] {
  if (period === "personalizado") {
    return expenses.filter((e) => {
      if (e.tipo !== "fixa") return false;
      const isoDueDate = normalizeDateToISO(e.dataVencimento);
      if (customStart && isoDueDate < customStart) return false;
      if (customEnd && isoDueDate > customEnd) return false;
      return true;
    });
  }

  const { start, end } = getDateRangeFromPeriodFilter(period, todayStr);

  return expenses.filter((e) => {
    if (e.tipo !== "fixa") return false;
    const isoDueDate = normalizeDateToISO(e.dataVencimento);
    if (start && isoDueDate < start) return false;
    if (end && isoDueDate > end) return false;
    return true;
  });
}

export interface FixedExpenseTotals {
  total: number;
  pendentes: number;
  pagas: number;
  vencidas: number;
  futuras: number;
  recorrenciasAtivas: number;
  parceladasEmAberto: number;
}

export function calculateFixedExpenseTotals(
  filteredExpenses: Expense[],
  todayStr: string
): FixedExpenseTotals {
  let total = 0;
  let pendentes = 0;
  let pagas = 0;
  let vencidas = 0;
  let futuras = 0;
  let recorrenciasAtivas = 0;
  let parceladasEmAberto = 0;

  for (const e of filteredExpenses) {
    if (e.tipo !== "fixa") continue;

    const valor = e.valor || 0;
    total += valor;

    if (e.status === "pago") {
      pagas += valor;
    } else {
      pendentes += valor;
      const isoDueDate = normalizeDateToISO(e.dataVencimento);
      if (isoDueDate < todayStr) {
        vencidas += valor;
      } else if (isoDueDate > todayStr) {
        futuras += valor;
      }
    }

    if (e.recorrente && e.recorrenciaAtiva && !e.baixadaCompletamente) {
      recorrenciasAtivas++;
    }

    if (e.parcelado && e.parcelamentoQuitado !== true) {
      parceladasEmAberto++;
    }
  }

  return {
    total,
    pendentes,
    pagas,
    vencidas,
    futuras,
    recorrenciasAtivas,
    parceladasEmAberto,
  };
}

/**
 * Calculates total balance of active bank accounts.
 * Always the ultimate source of truth for "Saldo Atual".
 */
export function calculateBankBalance(banks: BankAccount[]): number {
  return banks
    .filter((b) => b.ativo !== false)
    .reduce((sum, b) => sum + (b.saldoAtual || 0), 0);
}

/**
 * Calculates totals for entries and exits from transactions list.
 */
export function calculateTransactionTotals(transactions: Transaction[]): {
  entradas: number;
  saidas: number;
  saldoPeriodo: number;
} {
  let entradas = 0;
  let saidas = 0;

  transactions.forEach((t) => {
    const val = Math.abs(t.valor || 0);
    if (t.tipo === "entrada") {
      entradas += val;
    } else if (t.tipo === "saida" || t.tipo === "saída") {
      saidas += val;
    }
  });

  return {
    entradas,
    saidas,
    saldoPeriodo: entradas - saidas
  };
}

/**
 * Calculates totals for variable expenses.
 */
export function calculateVariableExpenseTotals(expenses: Expense[]): {
  total: number;
  pagas: number;
  pendentes: number;
} {
  let total = 0;
  let pagas = 0;
  let pendentes = 0;

  expenses.forEach((e) => {
    if (e.tipo !== "variavel") return;
    const val = e.valor || 0;
    total += val;
    if (e.status === "pago") {
      pagas += val;
    } else {
      pendentes += val;
    }
  });

  return { total, pagas, pendentes };
}

/**
 * Calculates card invoices and items totals.
 */
export function calculateCardInvoiceTotals(
  invoices: CardInvoice[],
  items: CardItem[]
): {
  totalFaturas: number;
  totalItensEmAberto: number;
} {
  const totalFaturas = invoices.reduce((sum, f) => sum + (parseFloat(f.valorTotal as any) || 0), 0);
  const totalItensEmAberto = items
    .filter((item) => item.status !== "pago")
    .reduce((sum, item) => sum + (item.valor || 0), 0);

  return { totalFaturas, totalItensEmAberto };
}

/**
 * Helper to sum pending fixed/variable expenses.
 */
export function calculatePendingTotal(expenses: Expense[]): number {
  return expenses
    .filter((e) => e.status !== "pago")
    .reduce((sum, e) => sum + (e.valor || 0), 0);
}

/**
 * Helper to sum overdue fixed/variable expenses based on vencimento date.
 */
export function calculateOverdueTotal(expenses: Expense[], todayStr: string): number {
  return expenses
    .filter((e) => e.status !== "pago" && e.dataVencimento && e.dataVencimento < todayStr)
    .reduce((sum, e) => sum + (e.valor || 0), 0);
}

/**
 * Aggregates dashboard overview calculations.
 */
export function calculateDashboardOverview(data: {
  transactions: Transaction[];
  expenses: Expense[];
  banks: BankAccount[];
  todayStr: string;
}) {
  const saldoAtual = calculateBankBalance(data.banks);
  const txTotals = calculateTransactionTotals(data.transactions);
  
  const fixedTotals = calculateFixedExpenseTotals(data.expenses, data.todayStr);
  const variableTotals = calculateVariableExpenseTotals(data.expenses);

  return {
    saldoAtual,
    entradas: txTotals.entradas,
    saidas: txTotals.saidas,
    saldoPeriodo: txTotals.saldoPeriodo,
    despesasFixasTotal: fixedTotals.total,
    despesasVariaveisTotal: variableTotals.total,
    despesasPendentes: fixedTotals.pendentes + variableTotals.pendentes,
    despesasVencidas: fixedTotals.vencidas
  };
}

/**
 * Calculates all overview summary cards with full support for selectedCycle filter.
 */
export function calculateOverviewCards(data: {
  transactions: Transaction[];
  expenses: Expense[];
  banks: BankAccount[];
  selectedCycle: string | null | undefined;
  todayStr?: string;
}) {
  const { transactions, expenses, banks, selectedCycle } = data;
  
  // Resolve todayStr safely
  let todayStr = data.todayStr;
  if (!todayStr) {
    const today = new Date();
    todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  // 1. Saldo Atual (always sum of active banks)
  const saldoAtual = calculateBankBalance(banks);

  // 2. Filter transactions and expenses by cycle
  const isAccumulated = isAccumulatedFilter(selectedCycle);

  const filteredTxs = transactions.filter((t) => {
    if (t.companyId && t.companyId !== COMPANY_ID) return false;
    if (!isAccumulated) {
      const comp = getCompetenceFromItem(t);
      if (comp !== selectedCycle) return false;
    }
    return true;
  });

  const filteredExpenses = expenses.filter((e) => {
    if (e.companyId && e.companyId !== COMPANY_ID) return false;
    if (!isAccumulated) {
      const comp = getCompetenceFromItem(e);
      if (comp !== selectedCycle) return false;
    }
    return true;
  });

  // 3. Entradas (sum of transactions where normalized type is "entrada")
  const entradas = filteredTxs
    .filter((t) => normalizeTransactionType(t.tipo) === "entrada")
    .reduce((sum, t) => sum + Math.abs(t.valor || 0), 0);

  // 4. Saídas (sum of transactions where normalized type is "saida")
  const saidas = filteredTxs
    .filter((t) => normalizeTransactionType(t.tipo) === "saida")
    .reduce((sum, t) => sum + Math.abs(t.valor || 0), 0);

  // 5. Resultado do Ciclo = entradas - saidas
  const resultadoCiclo = entradas - saidas;

  // 6. Despesas Fixas (sum of expenses where type is "fixa")
  const despesasFixas = filteredExpenses
    .filter((e) => normalizeExpenseType(e.tipo) === "fixa")
    .reduce((sum, e) => sum + (e.valor || 0), 0);

  // 7. Despesas Variáveis (sum of expenses where type is "variavel")
  const despesasVariaveis = filteredExpenses
    .filter((e) => normalizeExpenseType(e.tipo) === "variavel")
    .reduce((sum, e) => sum + (e.valor || 0), 0);

  // 8. Despesas Vencidas (pending expenses where due date is in the past)
  const despesasVencidas = filteredExpenses
    .filter((e) => {
      if (e.status === "pago" || e.baixadaCompletamente) return false;
      const isoDueDate = normalizeDateToISO(e.dataVencimento);
      return isoDueDate && isoDueDate < todayStr;
    })
    .reduce((sum, e) => sum + (e.valor || 0), 0);

  // 9. Vencem Hoje (pending expenses where due date is today)
  const vencemHoje = filteredExpenses
    .filter((e) => {
      if (e.status === "pago" || e.baixadaCompletamente) return false;
      const isoDueDate = normalizeDateToISO(e.dataVencimento);
      return isoDueDate && isoDueDate === todayStr;
    })
    .reduce((sum, e) => sum + (e.valor || 0), 0);

  return {
    saldoAtual,
    entradas,
    saidas,
    resultadoCiclo,
    despesasFixas,
    despesasVariaveis,
    despesasVencidas,
    vencemHoje
  };
}
