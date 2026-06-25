"use client";

import React, { useState, useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer as RespCont
} from "recharts";
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, Activity, AlertTriangle, 
  Layers, Percent, CheckCircle2, ShieldAlert, BarChart3, PieChart as PieIcon, LineChart as LineIcon, Info, Filter, RefreshCw, FileText
} from "lucide-react";
import { Transaction, Expense } from "@/types/finance";

interface ReportsSectionProps {
  transactions: Transaction[];
  expenses: Expense[];
  currentDateFormatted: string;
  userEmail?: string;
}

export default function ReportsSection({ transactions, expenses, currentDateFormatted, userEmail = "" }: ReportsSectionProps) {
  const todayStr = new Date().toISOString().split("T")[0];

  // Reports-specific filters
  const [reportMonth, setReportMonth] = useState(""); // YYYY-MM
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportType, setReportType] = useState<"todos" | "entradas" | "saidas" | "fixas" | "variaveis">("todos");
  const [reportPaymentMethod, setReportPaymentMethod] = useState("todos");
  const [reportCategory, setReportCategory] = useState("todas");
  const [reportImovel, setReportImovel] = useState("todos");

  const propertiesList = useMemo(() => {
    const list: { id: string; nome: string }[] = [];
    const seen = new Set<string>();
    expenses.forEach((e) => {
      if (e.imovelId && e.imovelNome && !seen.has(e.imovelId)) {
        seen.add(e.imovelId);
        list.push({ id: e.imovelId, nome: e.imovelNome });
      }
    });
    transactions.forEach((t) => {
      if (t.imovelId && t.imovelNome && !seen.has(t.imovelId)) {
        seen.add(t.imovelId);
        list.push({ id: t.imovelId, nome: t.imovelNome });
      }
    });
    return list.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [expenses, transactions]);

  const categoriesList = useMemo(() => {
    return Array.from(new Set([
      "Comissão", "Venda", "Serviço", "Aluguel", "Investimento", "Reembolso", 
      "Anúncios", "Software/SaaS", "Infraestrutura", "Consultoria", "Impostos", 
      "Internet", "Energia", "Água", "Sistema", "Funcionário", "Contabilidade", 
      "Seguros", "Combustível", "Alimentação", "Manutenção", "Compra avulsa", 
      "Taxas", "Viagem", "Eventos", "Outros"
    ])).sort();
  }, []);

  const paymentMethodsList = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Transferência", "Boleto", "Outros"];

  // Clear report filters
  const handleClearFilters = () => {
    setReportMonth("");
    setReportStartDate("");
    setReportEndDate("");
    setReportType("todos");
    setReportPaymentMethod("todos");
    setReportCategory("todas");
    setReportImovel("todos");
  };

  const handleLocalExportPDF = async () => {
    const { exportReportsPDF } = await import("@/lib/pdf-utils");
    exportReportsPDF(
      filteredTxs,
      filteredExps,
      reportMonth || (reportStartDate && reportEndDate ? `${reportStartDate} a ${reportEndDate}` : "Acumulado Geral"),
      analysisCards,
      userEmail
    );
  };

  // FILTERING LOGIC
  const filteredTxs = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Filter out if reportType dictates only expenses
      if (reportType === "fixas" || reportType === "variaveis") return false;
      if (reportType === "entradas" && t.tipo !== "entrada") return false;
      if (reportType === "saidas" && t.tipo !== "saida") return false;

      // Date/month filters
      if (reportMonth && !t.data.startsWith(reportMonth)) return false;
      if (reportStartDate && t.data < reportStartDate) return false;
      if (reportEndDate && t.data > reportEndDate) return false;

      // Payment method & Category filters
      if (reportPaymentMethod !== "todos" && t.formaPagamento !== reportPaymentMethod) return false;
      if (reportCategory !== "todas" && t.categoria !== reportCategory) return false;

      // Imóvel / Centro de Custo filter
      if (reportImovel !== "todos") {
        if (reportImovel === "sem_imovel") {
          if (t.imovelId) return false;
        } else {
          if (t.imovelId !== reportImovel) return false;
        }
      }

      return true;
    });
  }, [transactions, reportMonth, reportStartDate, reportEndDate, reportType, reportPaymentMethod, reportCategory, reportImovel]);

  const filteredExps = useMemo(() => {
    return expenses.filter((e) => {
      // 1. Filter out if reportType dictates only transactions
      if (reportType === "entradas" || reportType === "saidas") return false;
      if (reportType === "fixas" && e.tipo !== "fixa") return false;
      if (reportType === "variaveis" && e.tipo !== "variavel") return false;

      const dateStr = e.tipo === "fixa" ? e.dataVencimento : e.data;

      // Date/month filters
      if (reportMonth && !dateStr.startsWith(reportMonth)) return false;
      if (reportStartDate && dateStr < reportStartDate) return false;
      if (reportEndDate && dateStr > reportEndDate) return false;

      // Payment method & Category filters
      if (reportPaymentMethod !== "todos" && e.formaPagamento !== reportPaymentMethod) return false;
      if (reportCategory !== "todas" && e.categoria !== reportCategory) return false;

      // Imóvel / Centro de Custo filter
      if (reportImovel !== "todos") {
        if (reportImovel === "sem_imovel") {
          if (e.imovelId) return false;
        } else {
          if (e.imovelId !== reportImovel) return false;
        }
      }

      return true;
    });
  }, [expenses, reportMonth, reportStartDate, reportEndDate, reportType, reportPaymentMethod, reportCategory, reportImovel]);

  // CALCULATIONS (Based strictly on filtered dataset)
  const totalReceita = useMemo(() => {
    return filteredTxs
      .filter(t => t.tipo === "entrada")
      .reduce((sum, t) => sum + Math.abs(t.valor || 0), 0);
  }, [filteredTxs]);

  const totalSaidasTx = useMemo(() => {
    return filteredTxs
      .filter(t => t.tipo === "saida")
      .reduce((sum, t) => sum + Math.abs(t.valor || 0), 0);
  }, [filteredTxs]);

  const totalFixed = useMemo(() => {
    return filteredExps
      .filter(e => e.tipo === "fixa")
      .reduce((sum, e) => sum + e.valor, 0);
  }, [filteredExps]);

  const totalVariable = useMemo(() => {
    return filteredExps
      .filter(e => e.tipo === "variavel")
      .reduce((sum, e) => sum + e.valor, 0);
  }, [filteredExps]);

  const totalCustos = useMemo(() => {
    return totalSaidasTx + totalFixed + totalVariable;
  }, [totalSaidasTx, totalFixed, totalVariable]);

  const lucroPrejuizo = useMemo(() => {
    return totalReceita - totalCustos;
  }, [totalReceita, totalCustos]);

  const margemLucro = useMemo(() => {
    if (totalReceita <= 0) return 0;
    return (lucroPrejuizo / totalReceita) * 100;
  }, [lucroPrejuizo, totalReceita]);

  const totalPendente = useMemo(() => {
    return filteredExps
      .filter(e => e.status === "pendente")
      .reduce((sum, e) => sum + e.valor, 0);
  }, [filteredExps]);

  const totalPago = useMemo(() => {
    return filteredExps
      .filter(e => e.status === "pago")
      .reduce((sum, e) => sum + e.valor, 0);
  }, [filteredExps]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // GRAPH 1: Evolution (Timeline data grouped by Month or Day)
  const timelineData = useMemo(() => {
    const formatType = reportMonth ? "day" : "month";
    const groups: Record<string, { date: string, entradas: number, saidas: number, despesas: number, resultado: number }> = {};

    const getGroupKey = (dateStr: string) => {
      if (!dateStr) return "";
      const parts = dateStr.split("-");
      if (parts.length < 2) return dateStr;
      if (formatType === "day") {
        return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : dateStr;
      } else {
        return `${parts[1]}/${parts[0]}`;
      }
    };

    filteredTxs.forEach(t => {
      const key = getGroupKey(t.data);
      if (!key) return;
      if (!groups[key]) {
        groups[key] = { date: key, entradas: 0, saidas: 0, despesas: 0, resultado: 0 };
      }
      const val = Math.abs(t.valor || 0);
      if (t.tipo === "entrada") {
        groups[key].entradas += val;
      } else {
        groups[key].saidas += val;
      }
    });

    filteredExps.forEach(e => {
      const dateStr = e.tipo === "fixa" ? e.dataVencimento : e.data;
      const key = getGroupKey(dateStr);
      if (!key) return;
      if (!groups[key]) {
        groups[key] = { date: key, entradas: 0, saidas: 0, despesas: 0, resultado: 0 };
      }
      groups[key].despesas += e.valor;
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const [p1, p2] = a.split("/");
      const [q1, q2] = b.split("/");
      if (formatType === "day") {
        if (p2 !== q2) return p2.localeCompare(q2);
        return p1.localeCompare(q1);
      } else {
        // MM/YYYY
        if (p2 !== q2) return p2.localeCompare(q2);
        return p1.localeCompare(q1);
      }
    });

    return sortedKeys.map(key => {
      const item = groups[key];
      item.resultado = item.entradas - item.saidas - item.despesas;
      return item;
    });
  }, [filteredTxs, filteredExps, reportMonth]);

  // GRAPH 2: Comparison (Entradas x Saídas x Despesas Fixas x Despesas Variáveis)
  const comparisonData = useMemo(() => {
    return [
      { name: "Entradas", Valor: totalReceita, color: "#10b981" },
      { name: "Saídas", Valor: totalSaidasTx, color: "#ef4444" },
      { name: "Fixas", Valor: totalFixed, color: "#f59e0b" },
      { name: "Variáveis", Valor: totalVariable, color: "#3b82f6" }
    ];
  }, [totalReceita, totalSaidasTx, totalFixed, totalVariable]);

  // GRAPH 3: Category Distribution
  const categoryData = useMemo(() => {
    const catGroups: Record<string, number> = {};
    filteredTxs.filter(t => t.tipo === "saida").forEach(t => {
      catGroups[t.categoria] = (catGroups[t.categoria] || 0) + t.valor;
    });
    filteredExps.forEach(e => {
      catGroups[e.categoria] = (catGroups[e.categoria] || 0) + e.valor;
    });

    return Object.entries(catGroups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTxs, filteredExps]);

  const PIE_COLORS = ["#10b981", "#84cc16", "#06b6d4", "#3b82f6", "#f59e0b", "#6366f1", "#ec4899", "#a855f7", "#14b8a6", "#f43f5e"];

  // GRAPH 4: Top 5 Expenses
  const topExpensesData = useMemo(() => {
    const allExps = filteredExps.map(e => ({
      name: e.nome,
      valor: e.valor,
      categoria: e.categoria
    }));

    return allExps
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5)
      .map(e => ({
        name: e.name.length > 15 ? e.name.substring(0, 15) + "..." : e.name,
        Valor: e.valor,
        Categoria: e.categoria
      }));
  }, [filteredExps]);

  const propertyExpenses = useMemo(() => {
    const map: Record<string, { id: string; nome: string; total: number; count: number }> = {};
    
    // Initialize with all known properties so we display them even if they have R$ 0,00 spent!
    propertiesList.forEach((im) => {
      map[im.id] = { id: im.id, nome: im.nome, total: 0, count: 0 };
    });

    let semImovelTotal = 0;
    let semImovelCount = 0;

    filteredExps.forEach((e) => {
      if (e.status === "pago") {
        if (e.imovelId) {
          if (!map[e.imovelId]) {
            map[e.imovelId] = { id: e.imovelId, nome: e.imovelNome || "Desconhecido", total: 0, count: 0 };
          }
          map[e.imovelId].total += e.valor;
          map[e.imovelId].count += 1;
        } else {
          semImovelTotal += e.valor;
          semImovelCount += 1;
        }
      }
    });

    const list = Object.values(map);
    if (semImovelTotal > 0) {
      list.push({ id: "sem_imovel", nome: "Sem imóvel vinculado", total: semImovelTotal, count: semImovelCount });
    }

    return list.sort((a, b) => b.total - a.total);
  }, [propertiesList, filteredExps]);

  // ANALYSIS GENERATOR
  const analysisCards = useMemo(() => {
    const list: string[] = [];

    // 1. Entradas x Custos
    if (totalReceita > totalCustos) {
      list.push(`Suas entradas foram maiores que suas saídas e despesas neste período, resultando em superávit de ${formatCurrency(lucroPrejuizo)}.`);
    } else if (totalReceita < totalCustos) {
      list.push(`As saídas e despesas superaram suas entradas neste período. Recomendamos identificar gargalos ou reduzir custos de marketing e infraestrutura.`);
    } else {
      list.push(`Seu fluxo de caixa atingiu o ponto de equilíbrio perfeito neste período (R$ 0,00 de saldo líquido).`);
    }

    // 2. Fixed ratio
    if (totalCustos > 0) {
      const fixedRatio = (totalFixed / totalCustos) * 100;
      list.push(`As despesas fixas representam ${fixedRatio.toFixed(1)}% de todos os seus custos totais do período analisado.`);
    }

    // 3. Top category
    if (categoryData.length > 0) {
      const topCat = categoryData[0];
      list.push(`A categoria com maior consumo de capital foi "${topCat.name}" acumulando ${formatCurrency(topCat.value)}.`);
    }

    // 4. Overdue expenses
    const overdueCount = filteredExps.filter(e => e.status !== "pago" && e.tipo === "fixa" && e.dataVencimento < todayStr).length;
    if (overdueCount > 0) {
      list.push(`Atenção crítica: Existem ${overdueCount} despesas fixas vencidas no período analisado.`);
    } else {
      list.push(`Excelente! Nenhuma despesa fixa está vencida no período selecionado.`);
    }

    // 5. Final state
    if (lucroPrejuizo >= 0) {
      list.push(`Seu resultado final consolidado para o filtro atual foi positivo em ${formatCurrency(lucroPrejuizo)} (Margem de ${margemLucro.toFixed(1)}%).`);
    } else {
      list.push(`Seu resultado final consolidado para o filtro atual foi negativo em ${formatCurrency(Math.abs(lucroPrejuizo))}.`);
    }

    return list;
  }, [totalReceita, totalCustos, totalFixed, categoryData, filteredExps, todayStr, lucroPrejuizo, margemLucro]);

  const hasData = timelineData.length > 0 || comparisonData.some(c => c.Valor > 0);

  return (
    <div className="space-y-6">
      
      {/* FILTER SHEET */}
      <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/20 via-lime-400/20 to-transparent" />
        
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Filtros Inteligentes: Relatório de BI</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              id="btn-bi-exportar-pdf"
              onClick={handleLocalExportPDF}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-zinc-300 hover:text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/50 rounded-lg bg-zinc-900/60 transition-all cursor-pointer font-semibold uppercase tracking-wider"
            >
              <FileText className="w-3 h-3 text-emerald-400" />
              Exportar PDF
            </button>
            <button 
              id="btn-bi-resetar-filtros"
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-zinc-400 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/20 rounded-lg bg-zinc-900/60 transition-all cursor-pointer font-semibold uppercase tracking-wider"
            >
              <RefreshCw className="w-3 h-3" />
              Resetar Filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Ciclo / Mês</label>
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer font-mono"
            >
              <option value="">Todos (Acumulado)</option>
              <option value="2026-06">Junho / 2026</option>
              <option value="2026-05">Maio / 2026</option>
              <option value="2026-04">Abril / 2026</option>
              <option value="2026-03">Março / 2026</option>
              <option value="2026-02">Fevereiro / 2026</option>
              <option value="2026-01">Janeiro / 2026</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Data Inicial</label>
            <input
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Data Final</label>
            <input
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Foco do Tipo</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
            >
              <option value="todos">Todos os Registros</option>
              <option value="entradas">Apenas Entradas</option>
              <option value="saidas">Apenas Saídas</option>
              <option value="fixas">Apenas Despesas Fixas</option>
              <option value="variaveis">Apenas Despesas Variáveis</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Categoria</label>
            <select
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
            >
              <option value="todas">Todas as Categorias</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Meio de Pagamento</label>
            <select
              value={reportPaymentMethod}
              onChange={(e) => setReportPaymentMethod(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
            >
              <option value="todos">Todos os Meios</option>
              {paymentMethodsList.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-bold">Imóvel / Centro</label>
            <select
              value={reportImovel}
              onChange={(e) => setReportImovel(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer font-sans"
            >
              <option value="todos">Todos os imóveis</option>
              <option value="sem_imovel">Sem imóvel vinculado</option>
              {propertiesList.map((im) => (
                <option key={im.id} value={im.id}>{im.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* REPORT SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="rounded-2xl bg-zinc-900/30 border border-white/5 p-4 flex flex-col justify-between hover:border-emerald-500/10 transition-all">
          <div>
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Receita Total</span>
            <h2 className="text-xl font-black text-emerald-400 font-mono leading-none">
              {formatCurrency(totalReceita)}
            </h2>
          </div>
          <p className="text-zinc-600 text-[9px] mt-2">Soma de entradas filtradas</p>
        </div>

        <div className="rounded-2xl bg-zinc-900/30 border border-white/5 p-4 flex flex-col justify-between hover:border-red-500/10 transition-all">
          <div>
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Custos Totais</span>
            <h2 className="text-xl font-black text-red-400 font-mono leading-none">
              {formatCurrency(totalCustos)}
            </h2>
          </div>
          <p className="text-zinc-600 text-[9px] mt-2">Saídas + Fixas + Variáveis</p>
        </div>

        <div className="rounded-2xl bg-zinc-900/30 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
          <div>
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Lucro / Prejuízo</span>
            <h2 className={`text-xl font-black font-mono leading-none ${lucroPrejuizo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(lucroPrejuizo)}
            </h2>
          </div>
          <p className="text-zinc-600 text-[9px] mt-2">Saldo líquido do período</p>
        </div>

        <div className="rounded-2xl bg-zinc-900/30 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
          <div>
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Margem de Lucro</span>
            <h2 className={`text-xl font-black font-mono leading-none ${margemLucro >= 0 ? "text-lime-400" : "text-red-400"}`}>
              {margemLucro.toFixed(1)}%
            </h2>
          </div>
          <p className="text-zinc-600 text-[9px] mt-2">Retorno líquido operacional</p>
        </div>

        <div className="rounded-2xl bg-zinc-900/30 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
          <div>
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Total Pago</span>
            <h2 className="text-xl font-black text-emerald-400 font-mono leading-none">
              {formatCurrency(totalPago)}
            </h2>
          </div>
          <p className="text-zinc-600 text-[9px] mt-2">Despesas quitadas</p>
        </div>

        <div className="rounded-2xl bg-zinc-900/30 border border-white/5 p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
          <div>
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Total Pendente</span>
            <h2 className="text-xl font-black text-amber-500 font-mono leading-none">
              {formatCurrency(totalPendente)}
            </h2>
          </div>
          <p className="text-zinc-600 text-[9px] mt-2">Despesas em aberto</p>
        </div>
      </div>

      {/* DETAILED CHARTS SHEET */}
      {!hasData ? (
        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-3xl bg-zinc-950/20 max-w-full overflow-hidden">
          <BarChart3 className="w-12 h-12 text-zinc-700 mx-auto mb-4 animate-pulse" />
          <p className="text-zinc-400 font-semibold text-sm">Nenhum dado encontrado para este período.</p>
          <p className="text-zinc-600 text-xs mt-1">Insira registros adicionais ou tente alterar as configurações de filtros para atualizar os gráficos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Evolution (Line) */}
          <div className="bg-zinc-950 border border-white/5 p-6 rounded-2xl relative overflow-hidden flex flex-col h-[400px]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/10 to-transparent" />
            <div className="flex items-center gap-2 mb-4">
              <LineIcon className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Evolução do Saldo (Entradas x Saídas x Despesas)</h4>
            </div>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={10} tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px" }}
                    itemStyle={{ fontSize: "11px" }}
                    labelStyle={{ color: "#a1a1aa", fontSize: "11px", fontWeight: "bold" }}
                    formatter={(v: any) => [formatCurrency(Number(v)), ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px", color: "#a1a1aa" }} />
                  <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="resultado" name="Líquido" stroke="#3b82f6" strokeWidth={2.5} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Bars comparison */}
          <div className="bg-zinc-950 border border-white/5 p-6 rounded-2xl relative overflow-hidden flex flex-col h-[400px]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/10 to-transparent" />
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-lime-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Comparativo Geral de Fluxo</h4>
            </div>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={10} tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip 
                    cursor={{ fill: "#ffffff03" }}
                    contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px" }}
                    itemStyle={{ fontSize: "11px" }}
                    formatter={(v: any) => [formatCurrency(Number(v)), "Valor Total"]}
                  />
                  <Bar dataKey="Valor" radius={[8, 8, 0, 0]}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Donut categories distribution */}
          <div className="bg-zinc-950 border border-white/5 p-6 rounded-2xl relative overflow-hidden flex flex-col h-[400px]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/10 to-transparent" />
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Custos por Categoria (Despesas + Saídas)</h4>
            </div>
            <div className="flex-1 w-full min-h-0 flex flex-col sm:flex-row items-center gap-4">
              {categoryData.length === 0 ? (
                <p className="text-xs text-zinc-500 italic mx-auto">Nenhuma saída registrada.</p>
              ) : (
                <>
                  <div className="flex-1 w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px" }}
                          itemStyle={{ fontSize: "11px" }}
                          formatter={(v: any) => [formatCurrency(Number(v)), "Custos"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="w-full sm:w-48 overflow-y-auto max-h-[220px] text-left pr-2 space-y-2.5 custom-scrollbar">
                    {categoryData.slice(0, 5).map((cat, idx) => (
                      <div key={cat.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span className="text-zinc-400 truncate flex-1 font-medium">{cat.name}</span>
                        <span className="text-white font-mono font-bold shrink-0">{formatCurrency(cat.value)}</span>
                      </div>
                    ))}
                    {categoryData.length > 5 && (
                      <p className="text-[10px] text-zinc-500 text-center italic">+ {categoryData.length - 5} outras categorias</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chart 4: Top 5 Highest Expenses (Horizontal Bars) */}
          <div className="bg-zinc-950 border border-white/5 p-6 rounded-2xl relative overflow-hidden flex flex-col h-[400px]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/10 to-transparent" />
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-orange-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Top 5 Maiores Despesas do Período</h4>
            </div>
            <div className="flex-1 w-full min-h-0 flex flex-col justify-center">
              {topExpensesData.length === 0 ? (
                <p className="text-xs text-zinc-500 italic mx-auto">Nenhuma despesa localizada no filtro.</p>
              ) : (
                <div className="space-y-4">
                  {topExpensesData.map((item, idx) => {
                    const maxVal = topExpensesData[0]?.Valor || 1;
                    const widthPct = `${Math.max(5, Math.min(100, Math.round((item.Valor / maxVal) * 100)))}%`;
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-500 font-mono">#{idx+1}</span>
                            <span className="text-zinc-300 font-medium">{item.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-zinc-900 border border-white/5 text-zinc-500">{item.Categoria}</span>
                          </div>
                          <span className="text-white font-mono font-bold">{formatCurrency(item.Valor)}</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden relative">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500" 
                            style={{ width: widthPct }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Card de Gastos por Imóvel / Centro de Custo */}
          <div className="bg-zinc-950 border border-white/5 p-6 rounded-2xl relative overflow-hidden flex flex-col col-span-1 lg:col-span-2">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/15 to-transparent" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Gastos Consolidados por Imóvel (Despesas Pagas)</h4>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono font-medium">Soma de Fixas + Variáveis</span>
            </div>
            
            {propertyExpenses.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-6 text-center">Nenhum gasto associado a imóvel localizado no período.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {propertyExpenses.map((p) => {
                  const maxTotal = Math.max(...propertyExpenses.map(x => x.total)) || 1;
                  const pct = Math.round((p.total / maxTotal) * 100);
                  return (
                    <div key={p.id} className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 flex flex-col justify-between hover:border-emerald-500/15 transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-white truncate max-w-[150px]">{p.nome}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/5">
                            {p.count} {p.count === 1 ? "lançamento" : "lançamentos"}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-emerald-400 font-mono">{formatCurrency(p.total)}</h3>
                      </div>
                      
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                          <span>Relevância</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* INTELLIGENT ANALYSIS BLOCK */}
      <div className="p-6 border border-white/5 rounded-2xl bg-zinc-950 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/30 to-lime-500/30" />
        
        <div className="flex items-center gap-2.5 border-b border-white/5 pb-4 mb-4">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Análise Inteligente do Período</h4>
            <p className="text-[10px] text-zinc-500">Business Intelligence acoplado ao seu fluxo de caixa consolidado.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analysisCards.map((text, i) => (
            <div key={i} className="bg-zinc-900/30 border border-white/5 rounded-xl p-4 flex gap-3 hover:bg-zinc-900/50 transition-all">
              <span className="text-[11px] font-bold text-emerald-400 font-mono mt-0.5 shrink-0 bg-emerald-500/10 w-5 h-5 rounded-md flex items-center justify-center">
                {i+1}
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
