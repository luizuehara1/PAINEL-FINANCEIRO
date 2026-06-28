import { Transaction, Expense, BankAccount, CreditCard, CardInvoice, CardItem, Investment, Asset, PropertyCostCenter } from "@/types/finance";
import { loadAndProcessCollection } from "./data-source";
import { filterTransactions, filterExpenses } from "./filter-utils";

/**
 * Unified data service supplying validated data from Firestore with filters.
 */

export async function getTransactionsData(filters: any = {}): Promise<Transaction[]> {
  const raw = await loadAndProcessCollection<Transaction>(
    "Entradas e Saídas",
    "transacoes",
    "transaction",
    ["companyId", filters.selectedCycle ? `Ciclo: ${filters.selectedCycle}` : "Acumulado"]
  );
  return filterTransactions(raw, filters);
}

export async function getFixedExpensesData(filters: any = {}): Promise<Expense[]> {
  const raw = await loadAndProcessCollection<Expense>(
    "Despesas Fixas",
    "despesas",
    "expense",
    ["companyId", "tipo === fixa", filters.selectedCycle ? `Ciclo: ${filters.selectedCycle}` : "Acumulado"]
  );
  return filterExpenses(raw, { ...filters, tipo: "fixa" });
}

export async function getVariableExpensesData(filters: any = {}): Promise<Expense[]> {
  const raw = await loadAndProcessCollection<Expense>(
    "Despesas Variáveis",
    "despesas",
    "expense",
    ["companyId", "tipo === variavel", filters.selectedCycle ? `Ciclo: ${filters.selectedCycle}` : "Acumulado"]
  );
  return filterExpenses(raw, { ...filters, tipo: "variavel" });
}

export async function getBanksData(): Promise<BankAccount[]> {
  return loadAndProcessCollection<BankAccount>(
    "Bancos",
    "bancos",
    "other",
    ["companyId"]
  );
}

export async function getCardsData(): Promise<CreditCard[]> {
  return loadAndProcessCollection<CreditCard>(
    "Cartões",
    "cartoes",
    "other",
    ["companyId"]
  );
}

export async function getCardInvoicesData(): Promise<CardInvoice[]> {
  return loadAndProcessCollection<CardInvoice>(
    "Faturas de Cartão",
    "faturasCartao",
    "other",
    ["companyId"]
  );
}

export async function getCardItemsData(): Promise<CardItem[]> {
  return loadAndProcessCollection<CardItem>(
    "Itens de Fatura",
    "itensCartao",
    "other",
    ["companyId"]
  );
}

export async function getInvestmentsData(): Promise<Investment[]> {
  return loadAndProcessCollection<Investment>(
    "Investimentos",
    "investimentos",
    "other",
    ["companyId"]
  );
}

export async function getAssetsData(): Promise<Asset[]> {
  return loadAndProcessCollection<Asset>(
    "Patrimônios",
    "patrimonios",
    "other",
    ["companyId"]
  );
}

export async function getPropertiesData(): Promise<PropertyCostCenter[]> {
  return loadAndProcessCollection<PropertyCostCenter>(
    "Imóveis / Centros de Custo",
    "imoveis",
    "other",
    ["companyId"]
  );
}

export async function getDashboardOverviewData(filters: any = {}): Promise<{
  transactions: Transaction[];
  expenses: Expense[];
  banks: BankAccount[];
}> {
  const transactions = await getTransactionsData(filters);
  const expenses = await loadAndProcessCollection<Expense>("Dashboard Overview - Despesas", "despesas", "expense");
  const filteredExpenses = filterExpenses(expenses, filters);
  const banks = await getBanksData();

  return {
    transactions,
    expenses: filteredExpenses,
    banks
  };
}
