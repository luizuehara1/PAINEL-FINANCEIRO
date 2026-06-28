import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  DocumentData,
  QuerySnapshot
} from "firebase/firestore";
import { db } from "./firebase";
import { COMPANY_ID } from "./app-config";
import { debugFinance, errorFinance } from "./debug";

/**
 * Helper to fetch a complete Firestore collection for general finance records.
 */
export async function fetchCollectionDocs(collectionName: string): Promise<DocumentData[]> {
  try {
    const colRef = collection(db, "financeiro", "geral", collectionName);
    const snapshot = await getDocs(colRef);
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    debugFinance(`Fetched raw collection "${collectionName}"`, { count: docs.length });
    return docs;
  } catch (error) {
    errorFinance(`Error fetching collection "${collectionName}"`, error);
    return [];
  }
}

/**
 * Setup live listener for a collection.
 */
export function listenCollectionDocs(
  collectionName: string, 
  onUpdate: (docs: DocumentData[]) => void
): () => void {
  const colRef = collection(db, "financeiro", "geral", collectionName);
  
  return onSnapshot(colRef, 
    (snapshot: QuerySnapshot<DocumentData>) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      debugFinance(`Live snapshot update for "${collectionName}"`, { count: docs.length });
      onUpdate(docs);
    },
    (error) => {
      errorFinance(`Error listening to collection "${collectionName}"`, error);
    }
  );
}
