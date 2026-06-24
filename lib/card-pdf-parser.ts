import * as pdfjsLib from "pdfjs-dist";

// Configura o worker de forma amigável para o Vite e navegador
const pdfjsVersion = "4.10.38";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || pdfjsVersion}/pdf.worker.min.mjs`;

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

export interface ParsedItem {
  dataCompra: string; // "YYYY-MM-DD"
  nome: string;
  descricao: string;
  categoria: string;
  valor: number;
  parcelaAtual: number | null;
  totalParcelas: number | null;
  destino: "despesa_fixa" | "despesa_variavel" | "ignorar";
}

export function parseCardInvoiceText(text: string): ParsedItem[] {
  const lines = text.split(/[\n\r]+/);
  const items: ParsedItem[] = [];
  
  // Months list in Portuguese and English for textual dates
  const monthsPt = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const monthsEn = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  
  const currentYear = new Date().getFullYear();

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Skip lines that look like totals, payments, credits or headers to avoid noise
    const upperLine = line.toUpperCase();
    if (
      upperLine.includes("PAGAMENTO") || 
      upperLine.includes("FATURA ANTERIOR") || 
      upperLine.includes("SALDO ANTERIOR") || 
      upperLine.includes("CREDITO") || 
      upperLine.includes("CRÉDITO") || 
      upperLine.includes("TOTAL DA FATURA") || 
      upperLine.includes("VENCIMENTO") ||
      upperLine.includes("LIMITE DE CREDITO") ||
      upperLine.includes("LIMITE DE CRÉDITO") ||
      upperLine.includes("COMPROVANTE")
    ) {
      continue;
    }

    // Regexp to extract money values (e.g. R$ 120,50 or 45,90 or 1.120,50)
    const valueRegex = /(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})/gi;
    const valueMatches: RegExpExecArray[] = [];
    let match;
    while ((match = valueRegex.exec(line)) !== null) {
      valueMatches.push(match);
    }

    if (valueMatches.length === 0) continue;

    // Use the last value match as it's typically the transaction price on a row
    const valMatch = valueMatches[valueMatches.length - 1];
    const valStr = valMatch[1].replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(valStr);

    if (isNaN(valor) || valor <= 0) continue; // Skip credit rewards or 0

    const valueIndex = valMatch.index;
    const beforeValue = line.substring(0, valueIndex).trim();

    // Find date
    // Pattern 1: DD/MM or DD/MM/YYYY
    const slashDateRegex = /\b(\d{2})[\/\-](\d{2})(?:[\/\-](\d{4}))?\b/;
    // Pattern 2: DD MMM or DD de MMM
    const wordPtMonthPattern = new RegExp(`\\b(\\d{2})\\s*(?:de\\s+)?(${monthsPt.join("|")})[a-z]*\\b`, "i");
    const wordEnMonthPattern = new RegExp(`\\b(\\d{2})\\s*(${monthsEn.join("|")})[a-z]*\\b`, "i");

    let dataCompra = "";
    let cleanText = beforeValue;

    const slashMatch = slashDateRegex.exec(beforeValue);
    if (slashMatch) {
      const day = slashMatch[1];
      const month = slashMatch[2];
      const year = slashMatch[3] || String(currentYear);
      dataCompra = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      cleanText = beforeValue.replace(slashDateRegex, "").trim();
    } else {
      const ptMonthMatch = wordPtMonthPattern.exec(beforeValue);
      if (ptMonthMatch) {
        const day = ptMonthMatch[1];
        const monthWord = ptMonthMatch[2].toLowerCase();
        const monthNum = monthsPt.indexOf(monthWord) + 1;
        dataCompra = `${currentYear}-${String(monthNum).padStart(2, "0")}-${day.padStart(2, "0")}`;
        cleanText = beforeValue.replace(wordPtMonthPattern, "").trim();
      } else {
        const enMonthMatch = wordEnMonthPattern.exec(beforeValue);
        if (enMonthMatch) {
          const day = enMonthMatch[1];
          const monthWord = enMonthMatch[2].toLowerCase();
          const monthNum = monthsEn.indexOf(monthWord) + 1;
          dataCompra = `${currentYear}-${String(monthNum).padStart(2, "0")}-${day.padStart(2, "0")}`;
          cleanText = beforeValue.replace(wordEnMonthPattern, "").trim();
        }
      }
    }

    if (!dataCompra) {
      // Default to today if date isn't found on the line
      const today = new Date();
      dataCompra = today.toISOString().split("T")[0];
    }

    // Parse installments (e.g., 2/3 or 02/03 or 2 de 3)
    let parcelaAtual: number | null = null;
    let totalParcelas: number | null = null;
    
    const parcelasRegex = /\b(\d{1,2})[\/\s]+de[\/\s]+(\d{1,2})\b|\b(\d{1,2})\/(\d{1,2})\b/i;
    const parcMatch = parcelasRegex.exec(cleanText);
    if (parcMatch) {
      if (parcMatch[1] && parcMatch[2]) {
        parcelaAtual = parseInt(parcMatch[1]);
        totalParcelas = parseInt(parcMatch[2]);
      } else if (parcMatch[3] && parcMatch[4]) {
        parcelaAtual = parseInt(parcMatch[3]);
        totalParcelas = parseInt(parcMatch[4]);
      }
      cleanText = cleanText.replace(parcelasRegex, "").trim();
    }

    // Clean up description
    let nome = cleanText
      .replace(/^[\s\-\*\•\>]+/g, "")
      .replace(/[\s\-\*\•\>]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!nome || nome.length < 2) {
      nome = "Compra Cartão";
    }

    // Clean common prefixes
    nome = nome
      .replace(/^IFD\*/i, "iFood - ")
      .replace(/^IFOOD\*/i, "iFood - ")
      .replace(/^UBR\*/i, "Uber - ")
      .replace(/^UBER\*/i, "Uber - ")
      .replace(/^PAG\*/i, "")
      .replace(/^MP\*/i, "")
      .replace(/^PAYPAL\*/i, "");

    nome = nome.trim();
    if (!nome) nome = "Compra Cartão";

    // Suggest category
    let categoria = "Outros";
    const nomeLower = nome.toLowerCase();

    const categoryKeywords: { [cat: string]: string[] } = {
      "Alimentação": ["supermercado", "mercado", "carrefour", "pao de acucar", "extra", "dia%", "restaurante", "ifood", "uber eats", "lanchonete", "padaria", "cafe", "pizzaria", "burger", "mcdonald", "outback", "bk", "churrascaria", "gourmet", "snack", "doceria", "confeitaria"],
      "Transporte": ["uber", "99app", "99", "taxi", "posto", "combustivel", "gasolina", "petrobras", "shell", "ipiranga", "pedagio", "metro", "onibus", "movida", "localiza", "estacionamento", "zona azul"],
      "Moradia": ["aluguel", "condominio", "luz", "agua", "gas", "energia", "sabesp", "enel", "light", "vivo", "claro", "tim", "netcombo", "sky", "leroy", "tok&stok", "casa", "decoracao"],
      "Assinaturas & Software": ["netflix", "spotify", "aws", "github", "google", "adobe", "microsoft", "canva", "chatgpt", "openai", "apple", "figma", "notion", "zoom", "vimeo", "heroku", "cloudflare", "hosting", "godaddy", "hospedagem", "assinatura", "mensalidade", "software", "cloud"],
      "Lazer & Entretenimento": ["cinema", "show", "teatro", "viagem", "hotel", "airbnb", "decolar", "bar", "pub", "festa", "ingresso", "steam", "playstation", "xbox", "nintendo", "jogos", "shopee", "aliexpress", "shein", "amazon"],
      "Saúde": ["farmacia", "drogaria", "pague menos", "drogasil", "raia", "sao paulo", "hospital", "consulta", "medico", "dentista", "exames", "unimed", "pilates", "academia", "smartfit"],
      "Educação": ["faculdade", "escola", "curso", "livros", "livraria", "udemy", "hotmart", "alura", "ingles", "colegio"]
    };

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => nomeLower.includes(keyword))) {
        categoria = cat;
        break;
      }
    }

    // Determine default destination ("despesa_fixa" or "despesa_variavel")
    const fixedKeywords = ["netflix", "spotify", "aws", "github", "google", "adobe", "microsoft", "canva", "chatgpt", "notion", "zoom", "aluguel", "mensalidade", "software", "assinatura", "hospedagem", "cloudflare", "telefonia", "tim", "vivo", "claro", "copasa", "sanepar", "enel", "coelba"];
    let destino: "despesa_fixa" | "despesa_variavel" = "despesa_variavel";
    if (fixedKeywords.some(keyword => nomeLower.includes(keyword))) {
      destino = "despesa_fixa";
    }

    items.push({
      dataCompra,
      nome,
      descricao: "Importado da fatura do cartão",
      categoria,
      valor,
      parcelaAtual,
      totalParcelas,
      destino
    });
  }

  return items;
}
