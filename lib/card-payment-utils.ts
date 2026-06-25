import { db } from "./firebase";
import { 
  collection, 
  doc, 
  writeBatch, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  Timestamp 
} from "firebase/firestore";
import { CardInvoice, CardItem } from "@/types/finance";

export async function confirmCardInvoicePayment(
  invoice: CardInvoice, 
  invoiceItems: CardItem[], 
  userEmail: string
): Promise<string> {
  if (invoice.status === "paga") {
    throw new Error("Essa fatura já foi paga.");
  }

  // Anti-duplicity check: check if transacao already exists
  const transQuery = query(
    collection(db, "financeiro", "geral", "transacoes"),
    where("origem", "==", "cartao"),
    where("faturaId", "==", invoice.id)
  );
  const transSnap = await getDocs(transQuery);

  let transId = invoice.transacaoGeradaId || null;

  const batch = writeBatch(db);

  if (transSnap.empty && !transId) {
    // Create UMA transação em Entradas e Saídas
    const transRef = doc(collection(db, "financeiro", "geral", "transacoes"));
    transId = transRef.id;

    const transPayload = {
      tipo: "saida" as const,
      nome: `Pagamento fatura - ${invoice.cartaoNome}`,
      descricao: `Pagamento da fatura do cartão ${invoice.cartaoNome} competência ${invoice.competencia}`,
      categoria: "Cartão de Crédito",
      valor: Number(invoice.valorTotal),
      formaPagamento: "Cartão de Crédito",
      data: new Date().toISOString().split("T")[0],
      origem: "cartao" as const,
      cartaoId: invoice.cartaoId,
      faturaId: invoice.id,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      criadoPorEmail: userEmail
    };

    batch.set(transRef, transPayload);
  } else if (!transSnap.empty) {
    transId = transSnap.docs[0].id;
  }

  // Update the invoice doc
  const invoiceRef = doc(db, "financeiro", "geral", "faturasCartao", invoice.id);
  batch.update(invoiceRef, {
    status: "paga",
    pagoEm: serverTimestamp(),
    transacaoGeradaId: transId,
    atualizadoEm: serverTimestamp()
  });

  // Update all items inside fatura to pago
  for (const item of invoiceItems) {
    const itemRef = doc(db, "financeiro", "geral", "itensCartao", item.id);
    batch.update(itemRef, { 
      status: "pago" 
    });
  }

  await batch.commit();
  return transId || "";
}
