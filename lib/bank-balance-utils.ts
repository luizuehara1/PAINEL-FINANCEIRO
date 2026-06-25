import { db } from "./firebase";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  runTransaction, 
  updateDoc, 
  increment,
  writeBatch
} from "firebase/firestore";
import { BankAccount, Transaction, Expense, CardInvoice, CardItem } from "@/types/finance";

/**
 * Fetch all active banks.
 */
export async function getActiveBanks(): Promise<BankAccount[]> {
  const q = query(
    collection(db, "financeiro", "geral", "bancos"),
    where("ativo", "==", true)
  );
  const snap = await getDocs(q);
  const list: BankAccount[] = [];
  snap.forEach((docSnap) => {
    list.push({ id: docSnap.id, ...docSnap.data() } as BankAccount);
  });
  return list;
}

/**
 * Calculates total available bank balance from active banks.
 */
export async function calculateAvailableBankBalance(banks?: BankAccount[]): Promise<number> {
  const bankList = banks || await getActiveBanks();
  return bankList.reduce((sum, b) => sum + (b.saldoAtual || 0), 0);
}

/**
 * Increment a bank's balance atomically.
 */
export async function increaseBankBalance(bankId: string, amount: number): Promise<void> {
  const absAmount = Math.abs(amount || 0);
  if (!bankId || absAmount <= 0) return;
  const bankRef = doc(db, "financeiro", "geral", "bancos", bankId);
  await updateDoc(bankRef, {
    saldoAtual: increment(absAmount),
    atualizadoEm: new Date().toISOString()
  });
}

/**
 * Decrement a bank's balance atomically.
 */
export async function decreaseBankBalance(bankId: string, amount: number): Promise<void> {
  const absAmount = Math.abs(amount || 0);
  if (!bankId || absAmount <= 0) return;
  const bankRef = doc(db, "financeiro", "geral", "bancos", bankId);
  await updateDoc(bankRef, {
    saldoAtual: increment(-absAmount),
    atualizadoEm: new Date().toISOString()
  });
}

/**
 * Apply a transaction's value change to its linked bank.
 */
export async function applyTransactionToBank(transaction: Transaction): Promise<void> {
  if (!transaction.bancoId || !transaction.valor) return;
  const absAmount = Math.abs(transaction.valor || 0);
  if (transaction.tipo === "entrada") {
    await increaseBankBalance(transaction.bancoId, absAmount);
  } else if (transaction.tipo === "saida") {
    await decreaseBankBalance(transaction.bancoId, absAmount);
  }
}

/**
 * Reverse a transaction's value change from its linked bank.
 */
export async function reverseTransactionFromBank(transaction: Transaction): Promise<void> {
  if (!transaction.bancoId || !transaction.valor) return;
  const absAmount = Math.abs(transaction.valor || 0);
  if (transaction.tipo === "entrada") {
    await decreaseBankBalance(transaction.bancoId, absAmount);
  } else if (transaction.tipo === "saida") {
    await increaseBankBalance(transaction.bancoId, absAmount);
  }
}

/**
 * Updates bank balances correctly when a transaction is edited.
 * Handles: changing amount, changing type, and swapping banks.
 */
export async function updateBankBalanceOnTransactionEdit(
  oldTransaction: Transaction,
  newTransaction: Transaction
): Promise<void> {
  await runTransaction(db, async (firestoreTransaction) => {
    // 1. Revert old transaction
    if (oldTransaction.bancoId && oldTransaction.valor) {
      const oldBankRef = doc(db, "financeiro", "geral", "bancos", oldTransaction.bancoId);
      const oldBankSnap = await firestoreTransaction.get(oldBankRef);
      if (oldBankSnap.exists()) {
        const currentSaldo = oldBankSnap.data().saldoAtual || 0;
        let newSaldo = currentSaldo;
        const oldAbsValue = Math.abs(oldTransaction.valor || 0);
        if (oldTransaction.tipo === "entrada") {
          newSaldo -= oldAbsValue;
        } else if (oldTransaction.tipo === "saida") {
          newSaldo += oldAbsValue;
        }
        firestoreTransaction.update(oldBankRef, {
          saldoAtual: newSaldo,
          atualizadoEm: new Date().toISOString(),
        });
      }
    }

    // 2. Apply new transaction
    if (newTransaction.bancoId && newTransaction.valor) {
      const newBankRef = doc(db, "financeiro", "geral", "bancos", newTransaction.bancoId);
      const newBankSnap = await firestoreTransaction.get(newBankRef);
      if (newBankSnap.exists()) {
        const currentSaldo = newBankSnap.data().saldoAtual || 0;
        let newSaldo = currentSaldo;
        const newAbsValue = Math.abs(newTransaction.valor || 0);
        if (newTransaction.tipo === "entrada") {
          newSaldo += newAbsValue;
        } else if (newTransaction.tipo === "saida") {
          newSaldo -= newAbsValue;
        }
        firestoreTransaction.update(newBankRef, {
          saldoAtual: newSaldo,
          atualizadoEm: new Date().toISOString(),
        });
      }
    }
  });
}

