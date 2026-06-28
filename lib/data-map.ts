/**
 * System Data Map representing sources, calculations, and rules for finance data tracking.
 */
export const FINANCE_DATA_MAP = {
  saldoAtual: {
    source: "financeiro/geral/bancos",
    calculation: "Soma de saldoAtual dos bancos ativos",
    filters: ["companyId"],
  },
  entradasSaidas: {
    source: "financeiro/geral/transacoes",
    filters: ["companyId", "competência/mês ou acumulado", "tipo: entrada | saida"],
  },
  despesasFixas: {
    source: "financeiro/geral/despesas",
    filters: ["companyId", "tipo: fixa", "competência/vencimento ou acumulado"],
  },
  despesasVariaveis: {
    source: "financeiro/geral/despesas",
    filters: ["companyId", "tipo: variavel", "competência/mês ou acumulado"],
  },
  cartoes: {
    source: "financeiro/geral/cartoes",
    filters: ["companyId"],
  },
  faturasCartao: {
    source: "financeiro/geral/faturasCartao",
    filters: ["companyId", "cartaoId", "competencia"],
  },
  itensCartao: {
    source: "financeiro/geral/itensCartao",
    filters: ["companyId", "cartaoId", "competencia"],
  },
  bancos: {
    source: "financeiro/geral/bancos",
    filters: ["companyId"],
  },
  investimentos: {
    source: "financeiro/geral/investimentos",
    filters: ["companyId"],
  },
  patrimonios: {
    source: "financeiro/geral/patrimonios",
    filters: ["companyId"],
  },
  imoveis: {
    source: "financeiro/geral/imoveis",
    filters: ["companyId"],
  },
  categorias: {
    source: [
      "financeiro/geral/categoriasEntrada",
      "financeiro/geral/categoriasSaida",
      "financeiro/geral/categoriasDespesasFixas",
      "financeiro/geral/categoriasDespesasVariaveis"
    ],
    filters: ["companyId"],
  },
  formasPagamento: {
    source: "financeiro/geral/formasPagamento",
    filters: ["companyId"],
  },
  notas: {
    source: "financeiro/geral/notas",
    filters: ["companyId"],
  }
};
