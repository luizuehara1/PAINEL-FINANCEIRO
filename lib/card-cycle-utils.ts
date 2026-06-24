import { CreditCard } from "@/types/finance";

// Helper to parse dates robustly
export function getCardDate(val: any): Date {
  if (!val) return new Date();
  if (typeof val === "object" && val.seconds !== undefined) {
    return new Date(val.seconds * 1000);
  }
  if (typeof val === "object" && typeof val.toDate === "function") {
    return val.toDate();
  }
  if (val instanceof Date) {
    return val;
  }
  
  const str = String(val).trim();
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }
  }
  if (str.includes("-")) {
    const parts = str.split("T")[0].split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? new Date() : new Date(parsed);
}

// Helper to get last day of a month
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculates card cycle dates, competence and invoice due date based on a purchase date.
 */
export function calculateCardCycle(dataCompraInput: any, card: CreditCard) {
  const dataCompra = getCardDate(dataCompraInput);
  
  const Y = dataCompra.getFullYear();
  const M = dataCompra.getMonth();
  const day = dataCompra.getDate();
  
  let competenceYear = Y;
  let competenceMonth = M;
  
  if (card.diaInicioCiclo <= card.diaFimCiclo) {
    // Standard monthly cycle (e.g. 1 to 30)
    competenceYear = Y;
    competenceMonth = M;
  } else {
    // Split cycle (e.g. 25 to 24 of next month)
    if (day >= card.diaInicioCiclo) {
      competenceYear = Y;
      competenceMonth = M;
    } else {
      const prevDate = new Date(Y, M - 1, 1);
      competenceYear = prevDate.getFullYear();
      competenceMonth = prevDate.getMonth();
    }
  }
  
  const compStr = `${competenceYear}-${String(competenceMonth + 1).padStart(2, "0")}`;
  
  // Calculate Cycle Start Date
  const cycleStart = new Date(competenceYear, competenceMonth, card.diaInicioCiclo, 0, 0, 0, 0);
  
  // Calculate Cycle End Date
  let cycleEnd: Date;
  if (card.diaInicioCiclo <= card.diaFimCiclo) {
    const lastDay = getLastDayOfMonth(competenceYear, competenceMonth);
    cycleEnd = new Date(competenceYear, competenceMonth, Math.min(card.diaFimCiclo, lastDay), 23, 59, 59, 999);
  } else {
    const nextMonthDate = new Date(competenceYear, competenceMonth + 1, 1);
    const NY = nextMonthDate.getFullYear();
    const NM = nextMonthDate.getMonth();
    const lastDay = getLastDayOfMonth(NY, NM);
    cycleEnd = new Date(NY, NM, Math.min(card.diaFimCiclo, lastDay), 23, 59, 59, 999);
  }
  
  // Calculate Due Date
  let dueYear = competenceYear;
  let dueMonth = competenceMonth;
  if (card.vencimentoMesSeguinte) {
    const nextMonth = new Date(competenceYear, competenceMonth + 1, 1);
    dueYear = nextMonth.getFullYear();
    dueMonth = nextMonth.getMonth();
  }
  
  const dueLastDay = getLastDayOfMonth(dueYear, dueMonth);
  const dueDay = Math.min(card.diaVencimento, dueLastDay);
  const dataVencimentoFatura = new Date(dueYear, dueMonth, dueDay, 12, 0, 0, 0);
  
  return {
    competencia: compStr,
    dataInicioCiclo: cycleStart,
    dataFimCiclo: cycleEnd,
    dataVencimentoFatura
  };
}

/**
 * Returns the competence string "YYYY-MM" for a purchase date.
 */
export function getCardCompetence(dataCompra: any, card: CreditCard): string {
  return calculateCardCycle(dataCompra, card).competencia;
}

/**
 * Returns the cycle start date for a specific competence.
 */
export function getCycleStartDate(competencia: string, card: CreditCard): Date {
  const parts = competencia.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  return new Date(year, month, card.diaInicioCiclo, 0, 0, 0, 0);
}

/**
 * Returns the cycle end date for a specific competence.
 */
export function getCycleEndDate(competencia: string, card: CreditCard): Date {
  const parts = competencia.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  
  if (card.diaInicioCiclo <= card.diaFimCiclo) {
    const lastDay = getLastDayOfMonth(year, month);
    return new Date(year, month, Math.min(card.diaFimCiclo, lastDay), 23, 59, 59, 999);
  } else {
    const nextMonthDate = new Date(year, month + 1, 1);
    const NY = nextMonthDate.getFullYear();
    const NM = nextMonthDate.getMonth();
    const lastDay = getLastDayOfMonth(NY, NM);
    return new Date(NY, NM, Math.min(card.diaFimCiclo, lastDay), 23, 59, 59, 999);
  }
}

/**
 * Returns the invoice due date for a specific competence.
 */
export function getInvoiceDueDate(competencia: string, card: CreditCard): Date {
  const parts = competencia.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  
  let dueYear = year;
  let dueMonth = month;
  if (card.vencimentoMesSeguinte) {
    const nextMonth = new Date(year, month + 1, 1);
    dueYear = nextMonth.getFullYear();
    dueMonth = nextMonth.getMonth();
  }
  
  const dueLastDay = getLastDayOfMonth(dueYear, dueMonth);
  const dueDay = Math.min(card.diaVencimento, dueLastDay);
  return new Date(dueYear, dueMonth, dueDay, 12, 0, 0, 0);
}
