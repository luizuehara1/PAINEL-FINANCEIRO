import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { Expense } from "@/types/finance";
import { COMPANY_ID } from "./app-config";
import { 
  getCompetenceFromDate,
  getNextCompetence,
  createDueDateFromCompetence,
  toDateSafe
} from "./date-utils";

/**
 * Calculates if a given competence is more than a certain number of months ahead of a base competence.
 */
function isMoreThanMonthsAhead(comp1: string, comp2: string, maxMonths: number): boolean {
  if (!comp1 || !comp2 || !comp1.includes("-") || !comp2.includes("-")) return true;
  const [y1, m1] = comp1.split("-").map(Number);
  const [y2, m2] = comp2.split("-").map(Number);
  const diff = (y1 - y2) * 12 + (m1 - m2);
  return diff > maxMonths;
}

/**
 * Checks if a recurring expense already exists for a given group and competence.
 */
export function checkRecurringExpenseExists(
  expenses: Expense[],
  grupoRecorrenciaId: string,
  competencia: string
): boolean {
  if (!grupoRecorrenciaId || !competencia) return false;
  return expenses.some(
    (e) =>
      e.grupoRecorrenciaId === grupoRecorrenciaId &&
      e.competencia === competencia &&
      e.companyId === COMPANY_ID
  );
}

/**
 * Automatically creates future recurring fixed expenses up to monthsAhead sequentially month-by-month.
 */
export async function generateFutureRecurringExpenses(
  expenses: Expense[],
  userEmail: string,
  monthsAhead = 6
) {
  if (!userEmail || !expenses || expenses.length === 0) return;

  // Filter unique active recurrence groups
  const activeRecurrents = expenses.filter(
    (e) => 
      e.tipo === "fixa" && 
      e.recorrente && 
      e.recorrenciaAtiva && 
      !e.baixadaCompletamente && 
      e.grupoRecorrenciaId && 
      e.companyId === COMPANY_ID
  );

  if (activeRecurrents.length === 0) return;

  const todayCompetence = getCompetenceFromDate(new Date());
  const batch = writeBatch(db);
  let hasUpdates = false;

  // We will keep track of newly generated ones in this run to avoid duplicates within the same batch
  const generatedThisBatch = new Set<string>();

  for (const expense of activeRecurrents) {
    const grupoId = expense.grupoRecorrenciaId!;
    const diaVenc = expense.diaVencimento || 10;

    // Find all existing expenses in this group to determine the latest competence
    const groupExpenses = expenses.filter((e) => e.grupoRecorrenciaId === grupoId);
    
    let maxCompetence = "";
    groupExpenses.forEach((e) => {
      const comp = e.competencia || (e.dataVencimento ? e.dataVencimento.substring(0, 7) : "");
      if (comp && /^\d{4}-\d{2}$/.test(comp)) {
        if (!maxCompetence || comp > maxCompetence) {
          maxCompetence = comp;
        }
      }
    });

    // Fallback if no competence found
    if (!maxCompetence) {
      maxCompetence = expense.competencia || (expense.dataVencimento ? expense.dataVencimento.substring(0, 7) : "") || todayCompetence;
    }

    let currentCompetence = maxCompetence;

    // Generate month-by-month sequentially up to monthsAhead from today
    for (let i = 0; i < monthsAhead; i++) {
      const nextComp = getNextCompetence(currentCompetence);
      
      // Stop if next competence is too far in the future
      if (isMoreThanMonthsAhead(nextComp, todayCompetence, 6)) {
        break;
      }

      const uniqueKey = `${grupoId}_${nextComp}`;

      // Check if it already exists in database list OR already generated in this batch
      const alreadyExists = checkRecurringExpenseExists(expenses, grupoId, nextComp) || generatedThisBatch.has(uniqueKey);

      if (!alreadyExists) {
        const docRef = doc(collection(db, "financeiro", "geral", "despesas"));
        const targetDueDate = createDueDateFromCompetence(nextComp, diaVenc);

        const newExpenseData = {
          companyId: COMPANY_ID,
          tipo: "fixa" as const,
          nome: expense.nome,
          descricao: expense.descricao || "",
          categoria: expense.categoria,
          valor: expense.valor,
          formaPagamento: expense.formaPagamento,
          data: "",
          dataVencimento: targetDueDate,
          diaVencimento: diaVenc,
          competencia: nextComp,
          status: "pendente" as const,
          pagoEm: null,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
          criadoPorEmail: userEmail,
          recorrente: true,
          recorrenciaAtiva: true,
          despesaOrigemId: expense.id,
          grupoRecorrenciaId: grupoId,
          origem: "recorrencia",
          geradaAutomaticamente: true,
          baixadaCompletamente: false,
          baixadaEm: null,
          motivoBaixa: null,
          imovelId: expense.imovelId || null,
          imovelNome: expense.imovelNome || null,
          centroCustoTipo: expense.centroCustoTipo || null,
        };

        batch.set(docRef, newExpenseData);
        generatedThisBatch.add(uniqueKey);
        hasUpdates = true;
      }

      currentCompetence = nextComp;
    }
  }

  if (hasUpdates) {
    try {
      await batch.commit();
      console.log("Future recurring expenses generated sequentially successfully!");
    } catch (error) {
      console.error("Error committing batch recurring expenses:", error);
    }
  }
}
