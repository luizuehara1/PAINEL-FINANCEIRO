import { collection, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { COMPANY_ID } from "./app-config";

export const COLLECTIONS_TO_RECOVER = [
  "transacoes",
  "despesas",
  "cartoes",
  "faturasCartao",
  "itensCartao",
  "bancos",
  "investimentos",
  "patrimonios",
  "imoveis",
  "categoriasEntrada",
  "categoriasSaida",
  "categoriasDespesasFixas",
  "categoriasDespesasVariaveis",
  "formasPagamento",
  "notas"
];

export interface LegacyCounts {
  [collectionName: string]: number;
}

/**
 * Busca nas coleções documentos sem companyId e conta quantos existem em cada uma.
 */
export async function findLegacyDocumentsWithoutCompanyId(): Promise<LegacyCounts> {
  const counts: LegacyCounts = {};

  const promises = COLLECTIONS_TO_RECOVER.map(async (colName) => {
    try {
      const colRef = collection(db, "financeiro", "geral", colName);
      const snapshot = await getDocs(colRef);
      const legacyDocs = snapshot.docs.filter((docSnap) => {
        const data = docSnap.data();
        return !data.companyId || data.companyId === "";
      });
      counts[colName] = legacyDocs.length;
    } catch (error) {
      console.error(`Erro ao verificar coleção ${colName}:`, error);
      counts[colName] = 0;
    }
  });

  await Promise.all(promises);
  return counts;
}

/**
 * Adiciona o companyId: "painel_financeiro_principal" e atualizadoEm: serverTimestamp()
 * a todos os documentos antigos sem companyId nas coleções especificadas.
 */
export async function attachCompanyIdToLegacyDocuments(): Promise<{ totalMigrated: number }> {
  let totalMigrated = 0;

  for (const colName of COLLECTIONS_TO_RECOVER) {
    try {
      const colRef = collection(db, "financeiro", "geral", colName);
      const snapshot = await getDocs(colRef);
      const legacyDocs = snapshot.docs.filter((docSnap) => {
        const data = docSnap.data();
        return !data.companyId || data.companyId === "";
      });

      if (legacyDocs.length > 0) {
        // Process in chunks of 500 (Firestore writeBatch limit)
        for (let i = 0; i < legacyDocs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = legacyDocs.slice(i, i + 500);

          chunk.forEach((docSnap) => {
            batch.update(docSnap.ref, {
              companyId: COMPANY_ID,
              atualizadoEm: serverTimestamp()
            });
          });

          await batch.commit();
          totalMigrated += chunk.length;
        }
      }
    } catch (error) {
      console.error(`Erro ao vincular dados da coleção ${colName}:`, error);
      throw error;
    }
  }

  return { totalMigrated };
}
