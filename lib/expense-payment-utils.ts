import { db } from "./firebase";
import { 
  collection, 
  doc, 
  writeBatch, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from "firebase/firestore";
import { Expense } from "@/types/finance";
import { confirmExpensePaymentAndCreateTransaction } from "./finance-actions";

export async function confirmExpensePayment(
  expense: Expense, 
  userEmail: string, 
  allExpenses: Expense[] = []
): Promise<string> {
  if (expense.status === "pago") {
    return expense.transacaoGeradaId || "";
  }
  
  // Directly call the robust action handler to process everything cleanly and efficiently
  return await confirmExpensePaymentAndCreateTransaction(expense, userEmail, allExpenses);
}
