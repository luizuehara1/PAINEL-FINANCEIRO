import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import { Expense } from "@/types/finance";
import { 
  normalizeDateToISO, 
  getCompetenceFromDate, 
  getNextCompetence, 
  createDueDateFromCompetence 
} from "./date-utils";

/**
 * Returns competence in "YYYY-MM" format safely.
 */
export function getExpenseCompetence(dateStr: string): string {
  if (!dateStr) return "";
  const iso = normalizeDateToISO(dateStr);
  return iso.substring(0, 7); // "YYYY-MM"
}

/**
 * Calculates the next month's due date based on the current due date and selected day.
 */
export function getNextMonthDueDate(currentDueDateStr: string, diaVencimento: number): string {
  if (!currentDueDateStr) return "";
  const isoDate = normalizeDateToISO(currentDueDateStr);
  const currentCompetence = isoDate.substring(0, 7); // YYYY-MM
  const nextCompetence = getNextCompetence(currentCompetence);
  return createDueDateFromCompetence(nextCompetence, diaVencimento);
}

/**
 * Checks if a future/next month's expense in the same recurrence group already exists.
 */
export function checkIfNextExpenseAlreadyExists(
  expenses: Expense[], 
  grupoRecorrenciaId: string, 
  nextCompetence: string
): boolean {
  if (!grupoRecorrenciaId || !nextCompetence) return false;
  return expenses.some(
    (e) => 
      e.grupoRecorrenciaId === grupoRecorrenciaId && 
      e.competencia === nextCompetence
  );
}

/**
 * Saves a new fixed expense, initializing the smart recurrence fields.
 */
