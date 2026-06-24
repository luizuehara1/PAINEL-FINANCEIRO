import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { db } from "./firebase";
import { Expense } from "@/types/finance";

/**
 * Generates dates for installments starting from a start date, incrementing the month.
 */
export function generateInstallmentDates(startDateStr: string, total: number): string[] {
  const dates: string[] = [];
  if (!startDateStr) return dates;
  const parts = startDateStr.split("-");
  if (parts.length < 3) return dates;
  
  const initialYear = parseInt(parts[0]);
  const initialMonth = parseInt(parts[1]); // 1-12
  const initialDay = parseInt(parts[2]);
  
  for (let i = 0; i < total; i++) {
    let year = initialYear;
    let month = initialMonth + i;
    
    // adjust year and month if month goes beyond 12
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    
    // handle month end limits (e.g., 31st of Jan -> 28th of Feb)
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const day = Math.min(initialDay, lastDayOfMonth);
    
    const mm = month.toString().padStart(2, "0");
    const dd = day.toString().padStart(2, "0");
    dates.push(`${year}-${mm}-${dd}`);
  }
  return dates;
}

/**
 * Calculates installment values, handling rounding errors.
 */
export function calculateInstallmentValues(valorTotal: number, totalParcelas: number): number[] {
  const baseValue = Math.floor((valorTotal / totalParcelas) * 100) / 100;
  const values = Array(totalParcelas).fill(baseValue);
  
  const sumOfParts = baseValue * totalParcelas;
  const remainder = Math.round((valorTotal - sumOfParts) * 100) / 100;
  if (remainder !== 0) {
    values[0] = Math.round((values[0] + remainder) * 100) / 100;
  }
  return values;
}

/**
 * Generates and saves multiple installment expenses to Firestore.
 */
export async function generateInstallmentExpenses({
  nome,
  valorTotal,
  totalParcelas,
  primeiraDataVencimento,
  categoria,
  formaPagamento,
  descricao,
  criadoPorEmail,
  cartaoId,
  notaUrl,
  notaPublicId,
  notaTipo,
  notaNome,
}: {
  nome: string;
  valorTotal: number;
  totalParcelas: number;
  primeiraDataVencimento: string;
  categoria: string;
  formaPagamento: string;
  descricao: string;
  criadoPorEmail: string;
  cartaoId?: string | null;
  notaUrl?: string | null;
  notaPublicId?: string | null;
  notaTipo?: string | null;
  notaNome?: string | null;
}) {
  const dates = generateInstallmentDates(primeiraDataVencimento, totalParcelas);
  const values = calculateInstallmentValues(valorTotal, totalParcelas);
  
  const grupoParcelamentoId = `install_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();
  
  const batch = writeBatch(db);
  
  for (let i = 0; i < totalParcelas; i++) {
    const parcelaNum = i + 1;
    const valorParcela = values[i];
    const dataVenc = dates[i];
    const competence = dataVenc.substring(0, 7); // "YYYY-MM"
    
    const docRef = doc(collection(db, "financeiro", "geral", "despesas"));
    
    const despesaPayload = {
      tipo: "fixa" as const,
      nome,
      descricao: `Parcela ${parcelaNum}/${totalParcelas} - ${descricao || nome}`,
      categoria,
      valor: valorParcela,
      formaPagamento,
      data: "", // empty for fixed despesas
      dataVencimento: dataVenc,
      status: "pendente" as const,
      pagoEm: null,
      criadoEm: now,
      atualizadoEm: now,
      criadoPorEmail,
      
      // smart recurrence fields disabled
      recorrente: false,
      recorrenciaAtiva: false,
      baixadaCompletamente: false,
      diaVencimento: parseInt(dataVenc.split("-")[2]),
      competencia: competence,
      despesaOrigemId: null,
      
      // installment fields
      parcelado: true,
      parcelaAtual: parcelaNum,
      totalParcelas,
      valorParcela,
      valorTotalParcelado: valorTotal,
      grupoParcelamentoId,
      parcelamentoAtivo: true,
      parcelamentoQuitado: false,
      quitadoEm: null,
      
      // card link if present
      cartaoId: cartaoId || null,
      origem: "manual" as const,

      // Attachment fields
      notaUrl: notaUrl || null,
      notaPublicId: notaPublicId || null,
      notaTipo: notaTipo || null,
      notaNome: notaNome || null,
    };
    
    batch.set(docRef, despesaPayload);
  }
  
  await batch.commit();
  return grupoParcelamentoId;
}

/**
 * Checks if all installments of a group are marked as "pago".
 */
export async function checkIfAllInstallmentsArePaid(grupoParcelamentoId: string): Promise<boolean> {
  if (!grupoParcelamentoId) return false;
  const q = query(
    collection(db, "financeiro", "geral", "despesas"),
    where("grupoParcelamentoId", "==", grupoParcelamentoId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return false;
  
  let allPaid = true;
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.status !== "pago") {
      allPaid = false;
    }
  });
  return allPaid;
}

/**
 * Marks all installments in a group as quitado (parcelamentoAtivo = false, parcelamentoQuitado = true).
 */
export async function markInstallmentGroupAsPaidOff(grupoParcelamentoId: string) {
  if (!grupoParcelamentoId) return;
  const q = query(
    collection(db, "financeiro", "geral", "despesas"),
    where("grupoParcelamentoId", "==", grupoParcelamentoId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  snap.forEach((docSnap) => {
    batch.update(doc(db, "financeiro", "geral", "despesas", docSnap.id), {
      parcelamentoAtivo: false,
      parcelamentoQuitado: true,
      quitadoEm: now,
      atualizadoEm: now
    });
  });
  await batch.commit();
}

/**
 * Deletes all documents in a group.
 */
export async function deleteInstallmentGroup(grupoParcelamentoId: string) {
  if (!grupoParcelamentoId) return;
  const q = query(
    collection(db, "financeiro", "geral", "despesas"),
    where("grupoParcelamentoId", "==", grupoParcelamentoId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  
  const batch = writeBatch(db);
  snap.forEach((docSnap) => {
    batch.delete(doc(db, "financeiro", "geral", "despesas", docSnap.id));
  });
  await batch.commit();
}

/**
 * Confirms payment for an expense, and handles installment group updates.
 */
export async function confirmExpensePayment(expenseId: string, expenses: Expense[]): Promise<{ quitado: boolean, grupoId?: string | null }> {
  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) throw new Error("Despesa não encontrada");

  const now = new Date().toISOString();
  
  // 1. Update current expense
  const expenseRef = doc(db, "financeiro", "geral", "despesas", expenseId);
  await updateDoc(expenseRef, {
    status: "pago",
    pagoEm: now,
    atualizadoEm: now
  });

  if (expense.parcelado && expense.grupoParcelamentoId) {
    const allPaid = await checkIfAllInstallmentsArePaid(expense.grupoParcelamentoId);
    if (allPaid) {
      await markInstallmentGroupAsPaidOff(expense.grupoParcelamentoId);
      return { quitado: true, grupoId: expense.grupoParcelamentoId };
    }
    return { quitado: false, grupoId: expense.grupoParcelamentoId };
  }
  
  return { quitado: false, grupoId: null };
}
