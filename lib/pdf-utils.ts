import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Transaction, Expense, CardInvoice, CardItem, CreditCard } from "@/types/finance";

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Common style generator for PDF
function applyStyles(doc: jsPDF, title: string, subtitle: string, userEmail: string) {
  const pageCount = doc.getNumberOfPages();
  const today = new Date().toLocaleString("pt-BR");

  // Top header bar (dark)
  doc.setFillColor(18, 18, 20); // zinc-900
  doc.rect(0, 0, doc.internal.pageSize.width, 35, "F");

  // Accent Line (Emerald)
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 35, doc.internal.pageSize.width, 2, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 20);

  // Subtitle / Brand
  doc.setFontSize(10);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.setFont("helvetica", "italic");
  doc.text(subtitle, 14, 28);

  // Metadata block (top-right)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170); // zinc-400
  doc.text(`Gerado por: ${userEmail}`, doc.internal.pageSize.width - 14, 15, { align: "right" });
  doc.text(`Emissão: ${today}`, doc.internal.pageSize.width - 14, 22, { align: "right" });
  doc.text("Painel Financeiro SaaS", doc.internal.pageSize.width - 14, 29, { align: "right" });
}

function applyFooter(doc: jsPDF, userEmail: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const today = new Date().toLocaleDateString("pt-BR");
    
    // Bottom thin line
    doc.setDrawColor(228, 228, 231); // zinc-200
    doc.setLineWidth(0.5);
    doc.line(14, doc.internal.pageSize.height - 15, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122); // zinc-500
    doc.text("Gerado automaticamente pelo Painel Financeiro", 14, doc.internal.pageSize.height - 10);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 10, { align: "right" });
  }
}

