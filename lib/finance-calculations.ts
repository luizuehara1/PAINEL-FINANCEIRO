import { Expense } from "@/types/finance";

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
      if (customStart && e.dataVencimento < customStart) return false;
      if (customEnd && e.dataVencimento > customEnd) return false;
      return true;
    });
  }

  const { start, end } = getDateRangeFromPeriodFilter(period, todayStr);

  return expenses.filter((e) => {
    if (e.tipo !== "fixa") return false;
    if (start && e.dataVencimento < start) return false;
    if (end && e.dataVencimento > end) return false;
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
      if (e.dataVencimento < todayStr) {
        vencidas += valor;
      } else if (e.dataVencimento > todayStr) {
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
