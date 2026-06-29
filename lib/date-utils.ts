const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

/**
 * Safely parses a Brazilian formatted date string (DD/MM/YYYY) or an ISO date string (YYYY-MM-DD).
 * Never depends on browser-locale-dependent Date constructor directly.
 */
export function parseBrazilianDate(value: any): Date {
  if (value instanceof Date) return value;
  if (!value) return new Date();
  
  const str = String(value).trim();
  
  // Try DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1;
    const year = parseInt(brMatch[3], 10);
    return new Date(year, month, day);
  }
  
  // Try YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }
  
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Safely converts any value (Firestore Timestamp, Date, string) to a Date object.
 */
export function toDateSafe(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate();
  }
  if (typeof value === "object" && value.seconds !== undefined) {
    return new Date(value.seconds * 1000);
  }
  return parseBrazilianDate(value);
}

/**
 * Normalizes a Date object to a YYYY-MM competence string.
 */
export function getCompetenceFromDate(date: Date): string {
  const d = toDateSafe(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
 * Safely adds months to a date without skipping months or overflowing due to unequal month lengths.
 */
export function addMonthsSafe(date: Date, monthsToAdd: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1); // Set to 1st of the month to avoid overflowing during calculations
  d.setMonth(d.getMonth() + monthsToAdd);
  const lastDay = getLastDayOfMonth(d.getFullYear(), d.getMonth() + 1);
  d.setDate(Math.min(day, lastDay));
  return d;
}

/**
 * Returns the last day of the given year and month (1-indexed).
 */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Creates a due date string in DD/MM/YYYY format from a YYYY-MM competence and a due day.
 * Caps the day at the last day of that month if it exceeds.
 */
export function createDueDateFromCompetence(competence: string, dueDay: number): string {
  if (!competence || !competence.includes("-")) return "";
  const [yearStr, monthStr] = competence.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = getLastDayOfMonth(year, month);
  const day = Math.min(dueDay, lastDay);
  
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${dd}/${mm}/${yearStr}`;
}

/**
 * Normalizes any date string (DD/MM/YYYY or YYYY-MM-DD) or Date/Timestamp object to a standard ISO YYYY-MM-DD format for correct comparison.
 */
export function normalizeDateToISO(dateStr: any): string {
  if (!dateStr) return "";
  
  // If it's a Firestore Timestamp or Date object, let's format it directly
  if (typeof dateStr === "object") {
    try {
      const d = toDateSafe(dateStr);
      if (d && !isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}`;
      }
    } catch (e) {}
  }

  const str = String(dateStr).trim();
  
  // Try DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, "0");
    const month = brMatch[2].padStart(2, "0");
    const year = brMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Try YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
  } catch (e) {}
  
  return str;
}

/**
 * Safely calculates the next competence string month-by-month (e.g. 2026-07 -> 2026-08, 2026-12 -> 2027-01).
 */
export function getNextCompetence(currentCompetence: string): string {
  if (!currentCompetence || !currentCompetence.includes("-")) return "";
  const [yearStr, monthStr] = currentCompetence.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}
