import Papa from "papaparse";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import { ImportInvoiceResult, ParsedCardItem } from "@/types/finance";

// Configure pdfjs worker to avoid errors
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "3.11.174"}/pdf.worker.min.js`;
}

/**
 * Helper to clean and parse values from BR Currency (e.g. "R$ 4.646,53" or "R$ -6.746,52" or "1.019,50")
 */
export function parseCurrencyBR(value: string | number): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  
  let str = String(value).trim();
  // Remove currency symbol, spaces, non-breaking spaces
  str = str.replace(/R\$\s*/g, "").replace(/\s/g, "");
  
  // Identify if it's negative or positive
  const isNegative = str.includes("-");
  str = str.replace("-", "");

  // For BR formatting, dot is thousands separator and comma is decimal
  // If we have commas and dots, remove dots and replace comma with dot
  // e.g. "4.646,53" -> "4646.53"
  if (str.includes(",") && str.includes(".")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    // Only comma, e.g. "24,00" -> "24.00"
    str = str.replace(",", ".");
  } else if (str.includes(".")) {
    // Check if dot is thousands or decimal
    // If dot is followed by 2 digits at the end, it might be US style decimal "24.00"
    // But in Brazilian bank exports, a single dot with 2 decimal digits can also appear.
    // We treat dot as decimal if there is no comma and only one dot, and it fits XX.XX
    const parts = str.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      // e.g. "1.019" -> thousands.
      str = str.replace(".", "");
    }
  }

  const num = parseFloat(str) || 0;
  return isNegative ? -num : num;
}

/**
 * Helper to parse dates in format DD/MM/YYYY or YYYY-MM-DD
 */
export function parseDateBR(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (!value) return new Date();

  const str = String(value).trim();
  
  // DD/MM/YYYY or DD/MM/YY
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000; // expand YY to YYYY
      return new Date(year, month, day);
    }
  }
  
  // YYYY-MM-DD
  if (str.includes("-")) {
    const parts = str.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }

  const parsed = Date.parse(str);
  return isNaN(parsed) ? new Date() : new Date(parsed);
}

/**
 * Parses installment notation (e.g., "(01/10)" or "01/10" or "1/10")
 */
export function parseInstallment(value: string | null | undefined): {
  parcelaAtual: number | null;
  totalParcelas: number | null;
  parcelado: boolean;
} {
  if (!value) {
    return { parcelaAtual: null, totalParcelas: null, parcelado: false };
  }
  
  const str = String(value).trim();
  // Extract patterns like "01/10" or "(02/03)" or "2 de 3"
  const regex = /(\d+)\s*[\/|\\]\s*(\d+)/;
  const match = str.match(regex);
  if (match) {
    const parcelaAtual = parseInt(match[1], 10);
    const totalParcelas = parseInt(match[2], 10);
    return {
      parcelaAtual,
      totalParcelas,
      parcelado: totalParcelas > 1
    };
  }
  
  const textRegex = /(\d+)\s*(?:de|da|de\s+faturas)\s*(\d+)/i;
  const textMatch = str.match(textRegex);
  if (textMatch) {
    const parcelaAtual = parseInt(textMatch[1], 10);
    const totalParcelas = parseInt(textMatch[2], 10);
    return {
      parcelaAtual,
      totalParcelas,
      parcelado: totalParcelas > 1
    };
  }

  return { parcelaAtual: null, totalParcelas: null, parcelado: false };
}

/**
 * Smart category suggestion with base on keyword matching
 */
export function suggestCategory(description: string): string {
  const desc = String(description).toUpperCase();
  
  if (/FACEBK|META|GOOGLE ADS|ADS|FACEBOOK/i.test(desc)) {
    return "Anúncios";
  }
  if (/APPLE\.COM\/BILL|AWS|CLOUD|SOFTWARE|LICENÇA|LICENCA|SISTEMA|CODE|GITHUB|MICROSOFT|AZURE|HEROKU|DIGITALOCEAN|ZEIT|VERCEL|SLACK|ZOOM/i.test(desc)) {
    return "Sistema";
  }
  if (/MERCADO|MINIMERCADO|ATACADISTA|EMPORIO|PÃO DE AÇÚCAR|PAO DE ACUCAR|CARREFOUR|ASSAI|ZAFFARI|MUFFATO|CONDOR|COMPRA/i.test(desc)) {
    return "Alimentação ou Mercado";
  }
  if (/GAS|AGUA|ÁGUA|INTERNET|LINK|TELEFONE|TELECOM|COPEL|SANEPAR|ELETRO|ENERGIA|LUMI|CLARO|VIVO|TIM/i.test(desc)) {
    return "Despesa Fixa";
  }
  if (/RESTAURANTE|BAR|QUIOSQUE|MEAL|CHURRASCARIA|PADARIA|LANCHONETE|IFOOD|BURGER|MCDONALD|BK|DELIVERY|CAFE|CAFÉ/i.test(desc)) {
    return "Alimentação";
  }
  if (/MATERIAL|CONSTRUÇÃO|CONSTRUCAO|CASSOL|VEIGA MATERIAL|LEROY|CASAS|OBRA|TINTAS|FERRAGENS/i.test(desc)) {
    return "Material/Obra";
  }
  if (/POSTO|COMBUSTIVEL|COMBUSTÍVEL|SHELL|IPIRANGA|PETROBRAS|UBER|99Taxis|TAXI|PEDAGGIO|PEDAGIO|AUTO|ESTACIONAMENTO/i.test(desc)) {
    return "Transporte";
  }
  if (/FARMACIA|RAIA|DROGASIL|PANVEL|SAUDE|MEDICAMENTO|HOSPITAL|CLINICA|CONSULTORIO|ODONTO/i.test(desc)) {
    return "Saúde";
  }
  if (/PAGAMENTO|PAGT|DEB|PAGTO/i.test(desc)) {
    return "Pagamento Fatura";
  }
  if (/ESTORNO|CREDITO|CRED|DEV|REEMBOLSO/i.test(desc)) {
    return "Crédito/Estorno";
  }
  
  return "Outros";
}

/**
 * Smart destination suggestion based on description and values
 */
export function suggestDestination(
  description: string,
  value: number
): "despesa_fixa" | "despesa_variavel" | "ignorar" | "credito_estorno" | "pagamento_fatura" {
  const desc = String(description).toUpperCase();
  
  if (value < 0) {
    if (/PAGAMENTO|PGTO|PAGT|AUTOPAG/i.test(desc)) {
      return "pagamento_fatura";
    }
    return "credito_estorno";
  }

  if (/INTERNET|LINK|AWS|SOFTWARE|LICENÇA|LICENCA|APPLE\.COM\/BILL|SISTEMA|MENSALIDADE|ASSINATURA|RECORRENTE|NETFLIX|SPOTIFY|CONDOMINIO|ALUGUEL|COOP/i.test(desc)) {
    return "despesa_fixa";
  }
  
  return "despesa_variavel";
}

/**
 * Normalizes any card item to ensure consistent schema representation
 */
export function normalizeCardItem(
  item: Partial<ParsedCardItem> & { dataCompra: Date; descricao: string; valor: number }
): ParsedCardItem {
  const valorNum = item.valor;
  const dest = item.destino || suggestDestination(item.descricao, valorNum);
  const cat = item.categoriaSugerida || suggestCategory(item.descricao);
  
  // Extract installment info if parcelado is present or not parsed
  let installmentInfo = {
    parcelaAtual: item.parcelaAtual || null,
    totalParcelas: item.totalParcelas || null,
    parcelado: item.parcelado || false
  };

  if (!installmentInfo.parcelado && item.raw && (item.raw.Parcela || item.raw.parcela)) {
    const rawP = String(item.raw.Parcela || item.raw.parcela);
    installmentInfo = parseInstallment(rawP);
  }

  return {
    id: item.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    dataCompra: item.dataCompra,
    descricao: item.descricao,
    nome: item.nome || item.descricao,
    valor: valorNum,
    valorOriginal: item.valorOriginal || String(valorNum),
    parcelaAtual: installmentInfo.parcelaAtual,
    totalParcelas: installmentInfo.totalParcelas,
    parcelado: installmentInfo.parcelado,
    adicional: item.adicional || null,
    portadorNome: item.portadorNome || null,
    categoriaSugerida: cat,
    destino: dest,
    status: "pendente" as const,
    raw: item.raw || {},
    alreadyImported: item.alreadyImported || false
  };
}

/**
 * Detects the format of the file based on name or headers
 */
export function detectFileType(fileName: string, firstFewLines: string): "sicredi_csv" | "csv_generico" | "ofx" | "pdf" | "xlsx" | "unknown" {
  const nameLower = fileName.toLowerCase();
  
  if (nameLower.endsWith(".pdf")) return "pdf";
  if (nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls")) return "xlsx";
  if (nameLower.endsWith(".ofx")) return "ofx";
  
  if (nameLower.endsWith(".csv")) {
    // Check if it looks like a Sicredi export
    if (
      firstFewLines.includes("Associado ;") || 
      firstFewLines.includes("Cooperativa ;") || 
      firstFewLines.includes("Cartão Mastercard Black") ||
      (firstFewLines.includes("Data ; Descrição ; Parcela") || firstFewLines.includes("Data;Descrição;Parcela"))
    ) {
      return "sicredi_csv";
    }
    return "csv_generico";
  }

  // Fallback check on text content for OFX
  if (firstFewLines.includes("<OFX>") || firstFewLines.includes("OFXHEADER")) {
    return "ofx";
  }

  return "unknown";
}

/**
 * Parses custom Sicredi CSV export
 */
export function parseSicrediCsv(text: string): ImportInvoiceResult {
  const lines = text.split(/\r?\n/);
  
  // Extract metadata from early lines
  let associado = "";
  let cooperativa = "";
  let contaCorrente = "";
  let cartaoNome = "";
  let finalCartao = "";
  let dataVencimento: Date | undefined = undefined;
  let valorTotal = 0;
  let situacao = "";

  let tableHeaderIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const lowerLine = line.toLowerCase();
    
    // Check for metadata fields
    if (lowerLine.startsWith("associado ;") || lowerLine.startsWith("associado;")) {
      associado = line.split(";")[1]?.trim() || "";
    } else if (lowerLine.startsWith("cooperativa ;") || lowerLine.startsWith("cooperativa;")) {
      cooperativa = line.split(";")[1]?.trim() || "";
    } else if (lowerLine.startsWith("conta corrente ;") || lowerLine.startsWith("conta corrente;")) {
      contaCorrente = line.split(";")[1]?.trim() || "";
    } else if (lowerLine.includes("mastercard") || lowerLine.includes("visa") || lowerLine.includes("elo") || lowerLine.includes("black") || lowerLine.includes("gold") || lowerLine.includes("platinum")) {
      cartaoNome = line.replace(/;/g, " ").trim();
    } else if (/^\d{4}\.\d{2}XX\./.test(line) || /^\d{4}\s*\d{2}XX/.test(line)) {
      // Card numbers: e.g. 5122.67XX.XXXX.6117
      finalCartao = line.split(".").pop()?.trim() || line.trim();
    } else if (lowerLine.startsWith("data de vencimento ;") || lowerLine.startsWith("data de vencimento;")) {
      const dateStr = line.split(";")[1]?.trim() || "";
      dataVencimento = parseDateBR(dateStr);
    } else if (lowerLine.startsWith("valor total ;") || lowerLine.startsWith("valor total;")) {
      const valStr = line.split(";")[1]?.trim() || "";
      valorTotal = parseCurrencyBR(valStr);
    } else if (lowerLine.startsWith("situação ;") || lowerLine.startsWith("situação;")) {
      situacao = line.split(";")[1]?.trim() || "";
    }

    // Check if we hit table header
    // e.g. "Data ; Descrição ; Parcela ; Valor ; Valor em Dólar ; Adicional ; Nome"
    if (lowerLine.includes("descrição") && lowerLine.includes("valor")) {
      tableHeaderIndex = i;
    }
  }

  // If tableHeaderIndex not found, we fallback to guessing
  if (tableHeaderIndex === -1) {
    tableHeaderIndex = lines.findIndex(l => l.toLowerCase().includes("data") && l.toLowerCase().includes("valor"));
  }

  const csvRows = lines.slice(tableHeaderIndex !== -1 ? tableHeaderIndex : 0).join("\n");
  
  const parsed = Papa.parse(csvRows, {
    delimiter: ";",
    header: true,
    skipEmptyLines: "greedy",
  });

  const items: ParsedCardItem[] = [];

  const dataRows = parsed.data as Array<Record<string, string>>;
  for (const row of dataRows) {
    // Read cells, trimming keys and values
    const cleanedRow: Record<string, string> = {};
    Object.keys(row).forEach(key => {
      cleanedRow[key.trim()] = String(row[key] || "").trim();
    });

    const dateVal = cleanedRow["Data"] || cleanedRow["data"] || "";
    const descVal = cleanedRow["Descrição"] || cleanedRow["descricao"] || cleanedRow["Descrição;"] || "";
    const valVal = cleanedRow["Valor"] || cleanedRow["valor"] || "";
    
    if (!dateVal || !descVal || !valVal) continue;

    const dataCompra = parseDateBR(dateVal);
    const valor = parseCurrencyBR(valVal);
    const parcelaStr = cleanedRow["Parcela"] || cleanedRow["parcela"] || "";
    const nameVal = cleanedRow["Nome"] || cleanedRow["nome"] || cleanedRow["Portador"] || "";

    const instInfo = parseInstallment(parcelaStr);

    const item = normalizeCardItem({
      dataCompra,
      descricao: descVal,
      nome: descVal,
      valor,
      valorOriginal: valVal,
      parcelaAtual: instInfo.parcelaAtual,
      totalParcelas: instInfo.totalParcelas,
      parcelado: instInfo.parcelado,
      adicional: cleanedRow["Adicional"] || null,
      portadorNome: nameVal || null,
      raw: cleanedRow
    });

    items.push(item);
  }

  return {
    metadata: {
      associado: associado || undefined,
      cooperativa: cooperativa || undefined,
      contaCorrente: contaCorrente || undefined,
      cartaoNome: cartaoNome || "Sicredi Mastercard",
      finalCartao: finalCartao || undefined,
      dataVencimento,
      valorTotal: valorTotal || undefined,
      situacao: situacao || undefined,
      bancoDetectado: "Sicredi",
      formatoDetectado: "sicredi_csv"
    },
    items
  };
}

/**
 * Parses generic CSV
 */
export function parseGenericCsv(text: string): ImportInvoiceResult {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
  });

  const items: ParsedCardItem[] = [];
  const dataRows = parsed.data as Array<Record<string, string>>;

  for (const row of dataRows) {
    const cleanedRow: Record<string, string> = {};
    Object.keys(row).forEach(key => {
      cleanedRow[key.trim()] = String(row[key] || "").trim();
    });

    // Find date field
    const dateKey = Object.keys(cleanedRow).find(k => /data|date/i.test(k));
    const descKey = Object.keys(cleanedRow).find(k => /desc|hist|estab|descrição|descricao|estabelecimento/i.test(k));
    const valKey = Object.keys(cleanedRow).find(k => /valor|val|amount|total/i.test(k));
    const parcKey = Object.keys(cleanedRow).find(k => /parc|prest|parcela/i.test(k));
    const portadorKey = Object.keys(cleanedRow).find(k => /portador|nome|name/i.test(k));

    if (!dateKey || !descKey || !valKey) continue;

    const dateVal = cleanedRow[dateKey];
    const descVal = cleanedRow[descKey];
    const valVal = cleanedRow[valKey];

    if (!dateVal || !descVal || !valVal) continue;

    const dataCompra = parseDateBR(dateVal);
    const valor = parseCurrencyBR(valVal);
    const parcelaStr = parcKey ? cleanedRow[parcKey] : "";
    const portadorVal = portadorKey ? cleanedRow[portadorKey] : "";

    const instInfo = parseInstallment(parcelaStr);

    const item = normalizeCardItem({
      dataCompra,
      descricao: descVal,
      nome: descVal,
      valor,
      valorOriginal: valVal,
      parcelaAtual: instInfo.parcelaAtual,
      totalParcelas: instInfo.totalParcelas,
      parcelado: instInfo.parcelado,
      portadorNome: portadorVal || null,
      raw: cleanedRow
    });

    items.push(item);
  }

  return {
    metadata: {
      cartaoNome: "Cartão de Crédito",
      bancoDetectado: "Genérico",
      formatoDetectado: "csv_generico"
    },
    items
  };
}

/**
 * Parses OFX file
 */
export function parseOfxInvoice(text: string): ImportInvoiceResult {
  const items: ParsedCardItem[] = [];
  
  // Basic OFX text tag matching
  const transRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  
  while ((match = transRegex.exec(text)) !== null) {
    const block = match[1];
    
    const trntype = block.match(/<TRNTYPE>(.*)/i)?.[1]?.trim() || "";
    const dtposted = block.match(/<DTPOSTED>(.*)/i)?.[1]?.trim() || "";
    const trnamt = block.match(/<TRNAMT>(.*)/i)?.[1]?.trim() || "";
    const fitid = block.match(/<FITID>(.*)/i)?.[1]?.trim() || "";
    const memo = block.match(/<MEMO>(.*)/i)?.[1]?.trim() || "";
    const name = block.match(/<NAME>(.*)/i)?.[1]?.trim() || "";
    
    if (!dtposted || !trnamt) continue;

    // Parse OFX Date: YYYYMMDDHHMMSS
    let dataCompra = new Date();
    if (dtposted.length >= 8) {
      const year = parseInt(dtposted.substring(0, 4), 10);
      const month = parseInt(dtposted.substring(4, 6), 10) - 1;
      const day = parseInt(dtposted.substring(6, 8), 10);
      dataCompra = new Date(year, month, day);
    }

    // OFX values: decimal dot, can be negative e.g. "-125.40"
    // Usually, in OFX, credit card transactions are NEGATIVE because they reduce card limit / are charges.
    // Wait! Let's understand that OFX specification says:
    // Expenses/charges in Credit Cards are usually negative. But our client requested:
    // "Se valor for positivo: Considerar como compra/despesa. Se valor for negativo: Classificar como estorno/pagamento."
    // So we need to reverse the sign of OFX card charges!
    // Let's verify: in OFX, if it's a charge (DEBIT), the value is negative.
    // If it's a credit card statement OFX, charges are indeed negative.
    // We should convert a negative value to positive, and positive to negative so it matches BR standards where purchases are positive.
    let rawVal = parseFloat(trnamt) || 0;
    // Reverse the sign of standard OFX card charges
    const valor = -rawVal;

    const desc = memo || name || "Lançamento OFX";
    const instInfo = parseInstallment(desc);

    const item = normalizeCardItem({
      id: fitid || undefined,
      dataCompra,
      descricao: desc,
      nome: desc,
      valor,
      valorOriginal: trnamt,
      parcelaAtual: instInfo.parcelaAtual,
      totalParcelas: instInfo.totalParcelas,
      parcelado: instInfo.parcelado,
      raw: { trntype, dtposted, trnamt, fitid, memo, name }
    });

    items.push(item);
  }

  return {
    metadata: {
      cartaoNome: "Cartão de Crédito",
      bancoDetectado: "OFX Import",
      formatoDetectado: "ofx"
    },
    items
  };
}

/**
 * Parses XLSX/XLS using xlsx
 */
export async function parseExcelInvoice(file: File): Promise<ImportInvoiceResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error("Não foi possível ler os dados do arquivo.");
        }
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to json array
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Find header row or guess columns
        // Standard headers: Data, Descrição, Valor, Parcela, etc.
        let headerRowIndex = -1;
        let colIndexes = {
          date: -1,
          desc: -1,
          val: -1,
          parc: -1,
          name: -1
        };

        for (let r = 0; r < Math.min(rawRows.length, 30); r++) {
          const row = rawRows[r];
          if (!row || !row.length) continue;
          
          const dIdx = row.findIndex(c => c && /data|date/i.test(String(c)));
          const deIdx = row.findIndex(c => c && /desc|hist|estab|descrição|descricao|estabelecimento/i.test(String(c)));
          const vIdx = row.findIndex(c => c && /valor|val|amount|total/i.test(String(c)));
          
          if (dIdx !== -1 && deIdx !== -1 && vIdx !== -1) {
            headerRowIndex = r;
            colIndexes.date = dIdx;
            colIndexes.desc = deIdx;
            colIndexes.val = vIdx;
            colIndexes.parc = row.findIndex(c => c && /parc|prest|parcela/i.test(String(c)));
            colIndexes.name = row.findIndex(c => c && /portador|nome|name/i.test(String(c)));
            break;
          }
        }

        // Fallback guess: columns 0, 1, 2
        if (headerRowIndex === -1) {
          headerRowIndex = 0;
          colIndexes.date = 0;
          colIndexes.desc = 1;
          colIndexes.val = 2;
        }

        const items: ParsedCardItem[] = [];

        for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length <= Math.max(colIndexes.date, colIndexes.desc, colIndexes.val)) continue;

          const rawDate = row[colIndexes.date];
          const rawDesc = row[colIndexes.desc];
          const rawVal = row[colIndexes.val];

          if (!rawDate || !rawDesc || rawVal === undefined || rawVal === null) continue;

          const dataCompra = parseDateBR(String(rawDate));
          const valor = parseCurrencyBR(rawVal);
          const rawParc = colIndexes.parc !== -1 ? String(row[colIndexes.parc] || "") : "";
          const rawName = colIndexes.name !== -1 ? String(row[colIndexes.name] || "") : "";

          const instInfo = parseInstallment(rawParc);

          const item = normalizeCardItem({
            dataCompra,
            descricao: String(rawDesc),
            nome: String(rawDesc),
            valor,
            valorOriginal: String(rawVal),
            parcelaAtual: instInfo.parcelaAtual,
            totalParcelas: instInfo.totalParcelas,
            parcelado: instInfo.parcelado,
            portadorNome: rawName || null,
            raw: { row }
          });

          items.push(item);
        }

        resolve({
          metadata: {
            cartaoNome: "Cartão de Crédito",
            bancoDetectado: "Importado via Excel",
            formatoDetectado: "xlsx"
          },
          items
        });

      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo Excel"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses PDF text content to locate card transactions using generic pattern match
 */
export async function parsePdfInvoice(file: File): Promise<ImportInvoiceResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  const items: ParsedCardItem[] = [];
  
  // Look for transactions in the format: DD/MM/YYYY Description Amount or DD/MM Description Amount
  // matches e.g. "24/06/2026 FORXITE GAS E AGUA 24,00" or "24/06/2026 FORXITE GAS E AGUA R$ 24,00"
  // or negative values "-24,00" or "R$ -24,00"
  // and checks for installments: e.g. "CASSOL (02/03) 1.019,50" or "CASSOL 02/03 1.019,50"
  const lines = fullText.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern matching Date at start: DD/MM/YYYY or DD/MM
    const dateRegex = /^(\d{2}\/\d{2}(?:\/\d{4})?)\s+(.+?)\s+([R$-]*\s*-?\d+(?:\.\d{3})*(?:,\d{2}))(?:\s|$)/i;
    const match = trimmed.match(dateRegex);
    
    if (match) {
      const dateStr = match[1];
      const rest = match[2].trim();
      const valStr = match[3];

      // Parse date
      let dataCompra = parseDateBR(dateStr);
      // Parse value
      const valor = parseCurrencyBR(valStr);

      // Extract installment and cleaned description
      const instInfo = parseInstallment(rest);
      
      // Remove installment info from description for cleaner display
      let cleanedDesc = rest.replace(/\(\d+\/\d+\)/g, "").replace(/\d+\/\d+/g, "").replace(/\s+/g, " ").trim();
      if (!cleanedDesc) cleanedDesc = rest;

      const item = normalizeCardItem({
        dataCompra,
        descricao: cleanedDesc,
        nome: cleanedDesc,
        valor,
        valorOriginal: valStr,
        parcelaAtual: instInfo.parcelaAtual,
        totalParcelas: instInfo.totalParcelas,
        parcelado: instInfo.parcelado,
        raw: { line: trimmed }
      });

      items.push(item);
    }
  }

  return {
    metadata: {
      cartaoNome: "Cartão de Crédito",
      bancoDetectado: "Importado via PDF",
      formatoDetectado: "pdf"
    },
    items
  };
}

/**
 * Universal Entry Point
 */
export async function parseCardInvoiceFile(file: File): Promise<ImportInvoiceResult> {
  const fileName = file.name;
  
  // Check extension or structure
  if (fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls")) {
    return parseExcelInvoice(file);
  }

  if (fileName.toLowerCase().endsWith(".pdf")) {
    return parsePdfInvoice(file);
  }

  // Read first few lines of text to determine type
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error("Não foi possível ler o arquivo.");
        }
        
        const firstFewLines = text.substring(0, 1000);
        const fileType = detectFileType(fileName, firstFewLines);
        
        if (fileType === "sicredi_csv") {
          resolve(parseSicrediCsv(text));
        } else if (fileType === "ofx") {
          resolve(parseOfxInvoice(text));
        } else if (fileType === "csv_generico" || fileName.toLowerCase().endsWith(".csv") || fileName.toLowerCase().endsWith(".txt")) {
          resolve(parseGenericCsv(text));
        } else {
          reject(new Error("Formato do arquivo não suportado. Envie CSV, PDF, XLS/XLSX ou OFX."));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo de texto."));
    reader.readAsText(file);
  });
}