/**
 * Confirms payment for an expense (fixed/variable) and deducts from selected bank.
 */
export async function confirmExpensePaymentAndUpdateBank(
  expense: Expense | string,
  bank: BankAccount | string,
  userEmail: string
): Promise<{ transId: string; groupFullyPaid: boolean }> {
  const expenseId = typeof expense === "string" ? expense : expense.id;
  const bankId = typeof bank === "string" ? bank : bank.id;

  let installmentGroupId: string | null = null;
  let groupExpenses: Expense[] = [];

  if (typeof expense !== "string" && expense.parcelado && expense.grupoParcelamentoId) {
    installmentGroupId = expense.grupoParcelamentoId;
  } else {
    const expSnap = await getDoc(doc(db, "financeiro", "geral", "despesas", expenseId));
    if (expSnap.exists()) {
      const expD = expSnap.data() as Expense;
      if (expD.parcelado && expD.grupoParcelamentoId) {
        installmentGroupId = expD.grupoParcelamentoId;
      }
    }
  }

  if (installmentGroupId) {
    const q = query(
      collection(db, "financeiro", "geral", "despesas"),
      where("grupoParcelamentoId", "==", installmentGroupId)
    );
    const snap = await getDocs(q);
    groupExpenses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
  }

  return await runTransaction(db, async (firestoreTransaction) => {
    const expenseRef = doc(db, "financeiro", "geral", "despesas", expenseId);
    const bankRef = doc(db, "financeiro", "geral", "bancos", bankId);

    const expenseSnap = await firestoreTransaction.get(expenseRef);
    const bankSnap = await firestoreTransaction.get(bankRef);

    if (!expenseSnap.exists()) {
      throw new Error("Despesa não encontrada.");
    }
    if (!bankSnap.exists()) {
      throw new Error("Banco não encontrado.");
    }

    const expData = { id: expenseSnap.id, ...expenseSnap.data() } as Expense;
    const bankData = { id: bankSnap.id, ...bankSnap.data() } as BankAccount;

    // Prevent duplicate payment or deduction
    if (expData.status === "pago" || expData.saidaGerada === true || expData.transacaoGeradaId) {
      return { transId: expData.transacaoGeradaId || "", groupFullyPaid: false };
    }

    const transColl = collection(db, "financeiro", "geral", "transacoes");
    const newTransRef = doc(transColl);
    const transId = newTransRef.id;

    const nowStr = new Date().toISOString();
    const paymentDate = nowStr.split("T")[0];

    const amount = Math.abs(expData.valor || 0);

    const transPayload = {
      tipo: "saida",
      nome: expData.nome,
      descricao: `Pagamento confirmado da despesa ${expData.tipo === "fixa" ? "fixa" : "variável"}: ${expData.nome}`,
      categoria: expData.categoria,
      valor: amount,
      formaPagamento: expData.formaPagamento,
      data: paymentDate,
      origem: "despesa",
      despesaId: expData.id,
      despesaTipo: expData.tipo,
      bancoId: bankData.id,
      bancoNome: bankData.nome,
      criadoEm: nowStr,
      atualizadoEm: nowStr,
      criadoPorEmail: userEmail || expData.criadoPorEmail || "",
      notaUrl: expData.notaUrl || null,
      notaPublicId: expData.notaPublicId || null,
      notaTipo: expData.notaTipo || null,
      notaNome: expData.notaNome || null,
      imovelId: expData.imovelId || null,
      imovelNome: expData.imovelNome || null,
      centroCustoTipo: expData.centroCustoTipo || null,
    };

    // Create the out transaction
    firestoreTransaction.set(newTransRef, transPayload);

    // Determine if the group is fully paid off
    let groupFullyPaid = false;
    if (expData.parcelado && expData.grupoParcelamentoId && groupExpenses.length > 0) {
      const siblingInstallments = groupExpenses.filter(e => e.id !== expData.id);
      const allOthersPaid = siblingInstallments.every(e => e.status === "pago");
      if (allOthersPaid) {
        groupFullyPaid = true;
      }
    }

    // Update fields
    const expenseUpdates: any = {
      status: "pago",
      pagoEm: nowStr,
      saidaGerada: true,
      bancoPagamentoId: bankData.id,
      bancoPagamentoNome: bankData.nome,
      transacaoGeradaId: transId,
      atualizadoEm: nowStr,
    };

    if (groupFullyPaid) {
      expenseUpdates.parcelamentoAtivo = false;
      expenseUpdates.parcelamentoQuitado = true;
      expenseUpdates.quitadoEm = nowStr;
      expenseUpdates.baixadaCompletamente = true;
    }

    // Update current expense
    firestoreTransaction.update(expenseRef, expenseUpdates);

    // If group is fully paid, update all sibling installments as well
    if (groupFullyPaid) {
      for (const sibling of groupExpenses) {
        if (sibling.id !== expData.id) {
          const siblingRef = doc(db, "financeiro", "geral", "despesas", sibling.id);
          firestoreTransaction.update(siblingRef, {
            parcelamentoAtivo: false,
            parcelamentoQuitado: true,
            quitadoEm: nowStr,
            baixadaCompletamente: true,
            atualizadoEm: nowStr,
          });
        }
      }
    }

    // Deduct from bank
    const currentSaldo = bankData.saldoAtual || 0;
    firestoreTransaction.update(bankRef, {
      saldoAtual: Number(currentSaldo || 0) - amount,
      atualizadoEm: nowStr,
    });

    return { transId, groupFullyPaid };
  });
}