export async function createFixedExpense(
  expenseData: Omit<Expense, "id" | "criadoEm">,
  userEmail: string
) {
  const competence = getExpenseCompetence(expenseData.dataVencimento);
  const diaVenc = expenseData.diaVencimento || Number(expenseData.dataVencimento.split("-")[2]) || 10;
  const grupoId = expenseData.grupoRecorrenciaId || `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const newExpense = {
    ...expenseData,
    competencia: competence,
    diaVencimento: diaVenc,
    grupoRecorrenciaId: grupoId,
    recorrente: expenseData.recorrente ?? false,
    recorrenciaAtiva: expenseData.recorrenciaAtiva ?? false,
    baixadaCompletamente: false,
    despesaOrigemId: expenseData.despesaOrigemId || null,
    criadoPorEmail: userEmail,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };

  const docRef = await addDoc(collection(db, "financeiro", "geral", "despesas"), newExpense);
  return docRef.id;
}

/**
 * Automatically creates the next month's expense as "pendente".
 */
export async function createNextRecurringExpense(
  currentExpense: Expense,
  userEmail: string
) {
  if (!currentExpense.grupoRecorrenciaId) return null;
  
  const nextDueDate = getNextMonthDueDate(
    currentExpense.dataVencimento, 
    currentExpense.diaVencimento || 10
  );
  const nextCompetence = getExpenseCompetence(nextDueDate);

  const nextExpenseData = {
    tipo: "fixa" as const,
    nome: currentExpense.nome,
    descricao: currentExpense.descricao || "",
    categoria: currentExpense.categoria,
    valor: currentExpense.valor,
    formaPagamento: currentExpense.formaPagamento,
    data: "",
    dataVencimento: nextDueDate,
    diaVencimento: currentExpense.diaVencimento || 10,
    competencia: nextCompetence,
    status: "pendente" as const,
    pagoEm: null,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    criadoPorEmail: userEmail,
    recorrente: true,
    recorrenciaAtiva: true,
    despesaOrigemId: currentExpense.id,
    grupoRecorrenciaId: currentExpense.grupoRecorrenciaId,
    baixadaCompletamente: false,
    baixadaEm: null,
    motivoBaixa: null,

    // Copy imovel / centro de custo fields
    imovelId: currentExpense.imovelId || null,
    imovelNome: currentExpense.imovelNome || null,
    centroCustoTipo: currentExpense.centroCustoTipo || null,
  };

  const docRef = await addDoc(collection(db, "financeiro", "geral", "despesas"), nextExpenseData);
  return docRef.id;
}

/**
 * Confirms payment for a fixed expense, updating its status, and generates the next recurring instance.
 */
export async function confirmFixedExpensePayment(
  expenseId: string,
  expenses: Expense[],
  userEmail: string
) {
  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) throw new Error("Despesa não encontrada");

  // 1. Update current expense to paid
  const expenseDocRef = doc(db, "financeiro", "geral", "despesas", expenseId);
  await updateDoc(expenseDocRef, {
    status: "pago",
    pagoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  });

  // Check if this is a card installment and if it's the last pending installment in the group
  if (expense.parcelado && expense.grupoParcelamentoId) {
    const siblingInstallments = expenses.filter(
      (e) => e.grupoParcelamentoId === expense.grupoParcelamentoId && e.id !== expenseId
    );
    const allOthersPaid = siblingInstallments.every((e) => e.status === "pago");
    if (allOthersPaid) {
      const batch = writeBatch(db);
      const groupDocs = expenses.filter((e) => e.grupoParcelamentoId === expense.grupoParcelamentoId);
      const quitadoEmDate = new Date().toISOString();
      for (const d of groupDocs) {
        const dRef = doc(db, "financeiro", "geral", "despesas", d.id);
        batch.update(dRef, {
          parcelamentoQuitado: true,
          quitadoEm: quitadoEmDate,
          baixadaCompletamente: true, // Auto-close/quit despesa fixa when fully paid
          atualizadoEm: quitadoEmDate,
        });
      }
      await batch.commit();
      console.log("Grupo de parcelamento quitado e baixado automaticamente!");
    }
  }

  // 2. If it is an active recurring expense that hasn't been completely closed, trigger next month creation
  if (
    expense.tipo === "fixa" &&
    expense.recorrente &&
    expense.recorrenciaAtiva &&
    !expense.baixadaCompletamente
  ) {
    const nextDueDate = getNextMonthDueDate(
      expense.dataVencimento, 
      expense.diaVencimento || 10
    );
    const nextCompetence = getExpenseCompetence(nextDueDate);

    // 3. Double-check to prevent duplicate next month records
    const alreadyExists = checkIfNextExpenseAlreadyExists(
      expenses,
      expense.grupoRecorrenciaId || "",
      nextCompetence
    );

    if (!alreadyExists) {
      await createNextRecurringExpense(expense, userEmail);
    }
  }
}

/**
 * Terminates the recurrence group. Sets all future pending installments to "baixadaCompletamente".
 */
export async function closeRecurringExpense(
  expenseId: string,
  expenses: Expense[],
  motivo: string
) {
  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) throw new Error("Despesa não encontrada");

  const grupoId = expense.grupoRecorrenciaId;
  const nowStr = new Date().toISOString();

  if (!grupoId) {
    // Single instance closure
    const docRef = doc(db, "financeiro", "geral", "despesas", expenseId);
    await updateDoc(docRef, {
      recorrenciaAtiva: false,
      baixadaCompletamente: true,
      baixadaEm: nowStr,
      motivoBaixa: motivo || null,
      atualizadoEm: nowStr
    });
    return;
  }

  // Retrieve any pending installments of the same group to close
  const sameGroupPending = expenses.filter(
    (e) => e.grupoRecorrenciaId === grupoId && e.status === "pendente"
  );

  const batch = writeBatch(db);

  // Close the clicked record
  const currentRef = doc(db, "financeiro", "geral", "despesas", expenseId);
  batch.update(currentRef, {
    recorrenciaAtiva: false,
    baixadaCompletamente: true,
    baixadaEm: nowStr,
    motivoBaixa: motivo || null,
    atualizadoEm: nowStr
  });

  // Close any pending future/current installments associated with this group
  for (const exp of sameGroupPending) {
    const ref = doc(db, "financeiro", "geral", "despesas", exp.id);
    batch.update(ref, {
      recorrenciaAtiva: false,
      baixadaCompletamente: true,
      baixadaEm: nowStr,
      motivoBaixa: motivo || null,
      atualizadoEm: nowStr
    });
  }

  await batch.commit();
}
