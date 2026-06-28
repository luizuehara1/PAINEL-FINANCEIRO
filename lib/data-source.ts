import { fetchCollectionDocs } from "./firestore-queries";
import { validateFinanceDocument, filterByCompanyId } from "./filter-utils";
import { COMPANY_ID } from "./app-config";
import { debugFinance } from "./debug";

export interface IgnoredDoc {
  id: string;
  reason: string;
  item: any;
}

export interface DiagnosticInfo {
  sectionName: string;
  collectionName: string;
  filtersApplied: string[];
  loadedCount: number;
  displayedCount: number;
  ignoredDocs: IgnoredDoc[];
  lastUpdated: string;
}

// Module-level diagnostic registry to power the real-time UI
export const DIAGNOSTICS_REGISTRY: Record<string, DiagnosticInfo> = {};

/**
 * Registers diagnostic details for the diagnostics/audit systems.
 */
export function registerDiagnostic(info: DiagnosticInfo) {
  DIAGNOSTICS_REGISTRY[info.sectionName] = {
    ...info,
    lastUpdated: new Date().toLocaleTimeString()
  };
  debugFinance(`Diagnostic registered for section "${info.sectionName}"`, info);
}

/**
 * Standardized data source processor. 
 * Fetches, validates, handles companyId, tracks ignored docs, and logs diagnostics.
 */
export async function loadAndProcessCollection<T>(
  sectionName: string,
  collectionName: string,
  docType: "transaction" | "expense" | "other",
  filtersApplied: string[] = []
): Promise<T[]> {
  const rawDocs = await fetchCollectionDocs(collectionName);
  const loadedCount = rawDocs.length;
  
  const validated: T[] = [];
  const ignoredDocs: IgnoredDoc[] = [];

  rawDocs.forEach((doc: any) => {
    // 1. Check companyId
    if (doc.companyId && doc.companyId !== COMPANY_ID) {
      ignoredDocs.push({
        id: doc.id,
        reason: `companyId mismatch (esperava "${COMPANY_ID}", encontrou "${doc.companyId}")`,
        item: doc
      });
      return;
    }

    // 2. Perform schema validation for core items
    if (docType === "transaction" || docType === "expense") {
      const isValid = validateFinanceDocument(doc, docType);
      if (!isValid) {
        let reason = "Campos obrigatórios inválidos ou ausentes";
        if (!doc.companyId) {
          reason = "Documento legado sem companyId (precisa ser recuperado)";
        } else if (isNaN(parseFloat(doc.valor))) {
          reason = "Valor monetário inválido ou nulo";
        } else if (!doc.tipo) {
          reason = "Tipo de transação/despesa não especificado";
        } else if (docType === "transaction" && !doc.data) {
          reason = "Data da transação ausente";
        } else if (docType === "expense" && doc.tipo === "fixa" && !doc.dataVencimento) {
          reason = "Vencimento da despesa fixa ausente";
        } else if (docType === "expense" && doc.tipo === "variavel" && !doc.data) {
          reason = "Data da despesa variável ausente";
        }
        
        ignoredDocs.push({
          id: doc.id,
          reason,
          item: doc
        });
        return;
      }
    }

    // Standard fallback to add current companyId if it was legacy/null but validated
    const processedDoc = {
      ...doc,
      companyId: doc.companyId || COMPANY_ID
    };

    validated.push(processedDoc as T);
  });

  registerDiagnostic({
    sectionName,
    collectionName,
    filtersApplied,
    loadedCount,
    displayedCount: validated.length,
    ignoredDocs,
    lastUpdated: new Date().toLocaleTimeString()
  });

  return validated;
}