/**
 * Confirms payment for credit card invoice and deducts from selected bank.
 */
export async function confirmCardInvoicePaymentAndUpdateBank(
  invoice: CardInvoice | string,
  bank: BankAccount | string,
  invoiceItems: CardItem[],
  userEmail: string
): Promise<string> {
  const invoiceId = typeof invoice === "string" ? invoice : invoice.id;
  const bankId = typeof bank === "string" ? bank : bank.id;

  // ANTI-DUPLICIDADE pre-checks:
  const q = query(
    collection(db, "financeiro", "geral", "transacoes"),
    where("origem", "==", "cartao"),
    where("faturaId", "==", invoiceId)
  );
  const existingTxSnap = await getDocs(q);
  if (!existingTxSnap.empty) {
    throw new Error("Essa fatura já foi paga.");
  }

  const invoiceDocRef = doc(db, "financeiro", "geral", "faturasCartao", invoiceId);
  const invoiceDocSnap = await getDoc(invoiceDocRef);
  if (invoiceDocSnap.exists()) {
    const invObj = invoiceDocSnap.data() as CardInvoice;
    if (invObj.status === "paga" || invObj.transacaoGeradaId) {
      throw new Error("Essa fatura já foi paga.");
    }
  }

  return await runTransaction(db, async (firestoreTransaction) => {
    const invoiceRef = doc(db, "financeiro", "geral", "faturasCartao", invoiceId);
    const bankRef = doc(db, "financeiro", "geral", "bancos", bankId);

    const invoiceSnap = await firestoreTransaction.get(invoiceRef);
    const bankSnap = await firestoreTransaction.get(bankRef);

    if (!invoiceSnap.exists()) {
      throw new Error("Fatura não encontrada.");
    }
    if (!bankSnap.exists()) {
      throw new Error("Banco não encontrado.");
    }

    const invData = { id: invoiceSnap.id, ...invoiceSnap.data() } as CardInvoice;
    const bankData = { id: bankSnap.id, ...bankSnap.data() } as BankAccount;

    if (invData.status === "paga" || invData.transacaoGeradaId) {
      throw new Error("Essa fatura já foi paga.");
    }

    const transColl = collection(db, "financeiro", "geral", "transacoes");
    const newTransRef = doc(transColl);
    const transId = newTransRef.id;

    const nowStr = new Date().toISOString();
    const paymentDate = nowStr.split("T")[0];

    const amount = Math.abs(invData.valorTotal || 0);

    // DEBUG:
    console.log("Valor original da fatura:", invData.valorTotal);
    console.log("Valor normalizado para pagamento:", amount);
    console.log("Saldo antes:", bankData.saldoAtual);
    console.log("Saldo depois:", bankData.saldoAtual - amount);

    const transPayload = {
      tipo: "saida",
      nome: `Pagamento fatura - ${invData.cartaoNome}`,
      descricao: `Pagamento da fatura do cartão ${invData.cartaoNome} competência ${invData.competencia}`,
      categoria: "Cartão de Crédito",
      valor: amount,
      formaPagamento: "Débito em conta",
      data: paymentDate,
      origem: "cartao",
      cartaoId: invData.cartaoId,
      faturaId: invData.id,
      bancoId: bankData.id,
      bancoNome: bankData.nome,
      criadoEm: nowStr,
      atualizadoEm: nowStr,
      criadoPorEmail: userEmail || invData.criadoPorEmail || "",
    };

    // Create single transaction
    firestoreTransaction.set(newTransRef, transPayload);

    // Update invoice status
    firestoreTransaction.update(invoiceRef, {
      status: "paga",
      pagoEm: nowStr,
      bancoPagamentoId: bankData.id,
      bancoPagamentoNome: bankData.nome,
      transacaoGeradaId: transId,
      atualizadoEm: nowStr,
    });

    // Update each item inside fatura
    for (const item of invoiceItems) {
      const itemRef = doc(db, "financeiro", "geral", "itensCartao", item.id);
      firestoreTransaction.update(itemRef, {
        status: "pago",
      });
    }

    // Deduct from bank
    const currentSaldo = bankData.saldoAtual || 0;
    firestoreTransaction.update(bankRef, {
      saldoAtual: Number(currentSaldo || 0) - amount,
      atualizadoEm: nowStr,
    });

    return transId;
  });
}