export function exportTransactionsPDF(transactions: Transaction[], filtersInfo: string, userEmail: string) {
  const doc = new jsPDF();
  applyStyles(doc, "Relatório de Entradas e Saídas", "Fluxo de Caixa Consolidado", userEmail);

  // Filter & Summary block
  doc.setTextColor(24, 24, 27); // zinc-900
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Filtros Aplicados:", 14, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(filtersInfo || "Nenhum filtro ativo.", 14, 54);

  // Calculations
  const totalEntradas = transactions.filter((t) => t.tipo === "entrada").reduce((sum, t) => sum + t.valor, 0);
  const totalSaidas = transactions.filter((t) => t.tipo === "saida").reduce((sum, t) => sum + t.valor, 0);
  const saldoPeriodo = totalEntradas - totalSaidas;

  // Summary Cards visual boxes
  doc.setFillColor(244, 244, 245); // zinc-100
  doc.roundedRect(14, 62, 55, 20, 3, 3, "F");
  doc.roundedRect(77, 62, 55, 20, 3, 3, "F");
  doc.roundedRect(140, 62, 55, 20, 3, 3, "F");

  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122); // zinc-500
  doc.text("TOTAL ENTRADAS", 18, 68);
  doc.text("TOTAL SAÍDAS", 81, 68);
  doc.text("SALDO PERÍODO", 144, 68);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(formatCurrencyBRL(totalEntradas), 18, 76);
  doc.setTextColor(239, 68, 68); // red-500
  doc.text(formatCurrencyBRL(totalSaidas), 81, 76);
  if (saldoPeriodo >= 0) {
    doc.setTextColor(16, 185, 129); // emerald-600
  } else {
    doc.setTextColor(239, 68, 68); // red-500
  }
  doc.text(formatCurrencyBRL(saldoPeriodo), 144, 76);

  // Table Data
  const tableBody = transactions.length > 0 
    ? transactions.map(t => [
        formatDateBR(t.data),
        t.tipo === "entrada" ? "ENTRADA" : "SAÍDA",
        t.nome,
        t.categoria,
        t.formaPagamento,
        formatCurrencyBRL(t.valor),
        t.descricao || "-"
      ])
    : [["Nenhum registro encontrado para este período.", "", "", "", "", "", ""]];

  autoTable(doc, {
    startY: 90,
    head: [["Data", "Tipo", "Nome", "Categoria", "Forma Pagto.", "Valor", "Descrição"]],
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: [18, 18, 20],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold"
    },
    bodyStyles: {
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 20 },
      2: { cellWidth: 35 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
      6: { cellWidth: "auto" }
    },
    didParseCell: (data) => {
      if (data.row.section === "body" && data.column.index === 1) {
        if (data.cell.text[0] === "ENTRADA") {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (data.cell.text[0] === "SAÍDA") {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    }
  });

  applyFooter(doc, userEmail);
  doc.save(`entradas_saidas_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportFixedExpensesPDF(expenses: Expense[], filtersInfo: string, userEmail: string) {
  const doc = new jsPDF();
  applyStyles(doc, "Relatório de Despesas Fixas", "Obrigações e Compromissos Recorrentes", userEmail);

  // Filter & Summary block
  doc.setTextColor(24, 24, 27); // zinc-900
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Filtros Aplicados:", 14, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(filtersInfo || "Nenhum filtro ativo.", 14, 54);

  // Calculations
  const totalVal = expenses.reduce((sum, e) => sum + e.valor, 0);
  const totalPagas = expenses.filter((e) => e.status === "pago").reduce((sum, e) => sum + e.valor, 0);
  const totalPendentes = expenses.filter((e) => e.status !== "pago").reduce((sum, e) => sum + e.valor, 0);

  // Visual summary cards
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(14, 62, 55, 20, 3, 3, "F");
  doc.roundedRect(77, 62, 55, 20, 3, 3, "F");
  doc.roundedRect(140, 62, 55, 20, 3, 3, "F");

  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  doc.text("VALOR TOTAL", 18, 68);
  doc.text("TOTAL PAGAS", 81, 68);
  doc.text("TOTAL PENDENTES", 144, 68);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27);
  doc.text(formatCurrencyBRL(totalVal), 18, 76);
  doc.setTextColor(16, 185, 129);
  doc.text(formatCurrencyBRL(totalPagas), 81, 76);
  doc.setTextColor(239, 68, 68);
  doc.text(formatCurrencyBRL(totalPendentes), 144, 76);

  // Table Data
  const tableBody = expenses.length > 0
    ? expenses.map(e => [
        formatDateBR(e.dataVencimento),
        e.competencia || "-",
        e.nome,
        e.categoria,
        e.formaPagamento,
        formatCurrencyBRL(e.valor),
        e.status === "pago" ? "PAGO" : "PENDENTE",
        e.recorrente ? "SIM" : "NÃO",
        e.descricao || "-"
      ])
    : [["Nenhum registro encontrado para este período.", "", "", "", "", "", "", "", ""]];

  autoTable(doc, {
    startY: 90,
    head: [["Vencimento", "Competência", "Nome", "Categoria", "Forma Pagto.", "Valor", "Status", "Recor.", "Descrição"]],
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: [18, 18, 20],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold"
    },
    bodyStyles: {
      fontSize: 7.5
    },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 18 },
      2: { cellWidth: 32 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 18 },
      7: { cellWidth: 12 },
      8: { cellWidth: "auto" }
    },
    didParseCell: (data) => {
      if (data.row.section === "body" && data.column.index === 6) {
        if (data.cell.text[0] === "PAGO") {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (data.cell.text[0] === "PENDENTE") {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    }
  });

  applyFooter(doc, userEmail);
  doc.save(`despesas_fixas_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportVariableExpensesPDF(expenses: Expense[], filtersInfo: string, userEmail: string) {
  const doc = new jsPDF();
  applyStyles(doc, "Relatório de Despesas Variáveis", "Custos Flutuantes e Pontuais", userEmail);

  // Filter & Summary block
  doc.setTextColor(24, 24, 27);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Filtros Aplicados:", 14, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(filtersInfo || "Nenhum filtro ativo.", 14, 54);

  // Calculations
  const totalVal = expenses.reduce((sum, e) => sum + e.valor, 0);
  const totalPagas = expenses.filter((e) => e.status === "pago").reduce((sum, e) => sum + e.valor, 0);
  const totalPendentes = expenses.filter((e) => e.status !== "pago").reduce((sum, e) => sum + e.valor, 0);

  // Visual summary cards
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(14, 62, 55, 20, 3, 3, "F");
  doc.roundedRect(77, 62, 55, 20, 3, 3, "F");
  doc.roundedRect(140, 62, 55, 20, 3, 3, "F");

  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  doc.text("VALOR TOTAL", 18, 68);
  doc.text("TOTAL PAGAS", 81, 68);
  doc.text("TOTAL PENDENTES", 144, 68);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27);
  doc.text(formatCurrencyBRL(totalVal), 18, 76);
  doc.setTextColor(16, 185, 129);
  doc.text(formatCurrencyBRL(totalPagas), 81, 76);
  doc.setTextColor(239, 68, 68);
  doc.text(formatCurrencyBRL(totalPendentes), 144, 76);

  // Table Data
  const tableBody = expenses.length > 0
    ? expenses.map(e => [
        formatDateBR(e.data),
        e.nome,
        e.categoria,
        e.formaPagamento,
        formatCurrencyBRL(e.valor),
        e.status === "pago" ? "PAGO" : "PENDENTE",
        e.descricao || "-"
      ])
    : [["Nenhum registro encontrado para este período.", "", "", "", "", "", ""]];

  autoTable(doc, {
    startY: 90,
    head: [["Data", "Nome", "Categoria", "Forma Pagto.", "Valor", "Status", "Descrição"]],
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: [18, 18, 20],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold"
    },
    bodyStyles: {
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
      6: { cellWidth: "auto" }
    },
    didParseCell: (data) => {
      if (data.row.section === "body" && data.column.index === 5) {
        if (data.cell.text[0] === "PAGO") {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (data.cell.text[0] === "PENDENTE") {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    }
  });

  applyFooter(doc, userEmail);
  doc.save(`despesas_variaveis_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportOverviewPDF(
  transactions: Transaction[], 
  expenses: Expense[], 
  selectedMonth: string, 
  userEmail: string
) {
  const doc = new jsPDF();
  applyStyles(doc, "Resumo Geral Financeiro", `Relatório Executivo Mensal - Competência ${selectedMonth || "Consolidado"}`, userEmail);

  // Calculations
  const totalEntradas = transactions.filter((t) => t.tipo === "entrada").reduce((sum, t) => sum + t.valor, 0);
  const totalSaidas = transactions.filter((t) => t.tipo === "saida").reduce((sum, t) => sum + t.valor, 0);
  const totalDespesasPagas = expenses.filter((e) => e.status === "pago").reduce((sum, e) => sum + e.valor, 0);
  const totalDespesasFixas = expenses.filter((e) => e.tipo === "fixa").reduce((sum, e) => sum + e.valor, 0);
  const totalDespesasVariaveis = expenses.filter((e) => e.tipo === "variavel").reduce((sum, e) => sum + e.valor, 0);
  
  const saldoAtual = totalEntradas - totalSaidas - totalDespesasPagas;
  const totalDespesasGeral = expenses.reduce((sum, e) => sum + e.valor, 0);
  const resultadoMes = totalEntradas - totalSaidas - totalDespesasGeral;

  const todayStr = new Date().toISOString().split("T")[0];
  const despesasVencidas = expenses.filter((e) => e.tipo === "fixa" && e.status !== "pago" && e.dataVencimento < todayStr);
  const totalDespesasVencidas = despesasVencidas.reduce((sum, e) => sum + e.valor, 0);

  const vencemHoje = expenses.filter((e) => e.status !== "pago" && (e.dataVencimento === todayStr || e.data === todayStr));
  const totalVencemHoje = vencemHoje.reduce((sum, e) => sum + e.valor, 0);

  // Big Dashboard Visual
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(14, 45, 85, 18, 2, 2, "F");
  doc.roundedRect(111, 45, 85, 18, 2, 2, "F");

  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  doc.text("SALDO ATUAL CONSOLIDADO", 18, 51);
  doc.text("RESULTADO LIQUIDO PROJETADO", 115, 51);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(formatCurrencyBRL(saldoAtual), 18, 58);
  if (resultadoMes >= 0) {
    doc.setTextColor(16, 185, 129); // emerald-600
  } else {
    doc.setTextColor(239, 68, 68); // red-500
  }
  doc.text(formatCurrencyBRL(resultadoMes), 115, 58);

  // 4 Cards grid below
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(14, 70, 42, 16, 2, 2, "F");
  doc.roundedRect(61, 70, 42, 16, 2, 2, "F");
  doc.roundedRect(108, 70, 42, 16, 2, 2, "F");
  doc.roundedRect(155, 70, 42, 16, 2, 2, "F");

  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.setFont("helvetica", "normal");
  doc.text("TOTAL RECEITAS", 17, 75);
  doc.text("DESPESAS FIXAS", 64, 75);
  doc.text("DESPESAS VARIÁVEIS", 111, 75);
  doc.text("CUSTOS VENCIDOS", 158, 75);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(formatCurrencyBRL(totalEntradas), 17, 82);
  doc.setTextColor(245, 158, 11);
  doc.text(formatCurrencyBRL(totalDespesasFixas), 64, 82);
  doc.setTextColor(59, 130, 246);
  doc.text(formatCurrencyBRL(totalDespesasVariaveis), 111, 82);
  doc.setTextColor(239, 68, 68);
  doc.text(formatCurrencyBRL(totalDespesasVencidas), 158, 82);

  // Section: Alert Status
  doc.setTextColor(24, 24, 27);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Alertas e Vencimentos de Hoje:", 14, 96);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  if (totalVencemHoje > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text(`ATENÇÃO: Você tem ${vencemHoje.length} compromisso(s) vencendo hoje, totalizando ${formatCurrencyBRL(totalVencemHoje)}.`, 14, 102);
  } else {
    doc.setTextColor(16, 185, 129);
    doc.text("Excelente! Nenhuma despesa pendente vence no dia de hoje.", 14, 102);
  }

  // Section: Recent Transactions & Expenses
  doc.setTextColor(24, 24, 27);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Últimas Transações Registradas (Máx 5):", 14, 114);

  const txsSlice = transactions.slice(0, 5);
  const txsBody = txsSlice.length > 0
    ? txsSlice.map(t => [formatDateBR(t.data), t.tipo.toUpperCase(), t.nome, t.categoria, formatCurrencyBRL(t.valor)])
    : [["Nenhuma transação registrada.", "", "", "", ""]];

  autoTable(doc, {
    startY: 118,
    head: [["Data", "Tipo", "Nome", "Categoria", "Valor"]],
    body: txsBody,
    theme: "striped",
    headStyles: { fillColor: [63, 63, 70], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    didParseCell: (data) => {
      if (data.row.section === "body" && data.column.index === 1) {
        if (data.cell.text[0] === "ENTRADA") data.cell.styles.textColor = [16, 185, 129];
        if (data.cell.text[0] === "SAÍDA") data.cell.styles.textColor = [239, 68, 68];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setTextColor(24, 24, 27);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Compromissos Recentes (Máx 5):", 14, finalY);

  const expsSlice = expenses.slice(0, 5);
  const expsBody = expsSlice.length > 0
    ? expsSlice.map(e => [formatDateBR(e.dataVencimento || e.data), e.tipo.toUpperCase(), e.nome, e.categoria, formatCurrencyBRL(e.valor), e.status.toUpperCase()])
    : [["Nenhuma despesa registrada.", "", "", "", "", ""]];

  autoTable(doc, {
    startY: finalY + 4,
    head: [["Vencimento/Data", "Tipo", "Nome", "Categoria", "Valor", "Status"]],
    body: expsBody,
    theme: "striped",
    headStyles: { fillColor: [63, 63, 70], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    didParseCell: (data) => {
      if (data.row.section === "body" && data.column.index === 5) {
        if (data.cell.text[0] === "PAGO") data.cell.styles.textColor = [16, 185, 129];
        if (data.cell.text[0] === "PENDENTE") data.cell.styles.textColor = [239, 68, 68];
      }
    }
  });

  applyFooter(doc, userEmail);
  doc.save(`resumo_geral_${selectedMonth || "consolidado"}.pdf`);
}

export function exportReportsPDF(
  transactions: Transaction[], 
  expenses: Expense[], 
  period: string, 
  insights: string[], 
  userEmail: string
) {
  const doc = new jsPDF();
  applyStyles(doc, "Relatório Consolidado de BI Financeiro", `Análise de Métricas Inteligentes - ${period || "Geral"}`, userEmail);

  // Core BI Metrics
  const totalEntradas = transactions.filter((t) => t.tipo === "entrada").reduce((sum, t) => sum + t.valor, 0);
  const totalSaidas = transactions.filter((t) => t.tipo === "saida").reduce((sum, t) => sum + t.valor, 0);
  const totalDespesasGeral = expenses.reduce((sum, e) => sum + e.valor, 0);
  const custosTotais = totalSaidas + totalDespesasGeral;
  const lucroPrejuizo = totalEntradas - custosTotais;
  
  const margemLucro = totalEntradas > 0 ? (lucroPrejuizo / totalEntradas) * 100 : 0;

  // Render Metric blocks
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(14, 45, 55, 18, 2, 2, "F");
  doc.roundedRect(77, 45, 55, 18, 2, 2, "F");
  doc.roundedRect(140, 45, 55, 18, 2, 2, "F");

  doc.setFontSize(7.5);
  doc.setTextColor(113, 113, 122);
  doc.text("RECEITA BRUTA", 18, 50);
  doc.text("CUSTOS E DESPESAS", 81, 50);
  doc.text("RESULTADO LÍQUIDO", 144, 50);

  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(formatCurrencyBRL(totalEntradas), 18, 57);
  doc.setTextColor(239, 68, 68);
  doc.text(formatCurrencyBRL(custosTotais), 81, 57);
  if (lucroPrejuizo >= 0) {
    doc.setTextColor(16, 185, 129); // emerald-600
  } else {
    doc.setTextColor(239, 68, 68); // red-500
  }
  doc.text(formatCurrencyBRL(lucroPrejuizo), 144, 57);

  // Margin info
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(14, 68, 181, 12, 2, 2, "F");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 24, 27);
  doc.text(`MARGEM DE LUCRO LÍQUIDA: ${margemLucro.toFixed(2)}%`, 18, 76);

  // Analysis block
  doc.setTextColor(24, 24, 27);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Análise Inteligente (Insights de BI):", 14, 88);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(63, 63, 70);

  let currentY = 94;
  if (insights && insights.length > 0) {
    insights.forEach((insight) => {
      // split text to fit line width
      const splitLines = doc.splitTextToSize(`• ${insight}`, 180);
      splitLines.forEach((line: string) => {
        if (currentY < doc.internal.pageSize.height - 30) {
          doc.text(line, 14, currentY);
          currentY += 5;
        }
      });
      currentY += 2;
    });
  } else {
    doc.text("Não há insights suficientes gerados para o período analisado.", 14, currentY);
    currentY += 8;
  }

  // Categories Breakdown Table
  doc.setTextColor(24, 24, 27);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Distribuição de Custos por Categoria (Top 5 maiores):", 14, currentY + 4);

  // Group expenses by category
  const expensesGrouped: { [key: string]: number } = {};
  expenses.forEach((e) => {
    expensesGrouped[e.categoria] = (expensesGrouped[e.categoria] || 0) + e.valor;
  });
  transactions.filter(t => t.tipo === "saida").forEach(t => {
    expensesGrouped[t.categoria] = (expensesGrouped[t.categoria] || 0) + t.valor;
  });

  const sortedCategories = Object.entries(expensesGrouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const categoriesBody = sortedCategories.length > 0
    ? sortedCategories.map(([cat, val]) => [cat, formatCurrencyBRL(val)])
    : [["Nenhum custo registrado no período.", "R$ 0,00"]];

  autoTable(doc, {
    startY: currentY + 10,
    head: [["Categoria de Gasto", "Valor Consolidado"]],
    body: categoriesBody,
    theme: "striped",
    headStyles: { fillColor: [63, 63, 70], fontSize: 8 },
    bodyStyles: { fontSize: 8 }
  });

  applyFooter(doc, userEmail);
  doc.save(`relatorio_bi_${period || "geral"}.pdf`);
}

export function exportCardInvoicePDF(
  invoice: CardInvoice,
  items: CardItem[],
  card: CreditCard,
  userEmail: string
) {
  const doc = new jsPDF();
  applyStyles(doc, "Fatura de Cartão de Crédito", `Detalhamento Mensal - ${card.nome} (${invoice.competencia})`, userEmail);

  // Details
  doc.setTextColor(24, 24, 27);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Detalhes do Cartão & Fatura:", 14, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Cartão: ${card.nome} (•••• ${card.finalCartao})`, 14, 54);
  doc.text(`Banco: ${card.banco}`, 14, 60);
  doc.text(`Competência: ${invoice.competencia}`, 14, 66);

  const dueStr = invoice.dataVencimento ? formatDateBR(invoice.dataVencimento.toDate ? invoice.dataVencimento.toDate().toISOString() : String(invoice.dataVencimento)) : "-";
  doc.text(`Vencimento: ${dueStr}`, 110, 54);
  doc.text(`Status: ${invoice.status ? invoice.status.toUpperCase() : "ABERTA"}`, 110, 60);

  // Summary Cards
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(14, 74, 42, 16, 2, 2, "F");
  doc.roundedRect(61, 74, 42, 16, 2, 2, "F");
  doc.roundedRect(108, 74, 42, 16, 2, 2, "F");
  doc.roundedRect(155, 74, 42, 16, 2, 2, "F");

  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text("TOTAL FIXAS", 17, 79);
  doc.text("TOTAL VARIÁVEIS", 64, 79);
  doc.text("PAGOS/CRÉDITOS", 111, 79);
  doc.text("VALOR TOTAL FATURA", 158, 79);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(245, 158, 11);
  doc.text(formatCurrencyBRL(invoice.totalFixasCartao || 0), 17, 86);
  doc.setTextColor(59, 130, 246);
  doc.text(formatCurrencyBRL(invoice.totalVariaveisCartao || 0), 64, 86);
  doc.setTextColor(16, 185, 129);
  doc.text(formatCurrencyBRL((invoice.totalPagamentos || 0) + (invoice.totalCreditosEstornos || 0)), 111, 86);
  doc.setTextColor(239, 68, 68);
  doc.text(formatCurrencyBRL(invoice.valorTotal || 0), 158, 86);

  // Table Data
  const tableBody = items.length > 0
    ? items.map(item => [
        formatDateBR(item.dataCompra?.toDate ? item.dataCompra.toDate().toISOString() : String(item.dataCompra)),
        item.descricao,
        item.categoria,
        item.parcelaAtual ? `${item.parcelaAtual}/${item.totalParcelas}` : "1/1",
        item.classificacaoCartao === "fixa_cartao" ? "FIXA" : item.classificacaoCartao === "variavel_cartao" ? "VARIÁVEL" : item.classificacaoCartao ? item.classificacaoCartao.toUpperCase() : "VARIÁVEL",
        formatCurrencyBRL(item.valor)
      ])
    : [["Nenhum lançamento nesta competência.", "", "", "", "", ""]];

  autoTable(doc, {
    startY: 96,
    head: [["Data", "Descrição", "Categoria", "Parcela", "Classificação", "Valor"]],
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: [18, 18, 20],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold"
    },
    bodyStyles: {
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 60 },
      2: { cellWidth: 30 },
      3: { cellWidth: 15 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25, halign: "right" }
    }
  });

  applyFooter(doc, userEmail);
  doc.save(`fatura_${card.nome.replace(/\s+/g, "_")}_${invoice.competencia}.pdf`);
}
