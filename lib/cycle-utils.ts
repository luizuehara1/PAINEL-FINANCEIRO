import { Expense } from "@/types/finance";
import { normalizeDateToISO } from "./date-utils";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

/**
 * Normalizes a Date object to a YYYY-MM competence string.
 */
export function getCompetenceFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Extracts YYYY-MM competence string from date string (YYYY-MM-DD, DD/MM/YYYY or YYYY-MM) safely.
 */
export function getCompetenceFromDateStr(dateStr: string): string {
  if (!dateStr) return "";
  
  // If it's already YYYY-MM
  if (/^\d{4}-\d{2}$/.test(dateStr)) return dateStr;
  
  const iso = normalizeDateToISO(dateStr);
  if (iso && iso.length >= 7) {
    return iso.substring(0, 7);
  }
  
  return "";
}

/**
 * Formats YYYY-MM into "Month / Year" format.
 */
export function formatCompetenceLabel(competence: string): string {
  if (!competence || !competence.includes("-")) return competence;
  const [yearStr, monthStr] = competence.split("-");
  const monthIdx = parseInt(monthStr, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${MONTH_NAMES[monthIdx]} / ${yearStr}`;
  }
  return competence;
}

/**
 * Generates available cycle options based on fixed expenses list.
 */
export function getAvailableCyclesFromExpenses(expenses: Expense[]): { value: string; label: string }[] {
  const cyclesSet = new Set<string>();
  
  expenses.forEach(e => {
    if (e.tipo !== "fixa") return;
    
    let comp = e.competencia;
    if (!comp && e.dataVencimento) {
      comp = getCompetenceFromDateStr(e.dataVencimento);
    }
    if (!comp && e.data) {
      comp = getCompetenceFromDateStr(e.data);
    }
    
    if (comp && /^\d{4}-\d{2}$/.test(comp)) {
      cyclesSet.add(comp);
    }
  });
  
  // Sort competence list in ascending order (earliest first)
  const sortedCompetences = Array.from(cyclesSet).sort();
  
  const options = [
    { value: "", label: "Todos os Ciclos (Acumulado)" }
  ];
  
  sortedCompetences.forEach(comp => {
    options.push({
      value: comp,
      label: formatCompetenceLabel(comp)
    });
  });
  
  return options;
}
