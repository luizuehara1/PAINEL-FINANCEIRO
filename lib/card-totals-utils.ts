
export function parseCurrencyBR(value: string | number | null | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  
  let str = value.toString().trim();
  if (!str) return 0;

  // Remove R$, spaces, and other non-breaking spaces
  str = str.replace(/R\$\s*/gi, "").replace(/\s/g, "");

  // If there's both comma and dot, e.g. "1.019,50" or "-6.746,52"
  if (str.includes(",") && str.includes(".")) {
    // Check if the comma is after the dot (Brazilian format)
    if (str.indexOf(".") < str.indexOf(",")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // US format with comma as thousands separator (e.g. "1,019.50")
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    // Only comma: e.g. "24,00" -> replace with dot "24.00"
    str = str.replace(",", ".");
  } else if (str.includes(".")) {
    // Only dot: e.g. "1019.50" or "1.019".
    // Let's check if there are exactly 3 digits after the dot, e.g. "1.019" or "1.000".
    // If so, it might be a Brazilian thousands separator.
    const parts = str.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace(".", "");
    }
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export interface CardItem {
  id?: string;
  cartaoId: string;
  cartaoNome: string;
  banco: string;
  finalCartao: string;
  faturaId: string;
  dataCompra: Date;
  descricao: string;
  categoria: string;
  valor: number;
  valorOriginal: number;
  parcelaAtual: number;
  totalParcelas: number;
  parcelado: boolean;
  classificacaoCartao: string; // 'fixa_cartao', 'variavel_cartao', 'credito_estorno', 'pagamento_fatura'
  status: string;
  competencia: string;
  dataInicioCiclo: Date;
  dataFimCiclo: Date;
  dataVencimentoFatura: Date;
  importHash: string;
  origem: string;
  criadoEm: Date;
  atualizadoEm: Date;
  criadoPorEmail: string;
}

export function calculateCardTotals(items: CardItem[]) {
  let totalFixasCartao = 0;
  let totalVariaveisCartao = 0;
  let totalCreditosEstornos = 0;
  let totalPagamentos = 0;

  items.forEach(item => {
    const valor = item.valor || 0;
    switch (item.classificacaoCartao) {
      case 'fixa_cartao':
        totalFixasCartao += Math.abs(valor);
        break;
      case 'variavel_cartao':
        totalVariaveisCartao += Math.abs(valor);
        break;
      case 'credito_estorno':
        totalCreditosEstornos += Math.abs(valor);
        break;
      case 'pagamento_fatura':
        totalPagamentos += Math.abs(valor);
        break;
    }
  });

  const totalConsolidado = totalFixasCartao + totalVariaveisCartao - totalCreditosEstornos;

  return {
    totalFixasCartao,
    totalVariaveisCartao,
    totalCreditosEstornos,
    totalPagamentos,
    totalConsolidado
  };
}

export function filterCardItemsByCompetence(items: CardItem[], competence: string) {
  return items.filter(item => item.competencia === competence);
}
