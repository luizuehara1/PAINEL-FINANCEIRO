/**
 * Safe logger that only logs in development mode.
 */

const isDev = typeof window !== "undefined" 
  ? (window.location.hostname === "localhost" || window.location.hostname.includes("127.0.0.1") || window.location.hostname.includes("run.app"))
  : process.env.NODE_ENV === "development";

export function debugFinance(label: string, data?: any) {
  if (isDev) {
    console.log(`[FINANCE DEBUG] ${label}:`, data !== undefined ? data : "");
  }
}

export function warnFinance(label: string, data?: any) {
  if (isDev) {
    console.warn(`[FINANCE WARNING] ${label}:`, data !== undefined ? data : "");
  }
}

export function errorFinance(label: string, error?: any) {
  console.error(`[FINANCE ERROR] ${label}:`, error !== undefined ? error : "");
}
