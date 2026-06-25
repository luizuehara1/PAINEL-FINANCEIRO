import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { Expense } from "@/types/finance";

/**
 * Automatically creates future recurring fixed expenses up to monthsAhead to populate upcoming months in filters.
 */
export async function generateFutureRecurringExpenses(
  expenses: Expense[],
  userEmail: string,
  monthsAhead = 12
) {
  if (!userEmail || expenses.length === 0) return;

  // Filter unique active recurrence groups by looking at current recurrences
  const activeRecurrents = expenses.filter(
    (e) => e.tipo === "fixa" && e.recorrente && e.recorrenciaAtiva && !e.baixadaCompletamente && e.grupoRecorrenciaId
  );

  if (activeRecurrents.length === 0) return;

  const batch = writeBatch(db);
  let hasUpdates = false;

  for (const expense of activeRecurrents) {
    const diaVenc = expense.diaVencimento || Number(expense.dataVencimento.split("-")[2]) || 10;
    const baseDate = expense.dataVencimento;

    for (let i = 0; i <= monthsAhead; i++) {
      const parts = baseDate.split("-");
      let year = parseInt(parts[0]);
      let month = parseInt(parts[1]); // 1-12
      
      month += i;
      while (month > 12) {
        month -= 12;
        year += 1;
      }
      
      const lastDay = new Date(year, month, 0).getDate();
      const day = Math.min(diaVenc, lastDay);
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const targetDueDate = `${year}-${mm}-${dd}`;
      const targetCompetence = `${year}-${mm}`;

      // Check if this competence already exists for this group
      const alreadyExists = expenses.some(
        (e) => e.grupoRecorrenciaId === expense.grupoRecorrenciaId && e.competencia === targetCompetence
      );

      if (!alreadyExists) {
        const docRef = doc(collection(db, "financeiro", "geral", "despesas"));
        const newExpenseData = {
          tipo: "fixa" as const,
          nome: expense.nome,
          descricao: expense.descricao || "",
          categoria: expense.categoria,
          valor: expense.valor,
          formaPagamento: expense.formaPagamento,
          data: "",
          dataVencimento: targetDueDate,
          diaVencimento: diaVenc,
          competencia: targetCompetence,
          status: "pendente" as const,
          pagoEm: null,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
          criadoPorEmail: userEmail,
          recorrente: true,
          recorrenciaAtiva: true,
          despesaOrigemId: expense.id,
          grupoRecorrenciaId: expense.grupoRecorrenciaId,
          baixadaCompletamente: false,
          baixadaEm: null,
          motivoBaixa: null,
          imovelId: expense.imovelId || null,
          imovelNome: expense.imovelNome || null,
          centroCustoTipo: expense.centroCustoTipo || null,
        };
        batch.set(docRef, newExpenseData);
        hasUpdates = true;
      }
    }
  }

  if (hasUpdates) {
    await batch.commit();
    console.log("Future recurring expenses generated successfully!");
  }
}
