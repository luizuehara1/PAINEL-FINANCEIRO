import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  writeBatch 
} from "firebase/firestore";
import { db } from "./firebase";
import { Expense } from "@/types/finance";
import { 
  checkIfNextExpenseAlreadyExists, 
  createNextRecurringExpense, 
  getExpenseCompetence, 
  getNextMonthDueDate 
} from "./finance-utils";

/**
 * Checks if an automatic transaction exists for a given expense ID.
 */
export async function checkExpenseTransactionExists(expenseId: string): Promise<boolean> {
  if (!expenseId) return false;
  const q = query(
    collection(db, "financeiro", "geral", "transacoes"),
    where("origem", "==", "despesa"),
    where("despesaId", "==", expenseId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Creates an automatic payment transaction out for a given expense.
 */
export async function createExpensePaymentTransaction(expense: Expense, userEmail: string): Promise<string | null> {
  if (!expense) return null;

  // 1. Anti-duplicity checks
  if (expense.saidaGerada === true && expense.transacaoGeradaId) {
    return expense.transacaoGeradaId;
  }

  const q = query(
    collection(db, "financeiro", "geral", "transacoes"),
    where("origem", "==", "despesa"),
    where("despesaId", "==", expense.id)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    return snap.docs[0].id;
  }

  // 2. Create the transaction
  const paymentDate = expense.pagoEm || expense.data || expense.dataVencimento || new Date().toISOString().split("T")[0];
  const dataFormatted = paymentDate.includes("T") ? paymentDate.split("T")[0] : paymentDate;

  const transRef = await addDoc(collection(db, "financeiro", "geral", "transacoes"), {
    tipo: "saida",
    nome: expense.nome,
    descricao: `Pagamento da despesa: ${expense.nome}`,
    categoria: expense.categoria,
    valor: expense.valor,
    formaPagamento: expense.formaPagamento,
    data: dataFormatted,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    criadoPorEmail: userEmail || expense.criadoPorEmail || "",
    origem: "despesa",
    despesaId: expense.id,
    despesaTipo: expense.tipo,
    notaUrl: expense.notaUrl || null,
    notaPublicId: expense.notaPublicId || null,
    notaTipo: expense.notaTipo || null,
    notaNome: expense.notaNome || null,
  });

  return transRef.id;
}

/**
 * Confirms payment for an expense (fixed, variable, installment) and creates an automatic out transaction.
 */
export async function confirmExpensePaymentAndCreateTransaction(
  expense: Expense,
  userEmail: string,
  allExpenses: Expense[] = []
): Promise<string> {
  const nowStr = new Date().toISOString();

  // 1. Anti-duplicity lookup
  let transactionId = expense.transacaoGeradaId || null;
  if (!transactionId) {
    const q = query(
      collection(db, "financeiro", "geral", "transacoes"),
      where("origem", "==", "despesa"),
      where("despesaId", "==", expense.id)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      transactionId = snap.docs[0].id;
    }
  }

  // 2. Create transaction if not exists
  if (!transactionId) {
    const paymentDate = nowStr;
    const dataFormatted = paymentDate.split("T")[0];

    const transRef = await addDoc(collection(db, "financeiro", "geral", "transacoes"), {
      tipo: "saida",
      nome: expense.nome,
      descricao: `Pagamento da despesa: ${expense.nome}`,
      categoria: expense.categoria,
      valor: expense.valor,
      formaPagamento: expense.formaPagamento,
      data: dataFormatted,
      criadoEm: nowStr,
      atualizadoEm: nowStr,
      criadoPorEmail: userEmail || expense.criadoPorEmail || "",
      origem: "despesa",
      despesaId: expense.id,
      despesaTipo: expense.tipo,
      notaUrl: expense.notaUrl || null,
      notaPublicId: expense.notaPublicId || null,
      notaTipo: expense.notaTipo || null,
      notaNome: expense.notaNome || null,
    });
    transactionId = transRef.id;
  }

  // 3. Update the expense itself
  const expenseRef = doc(db, "financeiro", "geral", "despesas", expense.id);
  await updateDoc(expenseRef, {
    status: "pago",
    pagoEm: nowStr,
    saidaGerada: true,
    transacaoGeradaId: transactionId,
    atualizadoEm: nowStr,
  });

  // 4. Sibling installment logic (give closure if all installments are paid)
  if (expense.parcelado && expense.grupoParcelamentoId && allExpenses.length > 0) {
    const siblingInstallments = allExpenses.filter(
      (e) => e.grupoParcelamentoId === expense.grupoParcelamentoId && e.id !== expense.id
    );
    const allOthersPaid = siblingInstallments.every((e) => e.status === "pago");
    if (allOthersPaid) {
      const batch = writeBatch(db);
      const groupDocs = allExpenses.filter((e) => e.grupoParcelamentoId === expense.grupoParcelamentoId);
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
    }
  }

  // 5. Smart recurrence for Fixed Expenses
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

    const alreadyExists = checkIfNextExpenseAlreadyExists(
      allExpenses,
      expense.grupoRecorrenciaId || "",
      nextCompetence
    );

    if (!alreadyExists) {
      await createNextRecurringExpense(expense, userEmail);
    }
  }

  return transactionId;
}

/**
 * Updates a linked transaction when an expense is updated.
 */
export async function updateLinkedExpenseTransaction(expense: Expense): Promise<void> {
  let transactionId = expense.transacaoGeradaId;

  if (!transactionId) {
    const q = query(
      collection(db, "financeiro", "geral", "transacoes"),
      where("origem", "==", "despesa"),
      where("despesaId", "==", expense.id)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      transactionId = snap.docs[0].id;
    }
  }

  if (transactionId) {
    const transRef = doc(db, "financeiro", "geral", "transacoes", transactionId);
    const paymentDate = expense.pagoEm || expense.data || expense.dataVencimento || new Date().toISOString().split("T")[0];
    const dataFormatted = paymentDate.includes("T") ? paymentDate.split("T")[0] : paymentDate;

    await updateDoc(transRef, {
      nome: expense.nome,
      descricao: `Pagamento da despesa: ${expense.nome}`,
      categoria: expense.categoria,
      valor: expense.valor,
      formaPagamento: expense.formaPagamento,
      data: dataFormatted,
      notaUrl: expense.notaUrl || null,
      notaPublicId: expense.notaPublicId || null,
      notaTipo: expense.notaTipo || null,
      notaNome: expense.notaNome || null,
      atualizadoEm: new Date().toISOString(),
    });
  }
}

/**
 * Deletes a linked transaction.
 */
export async function deleteLinkedExpenseTransaction(transactionId: string): Promise<void> {
  if (!transactionId) return;
  try {
    const transRef = doc(db, "financeiro", "geral", "transacoes", transactionId);
    await deleteDoc(transRef);
  } catch (error) {
    console.error("Erro ao deletar transação vinculada:", error);
  }
}
